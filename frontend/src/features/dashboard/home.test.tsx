import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { todayIn } from '@/lib/dates';
import { createAcademicStore, seedDemoAcademics, type AcademicStore } from '@/mocks/academics';
import { seedDemoCoursework, type StoredEntry } from '@/mocks/coursework';
import { createMockDb, DEFAULT_SETTINGS } from '@/mocks/handlers';
import { axeViolations } from '@/test/axe';
import { renderRoute } from '@/test/render';
import { installMockApi, TEST_USER } from '@/test/server';

/** The user id createMockDb gives the logged-in test user. */
const USER_ID = '00000000-0000-4000-8000-000000000001';
// The test user's timezone is UTC, so "today" is today in UTC
const TODAY = todayIn('UTC');
const WEEKDAY = new Date(`${TODAY}T00:00:00Z`).getUTCDay() || 7;

/**
 * Demo semesters and coursework, with the timetable replaced by today's classes:
 *   09:00 DBMS lecture (its 1st class today), 11:00 OS lecture, 14:00 DBMS lab (its 2nd class)
 */
function setup({ weekday = WEEKDAY } = {}): AcademicStore {
  const store = createAcademicStore();
  seedDemoAcademics(store);
  seedDemoCoursework(store);
  const id = (name: string) => store.courses.find((c) => c.name === name)!.id;
  const entry = (n: number, course: string, startsAt: string, endsAt: string, kind: StoredEntry['kind']) => ({
    id: `entry-${n}`,
    courseId: id(course),
    dayOfWeek: weekday,
    startsAt,
    endsAt,
    kind,
    location: 'Room 204',
    instructor: null,
  });
  store.timetable = [
    entry(1, 'Database Systems', '14:00', '16:00', 'LAB'),
    entry(2, 'Database Systems', '09:00', '09:50', 'LECTURE'),
    entry(3, 'Operating Systems', '11:00', '11:50', 'LECTURE'),
  ];
  const db = createMockDb({ loggedInAs: TEST_USER });
  db.academics.set(USER_ID, store);
  db.settings.set(USER_ID, { ...DEFAULT_SETTINGS, defaultAttendanceTarget: 75 });
  installMockApi(db);
  return store;
}

const markList = async () => {
  const section = await screen.findByRole('region', { name: 'Mark today’s classes' });
  return within(section).getByRole('list');
};
const rows = (list: HTMLElement) => within(list).getAllByRole('listitem');

describe('Home: today’s classes', () => {
  it('lists today’s classes in order, numbering a course’s second class', async () => {
    setup();
    renderRoute('/app');
    const list = await markList();

    const text = rows(list).map((li) => li.querySelector('p')!.textContent);
    expect(text).toEqual([
      'CSE 201 Database Systems (1st class)',
      'CSE 203 Operating Systems',
      'CSE 201 Database Systems (2nd class)',
    ]);
    expect(screen.getByRole('group', { name: 'Mark CSE 203 Operating Systems' })).toBeInTheDocument();
  });

  it('marks a class in one tap, and can undo it', async () => {
    const store = setup();
    const { user } = renderRoute('/app');
    await markList();

    const lab = screen.getByRole('group', { name: 'Mark CSE 201 Database Systems (2nd class)' });
    await user.click(within(lab).getByRole('button', { name: 'Absent' }));
    const undo = await screen.findByRole('button', {
      name: 'Undo absent for CSE 201 Database Systems (2nd class)',
    });
    const saved = store.records.find((r) => r.heldOn === TODAY);
    expect(saved).toMatchObject({
      slot: 2,
      status: 'ABSENT',
      courseId: store.courses.find((c) => c.name === 'Database Systems')!.id,
    });

    await user.click(undo);
    expect(
      await screen.findByRole('group', { name: 'Mark CSE 201 Database Systems (2nd class)' }),
    ).toBeInTheDocument();
    expect(store.records.some((r) => r.heldOn === TODAY)).toBe(false);
  });

  it('shows marks made elsewhere, matched by slot', async () => {
    const store = setup();
    store.records.push({
      id: 'r1',
      courseId: store.courses.find((c) => c.name === 'Operating Systems')!.id,
      heldOn: TODAY,
      slot: 1,
      status: 'CANCELLED',
      createdAt: 1,
    });
    renderRoute('/app');
    const list = await markList();
    expect(rows(list)[1]).toHaveTextContent('Cancelled');
    expect(screen.queryByRole('group', { name: 'Mark CSE 203 Operating Systems' })).not.toBeInTheDocument();
  });

  it('says when there are no classes today', async () => {
    setup({ weekday: WEEKDAY === 7 ? 1 : WEEKDAY + 1 });
    renderRoute('/app');
    expect(await screen.findByText('No classes today.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open timetable' })).toHaveAttribute(
      'href',
      '/app/academics/timetable',
    );
  });

  it('knows when today is outside the semester', async () => {
    const store = setup();
    const current = store.semesters.find((s) => s.current)!;
    current.startsOn = '2020-01-01';
    current.endsOn = '2020-05-01';
    renderRoute('/app');
    expect(await screen.findByText(/outside your current semester’s dates/)).toBeInTheDocument();
  });

  it('counts down to the next exams', async () => {
    setup();
    renderRoute('/app');
    const exams = await screen.findByRole('list', { name: 'Upcoming exams' });
    expect(within(exams).getByRole('link', { name: 'Quiz 2' })).toBeInTheDocument();
    expect(exams).toHaveTextContent('In 4 days');
    expect(exams).toHaveTextContent('2 of 4 topics ready (50%)');
  });

  it('has no serious accessibility violations', async () => {
    setup();
    const { container } = renderRoute('/app');
    await markList();
    await waitFor(() => expect(screen.getByRole('list', { name: 'Upcoming exams' })).toBeInTheDocument());
    expect(await axeViolations(container)).toEqual([]);
  });
});
