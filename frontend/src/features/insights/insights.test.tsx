import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { addDays, todayIn } from '@/lib/dates';
import { createAcademicStore, seedDemoAcademics, type AcademicStore } from '@/mocks/academics';
import { createMockDb, DEFAULT_SETTINGS } from '@/mocks/handlers';
import { buildInsights } from '@/mocks/insights';
import { axeViolations } from '@/test/axe';
import { renderRoute } from '@/test/render';
import { installMockApi, TEST_USER } from '@/test/server';

/** The user id createMockDb gives the logged-in test user. */
const USER_ID = '00000000-0000-4000-8000-000000000001';
const TODAY = todayIn('UTC');
const HOUR = 3_600_000;

const task = (id: string, title: string, changes: Partial<AcademicStore['tasks'][number]> = {}) => ({
  id,
  title,
  description: null,
  category: 'PERSONAL' as const,
  priority: 'MEDIUM' as const,
  status: 'TODO' as const,
  plannedFor: null,
  plannedStart: null,
  dueAt: null,
  estimatedMinutes: null,
  completedAt: null,
  recurrence: 'NONE' as const,
  seriesId: null,
  courseId: null,
  examId: null,
  projectId: null,
  learningGoalId: null,
  hackathonId: null,
  internshipId: null,
  createdAt: 1,
  ...changes,
});

function setup(fill: (store: AcademicStore) => void = () => {}): AcademicStore {
  const store = createAcademicStore();
  seedDemoAcademics(store);
  fill(store);
  const db = createMockDb({ loggedInAs: TEST_USER });
  db.academics.set(USER_ID, store);
  db.settings.set(USER_ID, { ...DEFAULT_SETTINGS, timezone: 'UTC' });
  installMockApi(db);
  return store;
}

/** Five tasks planned today (four done) and a DBMS exam in 3 days with nothing ready and no study planned. */
function busyWeek(store: AcademicStore) {
  for (let i = 1; i <= 5; i++) {
    store.tasks.push(
      task(`t-${i}`, `Planned ${i}`, {
        plannedFor: TODAY,
        ...(i <= 4 ? { status: 'DONE' as const, completedAt: new Date().toISOString() } : {}),
      }),
    );
  }
  const dbms = store.courses.find((c) => c.name === 'Database Systems')!;
  store.exams.push({
    id: 'e-1',
    courseId: dbms.id,
    title: 'DBMS midsem',
    kind: 'MIDTERM',
    startsAt: new Date(Date.parse(`${addDays(TODAY, 3)}T09:00:00Z`)).toISOString(),
    durationMinutes: 90,
    location: null,
  });
  store.topics.push(
    { id: 'tp-1', examId: 'e-1', title: 'Joins', position: 0, doneAt: null, createdAt: 1 },
    { id: 'tp-2', examId: 'e-1', title: 'Indexing', position: 1, doneAt: null, createdAt: 2 },
  );
}

