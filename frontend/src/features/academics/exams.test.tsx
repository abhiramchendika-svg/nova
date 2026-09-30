import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { todayIn, zonedToInstant } from '@/lib/dates';
import { createAcademicStore, seedDemoAcademics, type AcademicStore } from '@/mocks/academics';
import { orderedTopics, seedDemoCoursework } from '@/mocks/coursework';
import { createMockDb, DEFAULT_SETTINGS } from '@/mocks/handlers';
import { axeViolations } from '@/test/axe';
import { renderRoute } from '@/test/render';
import { installMockApi, TEST_USER } from '@/test/server';

/** The user id createMockDb gives the logged-in test user. */
const USER_ID = '00000000-0000-4000-8000-000000000001';
const MIDSEM = '00000000-0000-4000-8000-0000000de001';

/**
 * Demo semesters and coursework (seedDemoCoursework), relative to now, in UTC:
 *   Quiz 2          Compilers, in 4 days, topics: Regular expressions, DFA minimisation (none done)
 *   Mid-semester 1  Database Systems, in 9 days, topics: ER modelling ✓, Normalization ✓, SQL joins, Transactions
 */
function setup({ timezone = 'UTC', exams = true } = {}): AcademicStore {
  const store = createAcademicStore();
  seedDemoAcademics(store);
  seedDemoCoursework(store);
  if (!exams) {
    store.exams = [];
    store.topics = [];
  }
  const db = createMockDb({ loggedInAs: TEST_USER });
  db.academics.set(USER_ID, store);
  db.settings.set(USER_ID, { ...DEFAULT_SETTINGS, timezone });
  installMockApi(db);
  return store;
}

