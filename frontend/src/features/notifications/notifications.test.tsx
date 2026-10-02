import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createAcademicStore, seedDemoAcademics, type AcademicStore } from '@/mocks/academics';
import { createMockDb, DEFAULT_SETTINGS } from '@/mocks/handlers';
import { attendanceWorsened, generateNotifications } from '@/mocks/notifications';
import { axeViolations } from '@/test/axe';
import { renderRoute } from '@/test/render';
import { installMockApi, TEST_USER } from '@/test/server';

/** The user id createMockDb gives the logged-in test user. */
const USER_ID = '00000000-0000-4000-8000-000000000001';
const HOUR = 3_600_000;
const inHours = (h: number) => new Date(Date.now() + h * HOUR).toISOString();

const task = (id: string, title: string, dueAt: string | null) => ({
  id,
  title,
  description: null,
  category: 'PERSONAL' as const,
  priority: 'MEDIUM' as const,
  status: 'TODO' as const,
  plannedFor: null,
  plannedStart: null,
  dueAt,
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

/** A task due in 3 hours and a DBMS exam in two days with one of two topics ready. */
function twoReminders(store: AcademicStore) {
  store.tasks.push(task('t-1', 'Pay hostel fee', inHours(3)));
  const dbms = store.courses.find((c) => c.name === 'Database Systems')!;
  store.exams.push({
    id: 'e-1',
    courseId: dbms.id,
    title: 'DBMS midsem',
    kind: 'MIDTERM',
    startsAt: inHours(50),
    durationMinutes: 90,
    location: null,
  });
  store.topics.push(
    { id: 'tp-1', examId: 'e-1', title: 'Joins', position: 0, doneAt: inHours(-1), createdAt: 1 },
    { id: 'tp-2', examId: 'e-1', title: 'Indexing', position: 1, doneAt: null, createdAt: 2 },
  );
}

describe('Notifications', () => {
  it('shows the unread count on the bell and opens what a notification is about', async () => {
    setup(twoReminders);
    const { user, router, container } = renderRoute('/app');
    await screen.findByRole('heading', { level: 1, name: /Abhi/ });

    const bell = await screen.findByRole('button', { name: 'Notifications, 2 unread' });
    await user.click(bell);
    const menu = await screen.findByRole('menu', { name: 'Notifications, 2 unread' });
    const items = await within(menu).findAllByRole('menuitem');
    // Newest first; both came from the same run, so either order is right
    expect(items.map((i) => i.textContent)).toEqual([
      'Mark all read',
      expect.any(String),
      expect.any(String),
      'See all notifications',
    ]);
    const taskItem = within(menu).getByRole('menuitem', {
      name: /^Pay hostel fee \(unread\)\. Due (today|tomorrow) at \d\d:\d\d\. Just now$/,
    });
    expect(
      within(menu).getByRole('menuitem', {
        name: /^DBMS midsem is in 2 days \(unread\)\. CSE 201 · .* · 1 of 2 topics ready\. Just now$/,
      }),
    ).toBeInTheDocument();
    expect(await axeViolations(container)).toEqual([]);

    // Choosing the task marks it read and opens it on the Tasks page
    await user.click(taskItem);
    await waitFor(() => expect(router.state.location.pathname).toBe('/app/planner/tasks'));
    expect(router.state.location.search).toBe('?task=t-1');
    const edit = await screen.findByRole('dialog', { name: 'Edit task' });
    expect(within(edit).getByLabelText('Title')).toHaveValue('Pay hostel fee');
    // Closing it leaves the Tasks page as it was
    await user.keyboard('{Escape}');
    await waitFor(() => expect(router.state.location.search).toBe(''));
    expect(await screen.findByRole('button', { name: 'Notifications, 1 unread' })).toBeInTheDocument();
  });

  it('marks everything read from the bell', async () => {
    setup(twoReminders);
    const { user } = renderRoute('/app');
    await user.click(await screen.findByRole('button', { name: 'Notifications, 2 unread' }));
    await user.click(await screen.findByRole('menuitem', { name: /Mark all read/ }));
    // The menu stays open, now with nothing unread
    await waitFor(() => expect(screen.queryByRole('menuitem', { name: /Mark all read/ })).toBeNull());
    expect(screen.queryByRole('menuitem', { name: /\(unread\)/ })).toBeNull();
    await user.keyboard('{Escape}');
    expect(await screen.findByRole('button', { name: 'Notifications' })).toBeInTheDocument();
  });

  it('lists them all on their own page, filters unread and marks one read or unread', async () => {
    const store = setup(twoReminders);
    const { user, container } = renderRoute('/app/notifications');

    const list = await screen.findByRole('list', { name: 'Notifications' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(2);
    expect(await axeViolations(container)).toEqual([]);

    await user.click(within(list).getByRole('button', { name: 'Mark “DBMS midsem is in 2 days” read' }));
    await waitFor(() => expect(store.notifications.find((n) => n.type === 'EXAM_SOON')?.read).toBe(true));
    await user.click(screen.getByRole('link', { name: 'Unread (1)' }));
    await waitFor(() =>
      expect(
        within(screen.getByRole('list', { name: 'Notifications' })).getAllByRole('listitem'),
      ).toHaveLength(1),
    );

    await user.click(screen.getByRole('button', { name: /^Mark all read/ }));
    expect(await screen.findByText('You’re all caught up.')).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: 'All' }));
    await user.click(await screen.findByRole('button', { name: 'Mark “Pay hostel fee” unread' }));
    expect(await screen.findByRole('link', { name: 'Unread (1)' })).toBeInTheDocument();
  });

  it('says how it works when there are none yet', async () => {
    setup();
    renderRoute('/app/notifications');
    expect(await screen.findByText('No notifications yet.')).toBeInTheDocument();
  });

  it('turns each type on or off in Settings', async () => {
    const store = setup();
    const { user, container } = renderRoute('/app/settings');

    const section = await screen.findByRole('region', { name: 'Notifications' });
    const switches = await within(section).findAllByRole('switch');
    expect(switches).toHaveLength(8);
    expect(switches.every((s) => s.getAttribute('aria-checked') === 'true')).toBe(true);
    expect(await axeViolations(container)).toEqual([]);

    const tasksDue = within(section).getByRole('switch', { name: 'Tasks due soon' });
    expect(tasksDue).toHaveAccessibleDescription('An open task is due within 24 hours.');
    await user.click(tasksDue);
    await waitFor(() => expect(store.notificationMutes).toEqual(['TASK_DUE']));
    expect(tasksDue).toHaveAttribute('aria-checked', 'false');

    // Off means no new ones of that type
    store.tasks.push(task('t-9', 'Quiet', inHours(2)));
    expect(generateNotifications(store, { ...DEFAULT_SETTINGS, timezone: 'UTC' })).toBe(0);
  });
});

describe('the mock notification rules', () => {
  const settings = { ...DEFAULT_SETTINGS, timezone: 'UTC', defaultAttendanceTarget: 75 };

  it('creates each reminder once', () => {
    const store = createAcademicStore();
    store.tasks.push(task('t-1', 'Due soon', inHours(5)), task('t-2', 'Too far', inHours(30)));
    expect(generateNotifications(store, settings)).toBe(1);
    expect(generateNotifications(store, settings)).toBe(0);
    expect(store.notifications[0]).toMatchObject({ type: 'TASK_DUE', link: '/app/planner/tasks?task=t-1' });
  });

  it('notifies about attendance only when it gets worse', () => {
    expect(attendanceWorsened(undefined, 'AT_RISK')).toBe(true);
    expect(attendanceWorsened('AT_RISK', 'BELOW')).toBe(true);
    expect(attendanceWorsened('BELOW', 'AT_RISK')).toBe(false);
    expect(attendanceWorsened('BELOW', 'BELOW')).toBe(false);

    const store = createAcademicStore();
    seedDemoAcademics(store);
    for (const c of store.courses) c.baselineAttended = c.baselineConducted; // all safe
    const course = store.courses.find((c) => c.name === 'Database Systems')!;
    expect(generateNotifications(store, settings)).toBe(0);
    course.baselineConducted = 10;
    course.baselineAttended = 6; // 60% of 75%
    expect(generateNotifications(store, settings)).toBe(1);
    expect(store.notifications[0]).toMatchObject({
      title: `${course.code} attendance is below your target`,
      body: '60% · attend the next 6 classes to get back to 75%',
    });
    expect(generateNotifications(store, settings)).toBe(0);
    course.baselineAttended = 10; // safe again
    expect(generateNotifications(store, settings)).toBe(0);
    course.baselineAttended = 6; // and below again: a new one
    expect(generateNotifications(store, settings)).toBe(1);
  });
});
