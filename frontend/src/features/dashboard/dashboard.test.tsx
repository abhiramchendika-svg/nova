import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { addDays, todayIn } from '@/lib/dates';
import { createAcademicStore, seedDemoAcademics, type AcademicStore } from '@/mocks/academics';
import { createMockDb, DEFAULT_SETTINGS } from '@/mocks/handlers';
import type { StoredTask } from '@/mocks/planner';
import { axeViolations } from '@/test/axe';
import { renderRoute } from '@/test/render';
import { installMockApi, TEST_USER } from '@/test/server';

/** The user id createMockDb gives the logged-in test user. */
const USER_ID = '00000000-0000-4000-8000-000000000001';
const TODAY = todayIn('UTC');
const HOUR = 3_600_000;
const hoursFromNow = (h: number) => new Date(Date.now() + h * HOUR).toISOString();

let n = 0;
function task(title: string, changes: Partial<StoredTask> = {}): StoredTask {
  n += 1;
  return {
    id: `task-${n}`,
    title,
    description: null,
    category: 'PERSONAL',
    priority: 'MEDIUM',
    status: 'TODO',
    plannedFor: null,
    plannedStart: null,
    dueAt: null,
    estimatedMinutes: null,
    completedAt: null,
    recurrence: 'NONE',
    seriesId: null,
    courseId: null,
    examId: null,
    createdAt: n,
    ...changes,
  };
}

/**
 * The demo semesters and courses with no attendance targets, records, coursework or tasks, so each
 * test adds exactly what it needs. Timezone UTC.
 */
function setup(fill: (store: AcademicStore, dbms: string) => void = () => {}): AcademicStore {
  const store = createAcademicStore();
  seedDemoAcademics(store);
  store.records = [];
  for (const s of store.semesters) s.attendanceTarget = null;
  for (const c of store.courses) {
    c.attendanceTarget = null;
    c.baselineConducted = 0;
    c.baselineAttended = 0;
  }
  const current = store.semesters.find((s) => s.current)!;
  const dbms = store.courses.find((c) => c.name === 'Database Systems' && c.semesterId === current.id)!.id;
  fill(store, dbms);
  const db = createMockDb({ loggedInAs: TEST_USER });
  db.academics.set(USER_ID, store);
  db.settings.set(USER_ID, { ...DEFAULT_SETTINGS, timezone: 'UTC', defaultAttendanceTarget: null });
  installMockApi(db);
  return store;
}

/** Everything Home ranks: overdue work, attendance below target, an under-prepared exam, a close deadline. */
function busyWeek(store: AcademicStore, dbms: string) {
  const course = store.courses.find((c) => c.id === dbms)!;
  course.attendanceTarget = 75;
  course.baselineConducted = 10;
  course.baselineAttended = 6;
  const assignment = (id: string, title: string, dueAt: string, priority: 'LOW' | 'HIGH') => ({
    id,
    courseId: dbms,
    title,
    description: null,
    dueAt,
    priority,
    status: 'NOT_STARTED' as const,
    estimatedMinutes: null,
    progressPct: 0,
    submittedAt: null,
    completedAt: null,
    createdAt: 1,
  });
  store.assignments = [
    assignment('a-1', 'Overdue report', hoursFromNow(-50), 'HIGH'),
    assignment('a-2', 'Due soon', hoursFromNow(10), 'LOW'),
  ];
  store.exams = [
    {
      id: 'exam-1',
      courseId: dbms,
      title: 'Mid-semester 1',
      kind: 'MIDTERM',
      startsAt: `${addDays(TODAY, 3)}T09:00:00.000Z`,
      durationMinutes: 90,
      location: null,
    },
  ];
  store.topics = ['Joins', 'Indexing'].map((title, i) => ({
    id: `topic-${i}`,
    examId: 'exam-1',
    title,
    position: i,
    doneAt: null,
    createdAt: i,
  }));
  store.tasks = [
    task('Overdue form', { dueAt: hoursFromNow(-30) }),
    task('Plan the sprint', { plannedFor: TODAY }),
    task('Laundry', { plannedFor: TODAY, status: 'DONE', completedAt: new Date().toISOString() }),
    task('Yesterday’s errand', { status: 'DONE', completedAt: `${addDays(TODAY, -1)}T12:00:00.000Z` }),
    task('Older errand', { status: 'DONE', completedAt: `${addDays(TODAY, -2)}T12:00:00.000Z` }),
  ];
}

