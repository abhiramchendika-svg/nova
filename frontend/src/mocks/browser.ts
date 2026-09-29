import { setupWorker } from 'msw/browser';
import { createAcademicStore, seedDemoAcademics } from './academics';
import { createHandlers, createMockDb } from './handlers';

/**
 * Starts in-browser API mocks for `npm run dev:mock`.
 * A demo account is pre-registered: demo@nova.dev / nova-demo-2026
 * It comes with three semesters of clearly fictional courses and grades.
 */
export async function startMockApi(): Promise<void> {
  const db = createMockDb();
  db.users.set('demo@nova.dev', {
    id: '00000000-0000-4000-8000-00000000de00',
    email: 'demo@nova.dev',
    displayName: 'Demo Student',
    onboardingCompleted: false,
    password: 'nova-demo-2026',
  });
  const demoAcademics = createAcademicStore();
  seedDemoAcademics(demoAcademics);
  db.academics.set('00000000-0000-4000-8000-00000000de00', demoAcademics);
  const worker = setupWorker(...createHandlers(db));
  await worker.start({ onUnhandledRequest: 'bypass', quiet: true });
  console.info('[NOVA] Mock API active. Demo login: demo@nova.dev / nova-demo-2026');
}
