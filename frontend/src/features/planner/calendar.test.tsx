import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createAcademicStore, seedDemoAcademics, type AcademicStore } from '@/mocks/academics';
import { createMockDb, DEFAULT_SETTINGS } from '@/mocks/handlers';
import type { StoredTask } from '@/mocks/planner';
import { axeViolations } from '@/test/axe';
import { renderRoute } from '@/test/render';
import { installMockApi, TEST_USER } from '@/test/server';

/** The user id createMockDb gives the logged-in test user. */
const USER_ID = '00000000-0000-4000-8000-000000000001';
/** A fixed week (Monday 2 – Sunday 8 November 2026); the calendar shows whatever date it's given. */
const MON = '2026-11-02';

function task(id: string, title: string, changes: Partial<StoredTask>): StoredTask {
  return {
    id,
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
    projectId: null,
    learningGoalId: null,
    createdAt: 1,
    ...changes,
  };
}

/**
 * The demo semesters and courses with an open-ended current term, plus: a Monday lecture, a
 * Tuesday exam, a Wednesday deadline and Thursday/Friday tasks, all in UTC.
 */
function setup(): { store: AcademicStore; dbms: string } {
  const store = createAcademicStore();
  seedDemoAcademics(store);
  const current = store.semesters.find((s) => s.current)!;
  current.startsOn = null;
  current.endsOn = null;
  const dbms = store.courses.find((c) => c.name === 'Database Systems' && c.semesterId === current.id)!.id;
  store.timetable.push({
    id: 'tt-1',
    courseId: dbms,
    dayOfWeek: 1,
    startsAt: '09:00',
    endsAt: '09:50',
    kind: 'LECTURE',
    location: 'Room 204',
    instructor: null,
  });
  store.exams.push({
    id: 'exam-1',
    courseId: dbms,
    title: 'Mid-semester 1',
    kind: 'MIDTERM',
    startsAt: '2026-11-03T10:00:00.000Z',
    durationMinutes: 90,
    location: 'Hall B',
  });
  store.assignments.push({
    id: 'asg-1',
    courseId: dbms,
    title: 'ER diagram',
    description: null,
    dueAt: '2026-11-04T18:00:00.000Z',
    priority: 'HIGH',
    status: 'NOT_STARTED',
    estimatedMinutes: null,
    progressPct: 0,
    submittedAt: null,
    completedAt: null,
    createdAt: 1,
  });
  store.tasks.push(
    task('task-1', 'Revise joins', { plannedFor: '2026-11-05', plannedStart: '18:00', estimatedMinutes: 45 }),
    task('task-2', 'Read notes', { plannedFor: '2026-11-05', estimatedMinutes: 30 }),
    task('task-3', 'Laundry', {
      plannedFor: '2026-11-06',
      status: 'DONE',
      completedAt: '2026-11-06T08:00:00.000Z',
    }),
  );
  const db = createMockDb({ loggedInAs: TEST_USER });
  db.academics.set(USER_ID, store);
  db.settings.set(USER_ID, { ...DEFAULT_SETTINGS, timezone: 'UTC' });
  installMockApi(db);
  return { store, dbms };
}

const day = (name: string) => screen.findByRole('region', { name });

