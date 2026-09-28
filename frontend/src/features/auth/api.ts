import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '@/services/http';
import type { CurrentUser, LoginRequest, RegisterRequest } from './types';

export const meQueryKey = ['auth', 'me'] as const;

/**
 * The current session. Resolves to `null` when logged out (401), so callers can
 * tell "not logged in" apart from "request failed" (which stays an error).
 */
export function useCurrentUser() {
  return useQuery<CurrentUser | null, ApiError>({
    queryKey: meQueryKey,
    queryFn: async ({ signal }) => {
      try {
        return await api<CurrentUser>('/auth/me', { signal });
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) return null;
        throw error;
      }
    },
    staleTime: 5 * 60_000,
    retry: (count, error) => (error.status !== 0 && error.status < 500 ? false : count < 2),
  });
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation<CurrentUser, ApiError, LoginRequest>({
    mutationFn: (body) => api<CurrentUser>('/auth/login', { method: 'POST', body }),
    onSuccess: (user) => queryClient.setQueryData(meQueryKey, user),
  });
}

export function useRegister() {
  const queryClient = useQueryClient();
  return useMutation<CurrentUser, ApiError, RegisterRequest>({
    mutationFn: (body) => api<CurrentUser>('/auth/register', { method: 'POST', body }),
    onSuccess: (user) => queryClient.setQueryData(meQueryKey, user),
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation<void, ApiError, void>({
    mutationFn: () => api<void>('/auth/logout', { method: 'POST' }),
    onSettled: () => {
      // Drop every cached query so no previous user's data survives logout.
      queryClient.clear();
      queryClient.setQueryData(meQueryKey, null);
    },
  });
}
