import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { createAcademicStore, seedDemoAcademics, type AcademicStore } from '@/mocks/academics';
import { createMockDb, DEFAULT_SETTINGS } from '@/mocks/handlers';
import { axeViolations } from '@/test/axe';
import { renderRoute } from '@/test/render';
import { installMockApi, TEST_USER } from '@/test/server';
import { forgetAll } from './recent';

/** The user id createMockDb gives the logged-in test user. */
const USER_ID = '00000000-0000-4000-8000-000000000001';

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

const task = (id: string, title: string) => ({
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
});

const openPalette = async () => {
  fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
  return screen.findByRole('dialog', { name: 'Search NOVA' });
};

const optionNames = (group: string) =>
  within(screen.getByRole('group', { name: group }))
    .getAllByRole('option')
    .map((o) => o.textContent);

describe('Search and the ⌘K palette', () => {
  beforeEach(() => forgetAll());

  it('opens with Ctrl+K, offers actions and pages, and goes where you pick', async () => {
    setup();
    const { user, router, container } = renderRoute('/app');
    await screen.findByRole('heading', { level: 1, name: /Abhi/ });

    const dialog = await openPalette();
    // Focus starts in the search box
    await waitFor(() => expect(within(dialog).getByRole('combobox')).toHaveFocus());
    expect(optionNames('Quick actions')).toContain('New task');
    expect(optionNames('Go to')).toContain('TimetableAcademics');
    expect(await axeViolations(container)).toEqual([]);

    const input = within(dialog).getByRole('combobox');
    await user.type(input, 'timet');
    expect(within(dialog).getAllByRole('option')[0]).toHaveAttribute('aria-selected', 'true');
    await user.keyboard('{Enter}');
    await waitFor(() => expect(router.state.location.pathname).toBe('/app/academics/timetable'));

    // It remembers what you opened
    await openPalette();
    expect(optionNames('Recent')).toEqual(['TimetableAcademics']);
  });

  it('finds your records by name and opens a task in place', async () => {
    setup((store) => store.tasks.push(task('t-1', 'Revise database indexes')));
    const { user, router } = renderRoute('/app');
    await screen.findByRole('heading', { level: 1, name: /Abhi/ });

    const dialog = await openPalette();
    await user.type(within(dialog).getByRole('combobox'), 'd');
    expect(within(dialog).getByRole('status')).toHaveTextContent('Type one more character');
    await user.type(within(dialog).getByRole('combobox'), 'atabase');

    await screen.findByRole('group', { name: 'Courses' });
    expect(optionNames('Courses')[0]).toMatch(/^Database Systems/);
    expect(optionNames('Tasks')).toEqual(['Revise database indexesUnscheduled']);

    await user.click(within(screen.getByRole('group', { name: 'Tasks' })).getByRole('option'));
    const edit = await screen.findByRole('dialog', { name: 'Edit task' });
    expect(within(edit).getByLabelText('Title')).toHaveValue('Revise database indexes');
    expect(router.state.location.pathname).toBe('/app');
  });

  it('moves through results with the arrow keys', async () => {
    setup();
    const { user, router } = renderRoute('/app');
    await screen.findByRole('heading', { level: 1, name: /Abhi/ });

    const dialog = await openPalette();
    await user.type(within(dialog).getByRole('combobox'), 'grades');
    const input = within(dialog).getByRole('combobox');
    await waitFor(() => expect(within(dialog).getAllByRole('option').length).toBeGreaterThan(0));
    await user.keyboard('{ArrowDown}{ArrowUp}');
    const active = within(dialog)
      .getAllByRole('option')
      .find((o) => o.getAttribute('aria-selected') === 'true')!;
    expect(input).toHaveAttribute('aria-activedescendant', active.id);
    await user.keyboard('{Enter}');
    await waitFor(() => expect(router.state.location.pathname).toBe('/app/academics/grades'));
  });

  it('starts a new item from a quick action', async () => {
    const store = setup();
    const { user, router } = renderRoute('/app');
    await screen.findByRole('heading', { level: 1, name: /Abhi/ });

    await user.click(screen.getByRole('button', { name: /Search/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Search NOVA' });
    await user.type(within(dialog).getByRole('combobox'), 'new proj');
    await user.keyboard('{Enter}');

    const form = await screen.findByRole('dialog', { name: 'New project' });
    await user.type(within(form).getByLabelText('Name'), 'Campus app');
    await user.click(within(form).getByRole('button', { name: 'Add project' }));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(`/app/developer/projects/${store.projects[0]!.id}`),
    );
  });

  it('says when nothing matches', async () => {
    setup();
    const { user } = renderRoute('/app');
    await screen.findByRole('heading', { level: 1, name: /Abhi/ });
    const dialog = await openPalette();
    await user.type(within(dialog).getByRole('combobox'), 'zzqx');
    expect(await within(dialog).findByText('Nothing matches “zzqx”.')).toBeInTheDocument();
  });
});
