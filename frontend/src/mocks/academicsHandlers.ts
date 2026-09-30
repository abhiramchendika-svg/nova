import { http, HttpResponse, type HttpHandler } from 'msw';
import type {
  AssignmentPriority,
  AssignmentRequest,
  AssignmentStatus,
  AttendanceMark,
  CourseRequest,
  ExamRequest,
  GradeKind,
  GradeOverride,
  GradingScheme,
  SchemeRequest,
  Semester,
  SemesterRequest,
} from '@/features/academics/types';
import {
  findGrade,
  summarize,
  toCourse,
  visibleSchemes,
  type AcademicStore,
  type StoredCourse,
} from './academics';
import { courseAttendance, todayIn, type StoredRecord } from './attendance';
import {
  applyProgress,
  assignmentProblem,
  examProblem,
  orderedTopics,
  renumber,
  toExamDetail,
  isOpen,
  normalizeLink,
  removeCourseWork,
  toAssignment,
  toExamSummary,
  type StoredAssignment,
  type StoredExam,
  type StoredResource,
} from './coursework';
import type { SettingsRequest } from '@/features/settings/types';
import { API, csrfOk, problem } from './http';

/**
 * Mock academics API (docs/api.md §2.2–2.4): the same routes, status codes and error shapes as
 * the Spring Boot controllers, backed by an in-memory store per user.
 */

type StoreFor = () => AcademicStore | null;

function invalid(field: string, message: string) {
  return problem(400, 'VALIDATION_FAILED', 'Some fields need attention', { errors: [{ field, message }] });
}

const notFound = () => problem(404, 'NOT_FOUND', 'We couldn’t find that');

/** Runs a handler with the user's store, enforcing login (and CSRF for writes). */
function withStore(
  storeFor: StoreFor,
  handler: (
    store: AcademicStore,
    request: Request,
    params: Record<string, string>,
  ) => Response | Promise<Response>,
) {
  return async ({
    request,
    params,
  }: {
    request: Request;
    params: Record<string, string | readonly string[] | undefined>;
  }) => {
    const store = storeFor();
    if (!store) return problem(401, 'UNAUTHENTICATED', 'Log in to continue');
    if (request.method !== 'GET' && !csrfOk(request))
      return problem(403, 'CSRF_INVALID', 'Invalid CSRF token');
    return handler(store, request, params as Record<string, string>);
  };
}

const blankToNull = (v: string | null | undefined) => (v && v.trim() ? v.trim() : null);

// ───────────── validation mirrors of the backend rules ─────────────

function validateScheme(body: SchemeRequest, knownIds: Set<string>): Response | null {
  if (!body.name?.trim()) return invalid('name', 'Give the scheme a name.');
  if (!(body.maxPoints > 0) || body.maxPoints >= 100)
    return invalid('maxPoints', 'Must be between 0 and 100.');
  if (!body.grades?.length || body.grades.length > 20)
    return invalid('grades', 'Use between 1 and 20 grades.');
  const labels = new Set<string>();
  const ids = new Set<string>();
  for (const [i, g] of body.grades.entries()) {
    const label = g.label?.trim() ?? '';
    if (!label) return invalid(`grades[${i}].label`, 'Give the grade a label.');
    if (labels.has(label.toUpperCase()))
      return invalid(`grades[${i}].label`, 'Each grade needs a different label.');
    labels.add(label.toUpperCase());
    if (!(g.points >= 0)) return invalid(`grades[${i}].points`, 'Can’t be negative.');
    if (g.points > body.maxPoints) {
      return invalid(`grades[${i}].points`, `Can’t be more than the maximum of ${body.maxPoints}.`);
    }
    if (g.id && knownIds.size > 0 && (!knownIds.has(g.id) || ids.has(g.id))) {
      return invalid(`grades[${i}].id`, 'That grade isn’t part of this scheme.');
    }
    if (g.id) ids.add(g.id);
  }
  if (!body.grades.some((g) => g.passing)) return invalid('grades', 'Mark at least one grade as passing.');
  return null;
}

function validateSemester(store: AcademicStore, body: SemesterRequest, selfId?: string): Response | null {
  if (!body.name?.trim()) return invalid('name', 'Give the semester a name.');
  if (!Number.isInteger(body.ordinal) || body.ordinal < 1 || body.ordinal > 20) {
    return invalid('ordinal', 'Must be between 1 and 20.');
  }
  if (store.semesters.some((s) => s.ordinal === body.ordinal && s.id !== selfId)) {
    return invalid('ordinal', 'You already have a semester with this number.');
  }
  if (!visibleSchemes(store).some((s) => s.id === body.gradingSchemeId)) {
    return invalid('gradingSchemeId', 'Choose one of your grading schemes.');
  }
  if (body.startsOn && body.endsOn && body.endsOn < body.startsOn) {
    return invalid('endsOn', 'The end date can’t be before the start date.');
  }
  return null;
}

