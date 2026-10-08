import { delay, http } from 'msw';
import { setupWorker } from 'msw/browser';
import { API, problem } from './http';
import { seedDemoStore } from './demo';
import { createHandlers, createMockDb, DEFAULT_SETTINGS } from './handlers';

/**
 * Starts in-browser API mocks for `npm run dev:mock`.
 * A demo account is pre-registered: demo@nova.dev / nova-demo-2026
 * It comes with the demo's clearly fictional data (see demo.ts). "Try the demo" makes a fresh,
 * temporary copy of the same data, like the real backend does.
 */
export async function startMockApi(): Promise<void> {
  const db = createMockDb();
  db.users.set('demo@nova.dev', {
    id: '00000000-0000-4000-8000-00000000de00',
    email: 'demo@nova.dev',
    displayName: 'Demo Student',
    onboardingCompleted: true, // the demo is already set up; register a new account to see onboarding
    password: 'nova-demo-2026',
  });
  db.academics.set('00000000-0000-4000-8000-00000000de00', seedDemoStore());
  db.settings.set('00000000-0000-4000-8000-00000000de00', {
    ...DEFAULT_SETTINGS,
    defaultAttendanceTarget: 75,
  });
  const worker = setupWorker(faultHandler(), ...createHandlers(db));
  exposeFaults();
  await worker.start({ onUnhandledRequest: 'bypass', quiet: true });
  console.info('[NOVA] Mock API active. Demo login: demo@nova.dev / nova-demo-2026');
}

// ───────────── Fault injection (mock mode only) ─────────────

/**
 * What the mock should break, for checking loading and error states by hand or in the e2e suite:
 * `window.__novaMock.failRequests(['/tasks'])` makes matching calls answer 500 (`'*'` = everything but
 * auth), `slowDown(1500)` delays every answer, `reset()` puts things back. Never part of a real build:
 * this file is only loaded by `npm run dev:mock`.
 */
const faults = { fail: [] as string[], delayMs: 0 };

function faultHandler() {
  return http.all(`${API}/*`, async ({ request }) => {
    const path = new URL(request.url).pathname.slice(API.length);
    if (faults.delayMs > 0) await delay(faults.delayMs);
    const auth = path.startsWith('/auth');
    if (faults.fail.some((p) => (p === '*' ? !auth : path.startsWith(p)))) {
      return problem(500, 'INTERNAL_ERROR', 'Something went wrong on our side');
    }
    return undefined; // fall through to the real mock handlers
  });
}

declare global {
  interface Window {
    __novaMock?: {
      failRequests: (prefixes: string[]) => void;
      slowDown: (ms: number) => void;
      reset: () => void;
      /** Set by App: drops cached data (except the session), so the next page fetches afresh. */
      forgetCache?: () => void;
    };
  }
}

function exposeFaults() {
  window.__novaMock = {
    failRequests: (prefixes) => {
      faults.fail = prefixes;
    },
    slowDown: (ms) => {
      faults.delayMs = ms;
    },
    reset: () => {
      faults.fail = [];
      faults.delayMs = 0;
    },
  };
}
