import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { addDays, todayIn } from '@/lib/dates';
import { createAcademicStore, seedDemoAcademics, type AcademicStore } from '@/mocks/academics';
import { seedDemoCoursework } from '@/mocks/coursework';
import { createMockDb, DEFAULT_SETTINGS } from '@/mocks/handlers';
import type { StoredTask } from '@/mocks/planner';
import { axeViolations } from '@/test/axe';
import { renderRoute } from '@/test/render';
import { installMockApi, TEST_USER } from '@/test/server';

/** The user id createMockDb gives the logged-in test user. */
const USER_ID = '00000000-0000-4000-8000-000000000001';
const MIDSEM = '00000000-0000-4000-8000-0000000de001';
const TODAY = todayIn('UTC');
const SERIES = '00000000-0000-4000-8000-00000000fb99';

let n = 0;
function task(title: string, changes: Partial<StoredTask> = {}): StoredTask {
  n += 1;
  return {
    id: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
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
    hackathonId: null,
    internshipId: null,
    createdAt: n,
    ...changes,
  };
}

/**
 * Demo semesters and coursework (seedDemoCoursework) in UTC, plus the given tasks. The demo's
 * Mid-semester 1 (Database Systems, CSE 201) is in 9 days with topics ER modelling ✓,
 * Normalization ✓, SQL joins, Transactions.
 */
function setup(tasks: StoredTask[] = []): AcademicStore {
  const store = createAcademicStore();
  seedDemoAcademics(store);
  seedDemoCoursework(store);
  store.tasks.push(...tasks);
  const db = createMockDb({ loggedInAs: TEST_USER });
  db.academics.set(USER_ID, store);
  db.settings.set(USER_ID, { ...DEFAULT_SETTINGS, timezone: 'UTC' });
  installMockApi(db);
  return store;
}

const group = (name: RegExp) => screen.findByRole('region', { name });
const titlesIn = (region: HTMLElement) =>
  within(region)
    .getAllByRole('checkbox')
    .map((box) => box.closest('li')!.querySelector('label')!.firstChild!.firstChild!.textContent);