const panel = (name: string) => screen.findByRole('region', { name });

describe('Home: what needs you', () => {
  it('ranks overdue work, attendance, exams and close deadlines, each with a reason and a link', async () => {
    setup(busyWeek);
    const { container } = renderRoute('/app');

    const attention = await panel('Needs attention');
    const list = await within(attention).findByRole('list', { name: 'Most urgent first' });
    const links = within(list).getAllByRole('link');
    expect(links.map((l) => l.textContent)).toEqual([
      expect.stringContaining('Overdue report'),
      expect.stringContaining('Database Systems'),
      expect.stringContaining('Overdue form'),
      expect.stringContaining('Mid-semester 1'),
      expect.stringContaining('Due soon'),
    ]);
    expect(links[1]).toHaveTextContent('60% · below your 75% target; attend the next 6 classes');
    expect(links[1]).toHaveAttribute('href', expect.stringMatching(/^\/app\/academics\/courses\//));
    expect(links[2]).toHaveAttribute('href', '/app/planner/tasks');
    expect(links[3]).toHaveTextContent('In 3 days · 0 of 2 topics ready');
    expect(links[3]).toHaveAttribute('href', '/app/academics/exams/exam-1');
    expect(within(links[0]!).getByText('Overdue')).toBeInTheDocument();
    expect(await axeViolations(container)).toEqual([]);
  });

  it('says so when nothing needs you', async () => {
    setup();
    renderRoute('/app');
    expect(
      await within(await panel('Needs attention')).findByText('Nothing needs you right now.'),
    ).toBeInTheDocument();
  });
});

describe('Home: summaries', () => {
  it('sums up the semester and the planner week, with a streak', async () => {
    setup(busyWeek);
    renderRoute('/app');

    const summaries = await panel('Summaries');
    expect(await within(summaries).findByText(/Lowest attendance: Database Systems at/)).toHaveTextContent(
      'Lowest attendance: Database Systems at 60%',
    );
    expect(within(summaries).getByRole('link', { name: /Open grades/ })).toHaveAttribute(
      'href',
      '/app/academics/grades',
    );
    expect(within(summaries).getByText('Today: 2 open · 1 done')).toBeInTheDocument();
    expect(within(summaries).getByText('This week: 1 of 2 planned tasks done')).toBeInTheDocument();
    expect(within(summaries).getByText('3-day streak')).toBeInTheDocument();
  });

  it('invites setup when there’s nothing to sum up', async () => {
    setup();
    renderRoute('/app');
    const summaries = await panel('Summaries');
    expect(
      await within(summaries).findByText('Plan tasks for today and see your weekly completion.'),
    ).toBeInTheDocument();
  });
});

describe('Home: today’s tasks', () => {
  it('ticks a task off in place and adds another', async () => {
    const store = setup(busyWeek);
    const { user } = renderRoute('/app');

    const tasks = await screen.findByRole('region', { name: 'Tasks' });
    await user.click(await within(tasks).findByLabelText('Plan the sprint'));
    expect(await screen.findByText('Done: “Plan the sprint”.')).toBeInTheDocument();
    await waitFor(() => expect(within(tasks).queryByLabelText('Plan the sprint')).not.toBeInTheDocument());
    expect(within(tasks).getByText('2 done today')).toBeInTheDocument();

    await user.type(within(tasks).getByLabelText('Add a task for today'), 'Call the bank{Enter}');
    expect(await within(tasks).findByLabelText('Call the bank')).toBeInTheDocument();
    expect(store.tasks.at(-1)).toMatchObject({ title: 'Call the bank', plannedFor: TODAY });
  });
});

describe('Home: next 7 days', () => {
  it('lists the coming deadlines and exams by day', async () => {
    setup(busyWeek);
    renderRoute('/app');

    const week = await panel('Next 7 days');
    const list = await within(week).findByRole('list', { name: 'Next 7 days' });
    const links = within(list)
      .getAllByRole('link')
      .map((l) => [l.textContent, l.getAttribute('href')]);
    expect(links).toEqual([
      ['Assignment due: Due soon', expect.stringMatching(/^\/app\/academics\/assignments\?course=/)],
      ['Exam: Mid-semester 1', '/app/academics/exams/exam-1'],
    ]);
    // Overdue work is in "Needs attention", not here
    expect(within(list).queryByText('Overdue report')).not.toBeInTheDocument();
  });
});
