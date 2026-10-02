import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { plannerKeys } from '@/features/planner/api';
import { api, type ApiError } from '@/services/http';
import { developerKeys } from './api';
import type { Hackathon, HackathonRequest, HackathonStatus } from './types';

/** Under the developer keys; hackathon writes also refresh the planner (calendar, Home, task chips). */
export const hackathonKeys = {
  list: (statuses: HackathonStatus[] | null) => ['developer', 'hackathons', statuses] as const,
  one: (id: string) => ['developer', 'hackathon', id] as const,
};

/** Upcoming first (soonest start), then past (most recent); null statuses means all. */
export function useHackathons(statuses: HackathonStatus[] | null = null, enabled = true) {
  const query = statuses?.length ? `?${statuses.map((s) => `status=${s}`).join('&')}` : '';
  return useQuery<Hackathon[], ApiError>({
    queryKey: hackathonKeys.list(statuses),
    queryFn: ({ signal }) => api<Hackathon[]>(`/hackathons${query}`, { signal }),
    enabled,
  });
}

export function useHackathon(id: string) {
  return useQuery<Hackathon, ApiError>({
    queryKey: hackathonKeys.one(id),
    queryFn: ({ signal }) => api<Hackathon>(`/hackathons/${id}`, { signal }),
  });
}

function useHackathonWrite<V>(request: (vars: V) => Promise<Hackathon>) {
  const queryClient = useQueryClient();
  return useMutation<Hackathon, ApiError, V>({
    mutationFn: request,
    onSuccess: async (h) => {
      queryClient.setQueryData(hackathonKeys.one(h.id), h);
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: developerKeys.all,
          predicate: (q) => !(q.queryKey[1] === 'hackathon' && q.queryKey[2] === h.id),
        }),
        queryClient.invalidateQueries({ queryKey: plannerKeys.all }),
      ]);
    },
  });
}

export function useCreateHackathon() {
  return useHackathonWrite((body: HackathonRequest) =>
    api<Hackathon>('/hackathons', { method: 'POST', body }),
  );
}

export function useUpdateHackathon() {
  return useHackathonWrite(({ id, body }: { id: string; body: HackathonRequest }) =>
    api<Hackathon>(`/hackathons/${id}`, { method: 'PUT', body }),
  );
}

export function useDeleteHackathon() {
  const queryClient = useQueryClient();
  return useMutation<void, ApiError, string>({
    mutationFn: (id) => api<void>(`/hackathons/${id}`, { method: 'DELETE' }),
    onSuccess: async (_v, id) => {
      queryClient.removeQueries({ queryKey: hackathonKeys.one(id) });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: developerKeys.all }),
        queryClient.invalidateQueries({ queryKey: plannerKeys.all }),
      ]);
    },
  });
}
