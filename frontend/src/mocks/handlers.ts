import { http, HttpResponse, type HttpHandler } from 'msw';
import { API, CSRF_TOKEN, csrfOk, problem } from './http';
import type { CurrentUser } from '@/features/auth/types';
import { createAcademicsHandlers } from './academicsHandlers';
import { createDeveloperHandlers } from './developerHandlers';
import { createPlannerHandlers } from './plannerHandlers';
import { createAcademicStore, type AcademicStore } from './academics';
import type { Settings, SettingsRequest } from '@/features/settings/types';

/**
 * In-memory fake of the NOVA API: auth and settings here (docs/api.md §2.1), academics in academicsHandlers.ts.
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
  /** Academic data per user id, created on first use. */
  academics: Map<string, AcademicStore>;
  /** Settings per user id; neutral defaults until the user changes them. */
  settings: Map<string, SettingsRequest>;
}

export const DEFAULT_SETTINGS: SettingsRequest = {
  timezone: 'UTC',
  weekStart: 'MON',
  universityName: null,
  defaultAttendanceTarget: null,
  theme: 'SYSTEM',
};

/**
 * A fake backend. A seeded, logged-in user has finished onboarding unless the test says otherwise
 * (onboarding: 'pending'); accounts registered through the mock start it like real new ones.
 */
export function createMockDb(
  seed: { loggedInAs?: Omit<StoredUser, 'id' | 'onboardingCompleted'>; onboarding?: 'done' | 'pending' } = {},
): MockDb {
  const db: MockDb = { users: new Map(), sessionEmail: null, academics: new Map(), settings: new Map() };
  if (seed.loggedInAs) {
    const user: StoredUser = {
      id: '00000000-0000-4000-8000-000000000001',
      onboardingCompleted: seed.onboarding !== 'pending',
      ...seed.loggedInAs,
    };
    db.users.set(user.email.toLowerCase(), user);
    db.sessionEmail = user.email.toLowerCase();
  }
  return db;
}

function publicUser({ password: _password, ...user }: StoredUser): CurrentUser {
  return user;
}

export function createHandlers(db: MockDb): HttpHandler[] {
  const currentUser = () => (db.sessionEmail ? db.users.get(db.sessionEmail) : undefined);
  const settingsOf = (user: StoredUser): Settings => ({
    ...(db.settings.get(user.id) ?? DEFAULT_SETTINGS),
    onboardingCompleted: user.onboardingCompleted,
  });

  /** The logged-in user's academic store (created on first use), or null when logged out. */
  const storeFor = () => {
    const user = currentUser();
    if (!user) return null;
    let store = db.academics.get(user.id);
    if (!store) {
      store = createAcademicStore();
      db.academics.set(user.id, store);
    }
    return store;
  };
  const settingsFor = () => {
    const user = currentUser();
    return user ? (db.settings.get(user.id) ?? DEFAULT_SETTINGS) : DEFAULT_SETTINGS;
  };

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

    http.get(`${API}/settings`, () => {
      const user = currentUser();
      if (!user) return problem(401, 'UNAUTHENTICATED', 'Log in to continue');
      return HttpResponse.json(settingsOf(user));
    }),

    http.post(`${API}/settings/onboarding/complete`, ({ request }) => {
      const user = currentUser();
      if (!user) return problem(401, 'UNAUTHENTICATED', 'Log in to continue');
      if (!csrfOk(request)) return problem(403, 'CSRF_INVALID', 'Invalid CSRF token');
      user.onboardingCompleted = true;
      return HttpResponse.json(settingsOf(user));
    }),

    http.put(`${API}/settings`, async ({ request }) => {
      const user = currentUser();
      if (!user) return problem(401, 'UNAUTHENTICATED', 'Log in to continue');
      if (!csrfOk(request)) return problem(403, 'CSRF_INVALID', 'Invalid CSRF token');
      const body = (await request.json()) as SettingsRequest;
      try {
        new Intl.DateTimeFormat('en-US', { timeZone: body.timezone });
        if (!body.timezone?.trim()) throw new RangeError();
      } catch {
        return problem(400, 'VALIDATION_FAILED', 'Some fields need attention', {
          errors: [{ field: 'timezone', message: 'Unknown timezone. Use a name like Asia/Kolkata.' }],
        });
      }
      const t = body.defaultAttendanceTarget;
      if (t !== null && (!(t > 0) || t >= 100 || Math.round(t * 100) !== t * 100)) {
        return problem(400, 'VALIDATION_FAILED', 'Some fields need attention', {
          errors: [{ field: 'defaultAttendanceTarget', message: 'Must be more than 0 and less than 100.' }],
        });
      }
      db.settings.set(user.id, { ...DEFAULT_SETTINGS, ...body });
      return HttpResponse.json(settingsOf(user));
    }),

    ...createAcademicsHandlers(storeFor, settingsFor),
    ...createPlannerHandlers(storeFor, settingsFor),
    ...createDeveloperHandlers(storeFor, settingsFor),
  ];
}
