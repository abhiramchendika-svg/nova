import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { addDays, todayIn } from '@/lib/dates';
import { createAcademicStore, seedDemoAcademics, type AcademicStore } from '@/mocks/academics';
import { createMockDb, DEFAULT_SETTINGS } from '@/mocks/handlers';
import type { StoredHackathon } from '@/mocks/hackathons';
import { axeViolations } from '@/test/axe';
import { renderRoute } from '@/test/render';
import { installMockApi, TEST_USER } from '@/test/server';

/** The user id createMockDb gives the logged-in test user. */
const USER_ID = '00000000-0000-4000-8000-000000000001';
const TODAY = todayIn('UTC');
const HOUR = 3_600_000;

function hackathon(id: string, name: string, changes: Partial<StoredHackathon> = {}): StoredHackathon {
  return {
    id,
    name,
    organizer: null,
    mode: null,
    location: null,
    websiteUrl: null,
    startsOn: null,
    endsOn: null,
    registrationDeadline: null,
    submissionDeadline: null,
    status: 'INTERESTED',
    teamName: null,
    teamMembers: null,
    projectId: null,
    result: null,
    repoUrl: null,
    demoUrl: null,
    certificateUrl: null,
    notes: null,
    createdAt: '2026-09-01T00:00:00.000Z',
    ...changes,
  };
}

/** The demo courses (no coursework), timezone UTC, plus whatever the test adds. */
function setup(fill: (store: AcademicStore) => void = () => {}): AcademicStore {
  const store = createAcademicStore();
  seedDemoAcademics(store);
  store.records = [];
  for (const s of store.semesters) s.attendanceTarget = null;
  for (const c of store.courses) c.attendanceTarget = null;
  fill(store);
  const db = createMockDb({ loggedInAs: TEST_USER });
  db.academics.set(USER_ID, store);
  db.settings.set(USER_ID, { ...DEFAULT_SETTINGS, timezone: 'UTC', defaultAttendanceTarget: null });
  installMockApi(db);
  return store;
}

/** One soon (registration closing, an exam the day after it ends), one later, one done. */
function season(store: AcademicStore) {
  const current = store.semesters.find((s) => s.current)!;
  const dbms = store.courses.find((c) => c.name === 'Database Systems' && c.semesterId === current.id)!;
  store.exams.push({
    id: 'exam-1',
    courseId: dbms.id,
    title: 'Mid-semester 1',
    kind: 'MIDTERM',
    startsAt: `${addDays(TODAY, 7)}T10:00:00.000Z`,
    durationMinutes: 90,
    location: null,
  });
  store.hackathons.push(
    hackathon('h-soon', 'Civic Hack', {
      startsOn: addDays(TODAY, 5),
      endsOn: addDays(TODAY, 6),
      mode: 'OFFLINE',
      location: 'Innovation lab',
      registrationDeadline: new Date(Date.now() + 10 * HOUR).toISOString(),
      submissionDeadline: `${addDays(TODAY, 6)}T10:00:00.000Z`,
      teamName: 'Null Pointers',
    }),
    hackathon('h-later', 'Later Jam', { status: 'REGISTERED', startsOn: addDays(TODAY, 30) }),
    hackathon('h-old', 'Old Buildathon', {
      status: 'FINISHED',
      startsOn: addDays(TODAY, -40),
      endsOn: addDays(TODAY, -39),
      result: 'Finalist (top 12)',
      repoUrl: 'https://github.com/example/old',
    }),
  );
}

const card = (name: string) => screen.findByRole('article', { name });

