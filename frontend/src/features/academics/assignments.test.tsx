import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { formatDateTime, formatDay, todayIn, zonedToInstant } from '@/lib/dates';
import { createAcademicStore, seedDemoAcademics, type AcademicStore } from '@/mocks/academics';
import { seedDemoCoursework } from '@/mocks/coursework';
import { createMockDb, DEFAULT_SETTINGS } from '@/mocks/handlers';
import { axeViolations } from '@/test/axe';
import { renderRoute } from '@/test/render';
import { installMockApi, TEST_USER } from '@/test/server';

/** The user id createMockDb gives the logged-in test user. */
const USER_ID = '00000000-0000-4000-8000-000000000001';

function setup({ store = demoStore(), timezone = 'UTC' } = {}) {
  const db = createMockDb({ loggedInAs: TEST_USER });
  db.academics.set(USER_ID, store);
  db.settings.set(USER_ID, { ...DEFAULT_SETTINGS, timezone });
  installMockApi(db);
  return store;
}

/**
 * Demo semesters plus coursework placed relative to now (seedDemoCoursework), at 18:00 UTC:
 *   Overdue       Scheduler simulation report (OS, yesterday, high, in progress 60%)
 *   Due tomorrow  ER diagram for the library schema (DBMS, in progress 30%)
 *   This week     Lexer for the toy language (Compilers, +3 days, high), SQL practice set 4 (DBMS, +5)
 *   Later         Paging worksheet (OS, +12 days)
 *   Done          Grammar exercises (Compilers, completed)
 */
function demoStore(withCoursework = true): AcademicStore {
  const store = createAcademicStore();
  seedDemoAcademics(store);
  if (withCoursework) seedDemoCoursework(store);
  return store;
}

const group = (name: string | RegExp) => screen.findByRole('region', { name });