describe('Tasks page', () => {
  it('shows today’s work in “what now?” order, with what’s already done', async () => {
    setup([
      task('Today, high', { priority: 'HIGH', plannedFor: TODAY }),
      task('Carried over', { plannedFor: addDays(TODAY, -1) }),
      task('Overdue form', { priority: 'LOW', dueAt: `${addDays(TODAY, -2)}T09:00:00.000Z` }),
      task('Tomorrow thing', { plannedFor: addDays(TODAY, 1) }),
      task('Someday thing'),
      task('Laundry', { status: 'DONE', plannedFor: TODAY, completedAt: new Date().toISOString() }),
    ]);
    const { container } = renderRoute('/app/planner/tasks');

    const todo = await group(/^To do/);
    expect(titlesIn(todo)).toEqual(['Overdue form', 'Today, high', 'Carried over']);
    expect(within(todo).getByText('Overdue')).toBeInTheDocument();
    expect(within(todo).getByText('Yesterday')).toBeInTheDocument();
    expect(within(await group(/^Done today/)).getByLabelText('Laundry')).toBeChecked();
    expect(screen.queryByText('Tomorrow thing')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Today' })).toHaveAttribute('aria-current', 'page');
    expect(await axeViolations(container)).toEqual([]);
  });

  it('adds a task for today from the quick-add bar', async () => {
    const store = setup();
    const { user } = renderRoute('/app/planner/tasks');

    expect(await screen.findByText('Nothing planned for today.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Add' }));
    expect(screen.getByText('Give the task a title.')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Add a task for today'), 'Buy a notebook{Enter}');
    expect(within(await group(/^To do/)).getByLabelText('Buy a notebook')).toBeInTheDocument();
    expect(screen.getByLabelText('Add a task for today')).toHaveValue('');
    expect(store.tasks[0]).toMatchObject({
      title: 'Buy a notebook',
      plannedFor: TODAY,
      category: 'PERSONAL',
    });
  });

  it('plans the next repeat when a repeating task is ticked off', async () => {
    setup([task('Journal', { plannedFor: TODAY, recurrence: 'DAILY', seriesId: SERIES })]);
    const { user } = renderRoute('/app/planner/tasks');

    await user.click(await screen.findByLabelText('Journal'));
    expect(
      await screen.findByText('Done: “Journal”. The next one is planned for tomorrow.'),
    ).toBeInTheDocument();
    expect(within(await group(/^Done today/)).getByLabelText('Journal')).toBeChecked();

    await user.click(screen.getByRole('link', { name: 'Upcoming' }));
    const tomorrow = await group(/^Tomorrow/);
    expect(within(tomorrow).getByLabelText('Journal')).not.toBeChecked();
    expect(within(tomorrow).getByText('Every day')).toBeInTheDocument();
  });

  it('creates a task with a day, start time and course from the dialog', async () => {
    const store = setup();
    const { user } = renderRoute('/app/planner/tasks?view=upcoming');

    await user.click(await screen.findByRole('button', { name: 'New task' }));
    const dialog = await screen.findByRole('dialog', { name: 'New task' });
    await user.type(within(dialog).getByLabelText('Title'), 'Revise joins');
    fireEvent.change(within(dialog).getByLabelText('Start time (optional)'), { target: { value: '07:30' } });
    await user.click(within(dialog).getByRole('button', { name: 'Add task' }));
    expect(await within(dialog).findByText('Pick a day before a start time.')).toBeInTheDocument();

    fireEvent.change(within(dialog).getByLabelText('Day (optional)'), {
      target: { value: addDays(TODAY, 2) },
    });
    const dbms = store.courses.find((c) => c.name === 'Database Systems')!;
    await user.selectOptions(within(dialog).getByLabelText('Course (optional)'), dbms.id);
    await user.type(within(dialog).getByLabelText('Estimate in minutes (optional)'), '45');
    await user.click(within(dialog).getByRole('button', { name: 'Add task' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    const item = (await screen.findByLabelText('Revise joins')).closest('li')!;
    expect(item).toHaveTextContent('07:30');
    expect(item).toHaveTextContent('CSE 201');
    expect(item).toHaveTextContent('about 45 min');
    expect(store.tasks[0]).toMatchObject({ category: 'ACADEMIC', plannedStart: '07:30', courseId: dbms.id });
  });

  it('deletes a repeating task and its future repeats when asked', async () => {
    const store = setup([
      task('Journal', { plannedFor: TODAY, recurrence: 'DAILY', seriesId: SERIES }),
      task('Journal', { plannedFor: addDays(TODAY, 1), recurrence: 'DAILY', seriesId: SERIES }),
      task('Journal', { plannedFor: addDays(TODAY, 2), recurrence: 'DAILY', seriesId: SERIES }),
      task('Gym', { plannedFor: TODAY }),
    ]);
    const { user, container } = renderRoute('/app/planner/tasks');

    await user.click(await screen.findByRole('button', { name: 'Delete Journal' }));
    const dialog = await screen.findByRole('dialog', { name: 'Delete a repeating task?' });
    expect(within(dialog).getByLabelText('Only this one')).toBeChecked();
    expect(await axeViolations(container.ownerDocument.body)).toEqual([]);
    await user.click(within(dialog).getByLabelText(/This and future repeats/));
    await user.click(within(dialog).getByRole('button', { name: 'Delete task' }));

    expect(await screen.findByText('Deleted “Journal” and its future repeats.')).toBeInTheDocument();
    expect(store.tasks.map((t) => t.title)).toEqual(['Gym']);

    // A one-off gets the plain confirmation
    await user.click(screen.getByRole('button', { name: 'Delete Gym' }));
    const plain = await screen.findByRole('dialog', { name: 'Delete this task?' });
    expect(within(plain).queryByRole('radio')).not.toBeInTheDocument();
  });

  it('filters by category through the URL', async () => {
    setup([
      task('Two LeetCode mediums', { category: 'CODING', plannedFor: TODAY }),
      task('Call home', { plannedFor: TODAY }),
    ]);
    const { user, router } = renderRoute('/app/planner/tasks');

    await screen.findByLabelText('Call home');
    await user.selectOptions(screen.getByLabelText('Category'), 'CODING');
    expect(router.state.location.search).toBe('?category=CODING');
    expect(screen.queryByLabelText('Call home')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Two LeetCode mediums')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(await screen.findByLabelText('Call home')).toBeInTheDocument();
  });

  it('lists finished tasks and can reopen one', async () => {
    setup([
      task('Old essay', { status: 'DONE', completedAt: '2026-01-05T10:00:00.000Z' }),
      task('Lab record', { status: 'DONE', completedAt: '2026-02-05T10:00:00.000Z' }),
    ]);
    const { user } = renderRoute('/app/planner/tasks?view=done');

    const done = await group(/^Finished/);
    expect(titlesIn(done)).toEqual(['Lab record', 'Old essay']);
    await user.click(within(done).getByLabelText('Old essay'));
    expect(await screen.findByText('“Old essay” is open again.')).toBeInTheDocument();
    await waitFor(() => expect(titlesIn(done)).toEqual(['Lab record']));
  });
});

describe('Exam study plan', () => {
  it('turns unfinished topics into study tasks spread before the exam', async () => {
    const store = setup();
    const { user } = renderRoute(`/app/academics/exams/${MIDSEM}`);

    const plan = await group(/^Study plan/);
    expect(await within(plan).findByText(/No study tasks yet/)).toBeInTheDocument();
    await user.click(within(plan).getByRole('button', { name: 'Plan my revision' }));

    const dialog = await screen.findByRole('dialog', { name: 'Plan your revision' });
    // Two unfinished topics over the 9 days before the exam
    expect(within(dialog).getByLabelText('Day for SQL joins')).toHaveValue(TODAY);
    expect(within(dialog).getByLabelText('Day for Transactions')).toHaveValue(addDays(TODAY, 4));
    fireEvent.change(within(dialog).getByLabelText('Day for Transactions'), {
      target: { value: addDays(TODAY, 5) },
    });
    await user.click(within(dialog).getByRole('button', { name: 'Add 2 study tasks' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    expect(await within(plan).findByLabelText('Study: SQL joins')).toBeInTheDocument();
    expect(within(plan).getByLabelText('Study: Transactions')).toBeInTheDocument();
    expect(store.tasks.map((t) => [t.title, t.plannedFor, t.examId, t.estimatedMinutes])).toEqual([
      ['Study: SQL joins', TODAY, MIDSEM, 60],
      ['Study: Transactions', addDays(TODAY, 5), MIDSEM, 60],
    ]);

    // Planning again finds nothing left to plan
    await user.click(within(plan).getByRole('button', { name: 'Plan my revision' }));
    expect(await screen.findByText('Every unfinished topic already has a study task.')).toBeInTheDocument();
  });

  it('lets a topic be left out of the plan', async () => {
    const store = setup();
    const { user } = renderRoute(`/app/academics/exams/${MIDSEM}`);

    const plan = await group(/^Study plan/);
    await user.click(within(plan).getByRole('button', { name: 'Plan my revision' }));
    const dialog = await screen.findByRole('dialog', { name: 'Plan your revision' });
    await user.click(within(dialog).getByLabelText('Transactions'));
    await user.click(within(dialog).getByRole('button', { name: 'Add 1 study task' }));

    await waitFor(() => expect(store.tasks.map((t) => t.title)).toEqual(['Study: SQL joins']));
  });

  it('adds a study task already linked to the exam', async () => {
    const store = setup();
    const { user } = renderRoute(`/app/academics/exams/${MIDSEM}`);

    const plan = await group(/^Study plan/);
    await user.click(within(plan).getByRole('button', { name: 'Add study task' }));
    const dialog = await screen.findByRole('dialog', { name: 'New task' });
    await waitFor(() => expect(within(dialog).getByLabelText('Exam (optional)')).toHaveValue(MIDSEM));
    await user.type(within(dialog).getByLabelText('Title'), 'Past paper 2024');
    await user.click(within(dialog).getByRole('button', { name: 'Add task' }));

    expect(await within(plan).findByLabelText('Past paper 2024')).toBeInTheDocument();
    expect(store.tasks[0]).toMatchObject({ examId: MIDSEM, category: 'ACADEMIC' });
  });
});