function validateCourse(store: AcademicStore, body: CourseRequest): Response | null {
  if (!store.semesters.some((s) => s.id === body.semesterId)) {
    return invalid('semesterId', 'Choose one of your semesters.');
  }
  if (!body.name?.trim()) return invalid('name', 'Give the course a name.');
  if (typeof body.credits !== 'number' || body.credits < 0 || body.credits > 99.9) {
    return invalid('credits', 'Must be between 0 and 99.9.');
  }
  if (Math.round(body.credits * 10) !== body.credits * 10)
    return invalid('credits', 'Use at most 1 decimal place.');
  return null;
}

function schemeSummary(scheme: GradingScheme) {
  return { id: scheme.id, name: scheme.name, maxPoints: scheme.maxPoints };
}

function setCurrent(store: AcademicStore, id: string) {
  for (const s of store.semesters) s.current = s.id === id;
}

// ───────────── handlers ─────────────

export function createAcademicsHandlers(
  storeFor: StoreFor,
  settingsFor: () => SettingsRequest,
): HttpHandler[] {
  return [
    // Grading schemes
    http.get(
      `${API}/grading-schemes`,
      withStore(storeFor, (store) => HttpResponse.json(visibleSchemes(store))),
    ),

    http.post(
      `${API}/grading-schemes`,
      withStore(storeFor, async (store, request) => {
        const body = (await request.json()) as SchemeRequest;
        const error = validateScheme(body, new Set());
        if (error) return error;
        const scheme: GradingScheme = {
          id: crypto.randomUUID(),
          name: body.name.trim(),
          maxPoints: body.maxPoints,
          builtIn: false,
          grades: body.grades.map((g) => ({ ...g, id: crypto.randomUUID(), label: g.label.trim() })),
        };
        store.schemes.push(scheme);
        return HttpResponse.json(scheme, { status: 201 });
      }),
    ),

    http.post(
      `${API}/grading-schemes/:id/clone`,
      withStore(storeFor, (store, _request, params) => {
        const source = visibleSchemes(store).find((s) => s.id === params.id);
        if (!source) return notFound();
        const copy: GradingScheme = {
          id: crypto.randomUUID(),
          name: `${source.name.slice(0, 53).trim()} (copy)`,
          maxPoints: source.maxPoints,
          builtIn: false,
          grades: source.grades.map((g) => ({ ...g, id: crypto.randomUUID() })),
        };
        store.schemes.push(copy);
        return HttpResponse.json(copy, { status: 201 });
      }),
    ),

    http.put(
      `${API}/grading-schemes/:id`,
      withStore(storeFor, async (store, request, params) => {
        const scheme = store.schemes.find((s) => s.id === params.id);
        if (!scheme) return notFound();
        const body = (await request.json()) as SchemeRequest;
        const error = validateScheme(body, new Set(scheme.grades.map((g) => g.id)));
        if (error) return error;
        const kept = new Set(body.grades.map((g) => g.id).filter(Boolean));
        const removedInUse = scheme.grades
          .filter((g) => !kept.has(g.id))
          .filter((g) => store.courses.some((c) => c.gradeDefinitionId === g.id))
          .map((g) => g.label);
        if (removedInUse.length) {
          return problem(
            409,
            'CONFLICT',
            `Courses are still graded ${removedInUse.sort().join(', ')}. Change those grades before removing them from the scheme.`,
          );
        }
        scheme.name = body.name.trim();
        scheme.maxPoints = body.maxPoints;
        scheme.grades = body.grades.map((g) => ({
          id: g.id ?? crypto.randomUUID(),
          label: g.label.trim(),
          points: g.points,
          passing: g.passing,
          countsInGpa: g.countsInGpa,
        }));
        for (const s of store.semesters) {
          if (s.gradingScheme.id === scheme.id) s.gradingScheme = schemeSummary(scheme);
        }
        return HttpResponse.json(scheme);
      }),
    ),

    http.delete(
      `${API}/grading-schemes/:id`,
      withStore(storeFor, (store, _request, params) => {
        const index = store.schemes.findIndex((s) => s.id === params.id);
        if (index < 0) return notFound();
        if (store.semesters.some((s) => s.gradingScheme.id === params.id)) {
          return problem(
            409,
            'CONFLICT',
            'A semester uses this grading scheme. Switch that semester to another scheme first.',
          );
        }
        store.schemes.splice(index, 1);
        return new HttpResponse(null, { status: 204 });
      }),
    ),

    // Semesters
    http.get(
      `${API}/semesters`,
      withStore(storeFor, (store) =>
        HttpResponse.json([...store.semesters].sort((a, b) => a.ordinal - b.ordinal)),
      ),
    ),

    http.get(
      `${API}/semesters/:id`,
      withStore(storeFor, (store, _request, params) => {
        const semester = store.semesters.find((s) => s.id === params.id);
        return semester ? HttpResponse.json(semester) : notFound();
      }),
    ),

    http.post(
      `${API}/semesters`,
      withStore(storeFor, async (store, request) => {
        const body = (await request.json()) as SemesterRequest;
        const error = validateSemester(store, body);
        if (error) return error;
        const scheme = visibleSchemes(store).find((s) => s.id === body.gradingSchemeId)!;
        const semester: Semester = {
          id: crypto.randomUUID(),
          name: body.name.trim(),
          ordinal: body.ordinal,
          startsOn: body.startsOn,
          endsOn: body.endsOn,
          current: false,
          attendanceTarget: body.attendanceTarget,
          gradingScheme: schemeSummary(scheme),
        };
        store.semesters.push(semester);
        if (body.current) setCurrent(store, semester.id);
        return HttpResponse.json(semester, { status: 201 });
      }),
    ),

    http.put(
      `${API}/semesters/:id`,
      withStore(storeFor, async (store, request, params) => {
        const semester = store.semesters.find((s) => s.id === params.id);
        if (!semester) return notFound();
        const body = (await request.json()) as SemesterRequest;
        const error = validateSemester(store, body, semester.id);
        if (error) return error;
        const graded = store.courses.some((c) => c.semesterId === semester.id && c.gradeDefinitionId);
        if (body.gradingSchemeId !== semester.gradingScheme.id && graded) {
          const message =
            'Some courses in this semester have grades. Clear them before switching the grading scheme.';
          return problem(422, 'RULE_VIOLATION', message, { errors: [{ field: 'gradingSchemeId', message }] });
        }
        const scheme = visibleSchemes(store).find((s) => s.id === body.gradingSchemeId)!;
        Object.assign(semester, {
          name: body.name.trim(),
          ordinal: body.ordinal,
          startsOn: body.startsOn,
          endsOn: body.endsOn,
          attendanceTarget: body.attendanceTarget,
          gradingScheme: schemeSummary(scheme),
        });
        if (body.current) setCurrent(store, semester.id);
        else semester.current = false;
        return HttpResponse.json(semester);
      }),
    ),

    http.post(
      `${API}/semesters/:id/make-current`,
      withStore(storeFor, (store, _request, params) => {
        const semester = store.semesters.find((s) => s.id === params.id);
        if (!semester) return notFound();
        setCurrent(store, semester.id);
        return HttpResponse.json(semester);
      }),
    ),

    http.delete(
      `${API}/semesters/:id`,
      withStore(storeFor, (store, _request, params) => {
        const index = store.semesters.findIndex((s) => s.id === params.id);
        if (index < 0) return notFound();
        store.semesters.splice(index, 1);
        const gone = new Set(store.courses.filter((c) => c.semesterId === params.id).map((c) => c.id));
        store.courses = store.courses.filter((c) => !gone.has(c.id));
        removeCourseWork(store, gone);
        return new HttpResponse(null, { status: 204 });
      }),
    ),

    // Courses
    http.get(
      `${API}/courses`,
      withStore(storeFor, (store, request) => {
        const semesterId = new URL(request.url).searchParams.get('semesterId');
        const semester = semesterId
          ? store.semesters.find((s) => s.id === semesterId)
          : store.semesters.find((s) => s.current);
        if (semesterId && !semester) return notFound();
        if (!semester) return HttpResponse.json([]);
        const courses = store.courses
          .filter((c) => c.semesterId === semester.id)
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((c) => toCourse(store, c));
        return HttpResponse.json(courses);
      }),
    ),

    http.get(
      `${API}/courses/:id`,
      withStore(storeFor, (store, _request, params) => {
        const course = store.courses.find((c) => c.id === params.id);
        return course ? HttpResponse.json(toCourse(store, course)) : notFound();
      }),
    ),

    http.post(
      `${API}/courses`,
      withStore(storeFor, async (store, request) => {
        const body = (await request.json()) as CourseRequest;
        const error = validateCourse(store, body);
        if (error) return error;
        const course: StoredCourse = {
          id: crypto.randomUUID(),
          semesterId: body.semesterId,
          code: blankToNull(body.code),
          name: body.name.trim(),
          credits: body.credits,
          faculty: blankToNull(body.faculty),
          colorHue: body.colorHue,
          notes: blankToNull(body.notes),
          attendanceTarget: body.attendanceTarget,
          gradeDefinitionId: null,
          gradeKind: null,
          baselineConducted: 0,
          baselineAttended: 0,
        };
        store.courses.push(course);
        return HttpResponse.json(toCourse(store, course), { status: 201 });
      }),
    ),

    http.put(
      `${API}/courses/:id`,
      withStore(storeFor, async (store, request, params) => {
        const course = store.courses.find((c) => c.id === params.id);
        if (!course) return notFound();
        const body = (await request.json()) as CourseRequest;
        const error = validateCourse(store, body);
        if (error) return error;
        if (body.semesterId !== course.semesterId && course.gradeDefinitionId) {
          const from = store.semesters.find((s) => s.id === course.semesterId)!;
          const to = store.semesters.find((s) => s.id === body.semesterId)!;
          if (from.gradingScheme.id !== to.gradingScheme.id) {
            const message =
              'This course’s grade comes from another grading scheme. Clear the grade before moving it.';
            return problem(422, 'RULE_VIOLATION', message, { errors: [{ field: 'semesterId', message }] });
          }
        }
        Object.assign(course, {
          semesterId: body.semesterId,
          code: blankToNull(body.code),
          name: body.name.trim(),
          credits: body.credits,
          faculty: blankToNull(body.faculty),
          colorHue: body.colorHue,
          notes: blankToNull(body.notes),
          attendanceTarget: body.attendanceTarget,
        });
        return HttpResponse.json(toCourse(store, course));
      }),
    ),

    http.delete(
      `${API}/courses/:id`,
      withStore(storeFor, (store, _request, params) => {
        const index = store.courses.findIndex((c) => c.id === params.id);
        if (index < 0) return notFound();
        const [removed] = store.courses.splice(index, 1);
        removeCourseWork(store, new Set([removed!.id]));
        return new HttpResponse(null, { status: 204 });
      }),
    ),

    http.put(
      `${API}/courses/:id/grade`,
      withStore(storeFor, async (store, request, params) => {
        const course = store.courses.find((c) => c.id === params.id);
        if (!course) return notFound();
        const body = (await request.json()) as { gradeDefinitionId?: string; kind?: GradeKind };
        if (!body.kind) return invalid('kind', 'Say whether the grade is final or expected.');
        const semester = store.semesters.find((s) => s.id === course.semesterId)!;
        const scheme = visibleSchemes(store).find((s) => s.id === semester.gradingScheme.id);
        if (!scheme?.grades.some((g) => g.id === body.gradeDefinitionId)) {
          return invalid('gradeDefinitionId', 'Choose a grade from this semester’s grading scheme.');
        }
        course.gradeDefinitionId = body.gradeDefinitionId ?? null;
        course.gradeKind = body.kind;
        return HttpResponse.json(toCourse(store, course));
      }),
    ),

    http.delete(
      `${API}/courses/:id/grade`,
      withStore(storeFor, (store, _request, params) => {
        const course = store.courses.find((c) => c.id === params.id);
        if (!course) return notFound();
        course.gradeDefinitionId = null;
        course.gradeKind = null;
        return new HttpResponse(null, { status: 204 });
      }),
    ),

    // Grades
    http.get(
      `${API}/grades/summary`,
      withStore(storeFor, (store) => HttpResponse.json(summarize(store))),
    ),

    http.post(
      `${API}/grades/what-if`,
      withStore(storeFor, async (store, request) => {
        const body = (await request.json()) as { overrides?: GradeOverride[] };
        const overrides = new Map<string, string>();
        for (const [i, o] of (body.overrides ?? []).entries()) {
          const course = store.courses.find((c) => c.id === o.courseId);
          if (!course || overrides.has(o.courseId)) {
            return invalid(`overrides[${i}].courseId`, 'Choose one of your courses.');
          }
          const semester = store.semesters.find((s) => s.id === course.semesterId)!;
          const scheme = visibleSchemes(store).find((s) => s.id === semester.gradingScheme.id);
          if (
            !findGrade(store, o.gradeDefinitionId) ||
            !scheme?.grades.some((g) => g.id === o.gradeDefinitionId)
          ) {
            return invalid(
              `overrides[${i}].gradeDefinitionId`,
              'Choose a grade from that course’s grading scheme.',
            );
          }
          overrides.set(o.courseId, o.gradeDefinitionId);
        }
        return HttpResponse.json(summarize(store, overrides));
      }),
    ),

    // Attendance (docs/api.md §2.5)
    http.get(
      `${API}/attendance`,
      withStore(storeFor, (store, request) => {
        const semesterId = new URL(request.url).searchParams.get('semesterId');
        const semester = semesterId
          ? store.semesters.find((s) => s.id === semesterId)
          : store.semesters.find((s) => s.current);
        if (semesterId && !semester) return notFound();
        if (!semester) return HttpResponse.json([]);
        const target = settingsFor().defaultAttendanceTarget;
        return HttpResponse.json(
          store.courses
            .filter((c) => c.semesterId === semester.id)
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((c) => courseAttendance(store, c, target)),
        );
      }),
    ),

    http.get(
      `${API}/courses/:id/attendance`,
      withStore(storeFor, (store, _request, params) => {
        const course = store.courses.find((c) => c.id === params.id);
        if (!course) return notFound();
        return HttpResponse.json(courseAttendance(store, course, settingsFor().defaultAttendanceTarget));
      }),
    ),

    http.get(
      `${API}/courses/:id/attendance/records`,
      withStore(storeFor, (store, request, params) => {
        if (!store.courses.some((c) => c.id === params.id)) return notFound();
        const url = new URL(request.url);
        const page = Number(url.searchParams.get('page') ?? '0');
        const size = Number(url.searchParams.get('size') ?? '20');
        if (!(size >= 1 && size <= 100)) return invalid('size', 'Must be between 1 and 100.');
        const all = store.records
          .filter((r) => r.courseId === params.id)
          .sort((a, b) => b.heldOn.localeCompare(a.heldOn) || b.slot - a.slot || b.createdAt - a.createdAt);
        return HttpResponse.json({
          items: all.slice(page * size, page * size + size).map(({ createdAt: _c, ...r }) => r),
          page,
          size,
          totalItems: all.length,
          totalPages: Math.ceil(all.length / size),
        });
      }),
    ),

    http.post(
      `${API}/courses/:id/attendance/records`,
      withStore(storeFor, async (store, request, params) => {
        const course = store.courses.find((c) => c.id === params.id);
        if (!course) return notFound();
        const body = (await request.json()) as { heldOn?: string; slot?: number; status?: AttendanceMark };
        const slot = body.slot ?? 1;
        if (!body.heldOn) return invalid('heldOn', 'Choose the day of the class.');
        if (!body.status) return invalid('status', 'Choose present, absent or cancelled.');
        if (!(slot >= 1 && slot <= 12)) return invalid('slot', 'Must be between 1 and 12.');
        if (body.heldOn > todayIn(settingsFor().timezone)) {
          return invalid('heldOn', 'You can’t mark a class that hasn’t happened yet.');
        }
        if (
          store.records.some((r) => r.courseId === course.id && r.heldOn === body.heldOn && r.slot === slot)
        ) {
          return problem(
            409,
            'CONFLICT',
            'You’ve already marked this class. Change or delete that mark instead.',
          );
        }
        const record: StoredRecord = {
          id: crypto.randomUUID(),
          courseId: course.id,
          heldOn: body.heldOn,
          slot,
          status: body.status,
          createdAt: Date.now(),
        };
        store.records.push(record);
        const { createdAt: _c, ...response } = record;
        return HttpResponse.json(response, { status: 201 });
      }),
    ),

    http.put(
      `${API}/attendance/records/:id`,
      withStore(storeFor, async (store, request, params) => {
        const record = store.records.find((r) => r.id === params.id);
        if (!record) return notFound();
        const body = (await request.json()) as { status?: AttendanceMark };
        if (!body.status) return invalid('status', 'Choose present, absent or cancelled.');
        record.status = body.status;
        const { createdAt: _c, ...response } = record;
        return HttpResponse.json(response);
      }),
    ),

    http.delete(
      `${API}/attendance/records/:id`,
      withStore(storeFor, (store, _request, params) => {
        const index = store.records.findIndex((r) => r.id === params.id);
        if (index < 0) return notFound();
        store.records.splice(index, 1);
        return new HttpResponse(null, { status: 204 });
      }),
    ),

    http.put(
      `${API}/courses/:id/attendance/baseline`,
      withStore(storeFor, async (store, request, params) => {
        const course = store.courses.find((c) => c.id === params.id);
        if (!course) return notFound();
        const body = (await request.json()) as { conducted?: number; attended?: number };
        for (const field of ['conducted', 'attended'] as const) {
          const v = body[field];
          if (typeof v !== 'number' || !Number.isInteger(v) || v < 0 || v > 9999) {
            return invalid(field, 'Use a whole number from 0 to 9999.');
          }
        }
        if (body.attended! > body.conducted!) {
          const message = 'You can’t have attended more classes than were held.';
          return problem(422, 'RULE_VIOLATION', message, { errors: [{ field: 'attended', message }] });
        }
        course.baselineConducted = body.conducted!;
        course.baselineAttended = body.attended!;
        return HttpResponse.json(courseAttendance(store, course, settingsFor().defaultAttendanceTarget));
      }),
    ),

    // Assignments (docs/api.md §2.6)
    http.get(
      `${API}/assignments`,
      withStore(storeFor, (store, request) => {
        const url = new URL(request.url);
        const page = Number(url.searchParams.get('page') ?? '0');
        const size = Number(url.searchParams.get('size') ?? '20');
        if (!(page >= 0)) return invalid('page', 'Must be 0 or more.');
        if (!(size >= 1 && size <= 100)) return invalid('size', 'Must be between 1 and 100.');
        const statuses = url.searchParams.getAll('status') as AssignmentStatus[];
        const courseId = url.searchParams.get('courseId');
        const priority = url.searchParams.get('priority') as AssignmentPriority | null;
        const [field, direction] = (url.searchParams.get('sort') ?? 'dueAt,asc').split(',');
        if (!['dueAt', 'createdAt'].includes(field!) || !['asc', 'desc', undefined].includes(direction)) {
          return invalid('sort', 'Sort by dueAt or createdAt, e.g. dueAt,asc.');
        }
        const sign = direction === 'desc' ? -1 : 1;
        const key = (a: StoredAssignment) => (field === 'dueAt' ? Date.parse(a.dueAt) : a.createdAt);
        const all = store.assignments
          .filter((a) => statuses.length === 0 || statuses.includes(a.status))
          .filter((a) => !courseId || a.courseId === courseId)
          .filter((a) => !priority || a.priority === priority)
          .sort((a, b) => sign * (key(a) - key(b)) || a.id.localeCompare(b.id));
        const now = new Date();
        const tz = settingsFor().timezone;
        return HttpResponse.json({
          items: all.slice(page * size, page * size + size).map((a) => toAssignment(store, a, now, tz)),
          page,
          size,
          totalItems: all.length,
          totalPages: Math.ceil(all.length / size),
        });
      }),
    ),

    http.get(
      `${API}/assignments/:id`,
      withStore(storeFor, (store, _request, params) => {
        const a = store.assignments.find((x) => x.id === params.id);
        return a ? HttpResponse.json(toAssignment(store, a, new Date(), settingsFor().timezone)) : notFound();
      }),
    ),

    http.post(
      `${API}/assignments`,
      withStore(storeFor, async (store, request) => {
        const body = (await request.json()) as Partial<AssignmentRequest>;
        const error = assignmentProblem(store, body);
        if (error) return invalid(...error);
        const a: StoredAssignment = {
          id: crypto.randomUUID(),
          courseId: body.courseId!,
          title: body.title!.trim(),
          description: blankToNull(body.description),
          dueAt: new Date(body.dueAt!).toISOString(),
          priority: body.priority ?? 'MEDIUM',
          status: 'NOT_STARTED',
          estimatedMinutes: body.estimatedMinutes ?? null,
          progressPct: 0,
          submittedAt: null,
          completedAt: null,
          createdAt: Date.now(),
        };
        store.assignments.push(a);
        return HttpResponse.json(toAssignment(store, a, new Date(), settingsFor().timezone), { status: 201 });
      }),
    ),

    http.put(
      `${API}/assignments/:id`,
      withStore(storeFor, async (store, request, params) => {
        const a = store.assignments.find((x) => x.id === params.id);
        if (!a) return notFound();
        const body = (await request.json()) as Partial<AssignmentRequest>;
        const error = assignmentProblem(store, body);
        if (error) return invalid(...error);
        Object.assign(a, {
          courseId: body.courseId!,
          title: body.title!.trim(),
          description: blankToNull(body.description),
          dueAt: new Date(body.dueAt!).toISOString(),
          priority: body.priority ?? 'MEDIUM',
          estimatedMinutes: body.estimatedMinutes ?? null,
        });
        return HttpResponse.json(toAssignment(store, a, new Date(), settingsFor().timezone));
      }),
    ),

    http.patch(
      `${API}/assignments/:id/progress`,
      withStore(storeFor, async (store, request, params) => {
        const body = (await request.json()) as { status?: AssignmentStatus; progressPct?: number };
        if (body.status === undefined && body.progressPct === undefined) {
          return invalid('status', 'Send a status, a progress value, or both.');
        }
        const p = body.progressPct;
        if (p !== undefined && (!Number.isInteger(p) || p < 0 || p > 100)) {
          return invalid('progressPct', 'Must be between 0 and 100.');
        }
        const a = store.assignments.find((x) => x.id === params.id);
        if (!a) return notFound();
        applyProgress(a, body.status, p, new Date().toISOString());
        return HttpResponse.json(toAssignment(store, a, new Date(), settingsFor().timezone));
      }),
    ),

    http.delete(
      `${API}/assignments/:id`,
      withStore(storeFor, (store, _request, params) => {
        const index = store.assignments.findIndex((x) => x.id === params.id);
        if (index < 0) return notFound();
        store.assignments.splice(index, 1);
        return new HttpResponse(null, { status: 204 });
      }),
    ),

    // Course links (docs/api.md §2.4)
    http.get(
      `${API}/courses/:id/resources`,
      withStore(storeFor, (store, _request, params) => {
        if (!store.courses.some((c) => c.id === params.id)) return notFound();
        return HttpResponse.json(resourcesOf(store, params.id!));
      }),
    ),

    http.post(
      `${API}/courses/:id/resources`,
      withStore(storeFor, async (store, request, params) => {
        if (!store.courses.some((c) => c.id === params.id)) return notFound();
        const body = (await request.json()) as { title?: string; url?: string };
        const error = resourceProblem(body);
        if (error) return invalid(...error);
        if (store.resources.filter((r) => r.courseId === params.id).length >= 50) {
          const message = 'A course can have up to 50 links.';
          return problem(422, 'RULE_VIOLATION', message, { errors: [{ field: 'url', message }] });
        }
        const now = Date.now();
        const resource: StoredResource = {
          id: crypto.randomUUID(),
          courseId: params.id!,
          title: body.title!.trim(),
          url: normalizeLink(body.url)!,
          createdAt: new Date(now).toISOString(),
          createdAtMs: now,
        };
        store.resources.push(resource);
        const { createdAtMs: _m, ...response } = resource;
        return HttpResponse.json(response, { status: 201 });
      }),
    ),

    http.put(
      `${API}/courses/:id/resources/:resourceId`,
      withStore(storeFor, async (store, request, params) => {
        const resource = store.resources.find((r) => r.id === params.resourceId && r.courseId === params.id);
        if (!resource) return notFound();
        const body = (await request.json()) as { title?: string; url?: string };
        const error = resourceProblem(body);
        if (error) return invalid(...error);
        resource.title = body.title!.trim();
        resource.url = normalizeLink(body.url)!;
        const { createdAtMs: _m, ...response } = resource;
        return HttpResponse.json(response);
      }),
    ),

    http.delete(
      `${API}/courses/:id/resources/:resourceId`,
      withStore(storeFor, (store, _request, params) => {
        const index = store.resources.findIndex(
          (r) => r.id === params.resourceId && r.courseId === params.id,
        );
        if (index < 0) return notFound();
        store.resources.splice(index, 1);
        return new HttpResponse(null, { status: 204 });
      }),
    ),

    // Course overview: the course page in one request
    http.get(
      `${API}/courses/:id/overview`,
      withStore(storeFor, (store, _request, params) => {
        const course = store.courses.find((c) => c.id === params.id);
        if (!course) return notFound();
        const now = new Date();
        const tz = settingsFor().timezone;
        const today = todayIn(tz, now);
        const open = store.assignments
          .filter((a) => a.courseId === course.id && isOpen(a.status))
          .sort((a, b) => Date.parse(a.dueAt) - Date.parse(b.dueAt));
        const exams = store.exams
          .filter((e) => e.courseId === course.id && todayIn(tz, new Date(e.startsAt)) >= today)
          .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
        return HttpResponse.json({
          course: toCourse(store, course),
          attendance: courseAttendance(store, course, settingsFor().defaultAttendanceTarget),
          openAssignments: open.slice(0, 5).map((a) => toAssignment(store, a, now, tz)),
          openAssignmentCount: open.length,
          overdueCount: open.filter((a) => Date.parse(a.dueAt) < now.getTime()).length,
          upcomingExams: exams.slice(0, 3).map((e) => toExamSummary(store, e, now, tz)),
          resources: resourcesOf(store, course.id),
        });
      }),
    ),

    // Exams (docs/api.md §2.7)
    http.get(
      `${API}/exams`,
      withStore(storeFor, (store, request) => {
        const url = new URL(request.url);
        const upcoming = url.searchParams.get('upcoming') === 'true';
        const courseId = url.searchParams.get('courseId');
        const now = new Date();
        const tz = settingsFor().timezone;
        const today = todayIn(tz, now);
        return HttpResponse.json(
          store.exams
            .filter((e) => !courseId || e.courseId === courseId)
            .filter((e) => !upcoming || todayIn(tz, new Date(e.startsAt)) >= today)
            .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt) || a.id.localeCompare(b.id))
            .map((e) => toExamSummary(store, e, now, tz)),
        );
      }),
    ),

    http.get(
      `${API}/exams/:id`,
      withStore(storeFor, (store, _request, params) => {
        const exam = store.exams.find((e) => e.id === params.id);
        return exam
          ? HttpResponse.json(toExamDetail(store, exam, new Date(), settingsFor().timezone))
          : notFound();
      }),
    ),

    http.post(
      `${API}/exams`,
      withStore(storeFor, async (store, request) => {
        const body = (await request.json()) as Partial<ExamRequest>;
        const error = examProblem(store, body);
        if (error) return invalid(...error);
        if (store.exams.filter((e) => e.courseId === body.courseId).length >= 50) {
          const message = 'A course can have up to 50 exams.';
          return problem(422, 'RULE_VIOLATION', message, { errors: [{ field: 'courseId', message }] });
        }
        const exam: StoredExam = {
          id: crypto.randomUUID(),
          courseId: body.courseId!,
          title: body.title!.trim(),
          kind: body.kind ?? 'OTHER',
          startsAt: new Date(body.startsAt!).toISOString(),
          durationMinutes: body.durationMinutes ?? null,
          location: blankToNull(body.location),
        };
        store.exams.push(exam);
        (body.topics ?? []).forEach((title, i) =>
          store.topics.push({
            id: crypto.randomUUID(),
            examId: exam.id,
            title: title.trim(),
            position: i,
            doneAt: null,
            createdAt: Date.now() + i,
          }),
        );
        return HttpResponse.json(toExamDetail(store, exam, new Date(), settingsFor().timezone), {
          status: 201,
        });
      }),
    ),

    http.put(
      `${API}/exams/:id`,
      withStore(storeFor, async (store, request, params) => {
        const exam = store.exams.find((e) => e.id === params.id);
        if (!exam) return notFound();
        const body = (await request.json()) as Partial<ExamRequest>;
        const error = examProblem(store, body);
        if (error) return invalid(...error);
        Object.assign(exam, {
          courseId: body.courseId!,
          title: body.title!.trim(),
          kind: body.kind ?? 'OTHER',
          startsAt: new Date(body.startsAt!).toISOString(),
          durationMinutes: body.durationMinutes ?? null,
          location: blankToNull(body.location),
        });
        return HttpResponse.json(toExamDetail(store, exam, new Date(), settingsFor().timezone));
      }),
    ),

    http.delete(
      `${API}/exams/:id`,
      withStore(storeFor, (store, _request, params) => {
        const index = store.exams.findIndex((e) => e.id === params.id);
        if (index < 0) return notFound();
        store.exams.splice(index, 1);
        store.topics = store.topics.filter((t) => t.examId !== params.id);
        return new HttpResponse(null, { status: 204 });
      }),
    ),

    http.post(
      `${API}/exams/:id/topics`,
      withStore(storeFor, async (store, request, params) => {
        const exam = store.exams.find((e) => e.id === params.id);
        if (!exam) return notFound();
        const body = (await request.json()) as { title?: string };
        if (!body.title?.trim()) return invalid('title', 'Name the topic.');
        if (body.title.length > 160) return invalid('title', 'Keep it under 160 characters.');
        const count = orderedTopics(store, exam.id).length;
        if (count >= 100) {
          const message = 'An exam can have up to 100 topics.';
          return problem(422, 'RULE_VIOLATION', message, { errors: [{ field: 'title', message }] });
        }
        store.topics.push({
          id: crypto.randomUUID(),
          examId: exam.id,
          title: body.title.trim(),
          position: count,
          doneAt: null,
          createdAt: Date.now(),
        });
        return HttpResponse.json(toExamDetail(store, exam, new Date(), settingsFor().timezone), {
          status: 201,
        });
      }),
    ),

    http.patch(
      `${API}/exams/:id/topics/:topicId`,
      withStore(storeFor, async (store, request, params) => {
        const body = (await request.json()) as { done?: boolean; title?: string; position?: number };
        if (body.done === undefined && body.title === undefined && body.position === undefined) {
          return invalid('done', 'Send done, title or position.');
        }
        if (body.title !== undefined && !body.title.trim()) return invalid('title', 'Name the topic.');
        if (body.title !== undefined && body.title.length > 160) {
          return invalid('title', 'Keep it under 160 characters.');
        }
        if (body.position !== undefined && (!Number.isInteger(body.position) || body.position < 0)) {
          return invalid('position', 'Must be 0 or more.');
        }
        const exam = store.exams.find((e) => e.id === params.id);
        const topic = store.topics.find((t) => t.id === params.topicId && t.examId === params.id);
        if (!exam || !topic) return notFound();
        if (body.done !== undefined)
          topic.doneAt = body.done ? (topic.doneAt ?? new Date().toISOString()) : null;
        if (body.title !== undefined) topic.title = body.title.trim();
        if (body.position !== undefined) {
          const ordered = orderedTopics(store, exam.id);
          if (body.position >= ordered.length) {
            return invalid('position', `Must be between 0 and ${ordered.length - 1}.`);
          }
          const rest = ordered.filter((t) => t.id !== topic.id);
          rest.splice(body.position, 0, topic);
          renumber(rest);
        }
        return HttpResponse.json(toExamDetail(store, exam, new Date(), settingsFor().timezone));
      }),
    ),

    http.delete(
      `${API}/exams/:id/topics/:topicId`,
      withStore(storeFor, (store, _request, params) => {
        const index = store.topics.findIndex((t) => t.id === params.topicId && t.examId === params.id);
        if (index < 0) return notFound();
        store.topics.splice(index, 1);
        renumber(orderedTopics(store, params.id!));
        return new HttpResponse(null, { status: 204 });
      }),
    ),
  ];
}

function resourcesOf(store: AcademicStore, courseId: string) {
  return store.resources
    .filter((r) => r.courseId === courseId)
    .sort((a, b) => a.createdAtMs - b.createdAtMs)
    .map(({ createdAtMs: _m, ...r }) => r);
}

function resourceProblem(body: { title?: string; url?: string }): [string, string] | null {
  if (!body.title?.trim()) return ['title', 'Give the link a title.'];
  if (body.title.length > 120) return ['title', 'Keep it under 120 characters.'];
  if (!body.url?.trim()) return ['url', 'Paste the link.'];
  if (!normalizeLink(body.url)) return ['url', 'Use a web link starting with http:// or https://.'];
  return null;
}