describe('Hackathons', () => {
  it('lists upcoming ones with what’s due and any exam clash, and past ones with how they went', async () => {
    setup(season);
    const { container } = renderRoute('/app/developer/hackathons');

    const upcoming = await screen.findByRole('region', { name: /^Upcoming/ });
    const names = within(upcoming)
      .getAllByRole('article')
      .map((a) => within(a).getByRole('heading').textContent);
    expect(names).toEqual(['Civic Hack', 'Later Jam']);

    const soon = await card('Civic Hack');
    expect(soon).toHaveTextContent('In 5 days');
    expect(soon).toHaveTextContent('In person · Innovation lab');
    expect(soon).toHaveTextContent('Registration closes');
    expect(soon).toHaveTextContent(/Close to an exam: CSE \d+ Mid-semester 1/);
    expect(soon).toHaveTextContent('Team Null Pointers');
    expect(await card('Later Jam')).not.toHaveTextContent('Close to');

    const past = screen.getByRole('list', { name: 'Past hackathons' });
    expect(past).toHaveTextContent('Old Buildathon');
    expect(past).toHaveTextContent('Finalist (top 12)');
    expect(within(past).getByRole('link', { name: /Code/ })).toHaveAttribute(
      'href',
      'https://github.com/example/old',
    );
    expect(await axeViolations(container)).toEqual([]);
  });

  it('adds a hackathon, checking dates and links first', async () => {
    const store = setup();
    const { user, router } = renderRoute('/app/developer/hackathons');

    await screen.findByText('Keep track of the hackathons you’re eyeing.');
    await user.click(screen.getByRole('button', { name: 'Add a hackathon' }));
    const dialog = await screen.findByRole('dialog', { name: 'New hackathon' });
    await user.type(within(dialog).getByLabelText('Name'), 'Smart City Hack');
    fireEvent.change(within(dialog).getByLabelText('Starts (optional)'), {
      target: { value: addDays(TODAY, 9) },
    });
    fireEvent.change(within(dialog).getByLabelText('Ends (optional)'), {
      target: { value: addDays(TODAY, 8) },
    });
    await user.type(within(dialog).getByLabelText('Website (optional)'), 'hack.example.com');
    await user.click(within(dialog).getByRole('button', { name: 'Add hackathon' }));
    expect(
      await within(dialog).findByText('The end date can’t be before the start date.'),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText('Use a full web address starting with http:// or https://.'),
    ).toBeInTheDocument();

    fireEvent.change(within(dialog).getByLabelText('Ends (optional)'), {
      target: { value: addDays(TODAY, 10) },
    });
    await user.clear(within(dialog).getByLabelText('Website (optional)'));
    await user.type(within(dialog).getByLabelText('Website (optional)'), 'https://hack.example.com');
    fireEvent.change(within(dialog).getByLabelText('Registration closes'), {
      target: { value: addDays(TODAY, 3) },
    });
    await user.click(within(dialog).getByRole('button', { name: 'Add hackathon' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Smart City Hack' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe(`/app/developer/hackathons/${store.hackathons[0]!.id}`);
    // Without a time, a deadline means 23:59 that day
    expect(store.hackathons[0]!.registrationDeadline).toBe(`${addDays(TODAY, 3)}T23:59:00.000Z`);
    expect(screen.getByText(/In 9 days/)).toBeInTheDocument();
  });

  it('follows the deadline that matters as the status moves on', async () => {
    const store = setup(season);
    const { user, container } = renderRoute('/app/developer/hackathons/h-soon');

    await screen.findByRole('heading', { level: 1, name: 'Civic Hack' });
    expect(screen.getByRole('region', { name: 'Next deadline' })).toHaveTextContent(/^Registration closes/);
    expect(screen.getByRole('region', { name: 'Close to an exam' })).toHaveTextContent('Mid-semester 1');

    await user.selectOptions(screen.getByLabelText('Status'), 'REGISTERED');
    await waitFor(() =>
      expect(screen.getByRole('region', { name: 'Next deadline' })).toHaveTextContent(/^Submissions close/),
    );
    expect(store.hackathons.find((h) => h.id === 'h-soon')!.status).toBe('REGISTERED');
    // Nothing else changed with it
    expect(store.hackathons.find((h) => h.id === 'h-soon')!.teamName).toBe('Null Pointers');
    expect(await axeViolations(container)).toEqual([]);
  });

  it('keeps prep tasks and creates a linked project', async () => {
    const store = setup(season);
    const { user } = renderRoute('/app/developer/hackathons/h-soon');

    await screen.findByRole('heading', { level: 1, name: 'Civic Hack' });
    await user.click(screen.getByRole('button', { name: 'Add prep task' }));
    const taskDialog = await screen.findByRole('dialog', { name: 'New task' });
    await user.type(within(taskDialog).getByLabelText('Title'), 'Set up the repo');
    await user.click(within(taskDialog).getByRole('button', { name: 'Add task' }));
    expect(await screen.findByRole('list', { name: 'Prep tasks' })).toHaveTextContent('Set up the repo');
    expect(store.tasks[0]).toMatchObject({ hackathonId: 'h-soon', category: 'PROJECT' });

    await user.click(screen.getByRole('button', { name: 'Create a project from it' }));
    const projectDialog = await screen.findByRole('dialog', { name: 'New project' });
    expect(within(projectDialog).getByLabelText('Name')).toHaveValue('Civic Hack');
    await user.click(within(projectDialog).getByRole('button', { name: 'Add project' }));

    const projectLink = await screen.findByRole('link', { name: 'Civic Hack' });
    expect(projectLink).toHaveAttribute('href', `/app/developer/projects/${store.projects[0]!.id}`);
    expect(store.hackathons.find((h) => h.id === 'h-soon')!.projectId).toBe(store.projects[0]!.id);
    expect(store.projects[0]!.status).toBe('PLANNING');
  });

  it('deletes a hackathon but keeps its prep tasks', async () => {
    const store = setup(season);
    store.tasks.push({
      id: 't-1',
      title: 'Register the team',
      description: null,
      category: 'PROJECT',
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
      hackathonId: 'h-later',
      internshipId: null,
      createdAt: 1,
    });
    const { user, router } = renderRoute('/app/developer/hackathons/h-later');

    await screen.findByRole('heading', { level: 1, name: 'Later Jam' });
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    const confirm = await screen.findByRole('dialog', { name: 'Delete this hackathon?' });
    await user.click(within(confirm).getByRole('button', { name: 'Delete hackathon' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/app/developer/hackathons'));
    expect(store.hackathons.map((h) => h.id)).not.toContain('h-later');
    expect(store.tasks[0]!.hackathonId).toBeNull();
  });

  it('puts its days and deadline on the calendar', async () => {
    setup(season);
    renderRoute(`/app/planner/calendar?date=${addDays(TODAY, 5)}`);

    const days = await screen.findAllByRole('link', { name: /^Hackathon: Civic Hack/ });
    expect(days.length).toBeGreaterThanOrEqual(1);
    expect(days[0]).toHaveAttribute('href', '/app/developer/hackathons/h-soon');
  });

  it('shows what’s due, the exam clash and the next one on Home', async () => {
    setup(season);
    renderRoute('/app');

    const attention = await screen.findByRole('region', { name: /Needs attention/ });
    expect(await within(attention).findByText(/Registration closes (today|tomorrow) at/)).toBeInTheDocument();
    expect(within(attention).getByText(/Mid-semester 1 on .+ · 1 day after it/)).toBeInTheDocument();

    const summaries = screen.getByRole('region', { name: 'Summaries' });
    expect(await within(summaries).findByText(/Next hackathon:/)).toHaveTextContent(
      'Next hackathon: Civic Hack, in 5 days',
    );
    expect(within(summaries).getByRole('link', { name: /Open hackathons/ })).toHaveAttribute(
      'href',
      '/app/developer/hackathons',
    );
  });

  it('says so when a hackathon doesn’t exist', async () => {
    setup();
    renderRoute('/app/developer/hackathons/nope');
    expect(await screen.findByText('We couldn’t find that hackathon.')).toBeInTheDocument();
  });
});
