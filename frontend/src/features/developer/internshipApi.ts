import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Page } from '@/features/academics/types';
import { plannerKeys } from '@/features/planner/api';
import { api, type ApiError } from '@/services/http';
import { developerKeys } from './api';
import type { Internship, InternshipAnalytics, InternshipRequest, InternshipStatus } from './types';

/** Under the developer keys; writes also refresh the planner (calendar, Home, task chips). */
export const internshipKeys = {
  list: (statuses: InternshipStatus[] | null, page: number, size: number) =>
    ['developer', 'internships', statuses, page, size] as const,
  one: (id: string) => ['developer', 'internship', id] as const,
  analytics: (month: string | null) => ['developer', 'internship-analytics', month] as const,
};

/** A page, most recently applied first (saved ones after); null statuses means all. */
export function useInternships(statuses: InternshipStatus[] | null, page = 0, size = 20, enabled = true) {
  const params = new URLSearchParams();
  for (const s of statuses ?? []) params.append('status', s);
  params.set('page', String(page));
  params.set('size', String(size));
  return useQuery<Page<Internship>, ApiError>({
    queryKey: internshipKeys.list(statuses, page, size),
    queryFn: ({ signal }) => api<Page<Internship>>(`/internships?${params.toString()}`, { signal }),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useInternship(id: string) {
  return useQuery<Internship, ApiError>({
    queryKey: internshipKeys.one(id),
    queryFn: ({ signal }) => api<Internship>(`/internships/${id}`, { signal }),
  });
}

/** {@code month} is "YYYY-MM"; null means this month in the user's timezone. */
export function useInternshipAnalytics(month: string | null) {
  return useQuery<InternshipAnalytics, ApiError>({
    queryKey: internshipKeys.analytics(month),
    queryFn: ({ signal }) =>
      api<InternshipAnalytics>(`/internships/analytics${month ? `?month=${month}` : ''}`, { signal }),
    placeholderData: keepPreviousData,
  });
}

function useInternshipWrite<V>(request: (vars: V) => Promise<Internship>) {
  const queryClient = useQueryClient();
  return useMutation<Internship, ApiError, V>({
    mutationFn: request,
    onSuccess: async (saved) => {
      queryClient.setQueryData(internshipKeys.one(saved.id), saved);
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: developerKeys.all,
          predicate: (q) => !(q.queryKey[1] === 'internship' && q.queryKey[2] === saved.id),
        }),
        queryClient.invalidateQueries({ queryKey: plannerKeys.all }),
      ]);
    },
  });
}

export function useCreateInternship() {
  return useInternshipWrite((body: InternshipRequest) =>
    api<Internship>('/internships', { method: 'POST', body }),
  );
}

export function useUpdateInternship() {
  return useInternshipWrite(({ id, body }: { id: string; body: InternshipRequest }) =>
    api<Internship>(`/internships/${id}`, { method: 'PUT', body }),
  );
}

export function useMoveInternship() {
  return useInternshipWrite(({ id, status }: { id: string; status: InternshipStatus }) =>
    api<Internship>(`/internships/${id}/status`, { method: 'PATCH', body: { status } }),
  );
}

export function useDeleteInternship() {
  const queryClient = useQueryClient();
  return useMutation<void, ApiError, string>({
    mutationFn: (id) => api<void>(`/internships/${id}`, { method: 'DELETE' }),
    onSuccess: async (_v, id) => {
      queryClient.removeQueries({ queryKey: internshipKeys.one(id) });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: developerKeys.all }),
        queryClient.invalidateQueries({ queryKey: plannerKeys.all }),
      ]);
    },
  });
}
