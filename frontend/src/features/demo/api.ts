import { useMutation, useQueryClient } from '@tanstack/react-query';
import { meQueryKey } from '@/features/auth/api';
import type { CurrentUser } from '@/features/auth/types';
import { api, errorMessage, type ApiError } from '@/services/http';

/** The browser's timezone, so "today" in the demo is the visitor's today. */
function browserTimezone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
  } catch {
    return undefined;
  }
}

/** Starts a temporary demo account and logs this browser in to it (POST /demo). */
export function useStartDemo() {
  const queryClient = useQueryClient();
  return useMutation<CurrentUser, ApiError, void>({
    mutationFn: () => api<CurrentUser>('/demo', { method: 'POST', body: { timezone: browserTimezone() } }),
    onSuccess: (user) => {
      // A different account from any before it: nothing cached may carry over
      queryClient.clear();
      queryClient.setQueryData(meQueryKey, user);
    },
  });
}

/** What to say when a demo can't start. Waits can be long, so they're in minutes. */
export function demoErrorMessage(error: ApiError): string {
  if (error.code === 'RATE_LIMITED') {
    const minutes = Math.ceil((error.problem.retryAfterSeconds ?? 60) / 60);
    return minutes <= 1
      ? 'Lots of people are trying the demo right now. Try again in a minute.'
      : `Lots of people are trying the demo right now. Try again in about ${minutes} minutes.`;
  }
  if (error.code === 'NOT_FOUND') return 'The demo isn’t available on this server.';
  return errorMessage(error);
}

/** "in about 23 hours", "in less than an hour" — how long a demo account has left. */
export function timeLeft(expiresAt: string, now: number = Date.now()): string {
  const hours = Math.floor((Date.parse(expiresAt) - now) / 3_600_000);
  if (hours < 1) return 'in less than an hour';
  return hours === 1 ? 'in about an hour' : `in about ${hours} hours`;
}
