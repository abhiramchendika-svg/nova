import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type ApiError } from '@/services/http';
import type {
  CalendarRange,
  StatusResult,
  Task,
  TaskFilter,
  TaskPage,
  TaskRequest,
  TaskStatus,
  TodayView,
  UpcomingView,
} from './types';

/**
 * Planner query keys all start with 'planner', so a task change refreshes every view with one
 * invalidation. Academic changes (a renamed course, a deleted exam) invalidate these too, since
 * tasks show course and exam names.
 */
export const plannerKeys = {
  all: ['planner'] as const,
  today: (date: string | null) => ['planner', 'today', date] as const,
  upcoming: (days: number) => ['planner', 'upcoming', days] as const,
  completed: (page: number) => ['planner', 'completed', page] as const,
  list: (filter: TaskFilter) => ['planner', 'list', filter] as const,
  task: (id: string) => ['planner', 'task', id] as const,
  calendar: (from: string, to: string) => ['planner', 'calendar', from, to] as const,
};

/** Task changes also refresh projects (open task counts); ['developer'] is developerKeys.all. */
function useInvalidatePlanner() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: plannerKeys.all }),
      queryClient.invalidateQueries({ queryKey: ['developer'] }),
    ]);
}

export function useTodayTasks(date: string | null = null) {
  return useQuery<TodayView, ApiError>({
    queryKey: plannerKeys.today(date),
    queryFn: ({ signal }) => api<TodayView>(`/tasks/today${date ? `?date=${date}` : ''}`, { signal }),
  });
}

export function useUpcomingTasks(days: number, enabled = true) {
  return useQuery<UpcomingView, ApiError>({
    queryKey: plannerKeys.upcoming(days),
    queryFn: ({ signal }) => api<UpcomingView>(`/tasks/upcoming?days=${days}`, { signal }),
    enabled,
    placeholderData: keepPreviousData,
  });
}

export function useCompletedTasks(page: number, size: number, enabled = true) {
  return useQuery<TaskPage, ApiError>({
    queryKey: plannerKeys.completed(page),
    queryFn: ({ signal }) => api<TaskPage>(`/tasks/completed?page=${page}&size=${size}`, { signal }),
    enabled,
    placeholderData: keepPreviousData,
  });
}

/** "?status=TODO&status=IN_PROGRESS&examId=…", in the backend's parameter names. */
export function taskQuery(filter: TaskFilter): string {
  const params = new URLSearchParams();
  for (const status of filter.status ?? []) params.append('status', status);
  if (filter.category) params.set('category', filter.category);
  if (filter.courseId) params.set('courseId', filter.courseId);
  if (filter.examId) params.set('examId', filter.examId);
  if (filter.projectId) params.set('projectId', filter.projectId);
  if (filter.learningGoalId) params.set('learningGoalId', filter.learningGoalId);
  if (filter.hackathonId) params.set('hackathonId', filter.hackathonId);
  if (filter.internshipId) params.set('internshipId', filter.internshipId);
  if (filter.sort) params.set('sort', filter.sort);
  params.set('page', String(filter.page ?? 0));
  params.set('size', String(filter.size ?? 20));
  return params.toString();
}

export function useTasks(filter: TaskFilter, enabled = true) {
  return useQuery<TaskPage, ApiError>({
    queryKey: plannerKeys.list(filter),
    queryFn: ({ signal }) => api<TaskPage>(`/tasks?${taskQuery(filter)}`, { signal }),
    enabled,
  });
}

export function useTask(id: string | null) {
  return useQuery<Task, ApiError>({
    queryKey: plannerKeys.task(id ?? ''),
    queryFn: ({ signal }) => api<Task>(`/tasks/${id}`, { signal }),
    enabled: id !== null,
  });
}

/** Classes, exams, deadlines and tasks from {@code from} to {@code to} (inclusive, at most 62 days). */
export function useCalendar(from: string, to: string) {
  return useQuery<CalendarRange, ApiError>({
    queryKey: plannerKeys.calendar(from, to),
    queryFn: ({ signal }) => api<CalendarRange>(`/calendar?from=${from}&to=${to}`, { signal }),
    placeholderData: keepPreviousData,
  });
}

export function useCreateTask() {
  const invalidate = useInvalidatePlanner();
  return useMutation<Task, ApiError, TaskRequest>({
    mutationFn: (body) => api<Task>('/tasks', { method: 'POST', body }),
    onSuccess: invalidate,
  });
}

/** All or nothing (an exam's revision plan). */
export function useCreateTasks() {
  const invalidate = useInvalidatePlanner();
  return useMutation<{ tasks: Task[] }, ApiError, TaskRequest[]>({
    mutationFn: (tasks) => api<{ tasks: Task[] }>('/tasks/batch', { method: 'POST', body: { tasks } }),
    onSuccess: invalidate,
  });
}

export function useUpdateTask() {
  const invalidate = useInvalidatePlanner();
  return useMutation<Task, ApiError, { id: string; body: TaskRequest }>({
    mutationFn: ({ id, body }) => api<Task>(`/tasks/${id}`, { method: 'PUT', body }),
    onSuccess: invalidate,
  });
}

export function useTaskStatus() {
  const invalidate = useInvalidatePlanner();
  return useMutation<StatusResult, ApiError, { id: string; status: TaskStatus }>({
    mutationFn: ({ id, status }) =>
      api<StatusResult>(`/tasks/${id}/status`, { method: 'PATCH', body: { status } }),
    onSuccess: invalidate,
  });
}

/** With {@code series}, the open repeats planned after this one go too. */
export function useDeleteTask() {
  const invalidate = useInvalidatePlanner();
  return useMutation<void, ApiError, { id: string; series: boolean }>({
    mutationFn: ({ id, series }) =>
      api<void>(`/tasks/${id}${series ? '?series=true' : ''}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  });
}