describe('Assignments page', () => {
  it('groups open work by how soon it’s due', async () => {
    const store = setup();
    renderRoute('/app/academics/assignments');

    const overdue = await group('Overdue 1');
    const report = store.assignments.find((a) => a.title === 'Scheduler simulation report')!;
    expect(overdue).toHaveTextContent(
      `Scheduler simulation reportHigh priorityCSE 203 Operating Systems · Due ${formatDateTime(report.dueAt, 'UTC')}`,
    );
    expect(await group('Due tomorrow 1')).toHaveTextContent('ER diagram for the library schema');
    const week = await group('This week 2');
    const titles = within(week)
      .getAllByRole('listitem')
      .map((li) => li.textContent);
    expect(titles[0]).toMatch(/^Lexer for the toy languageHigh priority/);
    expect(titles[1]).toMatch(/^SQL practice set 4/);
    expect(await group('Later 1')).toHaveTextContent('Paging worksheet');
    expect(screen.queryByRole('region', { name: /Due today/ })).not.toBeInTheDocument();
    // Finished work isn't in the open groups
    expect(screen.queryByText('Grammar exercises')).not.toBeInTheDocument();
  });

  it('filters by course and priority, and says when nothing matches', async () => {
    setup();
    const { user, router } = renderRoute('/app/academics/assignments');
    await group('Overdue 1');

    await user.selectOptions(screen.getByLabelText('Course'), 'CSE 201 · Database Systems');
    await waitFor(() => expect(screen.queryByRole('region', { name: /Overdue/ })).not.toBeInTheDocument());
    expect(await group('This week 1')).toHaveTextContent('SQL practice set 4');
    expect(router.state.location.search).toContain('course=');

    await user.selectOptions(screen.getByLabelText('Priority'), 'High');
    expect(await screen.findByText('No open assignments match these filters.')).toBeInTheDocument();

    await user.click(screen.getAllByRole('button', { name: 'Clear filters' })[0]!);
    expect(await group('Overdue 1')).toBeInTheDocument();
    expect(router.state.location.search).toBe('');
  });

  it('adds an assignment due at 23:59 in the student’s own timezone', async () => {
    const store = setup({ timezone: 'Asia/Kolkata' });
    const { user } = renderRoute('/app/academics/assignments');
    await group(/^Overdue/);
    const inTwoDays = new Date(Date.parse(`${todayIn('Asia/Kolkata')}T00:00:00Z`) + 2 * 86_400_000)
      .toISOString()
      .slice(0, 10);

    await user.click(screen.getByRole('button', { name: 'Add assignment' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add an assignment' });
    await user.type(within(dialog).getByLabelText('Title'), 'Normalization worksheet');
    await user.selectOptions(within(dialog).getByLabelText('Course'), 'CSE 201 · Database Systems');
    fireEvent.change(within(dialog).getByLabelText('Due date'), { target: { value: inTwoDays } });
    expect(within(dialog).getByLabelText('Due time')).toHaveValue('23:59');
    await user.selectOptions(within(dialog).getByLabelText('Priority'), 'High');
    await user.type(within(dialog).getByLabelText('Estimate in minutes (optional)'), '90');
    await user.click(within(dialog).getByRole('button', { name: 'Add assignment' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    const saved = store.assignments.find((a) => a.title === 'Normalization worksheet')!;
    expect(saved.dueAt).toBe(zonedToInstant(inTwoDays, '23:59', 'Asia/Kolkata'));
    expect(saved).toMatchObject({ priority: 'HIGH', estimatedMinutes: 90 });
    const week = await group(/^This week/);
    expect(week).toHaveTextContent(`Normalization worksheetHigh priority`);
    expect(week).toHaveTextContent(`Due ${formatDay(inTwoDays)}, 23:59 · about 1 h 30 min`);
  });

  it('checks the form before sending it', async () => {
    const store = setup();
    const { user } = renderRoute('/app/academics/assignments');
    await group('Overdue 1');
    const before = store.assignments.length;

    await user.click(screen.getByRole('button', { name: 'Add assignment' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add an assignment' });
    await user.type(within(dialog).getByLabelText('Estimate in minutes (optional)'), '0');
    await user.click(within(dialog).getByRole('button', { name: 'Add assignment' }));

    expect(await within(dialog).findByText('Give the assignment a title.')).toBeInTheDocument();
    expect(within(dialog).getByText('Choose a course.')).toBeInTheDocument();
    expect(within(dialog).getByText('Use whole minutes from 1 to 10000.')).toBeInTheDocument();
    expect(store.assignments).toHaveLength(before);
  });

  it('marks work completed, moving it to Done', async () => {
    setup();
    const { user } = renderRoute('/app/academics/assignments');
    await group('Overdue 1');

    await user.selectOptions(screen.getByLabelText('Status of Scheduler simulation report'), 'Completed');
    await waitFor(() => expect(screen.queryByRole('region', { name: /Overdue/ })).not.toBeInTheDocument());
    expect(screen.getByText('Marked “Scheduler simulation report” completed.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Show submitted and completed' }));
    const done = await screen.findByRole('list', { name: 'Submitted and completed assignments' });
    await waitFor(() => expect(done).toHaveTextContent('Scheduler simulation report'));
    expect(done).toHaveTextContent('Grammar exercises');
  });

  it('updates progress on work in progress', async () => {
    const store = setup();
    const { user } = renderRoute('/app/academics/assignments');
    await group('Overdue 1');

    const progress = screen.getByLabelText('Progress of ER diagram for the library schema');
    expect(progress).toHaveValue('30');
    await user.selectOptions(progress, '80%');
    await waitFor(() =>
      expect(store.assignments.find((a) => a.title.startsWith('ER diagram'))!.progressPct).toBe(80),
    );
    // Not-started work has no progress picker until it's started
    expect(screen.queryByLabelText('Progress of Paging worksheet')).not.toBeInTheDocument();
  });

  it('edits and deletes an assignment', async () => {
    const store = setup();
    const { user } = renderRoute('/app/academics/assignments');
    await group('Later 1');

    await user.click(screen.getByRole('button', { name: 'Edit Paging worksheet' }));
    const dialog = await screen.findByRole('dialog', { name: 'Edit assignment' });
    const title = within(dialog).getByLabelText('Title');
    expect(within(dialog).getByLabelText('Due time')).toHaveValue('18:00');
    await user.clear(title);
    await user.type(title, 'Paging and TLB worksheet');
    await user.click(within(dialog).getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByText('Paging and TLB worksheet')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Delete Paging and TLB worksheet' }));
    const confirm = await screen.findByRole('dialog', { name: 'Delete this assignment?' });
    await user.click(within(confirm).getByRole('button', { name: 'Delete assignment' }));
    await waitFor(() => expect(screen.queryByText('Paging and TLB worksheet')).not.toBeInTheDocument());
    expect(store.assignments.some((a) => a.title.startsWith('Paging'))).toBe(false);
  });

  it('has calm empty states', async () => {
    setup({ store: demoStore(false) });
    renderRoute('/app/academics/assignments');
    expect(await screen.findByText('Nothing due yet. Enjoy the breathing room.')).toBeInTheDocument();
  });

  it('sends a student without courses to add them first', async () => {
    setup({ store: createAcademicStore() });
    renderRoute('/app/academics/assignments');
    expect(await screen.findByText('Assignments belong to a course.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to courses' })).toHaveAttribute(
      'href',
      '/app/academics/courses',
    );
  });

  it('has no serious accessibility violations', async () => {
    setup();
    const { container, user } = renderRoute('/app/academics/assignments');
    await group('Overdue 1');
    await user.click(screen.getByRole('button', { name: 'Show submitted and completed' }));
    await screen.findByRole('list', { name: 'Submitted and completed assignments' });
    expect(await axeViolations(container)).toEqual([]);
  });
});
