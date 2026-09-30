import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type ApiError } from '@/services/http';
import type {
  AttendanceMark,
  AttendanceRecord,
  Course,
  CourseAttendance,
  CourseRequest,
  GradeKind,
  GradeOverride,
  GradesSummary,
  GradingScheme,
  Page,
  SchemeRequest,
  Semester,
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
