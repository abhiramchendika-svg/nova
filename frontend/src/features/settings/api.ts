import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { meQueryKey } from '@/features/auth/api';
import { api, type ApiError } from '@/services/http';
import type { Settings, SettingsRequest } from './types';

export const settingsKey = ['settings'] as const;

export function useSettings() {
  return useQuery<Settings, ApiError>({
    queryKey: settingsKey,
    queryFn: ({ signal }) => api<Settings>('/settings', { signal }),
    staleTime: 5 * 60_000,
  });
}

/**
 * Settings are replaced as a whole (PUT), so callers change one field on top of the current values.
 * Attendance depends on the default target, so academics data is refreshed too.
 */
export function useUpdateSettings() {
  const queryClient = useQueryClient();
  return useMutation<Settings, ApiError, SettingsRequest>({
    mutationFn: (body) => api<Settings>('/settings', { method: 'PUT', body }),
    onSuccess: async (saved) => {
      queryClient.setQueryData(settingsKey, saved);
      await queryClient.invalidateQueries({ queryKey: ['academics'] });
    },
  });
}

export function toSettingsRequest(s: Settings): SettingsRequest {
  return {
    timezone: s.timezone,
    weekStart: s.weekStart,
    universityName: s.universityName,
    defaultAttendanceTarget: s.defaultAttendanceTarget,
    theme: s.theme,
  };
}

/** Marks onboarding done (finished or skipped); /auth/me carries the flag too, so it's refreshed. */
export function useCompleteOnboarding() {
  const queryClient = useQueryClient();
  return useMutation<Settings, ApiError, void>({
    mutationFn: () => api<Settings>('/settings/onboarding/complete', { method: 'POST' }),
    onSuccess: async (saved) => {
      queryClient.setQueryData(settingsKey, saved);
      await queryClient.invalidateQueries({ queryKey: meQueryKey });
    },
  });
}
