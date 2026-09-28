import { QueryClient } from '@tanstack/react-query';
import { ApiError } from '@/services/http';

/** Don't retry client errors (4xx): they won't succeed on a second try. */
function shouldRetry(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false;
  return failureCount < 2;
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: shouldRetry, refetchOnWindowFocus: true, staleTime: 30_000 },
      mutations: { retry: false },
    },
  });
}