describe('Calendar', () => {
  it('shows a week of classes, exams, deadlines and tasks that link to where they live', async () => {
    const { dbms } = setup();
    const { container } = renderRoute(`/app/planner/calendar?date=${MON}`);

    expect(await screen.findByRole('heading', { name: '2 – 8 Nov 2026' })).toBeInTheDocument();
    const monday = await day('Monday 2 November');
    expect(
      within(monday).getByRole('link', { name: 'Class: Database Systems, 09:00–09:50, Room 204' }),
    ).toHaveAttribute('href', `/app/academics/courses/${dbms}`);
    expect(within(monday).getByText('50 min of classes')).toBeInTheDocument();

    const tuesday = await day('Tuesday 3 November');
    expect(
      within(tuesday).getByRole('link', { name: /^Exam: Mid-semester 1, CSE 201, 10:00–11:30, Hall B/ }),
    ).toHaveAttribute('href', '/app/academics/exams/exam-1');
    expect(within(tuesday).getByText('1 exam')).toBeInTheDocument();

    const wednesday = await day('Wednesday 4 November');
    expect(
      within(wednesday).getByRole('link', { name: /^Assignment due: ER diagram, CSE 201, Due 18:00/ }),
    ).toHaveAttribute('href', `/app/academics/assignments?course=${dbms}`);

    const thursday = await day('Thursday 5 November');
    const untimed = within(thursday).getAllByRole('button', { name: /^Task:/ });
    expect(untimed.map((b) => b.getAttribute('aria-label'))).toEqual([
      'Task: Read notes. Edit',
      'Task: Revise joins, 18:00–18:45. Edit',
    ]);
    expect(within(thursday).getByText('1 h 15 min planned')).toBeInTheDocument();

    expect(
      within(await day('Friday 6 November')).getByRole('button', { name: 'Task: Laundry, done. Edit' }),
    ).toBeInTheDocument();
    expect(within(await day('Saturday 7 November')).getByText('Nothing scheduled.')).toBeInTheDocument();
    expect(await axeViolations(container)).toEqual([]);
  });

  it('opens a task for editing, and adds one on a chosen day', async () => {
    setup();
    const { user } = renderRoute(`/app/planner/calendar?date=${MON}`);

    await user.click(await screen.findByRole('button', { name: 'Task: Revise joins, 18:00–18:45. Edit' }));
    const edit = await screen.findByRole('dialog', { name: 'Edit task' });
    expect(within(edit).getByLabelText('Title')).toHaveValue('Revise joins');
    expect(within(edit).getByLabelText('Start time (optional)')).toHaveValue('18:00');
    await user.click(within(edit).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'Add a task on Saturday 7 November' }));
    const add = await screen.findByRole('dialog', { name: 'New task' });
    expect(within(add).getByLabelText('Day (optional)')).toHaveValue('2026-11-07');
    await user.type(within(add).getByLabelText('Title'), 'Groceries');
    await user.click(within(add).getByRole('button', { name: 'Add task' }));

    const saturday = await day('Saturday 7 November');
    expect(
      await within(saturday).findByRole('button', { name: 'Task: Groceries. Edit' }),
    ).toBeInTheDocument();
  });

  it('moves between weeks and switches to the month', async () => {
    setup();
    const { user, router } = renderRoute(`/app/planner/calendar?date=${MON}`);

    await screen.findByRole('heading', { name: '2 – 8 Nov 2026' });
    await user.click(screen.getByRole('link', { name: 'Next week' }));
    expect(await screen.findByRole('heading', { name: '9 – 15 Nov 2026' })).toBeInTheDocument();
    // The weekly lecture repeats; one-off items don't
    expect(
      within(await day('Monday 9 November')).getByRole('link', { name: /^Class: Database Systems/ }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /^Exam:/ })).not.toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: 'Month' }));
    expect(await screen.findByRole('heading', { name: 'November 2026' })).toBeInTheDocument();
    expect(router.state.location.search).toBe('?view=month&date=2026-11-09');
    const tuesday = await day('Tuesday 3 November');
    expect(within(tuesday).getByRole('link', { name: /^Exam: Mid-semester 1/ })).toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: 'Previous month' }));
    expect(await screen.findByRole('heading', { name: 'October 2026' })).toBeInTheDocument();
  });

  it('links a crowded day in the month to its week', async () => {
    const { store } = setup();
    for (const n of [1, 2, 3, 4]) {
      store.tasks.push(task(`extra-${n}`, `Errand ${n}`, { plannedFor: '2026-11-10' }));
    }
    renderRoute('/app/planner/calendar?view=month&date=2026-11-10');

    // Phones list every item; wider screens show three and link the rest to the week
    const tuesday = await day('Tuesday 10 November');
    expect(within(tuesday).getAllByRole('button', { name: /^Task: Errand/ })).toHaveLength(4);
    const more = within(tuesday).getAllByRole('link', { hidden: true });
    expect(more.map((l) => [l.textContent, l.getAttribute('href')])).toEqual([
      ['+1 more on Tuesday 10 November, in the week view', '/app/planner/calendar?date=2026-11-10'],
    ]);
  });
});
