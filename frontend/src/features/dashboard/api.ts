import { useQuery } from '@tanstack/react-query';
import { api, type ApiError } from '@/services/http';
import type { Dashboard } from './types';

/**
 * Under the planner's keys, so any task change refreshes it; academic changes refresh the planner
 * too (features/academics/api.ts), so marks, grades and deadlines reach Home as well.
 */
export const dashboardKey = ['planner', 'dashboard'] as const;

export function useDashboard() {
  return useQuery<Dashboard, ApiError>({
    queryKey: dashboardKey,
    queryFn: ({ signal }) => api<Dashboard>('/dashboard', { signal }),
  });
}
