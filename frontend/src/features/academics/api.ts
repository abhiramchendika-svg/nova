import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type ApiError } from '@/services/http';
import type {
  Assignment,
  AssignmentFilter,
  AssignmentRequest,
  AssignmentStatus,
  AttendanceMark,
  AttendanceRecord,
  Course,
  CourseAttendance,
  CourseOverview,
  CourseRequest,
  CourseResource,
  ExamDetail,
  ExamRequest,
  ExamSummary,
  GradeKind,
  GradeOverride,
  GradesSummary,
  GradingScheme,
  Page,
  ResourceRequest,
  SchemeRequest,
  Semester,
  TimetableDay,
  TimetableEntry,
  TimetableEntryRequest,
  SemesterRequest,
} from './types';

/**
 * Query keys all start with 'academics', so any academic change can refresh everything that
 * depends on it with one invalidation. GPA is derived on the server, so after a grade or credit
 * change the summary must be refetched rather than patched locally.
 */
export const academicsKeys = {
  all: ['academics'] as const,
  schemes: ['academics', 'schemes'] as const,
  semesters: ['academics', 'semesters'] as const,
  courses: (semesterId: string) => ['academics', 'courses', semesterId] as const,
  summary: ['academics', 'grades', 'summary'] as const,
  whatIf: (overrides: GradeOverride[]) => ['academics', 'grades', 'what-if', overrides] as const,
  attendance: (semesterId: string) => ['academics', 'attendance', semesterId] as const,
  history: (courseId: string, page: number) => ['academics', 'attendance-history', courseId, page] as const,
  assignments: (filter: AssignmentFilter) => ['academics', 'assignments', filter] as const,
  overview: (courseId: string) => ['academics', 'course-overview', courseId] as const,
  exams: (filter: { upcoming: boolean; courseId?: string }) => ['academics', 'exams', filter] as const,
  exam: (id: string) => ['academics', 'exam', id] as const,
  timetable: (semesterId: string | null) => ['academics', 'timetable', semesterId] as const,
  day: (date: string | null) => ['academics', 'timetable-day', date] as const,
};

function useInvalidateAcademics() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: academicsKeys.all });
}

// ───────────── Grading schemes ─────────────

export function useGradingSchemes() {
  return useQuery<GradingScheme[], ApiError>({
    queryKey: academicsKeys.schemes,
    queryFn: ({ signal }) => api<GradingScheme[]>('/grading-schemes', { signal }),
    staleTime: 5 * 60_000,
  });
}

export function useCreateScheme() {
  const invalidate = useInvalidateAcademics();
  return useMutation<GradingScheme, ApiError, SchemeRequest>({
    mutationFn: (body) => api<GradingScheme>('/grading-schemes', { method: 'POST', body }),
    onSuccess: invalidate,
  });
}

export function useCloneScheme() {
  const invalidate = useInvalidateAcademics();
  return useMutation<GradingScheme, ApiError, string>({
    mutationFn: (id) => api<GradingScheme>(`/grading-schemes/${id}/clone`, { method: 'POST' }),
    onSuccess: invalidate,
  });
}

export function useUpdateScheme() {
  const invalidate = useInvalidateAcademics();
  return useMutation<GradingScheme, ApiError, { id: string; body: SchemeRequest }>({
    mutationFn: ({ id, body }) => api<GradingScheme>(`/grading-schemes/${id}`, { method: 'PUT', body }),
    onSuccess: invalidate,
  });
}

