import { http, HttpResponse, type HttpHandler } from 'msw';
import type {
  CourseRequest,
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

export function createAcademicsHandlers(storeFor: StoreFor): HttpHandler[] {
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
        store.courses = store.courses.filter((c) => c.semesterId !== params.id);
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
        store.courses.splice(index, 1);
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
  ];
}