const card = (name: string) => screen.findByRole('article', { name });
const dayFromToday = (days: number, timezone = 'UTC') =>
  new Date(Date.parse(`${todayIn(timezone)}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

describe('Exams page', () => {
  it('counts down to each exam, soonest first, with prep progress', async () => {
    setup();
    renderRoute('/app/academics/exams');

    const quiz = await card('Quiz 2');
    expect(quiz).toHaveTextContent('In 4 days');
    expect(quiz).toHaveTextContent('0 of 2 topics ready (0%)');
    const midsem = await card('Mid-semester 1');
    expect(midsem).toHaveTextContent('In 9 days');
    expect(midsem).toHaveTextContent('CSE 201 Database Systems');
    expect(midsem).toHaveTextContent('2 of 4 topics ready (50%)');
    const order = screen.getAllByRole('article').map((a) => a.getAttribute('aria-labelledby'));
    expect(order.indexOf(quiz.getAttribute('aria-labelledby'))).toBeLessThan(
      order.indexOf(midsem.getAttribute('aria-labelledby')),
    );
    expect(within(midsem).getByRole('link', { name: 'Mid-semester 1' })).toHaveAttribute(
      'href',
      `/app/academics/exams/${MIDSEM}`,
    );
  });

  it('keeps past exams out of the way until asked', async () => {
    const store = setup();
    const compilers = store.courses.find((c) => c.name === 'Compilers')!.id;
    store.exams.push({
      id: 'past-quiz',
      courseId: compilers,
      title: 'Quiz 1',
      kind: 'QUIZ',
      startsAt: `${dayFromToday(-10)}T09:00:00.000Z`,
      durationMinutes: 30,
      location: null,
    });
    const { user } = renderRoute('/app/academics/exams');
    await card('Quiz 2');
    expect(screen.queryByRole('article', { name: 'Quiz 1' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Show past exams' }));
    expect(await card('Quiz 1')).toHaveTextContent('10 days ago');
  });

  it('filters by course', async () => {
    setup();
    const { user } = renderRoute('/app/academics/exams');
    await card('Quiz 2');

    await user.selectOptions(screen.getByLabelText('Course'), 'CSE 201 · Database Systems');
    await waitFor(() => expect(screen.queryByRole('article', { name: 'Quiz 2' })).not.toBeInTheDocument());
    expect(await card('Mid-semester 1')).toBeInTheDocument();
  });

  it('adds an exam with starting topics and opens it', async () => {
    const store = setup({ timezone: 'Asia/Kolkata' });
    const { user, router } = renderRoute('/app/academics/exams');
    await card('Quiz 2');
    const day = dayFromToday(12, 'Asia/Kolkata');

    await user.click(screen.getByRole('button', { name: 'Add exam' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add an exam' });
    await user.type(within(dialog).getByLabelText('Title'), 'Mid-semester 2');
    await user.selectOptions(within(dialog).getByLabelText('Course'), 'CSE 201 · Database Systems');
    fireEvent.change(within(dialog).getByLabelText('Date'), { target: { value: day } });
    fireEvent.change(within(dialog).getByLabelText('Starts at'), { target: { value: '10:30' } });
    await user.type(within(dialog).getByLabelText('Duration in minutes (optional)'), '90');
    await user.type(
      within(dialog).getByLabelText('Topics to prepare (optional)'),
      'Indexing{enter}{enter}  Query optimisation  {enter}Recovery',
    );
    await user.click(within(dialog).getByRole('button', { name: 'Add exam' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Mid-semester 2' })).toBeInTheDocument();
    expect(router.state.location.pathname).toMatch(/^\/app\/academics\/exams\/.+/);
    const topics = screen.getByRole('list', { name: 'Topics' });
    expect(
      within(topics)
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual(['Indexing', 'Query optimisation', 'Recovery']);
    const saved = store.exams.find((e) => e.title === 'Mid-semester 2')!;
    expect(saved.startsAt).toBe(zonedToInstant(day, '10:30', 'Asia/Kolkata'));
    expect(saved).toMatchObject({ kind: 'MIDTERM', durationMinutes: 90 });
  });

  it('checks the form before sending it', async () => {
    const store = setup();
    const { user } = renderRoute('/app/academics/exams');
    await card('Quiz 2');
    const before = store.exams.length;

    await user.click(screen.getByRole('button', { name: 'Add exam' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add an exam' });
    await user.type(within(dialog).getByLabelText('Duration in minutes (optional)'), '2000');
    await user.click(within(dialog).getByRole('button', { name: 'Add exam' }));

    expect(await within(dialog).findByText('Give the exam a title.')).toBeInTheDocument();
    expect(within(dialog).getByText('Choose a course.')).toBeInTheDocument();
    expect(within(dialog).getByText('Use whole minutes from 1 to 1440.')).toBeInTheDocument();
    expect(store.exams).toHaveLength(before);
  });

  it('has a calm empty state', async () => {
    setup({ exams: false });
    renderRoute('/app/academics/exams');
    expect(await screen.findByText('No exams coming up.')).toBeInTheDocument();
  });
});

describe('Exam page', () => {
  const topicsList = () => screen.findByRole('list', { name: 'Topics' });
  const titles = (list: HTMLElement) =>
    within(list)
      .getAllByRole('listitem')
      .map((li) => li.textContent);

  it('ticks topics off and updates the prep bar', async () => {
    const store = setup();
    const { user } = renderRoute(`/app/academics/exams/${MIDSEM}`);
    expect(await screen.findByRole('heading', { level: 1, name: 'Mid-semester 1' })).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: '2 of 4 topics ready' })).toHaveAttribute(
      'aria-valuenow',
      '50',
    );

    await user.click(screen.getByRole('checkbox', { name: 'SQL joins' }));
    expect(await screen.findByRole('progressbar', { name: '3 of 4 topics ready' })).toHaveAttribute(
      'aria-valuenow',
      '75',
    );
    expect(screen.getByRole('checkbox', { name: 'SQL joins' })).toBeChecked();
    expect(store.topics.find((t) => t.title === 'SQL joins')!.doneAt).not.toBeNull();

    await user.click(screen.getByRole('checkbox', { name: 'ER modelling' }));
    await waitFor(() => expect(screen.getByRole('checkbox', { name: 'ER modelling' })).not.toBeChecked());
  });

  it('reorders topics with move up and down', async () => {
    const store = setup();
    const { user } = renderRoute(`/app/academics/exams/${MIDSEM}`);
    const list = await topicsList();
    expect(titles(list)).toEqual(['ER modelling', 'Normalization', 'SQL joins', 'Transactions']);
    expect(screen.getByRole('button', { name: 'Move ER modelling up' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Move Transactions down' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Move SQL joins up' }));
    await waitFor(() =>
      expect(titles(list)).toEqual(['ER modelling', 'SQL joins', 'Normalization', 'Transactions']),
    );
    expect(screen.getByText('Moved “SQL joins” to position 2 of 4.')).toBeInTheDocument();

    await waitFor(() => expect(screen.getByRole('button', { name: 'Move ER modelling down' })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: 'Move ER modelling down' }));
    await waitFor(() =>
      expect(titles(list)).toEqual(['SQL joins', 'ER modelling', 'Normalization', 'Transactions']),
    );
    expect(orderedTopics(store, MIDSEM).map((t) => [t.title, t.position])).toEqual([
      ['SQL joins', 0],
      ['ER modelling', 1],
      ['Normalization', 2],
      ['Transactions', 3],
    ]);
  });

  it('renames a topic in place, and Esc cancels', async () => {
    setup();
    const { user } = renderRoute(`/app/academics/exams/${MIDSEM}`);
    await topicsList();

    await user.click(screen.getByRole('button', { name: 'Rename Normalization' }));
    const field = screen.getByLabelText('New name for Normalization');
    await user.keyboard('{Escape}');
    expect(field).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Rename Transactions' }));
    const input = screen.getByLabelText('New name for Transactions');
    expect(input).toHaveFocus();
    await user.clear(input);
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Name the topic.')).toBeInTheDocument();
    await user.type(input, 'Transactions and recovery');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('checkbox', { name: 'Transactions and recovery' })).toBeInTheDocument();
  });

  it('adds and removes topics, keeping the order tidy', async () => {
    const store = setup();
    const { user } = renderRoute(`/app/academics/exams/${MIDSEM}`);
    const list = await topicsList();

    await user.click(screen.getByRole('button', { name: 'Add topic' }));
    expect(await screen.findByText('Name the topic.')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Add a topic'), 'Indexing');
    await user.click(screen.getByRole('button', { name: 'Add topic' }));
    await waitFor(() => expect(titles(list)).toContain('Indexing'));
    expect(screen.getByLabelText('Add a topic')).toHaveValue('');
    expect(screen.getByRole('progressbar', { name: '2 of 5 topics ready' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Delete Normalization' }));
    await waitFor(() => expect(titles(list)).not.toContain('Normalization'));
    expect(orderedTopics(store, MIDSEM).map((t) => t.position)).toEqual([0, 1, 2, 3]);
  });

  it('edits the exam and deletes it', async () => {
    const store = setup();
    const { user, router } = renderRoute(`/app/academics/exams/${MIDSEM}`);
    await screen.findByRole('heading', { level: 1, name: 'Mid-semester 1' });

    await user.click(screen.getByRole('button', { name: 'Edit exam' }));
    const dialog = await screen.findByRole('dialog', { name: 'Edit exam' });
    expect(within(dialog).getByLabelText('Starts at')).toHaveValue('09:00');
    expect(within(dialog).queryByLabelText('Topics to prepare (optional)')).not.toBeInTheDocument();
    const room = within(dialog).getByLabelText('Room (optional)');
    await user.clear(room);
    await user.type(room, 'Lab 3');
    await user.click(within(dialog).getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByText(/· Lab 3/)).toBeInTheDocument();
    // Topics are untouched by an edit
    expect(orderedTopics(store, MIDSEM)).toHaveLength(4);

    await user.click(screen.getByRole('button', { name: 'Delete' }));
    const confirm = await screen.findByRole('dialog', { name: 'Delete this exam?' });
    await user.click(within(confirm).getByRole('button', { name: 'Delete exam' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/app/academics/exams'));
    expect(store.exams.some((e) => e.id === MIDSEM)).toBe(false);
    expect(store.topics.some((t) => t.examId === MIDSEM)).toBe(false);
  });

  it('says so when the exam doesn’t exist', async () => {
    setup();
    renderRoute('/app/academics/exams/00000000-0000-4000-8000-00000000beef');
    expect(await screen.findByText('We couldn’t find that exam.')).toBeInTheDocument();
  });

  it('has no serious accessibility violations, including while renaming', async () => {
    setup();
    const { container, user } = renderRoute(`/app/academics/exams/${MIDSEM}`);
    await topicsList();
    expect(await axeViolations(container)).toEqual([]);
    await user.click(screen.getByRole('button', { name: 'Rename SQL joins' }));
    expect(await axeViolations(container)).toEqual([]);
  });
});
