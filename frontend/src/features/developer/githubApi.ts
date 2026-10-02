import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { dashboardKey } from '@/features/dashboard/api';
import { api, type ApiError } from '@/services/http';
import type { GitHubOverview } from './types';

export const githubKeys = {
  overview: ['developer', 'github'] as const,
};

/** The GitHub page's data; the server refreshes whatever is due before answering. */
export function useGitHub(enabled = true) {
  return useQuery<GitHubOverview, ApiError>({
    queryKey: githubKeys.overview,
    queryFn: ({ signal }) => api<GitHubOverview>('/github/overview', { signal }),
    enabled,
  });
}

function useGitHubWrite<V>(request: (vars: V) => Promise<GitHubOverview>) {
  const queryClient = useQueryClient();
  return useMutation<GitHubOverview, ApiError, V>({
    mutationFn: request,
    onSuccess: async (overview) => {
      queryClient.setQueryData(githubKeys.overview, overview);
      await queryClient.invalidateQueries({ queryKey: dashboardKey });
    },
  });
}

export function useConnectGitHub() {
  return useGitHubWrite((username: string) =>
    api<GitHubOverview>('/github/account', { method: 'PUT', body: { username } }),
  );
}

export function useRefreshGitHub() {
  return useGitHubWrite(() => api<GitHubOverview>('/github/refresh', { method: 'POST' }));
}

export function useDisconnectGitHub() {
  const queryClient = useQueryClient();
  return useMutation<void, ApiError, void>({
    mutationFn: () => api<void>('/github/account', { method: 'DELETE' }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: githubKeys.overview }),
        queryClient.invalidateQueries({ queryKey: dashboardKey }),
      ]);
    },
  });
}

/** "github.com/me/app" and "https://github.com/Me/App.git/" both name the same repository. */
export function repoKey(url: string): string | null {
  const m = /^https?:\/\/(?:www\.)?github\.com\/([^/\s]+)\/([^/\s#?]+)/i.exec(url.trim());
  if (!m) return null;
  return `${m[1]}/${m[2]!.replace(/\.git$/i, '')}`.toLowerCase();
}
