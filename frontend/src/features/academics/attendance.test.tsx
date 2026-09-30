import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { formatDay, todayIn } from '@/lib/dates';
import { createAcademicStore, seedDemoAcademics, type AcademicStore } from '@/mocks/academics';
import { createMockDb, DEFAULT_SETTINGS } from '@/mocks/handlers';
import { axeViolations } from '@/test/axe';
import { renderRoute } from '@/test/render';
import { installMockApi, TEST_USER } from '@/test/server';

/** The user id createMockDb gives the logged-in test user. */
const USER_ID = '00000000-0000-4000-8000-000000000001';
// The test user's timezone is UTC, so "today" is today in UTC (as on the server)
const TODAY = todayIn('UTC');
const YESTERDAY = todayIn('UTC', new Date(Date.now() - 86_400_000));

function setup({ store = demoStore(), defaultTarget = 75 as number | null } = {}) {
  const db = createMockDb({ loggedInAs: TEST_USER });
  db.academics.set(USER_ID, store);
  db.settings.set(USER_ID, { ...DEFAULT_SETTINGS, defaultAttendanceTarget: defaultTarget });
  installMockApi(db);
  return { store, db };
}

function demoStore(): AcademicStore {
  const store = createAcademicStore();
  seedDemoAcademics(store);
  return store;
}

// Demo data, current semester (Semester 3), with a 75% default target:
//   Database Systems  26/30 = 86.7%  can miss ⌊(260000 − 225000) / 7500⌋ = 4   → Safe
//   Compilers         16/20 = 80.0%  can miss ⌊(160000 − 150000) / 7500⌋ = 1   → At risk
//   Operating Systems 22/30 = 73.3%  need ⌈(225000 − 220000) / 2500⌉ = 2       → Below target
const card = (name: string) => screen.findByRole('region', { name: new RegExp(name) });