describe('Insights', () => {
  it('says what each rule needs when there isn’t enough data yet', async () => {
    setup();
    const { user, container } = renderRoute('/app/insights');

    expect(await screen.findByText('Insights appear once NOVA has a week of your data.')).toBeInTheDocument();
    const waiting = screen.getByRole('region', { name: 'Waiting for more data' });
    expect(waiting).toHaveTextContent('Task completionNeeds 5 tasks planned for days this week; you have 0.');
    expect(await axeViolations(container)).toEqual([]);

    await user.click(screen.getByRole('link', { name: 'This month' }));
    expect(await screen.findByText(/Needs 5 tasks planned for days this month/)).toBeInTheDocument();
  });

  it('shows each insight with its evidence, warnings first', async () => {
    setup(busyWeek);
    const { user, container } = renderRoute('/app/insights');

    const cards = await screen.findAllByRole('article');
    expect(cards.map((c) => c.getAttribute('aria-label'))).toEqual([
      '1 exam in the next 14 days is less than half prepared: DBMS midsem (0 of 2 topics).',
      'No study time planned before DBMS midsem in 3 days, with 2 topics still to go.',
      'You completed 4 of 5 tasks planned this week (80%).',
    ]);
    expect(within(cards[0]!).getByText('Worth a look')).toBeInTheDocument();
    expect(within(cards[2]!).getByText('Going well')).toBeInTheDocument();

    // The evidence: numbers, formula and the records it came from
    const completion = cards[2]!;
    await user.click(within(completion).getByText('How we got this'));
    expect(within(completion).getByText('Planned').nextElementSibling).toHaveTextContent('5');
    expect(within(completion).getByText(/done ÷ planned/)).toBeInTheDocument();
    expect(within(completion).getByRole('link', { name: 'Planned 5' })).toHaveAttribute(
      'href',
      '/app/planner/tasks?task=t-5',
    );
    expect(within(cards[0]!).getByRole('link', { name: /^Open/ })).toHaveAttribute(
      'href',
      '/app/academics/exams/e-1',
    );
    expect(await axeViolations(container)).toEqual([]);
  });

  it('draws two small charts that can be read as tables', async () => {
    setup(busyWeek);
    const { user } = renderRoute('/app/insights');

    const charts = await screen.findByRole('region', { name: 'Charts' });
    const tasks = within(charts).getByRole('figure', { name: 'Tasks done per day' });
    expect(within(tasks).getByRole('img')).toHaveAccessibleName(/^Tasks done per day: 4 in total/);
    await user.click(within(tasks).getByRole('button', { name: 'View as table' }));
    expect(within(tasks).getByRole('table')).toHaveTextContent('4 done · 5 planned');

    const ahead = within(charts).getByRole('figure', { name: 'Deadlines ahead' });
    expect(within(ahead).getByText('Exam that day')).toBeInTheDocument();
    await user.click(within(ahead).getByRole('button', { name: 'View as table' }));
    expect(within(ahead).getAllByRole('row')).toHaveLength(15); // header + 14 days
    expect(within(ahead).getByRole('table')).toHaveTextContent('0 deadlines · 1 exam');
  });

  it('puts the top two on Home', async () => {
    setup(busyWeek);
    renderRoute('/app');
    const panel = await screen.findByRole('region', { name: 'This week' });
    await waitFor(() => expect(within(panel).getAllByRole('article')).toHaveLength(2));
    expect(within(panel).getByRole('link', { name: 'All insights' })).toHaveAttribute(
      'href',
      '/app/insights',
    );
  });
});

describe('the mock insight rules', () => {
  const settings = { ...DEFAULT_SETTINGS, timezone: 'UTC' };

  it('finds a deadline cluster and leaves spread-out weeks alone', () => {
    const store = createAcademicStore();
    const at = new Date(Date.parse(`${addDays(TODAY, 2)}T18:00:00Z`));
    for (let i = 0; i < 3; i++) {
      store.tasks.push(
        task(`d-${i}`, `Due ${i}`, { dueAt: new Date(at.getTime() + i * HOUR).toISOString() }),
      );
    }
    store.tasks.push(task('d-x', 'Elsewhere', { dueAt: `${addDays(TODAY, 5)}T09:00:00.000Z` }));
    const result = buildInsights(store, settings, 'WEEK');
    expect(result.insights.map((i) => i.rule)).toEqual(['DEADLINE_CLUSTER']);
    expect(result.insights[0]!.text).toMatch(/holds 3 of your 4 deadlines in the next 7 days\.$/);
    expect(result.insights[0]!.link).toBe(`/app/planner/calendar?date=${addDays(TODAY, 2)}`);
  });

  it('flags tasks carried over from earlier days of the window', () => {
    const store = createAcademicStore();
    const result = buildInsights(store, settings, 'MONTH');
    expect(result.from).toBe(`${TODAY.slice(0, 8)}01`);
    if (TODAY.slice(8) === '01') return; // no earlier day this month to carry over from
    store.tasks.push(
      task('c-1', 'Old 1', { plannedFor: result.from }),
      task('c-2', 'Old 2', { plannedFor: result.from }),
    );
    const again = buildInsights(store, settings, 'MONTH');
    expect(again.insights.map((i) => i.text)).toContain(
      '2 tasks planned for earlier days this month are still open.',
    );
  });
});
