import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createAcademicStore, seedDemoAcademics, type AcademicStore } from '@/mocks/academics';
import { seedDemoCoursework } from '@/mocks/coursework';
import { createMockDb, DEFAULT_SETTINGS } from '@/mocks/handlers';
import { axeViolations } from '@/test/axe';
import { renderRoute } from '@/test/render';
import { installMockApi, TEST_USER } from '@/test/server';

/** The user id createMockDb gives the logged-in test user. */
const USER_ID = '00000000-0000-4000-8000-000000000001';

/**
 * The demo week (seedDemoCoursework): Monday to Friday, three courses. On Wednesday the OS lab
 * (14:00–16:00) overlaps a DBMS tutorial (15:00–15:50).
 */
function setup({ store = demoStore(), weekStart = 'MON' as 'MON' | 'SUN' } = {}): AcademicStore {
  const db = createMockDb({ loggedInAs: TEST_USER });
  db.academics.set(USER_ID, store);
  db.settings.set(USER_ID, { ...DEFAULT_SETTINGS, weekStart });
  installMockApi(db);
  return store;
}

function demoStore({ timetable = true } = {}): AcademicStore {
  const store = createAcademicStore();
  seedDemoAcademics(store);
  seedDemoCoursework(store);
  if (!timetable) store.timetable = [];
  return store;
}

const day = (name: string) => screen.findByRole('list', { name: `${name} classes` });
const classNames = (list: HTMLElement) =>
  within(list)
    .getAllByRole('button')
    .map((b) => b.getAttribute('aria-label'));

describe('Timetable page', () => {
  it('shows the week day by day, in time order, and warns about overlaps', async () => {
    setup();
    renderRoute('/app/academics/timetable');

    expect(classNames(await day('Monday'))).toEqual([
      'CSE 201 Database Systems, Lecture, Monday 09:00 to 09:50, Room 204. Edit',
      'CSE 203 Operating Systems, Lecture, Monday 10:00 to 10:50, Room 204. Edit',
      'CSE 205 Compilers, Lab, Monday 14:00 to 16:00, Lab 2. Edit',
    ]);
    expect(screen.getByRole('region', { name: 'Friday' })).toBeInTheDocument();
    // No weekend columns when nothing happens at the weekend
    expect(screen.queryByRole('region', { name: 'Saturday' })).not.toBeInTheDocument();

    expect(screen.getByText('Two classes overlap.')).toBeInTheDocument();
    const wednesday = await day('Wednesday');
    expect(
      within(wednesday).getByRole('button', {
        name: 'CSE 203 Operating Systems, Lab, Wednesday 14:00 to 16:00, Lab 1, overlaps CSE 201 Database Systems. Edit',
      }),
    ).toBeInTheDocument();
  });

  it('adds a weekend class, which brings in the weekend', async () => {
    const store = setup();
    const { user } = renderRoute('/app/academics/timetable');
    await day('Monday');

    await user.click(screen.getByRole('button', { name: 'Add class' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add a class' });
    await user.selectOptions(within(dialog).getByLabelText('Course'), 'CSE 205 · Compilers');
    await user.selectOptions(within(dialog).getByLabelText('Day'), 'Saturday');
    fireEvent.change(within(dialog).getByLabelText('Starts'), { target: { value: '10:00' } });
    fireEvent.change(within(dialog).getByLabelText('Ends'), { target: { value: '12:00' } });
    await user.selectOptions(within(dialog).getByLabelText('Kind'), 'Lab');
    await user.type(within(dialog).getByLabelText('Room (optional)'), 'Lab 2');
    await user.click(within(dialog).getByRole('button', { name: 'Add class' }));

    expect(classNames(await day('Saturday'))).toEqual([
      'CSE 205 Compilers, Lab, Saturday 10:00 to 12:00, Lab 2. Edit',
    ]);
    expect(store.timetable.some((e) => e.dayOfWeek === 6 && e.kind === 'LAB')).toBe(true);
  });

  it('checks that a class ends after it starts', async () => {
    const store = setup();
    const { user } = renderRoute('/app/academics/timetable');
    await day('Monday');
    const before = store.timetable.length;

    await user.click(screen.getByRole('button', { name: 'Add class' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add a class' });
    await user.selectOptions(within(dialog).getByLabelText('Course'), 'CSE 205 · Compilers');
    fireEvent.change(within(dialog).getByLabelText('Starts'), { target: { value: '11:00' } });
    fireEvent.change(within(dialog).getByLabelText('Ends'), { target: { value: '10:00' } });
    await user.click(within(dialog).getByRole('button', { name: 'Add class' }));

    expect(await within(dialog).findByText('A class must end after it starts.')).toBeInTheDocument();
    expect(store.timetable).toHaveLength(before);
  });

  it('edits a class, then deletes it', async () => {
    const store = setup();
    const { user } = renderRoute('/app/academics/timetable');
    const monday = await day('Monday');

    await user.click(
      within(monday).getByRole('button', { name: /^CSE 203 Operating Systems, Lecture, Monday/ }),
    );
    const dialog = await screen.findByRole('dialog', { name: 'Edit class' });
    expect(within(dialog).getByLabelText('Starts')).toHaveValue('10:00');
    const room = within(dialog).getByLabelText('Room (optional)');
    await user.clear(room);
    await user.type(room, 'Room 305');
    await user.click(within(dialog).getByRole('button', { name: 'Save changes' }));
    expect(
      await within(monday).findByRole('button', { name: /Monday 10:00 to 10:50, Room 305\. Edit$/ }),
    ).toBeInTheDocument();

    await user.click(within(monday).getByRole('button', { name: /Room 305\. Edit$/ }));
    await user.click(await screen.findByRole('button', { name: 'Delete class' }));
    const confirm = await screen.findByRole('dialog', { name: 'Delete this class?' });
    await user.click(within(confirm).getByRole('button', { name: 'Delete class' }));
    await waitFor(() => expect(classNames(monday)).toHaveLength(2));
    expect(store.timetable.some((e) => e.location === 'Room 305')).toBe(false);
  });

  it('starts the week on Sunday when that’s the student’s setting', async () => {
    const store = demoStore();
    store.timetable.push({ ...store.timetable[0]!, id: 'sunday-class', dayOfWeek: 7 });
    setup({ store, weekStart: 'SUN' });
    renderRoute('/app/academics/timetable');

    await day('Sunday');
    const headings = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(headings.slice(0, 2)).toEqual(['SunSunday', 'MonMonday']);
  });

  it('guides a student with no classes yet', async () => {
    setup({ store: demoStore({ timetable: false }) });
    renderRoute('/app/academics/timetable');
    expect(await screen.findByText('Add your weekly classes.')).toBeInTheDocument();
  });

  it('sends a student without courses to add them first', async () => {
    setup({ store: createAcademicStore() });
    renderRoute('/app/academics/timetable');
    expect(await screen.findByText('Classes belong to a course.')).toBeInTheDocument();
  });

  it('has no serious accessibility violations', async () => {
    setup();
    const { container } = renderRoute('/app/academics/timetable');
    await day('Monday');
    expect(await axeViolations(container)).toEqual([]);
  });
});