export function useDeleteScheme() {
  const invalidate = useInvalidateAcademics();
  return useMutation<void, ApiError, string>({
    mutationFn: (id) => api<void>(`/grading-schemes/${id}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  });
}

// ───────────── Semesters ─────────────

export function useSemesters() {
  return useQuery<Semester[], ApiError>({
    queryKey: academicsKeys.semesters,
    queryFn: ({ signal }) => api<Semester[]>('/semesters', { signal }),
  });
}

export function useCreateSemester() {
  const invalidate = useInvalidateAcademics();
  return useMutation<Semester, ApiError, SemesterRequest>({
    mutationFn: (body) => api<Semester>('/semesters', { method: 'POST', body }),
    onSuccess: invalidate,
  });
}

export function useUpdateSemester() {
  const invalidate = useInvalidateAcademics();
  return useMutation<Semester, ApiError, { id: string; body: SemesterRequest }>({
    mutationFn: ({ id, body }) => api<Semester>(`/semesters/${id}`, { method: 'PUT', body }),
    onSuccess: invalidate,
  });
}

export function useMakeCurrentSemester() {
  const invalidate = useInvalidateAcademics();
  return useMutation<Semester, ApiError, string>({
    mutationFn: (id) => api<Semester>(`/semesters/${id}/make-current`, { method: 'POST' }),
    onSuccess: invalidate,
  });
}

export function useDeleteSemester() {
  const invalidate = useInvalidateAcademics();
  return useMutation<void, ApiError, string>({
    mutationFn: (id) => api<void>(`/semesters/${id}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  });
}

// ───────────── Courses ─────────────

/** Shared by useCourses and pages that load several semesters' courses at once (useQueries). */
export function coursesQuery(semesterId: string) {
  return {
    queryKey: academicsKeys.courses(semesterId),
    queryFn: ({ signal }: { signal: AbortSignal }) =>
      api<Course[]>(`/courses?semesterId=${encodeURIComponent(semesterId)}`, { signal }),
  };
}

export function useCourses(semesterId: string | undefined) {
  return useQuery<Course[], ApiError>({ ...coursesQuery(semesterId ?? ''), enabled: Boolean(semesterId) });
}

export function useCreateCourse() {
  const invalidate = useInvalidateAcademics();
  return useMutation<Course, ApiError, CourseRequest>({
    mutationFn: (body) => api<Course>('/courses', { method: 'POST', body }),
    onSuccess: invalidate,
  });
}

export function useUpdateCourse() {
  const invalidate = useInvalidateAcademics();
  return useMutation<Course, ApiError, { id: string; body: CourseRequest }>({
    mutationFn: ({ id, body }) => api<Course>(`/courses/${id}`, { method: 'PUT', body }),
    onSuccess: invalidate,
  });
}

export function useDeleteCourse() {
  const invalidate = useInvalidateAcademics();
  return useMutation<void, ApiError, string>({
    mutationFn: (id) => api<void>(`/courses/${id}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  });
}

/** Sets a grade, or clears it when {@code gradeDefinitionId} is null. */
export function useSetCourseGrade() {
  const invalidate = useInvalidateAcademics();
  return useMutation<
    Course | void,
    ApiError,
    { courseId: string; gradeDefinitionId: string | null; kind: GradeKind }
  >({
    mutationFn: ({ courseId, gradeDefinitionId, kind }) =>
      gradeDefinitionId === null
        ? api<void>(`/courses/${courseId}/grade`, { method: 'DELETE' })
        : api<Course>(`/courses/${courseId}/grade`, { method: 'PUT', body: { gradeDefinitionId, kind } }),
    onSuccess: invalidate,
  });
}

// ───────────── Grades ─────────────

export function useGradesSummary() {
  return useQuery<GradesSummary, ApiError>({
    queryKey: academicsKeys.summary,
    queryFn: ({ signal }) => api<GradesSummary>('/grades/summary', { signal }),
  });
}

/**
 * Stateless what-if calculation. It's a POST (it has a body) but changes nothing, so it's
 * modelled as a query keyed by the overrides: the same overrides reuse the cached answer, and
 * the previous result stays on screen while the next one loads.
 */
export function useWhatIf(overrides: GradeOverride[], enabled: boolean) {
  return useQuery<GradesSummary, ApiError>({
    queryKey: academicsKeys.whatIf(overrides),
    queryFn: ({ signal }) =>
      api<GradesSummary>('/grades/what-if', { method: 'POST', body: { overrides }, signal }),
    enabled: enabled && overrides.length > 0,
    placeholderData: keepPreviousData,
    staleTime: 0,
  });
}

// ───────────── Attendance ─────────────

export function useSemesterAttendance(semesterId: string | undefined) {
  return useQuery<CourseAttendance[], ApiError>({
    queryKey: academicsKeys.attendance(semesterId ?? ''),
    queryFn: ({ signal }) =>
      api<CourseAttendance[]>(`/attendance?semesterId=${encodeURIComponent(semesterId ?? '')}`, { signal }),
    enabled: Boolean(semesterId),
  });
}

export const HISTORY_PAGE_SIZE = 10;

export function useAttendanceHistory(courseId: string, page: number, enabled: boolean) {
  return useQuery<Page<AttendanceRecord>, ApiError>({
    queryKey: academicsKeys.history(courseId, page),
    queryFn: ({ signal }) =>
      api<Page<AttendanceRecord>>(
        `/courses/${courseId}/attendance/records?page=${page}&size=${HISTORY_PAGE_SIZE}`,
        { signal },
      ),
    enabled,
    placeholderData: keepPreviousData,
  });
}

export function useMarkAttendance() {
  const invalidate = useInvalidateAcademics();
  return useMutation<
    AttendanceRecord,
    ApiError,
    { courseId: string; heldOn: string; slot: number; status: AttendanceMark }
  >({
    mutationFn: ({ courseId, ...body }) =>
      api<AttendanceRecord>(`/courses/${courseId}/attendance/records`, { method: 'POST', body }),
    onSuccess: invalidate,
  });
}

export function useChangeMark() {
  const invalidate = useInvalidateAcademics();
  return useMutation<AttendanceRecord, ApiError, { recordId: string; status: AttendanceMark }>({
    mutationFn: ({ recordId, status }) =>
      api<AttendanceRecord>(`/attendance/records/${recordId}`, { method: 'PUT', body: { status } }),
    onSuccess: invalidate,
  });
}

export function useDeleteMark() {
  const invalidate = useInvalidateAcademics();
  return useMutation<void, ApiError, string>({
    mutationFn: (recordId) => api<void>(`/attendance/records/${recordId}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  });
}

export function useSetBaseline() {
  const invalidate = useInvalidateAcademics();
  return useMutation<CourseAttendance, ApiError, { courseId: string; conducted: number; attended: number }>({
    mutationFn: ({ courseId, ...body }) =>
      api<CourseAttendance>(`/courses/${courseId}/attendance/baseline`, { method: 'PUT', body }),
    onSuccess: invalidate,
  });
}

// ───────────── Assignments ─────────────

/** "?status=NOT_STARTED&status=IN_PROGRESS&courseId=…", in the backend's parameter names. */
export function assignmentQuery(filter: AssignmentFilter): string {
  const params = new URLSearchParams();
  for (const status of filter.status ?? []) params.append('status', status);
  if (filter.courseId) params.set('courseId', filter.courseId);
  if (filter.priority) params.set('priority', filter.priority);
  if (filter.sort) params.set('sort', filter.sort);
  params.set('page', String(filter.page ?? 0));
  params.set('size', String(filter.size ?? 20));
  return params.toString();
}

export function useAssignments(filter: AssignmentFilter, enabled = true) {
  return useQuery<Page<Assignment>, ApiError>({
    queryKey: academicsKeys.assignments(filter),
    queryFn: ({ signal }) => api<Page<Assignment>>(`/assignments?${assignmentQuery(filter)}`, { signal }),
    enabled,
    placeholderData: keepPreviousData,
  });
}

export function useCreateAssignment() {
  const invalidate = useInvalidateAcademics();
  return useMutation<Assignment, ApiError, AssignmentRequest>({
    mutationFn: (body) => api<Assignment>('/assignments', { method: 'POST', body }),
    onSuccess: invalidate,
  });
}

export function useUpdateAssignment() {
  const invalidate = useInvalidateAcademics();
  return useMutation<Assignment, ApiError, { id: string; body: AssignmentRequest }>({
    mutationFn: ({ id, body }) => api<Assignment>(`/assignments/${id}`, { method: 'PUT', body }),
    onSuccess: invalidate,
  });
}

export function useAssignmentProgress() {
  const invalidate = useInvalidateAcademics();
  return useMutation<Assignment, ApiError, { id: string; status?: AssignmentStatus; progressPct?: number }>({
    mutationFn: ({ id, ...body }) =>
      api<Assignment>(`/assignments/${id}/progress`, { method: 'PATCH', body }),
    onSuccess: invalidate,
  });
}

export function useDeleteAssignment() {
  const invalidate = useInvalidateAcademics();
  return useMutation<void, ApiError, string>({
    mutationFn: (id) => api<void>(`/assignments/${id}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  });
}

// ───────────── Course page ─────────────

export function useCourseOverview(courseId: string) {
  return useQuery<CourseOverview, ApiError>({
    queryKey: academicsKeys.overview(courseId),
    queryFn: ({ signal }) => api<CourseOverview>(`/courses/${courseId}/overview`, { signal }),
  });
}

export function useAddResource() {
  const invalidate = useInvalidateAcademics();
  return useMutation<CourseResource, ApiError, { courseId: string; body: ResourceRequest }>({
    mutationFn: ({ courseId, body }) =>
      api<CourseResource>(`/courses/${courseId}/resources`, { method: 'POST', body }),
    onSuccess: invalidate,
  });
}

export function useUpdateResource() {
  const invalidate = useInvalidateAcademics();
  return useMutation<CourseResource, ApiError, { courseId: string; id: string; body: ResourceRequest }>({
    mutationFn: ({ courseId, id, body }) =>
      api<CourseResource>(`/courses/${courseId}/resources/${id}`, { method: 'PUT', body }),
    onSuccess: invalidate,
  });
}

export function useDeleteResource() {
  const invalidate = useInvalidateAcademics();
  return useMutation<void, ApiError, { courseId: string; id: string }>({
    mutationFn: ({ courseId, id }) => api<void>(`/courses/${courseId}/resources/${id}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  });
}

// ───────────── Exams ─────────────

export function useExams(filter: { upcoming: boolean; courseId?: string }, enabled = true) {
  const params = new URLSearchParams({ upcoming: String(filter.upcoming) });
  if (filter.courseId) params.set('courseId', filter.courseId);
  return useQuery<ExamSummary[], ApiError>({
    queryKey: academicsKeys.exams(filter),
    queryFn: ({ signal }) => api<ExamSummary[]>(`/exams?${params.toString()}`, { signal }),
    enabled,
  });
}

export function useExam(id: string) {
  return useQuery<ExamDetail, ApiError>({
    queryKey: academicsKeys.exam(id),
    queryFn: ({ signal }) => api<ExamDetail>(`/exams/${id}`, { signal }),
  });
}

/**
 * Exam and topic writes return the whole exam, so the page updates from the response straight
 * away; lists and the course page (prep %) refresh through the usual invalidation.
 */
function useExamWrite<V>(request: (vars: V) => Promise<ExamDetail>) {
  const queryClient = useQueryClient();
  return useMutation<ExamDetail, ApiError, V>({
    mutationFn: request,
    onSuccess: async (exam) => {
      queryClient.setQueryData(academicsKeys.exam(exam.id), exam);
      await queryClient.invalidateQueries({
        queryKey: academicsKeys.all,
        predicate: (q) => !(q.queryKey[1] === 'exam' && q.queryKey[2] === exam.id),
      });
    },
  });
}

export function useCreateExam() {
  return useExamWrite((body: ExamRequest) => api<ExamDetail>('/exams', { method: 'POST', body }));
}

export function useUpdateExam() {
  return useExamWrite(({ id, body }: { id: string; body: ExamRequest }) =>
    api<ExamDetail>(`/exams/${id}`, { method: 'PUT', body }),
  );
}

export function useDeleteExam() {
  const queryClient = useQueryClient();
  return useMutation<void, ApiError, string>({
    mutationFn: (id) => api<void>(`/exams/${id}`, { method: 'DELETE' }),
    onSuccess: async (_v, id) => {
      queryClient.removeQueries({ queryKey: academicsKeys.exam(id) });
      await queryClient.invalidateQueries({ queryKey: academicsKeys.all });
    },
  });
}

export function useAddTopic() {
  return useExamWrite(({ examId, title }: { examId: string; title: string }) =>
    api<ExamDetail>(`/exams/${examId}/topics`, { method: 'POST', body: { title } }),
  );
}

export function usePatchTopic() {
  return useExamWrite(
    ({
      examId,
      topicId,
      ...body
    }: {
      examId: string;
      topicId: string;
      done?: boolean;
      title?: string;
      position?: number;
    }) => api<ExamDetail>(`/exams/${examId}/topics/${topicId}`, { method: 'PATCH', body }),
  );
}

export function useDeleteTopic() {
  const queryClient = useQueryClient();
  return useMutation<void, ApiError, { examId: string; topicId: string }>({
    mutationFn: ({ examId, topicId }) =>
      api<void>(`/exams/${examId}/topics/${topicId}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: academicsKeys.all }),
  });
}

// ───────────── Timetable ─────────────

/** A semester's week (the current semester when {@code semesterId} is null). */
export function useTimetable(semesterId: string | null, enabled = true) {
  const query = semesterId ? `?semesterId=${encodeURIComponent(semesterId)}` : '';
  return useQuery<TimetableEntry[], ApiError>({
    queryKey: academicsKeys.timetable(semesterId),
    queryFn: ({ signal }) => api<TimetableEntry[]>(`/timetable${query}`, { signal }),
    enabled,
  });
}

/** A date's classes with their attendance slot and marks (today in the user's timezone when null). */
export function useTimetableDay(date: string | null = null) {
  return useQuery<TimetableDay, ApiError>({
    queryKey: academicsKeys.day(date),
    queryFn: ({ signal }) => api<TimetableDay>(`/timetable/day${date ? `?date=${date}` : ''}`, { signal }),
  });
}

export function useCreateEntry() {
  const invalidate = useInvalidateAcademics();
  return useMutation<TimetableEntry, ApiError, TimetableEntryRequest>({
    mutationFn: (body) => api<TimetableEntry>('/timetable', { method: 'POST', body }),
    onSuccess: invalidate,
  });
}

export function useUpdateEntry() {
  const invalidate = useInvalidateAcademics();
  return useMutation<TimetableEntry, ApiError, { id: string; body: TimetableEntryRequest }>({
    mutationFn: ({ id, body }) => api<TimetableEntry>(`/timetable/${id}`, { method: 'PUT', body }),
    onSuccess: invalidate,
  });
}

export function useDeleteEntry() {
  const invalidate = useInvalidateAcademics();
  return useMutation<void, ApiError, string>({
    mutationFn: (id) => api<void>(`/timetable/${id}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  });
}
