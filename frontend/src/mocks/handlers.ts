import { http, HttpResponse, type HttpHandler } from 'msw';
import type { CurrentUser } from '@/features/auth/types';

/**
 * In-memory fake of the NOVA auth API (docs/api.md §2.1).
 * Used by component tests (Node) and by `npm run dev:mock` (browser), so the
 * frontend can be developed and reviewed without running Java or PostgreSQL.
 * It mimics the real contract, including Problem Details errors and CSRF.
 */

interface StoredUser extends CurrentUser {
  password: string;
}

export interface MockDb {
  users: Map<string, StoredUser>;
  sessionEmail: string | null;
}

export function createMockDb(
  seed: { loggedInAs?: Omit<StoredUser, 'id' | 'onboardingCompleted'> } = {},
): MockDb {
  const db: MockDb = { users: new Map(), sessionEmail: null };
  if (seed.loggedInAs) {
    const user: StoredUser = {
      id: '00000000-0000-4000-8000-000000000001',
      onboardingCompleted: false,
      ...seed.loggedInAs,
    };
    db.users.set(user.email.toLowerCase(), user);
    db.sessionEmail = user.email.toLowerCase();
  }
  return db;
}

const API = '/api/v1';
const CSRF_TOKEN = 'mock-csrf-token';

function problem(status: number, code: string, title: string, extra: Record<string, unknown> = {}) {
  return HttpResponse.json(
    {
      type: `https://nova.dev/problems/${code.toLowerCase()}`,
      title,
      status,
      code,
      requestId: 'mock',
      ...extra,
    },
    { status, headers: { 'Content-Type': 'application/problem+json' } },
  );
}

function publicUser({ password: _password, ...user }: StoredUser): CurrentUser {
  return user;
}

function csrfOk(request: Request): boolean {
  return request.headers.get('X-XSRF-TOKEN') === CSRF_TOKEN;
}

export function createHandlers(db: MockDb): HttpHandler[] {
  return [
    http.get(`${API}/health`, () => HttpResponse.json({ status: 'UP', version: 'mock' })),

    http.get(`${API}/auth/csrf`, () => {
      document.cookie = `XSRF-TOKEN=${CSRF_TOKEN}; path=/`;
      return new HttpResponse(null, { status: 204 });
    }),

    http.get(`${API}/auth/me`, () => {
      const user = db.sessionEmail ? db.users.get(db.sessionEmail) : undefined;
      if (!user) return problem(401, 'UNAUTHENTICATED', 'Log in to continue');
      return HttpResponse.json(publicUser(user));
    }),

    http.post(`${API}/auth/register`, async ({ request }) => {
      if (!csrfOk(request)) return problem(403, 'CSRF_INVALID', 'Invalid CSRF token');
      const body = (await request.json()) as { email?: string; password?: string; displayName?: string };
      const email = (body.email ?? '').trim().toLowerCase();
      if ((body.password ?? '').length < 10) {
        return problem(400, 'VALIDATION_FAILED', 'Some fields need attention', {
          errors: [{ field: 'password', message: 'Use at least 10 characters.' }],
        });
      }
      if (db.users.has(email))
        return problem(409, 'CONFLICT', 'An account with this email may already exist');
      const user: StoredUser = {
        id: crypto.randomUUID(),
        email,
        displayName: (body.displayName ?? '').trim(),
        onboardingCompleted: false,
        password: body.password ?? '',
      };
      db.users.set(email, user);
      db.sessionEmail = email;
      return HttpResponse.json(publicUser(user), { status: 201 });
    }),

    http.post(`${API}/auth/login`, async ({ request }) => {
      if (!csrfOk(request)) return problem(403, 'CSRF_INVALID', 'Invalid CSRF token');
      const body = (await request.json()) as { email?: string; password?: string };
      const user = db.users.get((body.email ?? '').trim().toLowerCase());
      if (!user || user.password !== body.password) {
        return problem(401, 'UNAUTHENTICATED', 'Invalid email or password');
      }
      db.sessionEmail = user.email;
      return HttpResponse.json(publicUser(user));
    }),

    http.post(`${API}/auth/logout`, ({ request }) => {
      if (!csrfOk(request)) return problem(403, 'CSRF_INVALID', 'Invalid CSRF token');
      db.sessionEmail = null;
      return new HttpResponse(null, { status: 204 });
    }),
  ];
}
