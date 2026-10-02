import { http, HttpResponse, type HttpHandler } from 'msw';
import type { SettingsRequest } from '@/features/settings/types';
import { todayIn } from '@/lib/dates';
import { invalid, notFound, withStore, type StoreFor } from './academicsHandlers';
import { toOverview } from './github';
import { API, problem } from './http';

/** Mock GitHub API (docs/api.md §2.13): the same routes, checks and errors as GitHubController. */

const USERNAME = /^[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}$/;
const REFRESH_EVERY_MS = 5 * 60_000;

export function createGitHubHandlers(storeFor: StoreFor, settingsFor: () => SettingsRequest): HttpHandler[] {
  const today = () => todayIn(settingsFor().timezone);
  return [
    http.get(
      `${API}/github/overview`,
      withStore(storeFor, (store) => HttpResponse.json(toOverview(store.github, today()))),
    ),

    http.put(
      `${API}/github/account`,
      withStore(storeFor, async (store, request) => {
        const raw = ((await request.json()) as { username?: string }).username?.trim() ?? '';
        if (!raw) return invalid('username', 'Enter your GitHub username.');
        if (!USERNAME.test(raw)) {
          return invalid(
            'username',
            'Use your GitHub username: letters, numbers and single hyphens, up to 39 characters.',
          );
        }
        if (Object.keys(store.githubWorld).length === 0) {
          // The browser demo: the mock never makes up GitHub data
          return problem(
            502,
            'UPSTREAM_UNAVAILABLE',
            'Mock mode doesn’t call GitHub. Run the real backend to connect.',
          );
        }
        const user = store.githubWorld[raw.toLowerCase()];
        if (!user) return invalid('username', 'We couldn’t find that GitHub user.');
        store.github = { user, fetchedAt: new Date().toISOString(), refreshRequestedAt: null };
        return HttpResponse.json(toOverview(store.github, today()));
      }),
    ),

    http.delete(
      `${API}/github/account`,
      withStore(storeFor, (store) => {
        store.github = null;
        return new HttpResponse(null, { status: 204 });
      }),
    ),

    http.post(
      `${API}/github/refresh`,
      withStore(storeFor, (store) => {
        const g = store.github;
        if (!g) return notFound();
        const now = Date.now();
        if (g.refreshRequestedAt && now < Date.parse(g.refreshRequestedAt) + REFRESH_EVERY_MS) {
          const seconds = Math.ceil((Date.parse(g.refreshRequestedAt) + REFRESH_EVERY_MS - now) / 1000);
          return problem(429, 'RATE_LIMITED', 'Too many attempts', { retryAfterSeconds: seconds });
        }
        g.refreshRequestedAt = new Date(now).toISOString();
        const fresh = store.githubWorld[g.user.login.toLowerCase()];
        if (fresh) {
          g.user = fresh;
          g.fetchedAt = new Date(now).toISOString();
          return HttpResponse.json(toOverview(g, today()));
        }
        // GitHub unreachable: keep the saved copy, marked stale
        return HttpResponse.json(toOverview(g, today(), true, null));
      }),
    ),
  ];
}