describe('Attendance page', () => {
  it('points a new student to their courses first', async () => {
    setup({ store: createAcademicStore(), defaultTarget: null });
    renderRoute('/app/academics/attendance');

    expect(await screen.findByText('Attendance is tracked per course.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Add a semester' })).toHaveAttribute(
      'href',
      '/app/academics/courses',
    );
  });

  it('leads each course with what it means for you', async () => {
    setup();
    renderRoute('/app/academics/attendance');

    const dbms = await card('Database Systems');
    expect(dbms).toHaveTextContent('86.7%');
    expect(dbms).toHaveTextContent('26 of 30 attended · target 75% (your default)');
    expect(within(dbms).getByText('Safe')).toBeInTheDocument();
    expect(dbms).toHaveTextContent('You can miss 4 more classes.');

    const compilers = await card('Compilers');
    expect(within(compilers).getByText('At risk')).toBeInTheDocument();
    expect(compilers).toHaveTextContent('You can miss 1 more class.');

    const os = await card('Operating Systems');
    expect(within(os).getByText('Below target')).toBeInTheDocument();
    expect(os).toHaveTextContent('Attend the next 2 classes in a row to get back to 75%.');
  });

  it('asks for a target instead of assuming one, and uses it once set', async () => {
    setup({ defaultTarget: null });
    const { user } = renderRoute('/app/academics/attendance');

    const dbms = await card('Database Systems');
    expect(within(dbms).getByText('No target')).toBeInTheDocument();
    expect(
      screen.getByText('Set your attendance target to see how many classes you can miss.'),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Set target' }));
    const input = screen.getByLabelText('Default attendance target %');
    expect(input).toHaveFocus();
    await user.type(input, '75');
    await user.click(screen.getByRole('button', { name: 'Save target' }));

    await waitFor(() => expect(dbms).toHaveTextContent('You can miss 4 more classes.'));
    expect(screen.queryByText(/Set your attendance target/)).not.toBeInTheDocument();
    expect(screen.getByText(/Default target:/).parentElement).toHaveTextContent('75%');
  });

  it('rejects a target outside 0–100 before saving', async () => {
    setup({ defaultTarget: null });
    const { user } = renderRoute('/app/academics/attendance');

    await user.click(await screen.findByRole('button', { name: 'Set default' }));
    await user.type(screen.getByLabelText('Default attendance target %'), '120');
    await user.click(screen.getByRole('button', { name: 'Save target' }));

    expect(await screen.findByText('Use a number between 0 and 100, like 75.')).toBeInTheDocument();
  });

  it('marks today’s class and updates the projection straight away', async () => {
    setup();
    const { user } = renderRoute('/app/academics/attendance');
    const compilers = await card('Compilers');

    // 16 of 21 = 76.2%: ⌊(160000 − 157500) / 7500⌋ = 0 → can't miss the next one
    await user.click(within(compilers).getByRole('button', { name: 'Absent' }));
    await waitFor(() => expect(compilers).toHaveTextContent('Don’t miss the next class.'));
    expect(compilers).toHaveTextContent('76.2%');
    expect(compilers).toHaveTextContent('Marked absent for today.');

    // The same class twice is refused with an explanation
    await user.click(within(compilers).getByRole('button', { name: 'Present' }));
    expect(await within(compilers).findByText(/already marked this class/)).toBeInTheDocument();
  });

  it('marks a class on another day, in a second slot', async () => {
    setup();
    const { user } = renderRoute('/app/academics/attendance');
    const os = await card('Operating Systems');

    await user.click(within(os).getByRole('button', { name: 'Another day…' }));
    fireEvent.change(within(os).getByLabelText('Day of the class'), { target: { value: YESTERDAY } });
    await user.selectOptions(within(os).getByLabelText('Class that day'), '2nd class');
    await user.click(within(os).getByRole('button', { name: 'Present' }));

    await waitFor(() => expect(os).toHaveTextContent(`Marked present for ${formatDay(YESTERDAY)}.`));
    expect(os).toHaveTextContent('23 of 31 attended');

    await user.click(within(os).getByRole('button', { name: 'History' }));
    expect(await within(os).findByText(`${formatDay(YESTERDAY)}, class 2`)).toBeInTheDocument();
  });

  it('changes and deletes a mark from the history', async () => {
    const { store } = setup();
    const course = store.courses.find((c) => c.name === 'Database Systems')!;
    store.records.push({
      id: 'r1',
      courseId: course.id,
      heldOn: TODAY,
      slot: 1,
      status: 'ABSENT',
      createdAt: 1,
    });
    const { user } = renderRoute('/app/academics/attendance');
    const dbms = await card('Database Systems');
    expect(dbms).toHaveTextContent('26 of 31 attended');

    await user.click(within(dbms).getByRole('button', { name: 'History' }));
    const mark = await within(dbms).findByLabelText(`Mark for ${formatDay(TODAY)}`);
    await user.selectOptions(mark, 'Present');
    await waitFor(() => expect(dbms).toHaveTextContent('27 of 31 attended'));

    await user.click(within(dbms).getByRole('button', { name: `Delete mark for ${formatDay(TODAY)}` }));
    await waitFor(() => expect(dbms).toHaveTextContent('26 of 30 attended'));
    expect(await within(dbms).findByText(/No classes marked yet/)).toBeInTheDocument();
  });

  it('sets starting counts, checking them first', async () => {
    setup();
    const { user } = renderRoute('/app/academics/attendance');
    const dbms = await card('Database Systems');

    await user.click(within(dbms).getByRole('button', { name: /Starting counts/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Starting counts for Database Systems' });
    const held = within(dialog).getByLabelText('Classes held so far');
    const attended = within(dialog).getByLabelText('Classes you attended');
    await user.clear(held);
    await user.type(held, '10');
    await user.clear(attended);
    await user.type(attended, '11');
    await user.click(within(dialog).getByRole('button', { name: 'Save counts' }));
    expect(
      await within(dialog).findByText('You can’t have attended more classes than were held.'),
    ).toBeInTheDocument();

    await user.clear(held);
    await user.type(held, '40');
    await user.clear(attended);
    await user.type(attended, '30');
    await user.click(within(dialog).getByRole('button', { name: 'Save counts' }));
    await waitFor(() => expect(dbms).toHaveTextContent('30 of 40 attended'));
    expect(dbms).toHaveTextContent('75.0%');
  });

  it('shows where a course’s own target comes from', async () => {
    const { store } = setup();
    store.courses.find((c) => c.name === 'Compilers')!.attendanceTarget = 90;
    renderRoute('/app/academics/attendance');

    const compilers = await card('Compilers');
    expect(compilers).toHaveTextContent('target 90% (this course)');
    // 16/20 = 80% against 90%: ⌈(0.9 × 20 − 16) / 0.1⌉ = 20 in a row (36/40 = 90%)
    expect(compilers).toHaveTextContent('Attend the next 20 classes in a row to get back to 90%.');
  });

  it('has no serious accessibility violations, including with history open', async () => {
    setup();
    const { container, user } = renderRoute('/app/academics/attendance');
    const dbms = await card('Database Systems');
    expect(await axeViolations(container)).toEqual([]);

    await user.click(within(dbms).getByRole('button', { name: 'Another day…' }));
    await user.click(within(dbms).getByRole('button', { name: 'Absent' }));
    await user.click(within(dbms).getByRole('button', { name: 'History' }));
    await within(dbms).findByRole('list', { name: 'Marked classes for Database Systems' });
    expect(await axeViolations(container)).toEqual([]);
  });
});

describe('Courses page attendance', () => {
  it('shows each course’s attendance and edits its own target', async () => {
    const { store } = setup();
    const { user } = renderRoute('/app/academics/courses');

    const list = await screen.findByRole('region', { name: '3 courses' });
    await waitFor(() => expect(list).toHaveTextContent('Database Systems4 credits · 87% attended'));

    await user.click(screen.getByRole('button', { name: 'Edit Compilers' }));
    const dialog = await screen.findByRole('dialog', { name: 'Edit course' });
    await user.type(within(dialog).getByLabelText('Attendance target % (optional)'), '80');
    await user.click(within(dialog).getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(store.courses.find((c) => c.name === 'Compilers')!.attendanceTarget).toBe(80));
  });
});
