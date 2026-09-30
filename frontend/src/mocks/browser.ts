import { setupWorker } from 'msw/browser';
import { createAcademicStore, seedDemoAcademics } from './academics';
import { seedDemoCoursework } from './coursework';
import { createHandlers, createMockDb, DEFAULT_SETTINGS } from './handlers';

/**
 * Starts in-browser API mocks for `npm run dev:mock`.
 * A demo account is pre-registered: demo@nova.dev / nova-demo-2026
 * It comes with three semesters of clearly fictional courses, grades, attendance, assignments, exams and links.
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
  const demoAcademics = createAcademicStore();
  seedDemoAcademics(demoAcademics);
  seedDemoCoursework(demoAcademics);
  db.academics.set('00000000-0000-4000-8000-00000000de00', demoAcademics);
  db.settings.set('00000000-0000-4000-8000-00000000de00', {
    ...DEFAULT_SETTINGS,
    defaultAttendanceTarget: 75,
  });
  const worker = setupWorker(...createHandlers(db));
  await worker.start({ onUnhandledRequest: 'bypass', quiet: true });
  console.info('[NOVA] Mock API active. Demo login: demo@nova.dev / nova-demo-2026');
}
