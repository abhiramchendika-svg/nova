import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api, type ApiError } from '@/services/http';
import type { SearchResults } from './types';

export const MIN_QUERY = 2;

/** Under the planner's keys, so any change refreshes stale results. */
export function useSearch(q: string) {
  const query = q.trim();
  return useQuery<SearchResults, ApiError>({
    queryKey: ['planner', 'search', query],
    queryFn: ({ signal }) => api<SearchResults>(`/search?q=${encodeURIComponent(query)}&limit=5`, { signal }),
    enabled: query.length >= MIN_QUERY,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
}
