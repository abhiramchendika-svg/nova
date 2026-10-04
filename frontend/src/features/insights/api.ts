import { useQuery } from '@tanstack/react-query';
import { api, type ApiError } from '@/services/http';
import type { InsightWindow, Insights } from './types';

export const insightKeys = {
  all: ['insights'] as const,
  window: (window: InsightWindow) => ['insights', window] as const,
};

/** Insights are computed on request from your data, so they're always as fresh as the data they cite. */
export function useInsights(window: InsightWindow) {
  return useQuery<Insights, ApiError>({
    queryKey: insightKeys.window(window),
    queryFn: ({ signal }) => api<Insights>(`/insights?window=${window}`, { signal }),
  });
}
