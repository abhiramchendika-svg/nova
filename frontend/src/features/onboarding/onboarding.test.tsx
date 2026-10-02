import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createAcademicStore, PRESET_IDS, type AcademicStore } from '@/mocks/academics';
import { createMockDb, DEFAULT_SETTINGS, type MockDb } from '@/mocks/handlers';
import { axeViolations } from '@/test/axe';
import { renderRoute } from '@/test/render';
import { installMockApi, TEST_USER } from '@/test/server';

/** The user id createMockDb gives the logged-in test user. */
const USER_ID = '00000000-0000-4000-8000-000000000001';

/** The one GitHub user the mock knows in these tests. */
function knowGitHub(store: AcademicStore) {
  store.githubWorld['octo-student'] = {
    login: 'octo-student',
    name: null,
    avatarUrl: null,
    htmlUrl: 'https://github.com/octo-student',
    publicRepos: 0,
    followers: 0,
    following: 0,
    createdAt: '2024-01-01T00:00:00Z',
    repos: [],
    calendar: null,
  };
}

function setup(store: AcademicStore = createAcademicStore()): MockDb {
  knowGitHub(store);
  const db = createMockDb({ loggedInAs: TEST_USER, onboarding: 'pending' });
  db.academics.set(USER_ID, store);
  db.settings.set(USER_ID, { ...DEFAULT_SETTINGS });
  installMockApi(db);
  return db;
}

const onboarded = (db: MockDb) => db.users.get(TEST_USER.email)!.onboardingCompleted;
const currentStep = () =>
  screen.getByRole('navigation', { name: 'Setup steps' }).querySelector('[aria-current="step"]');

function storeWithSemester(): AcademicStore {
  const store = createAcademicStore();
  store.semesters.push({
    id: 'sem-1',
    name: 'Semester 3',
    ordinal: 3,
    startsOn: null,
    endsOn: null,
    current: true,
    attendanceTarget: null,
    gradingScheme: { id: PRESET_IDS.tenPoint, name: '10-point scale', maxPoints: 10 },
  });
  return store;
}

function withCourse(store: AcademicStore): AcademicStore {
  store.courses.push({
    id: 'c1',
    semesterId: 'sem-1',
    code: 'CSE 201',
    name: 'Database Systems',
    credits: 4,
    faculty: null,
    colorHue: null,
    notes: null,
    attendanceTarget: null,
    gradeDefinitionId: null,
    gradeKind: null,
    baselineConducted: 0,
    baselineAttended: 0,
  });
  return store;
}

describe('Onboarding', () => {
  it('sends a new account from Home to setup', async () => {
    setup();
    const { router } = renderRoute('/app');
    expect(await screen.findByRole('heading', { level: 1, name: 'Welcome, Abhi.' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/app/welcome');
    expect(currentStep()).toHaveTextContent('You');
  });

  it('walks through all six steps and lands on Home', async () => {
    const db = setup();
    const { user, router } = renderRoute('/app/welcome');

    // 1. You
    await screen.findByRole('heading', { level: 1, name: 'Welcome, Abhi.' });
    await user.type(screen.getByLabelText('University (optional)'), 'Example University');
    await user.type(screen.getByLabelText(/Minimum attendance/), '75');
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    // 2. Semester
    await screen.findByRole('heading', { level: 1, name: 'Your current semester' });
    expect(db.settings.get(USER_ID)).toMatchObject({
      universityName: 'Example University',
      defaultAttendanceTarget: 75,
    });
    await waitFor(() => expect(screen.getByLabelText('Grading scheme')).toHaveValue(PRESET_IDS.tenPoint));
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    // 3. Courses: an incomplete row is caught before anything is sent
    await screen.findByRole('heading', { level: 1, name: 'Courses in Semester 1' });
    await user.type(screen.getByLabelText('Course 1 code'), 'CSE 201');
    await user.type(screen.getByLabelText('Course 1 name'), 'Database Systems');
    const credits = screen.getAllByLabelText('Credits');
    await user.type(credits[0]!, '4');
    await user.type(screen.getByLabelText('Course 2 name'), 'Compilers');
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByText('Credits like 3 or 4.5.')).toBeInTheDocument();
    await user.type(credits[1]!, '3');
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    // 4. Timetable
    await screen.findByRole('heading', { level: 1, name: 'Your weekly classes' });
    const store = db.academics.get(USER_ID)!;
    expect(store.courses.map((c) => c.name).sort()).toEqual(['Compilers', 'Database Systems']);
    await user.click(screen.getByRole('button', { name: 'Add a class' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add a class' });
    await user.selectOptions(within(dialog).getByLabelText('Course'), 'CSE 201 · Database Systems');
    fireEvent.change(within(dialog).getByLabelText('Starts'), { target: { value: '09:00' } });
    fireEvent.change(within(dialog).getByLabelText('Ends'), { target: { value: '09:50' } });
    await user.click(within(dialog).getByRole('button', { name: 'Add class' }));
    expect(await screen.findByRole('list', { name: 'Classes added' })).toHaveTextContent(
      'Mon09:00–09:50CSE 201Lecture',
    );

    await user.click(screen.getByRole('button', { name: 'Continue' }));

    // 5. Goals: topics without a name are caught; then the goal is saved with its topics
    await screen.findByRole('heading', { level: 1, name: 'Something you’re learning' });
    expect(currentStep()).toHaveTextContent('Goals');
    expect(screen.getByRole('button', { name: 'Skip' })).toBeInTheDocument();
    await user.type(
      screen.getByLabelText('Topics (optional)'),
      'Dependency injection{Enter}{Enter}Spring Data JPA',
    );
    await user.click(screen.getByRole('button', { name: 'Save and continue' }));
    expect(await screen.findByText('Name what you’re learning.')).toBeInTheDocument();
    expect(onboarded(db)).toBe(false);
    await user.type(screen.getByLabelText('What you’re learning'), 'Spring Boot');
    await user.click(screen.getByRole('button', { name: 'Save and continue' }));

    // 6. GitHub: checked with (the mock) GitHub, then setup finishes
    await screen.findByRole('heading', { level: 1, name: 'Your GitHub' });
    expect(currentStep()).toHaveTextContent('GitHub');
    await user.type(screen.getByLabelText('GitHub username'), 'nobody-here');
    await user.click(screen.getByRole('button', { name: 'Connect and finish' }));
    expect(await screen.findByText('We couldn’t find that GitHub user.')).toBeInTheDocument();
    await user.clear(screen.getByLabelText('GitHub username'));
    await user.type(screen.getByLabelText('GitHub username'), 'octo-student');
    await user.click(screen.getByRole('button', { name: 'Connect and finish' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/app'));
    expect(store.github?.user.login).toBe('octo-student');
    expect(await screen.findByRole('heading', { level: 1, name: /Abhi\./ })).toBeInTheDocument();
    expect(onboarded(db)).toBe(true);
    expect(store.learningGoals.map((g) => g.title)).toEqual(['Spring Boot']);
    expect(store.learningTopics.sort((a, b) => a.position - b.position).map((t) => t.title)).toEqual([
      'Dependency injection',
      'Spring Data JPA',
    ]);
  });

  it('lets the goals and GitHub steps be skipped', async () => {
    const store = withCourse(storeWithSemester());
    const db = setup(store);
    const { user, router } = renderRoute('/app/welcome');
    await screen.findByRole('heading', { level: 1, name: 'Your weekly classes' });
    await user.click(screen.getByRole('button', { name: 'Skip' }));
    await screen.findByRole('heading', { level: 1, name: 'Something you’re learning' });
    await user.click(screen.getByRole('button', { name: 'Skip' }));
    await screen.findByRole('heading', { level: 1, name: 'Your GitHub' });
    await user.click(screen.getByRole('button', { name: 'Skip and finish' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/app'));
    expect(onboarded(db)).toBe(true);
    expect(store.learningGoals).toEqual([]);
    expect(store.github).toBeNull();
  });

  it('can be skipped, and then stays out of the way', async () => {
    const db = setup();
    const { user, router } = renderRoute('/app/welcome');
    await screen.findByRole('heading', { level: 1, name: 'Welcome, Abhi.' });

    await user.click(screen.getByRole('button', { name: 'Skip setup' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/app'));
    expect(await screen.findByText('Your day is clear.')).toBeInTheDocument();
    expect(onboarded(db)).toBe(true);
  });

  it('resumes from what’s saved: a semester without courses opens at Courses', async () => {
    setup(storeWithSemester());
    const { user } = renderRoute('/app/welcome');

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Courses in Semester 3' }),
    ).toBeInTheDocument();
    expect(currentStep()).toHaveTextContent('Courses');
    // Continuing without any course is refused
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByText('Add at least one course to continue.')).toBeInTheDocument();

    // Back shows the saved semester instead of a blank form
    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Your semester' })).toBeInTheDocument();
    expect(screen.getByText('Semester 3')).toBeInTheDocument();
  });

  it('resumes at the timetable when courses exist, listing them', async () => {
    setup(withCourse(storeWithSemester()));
    const { user } = renderRoute('/app/welcome');
    expect(await screen.findByRole('heading', { level: 1, name: 'Your weekly classes' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Skip' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(await screen.findByRole('list', { name: 'Courses already added' })).toHaveTextContent(
      'Database Systems',
    );
  });

  it('has no serious accessibility violations', async () => {
    setup();
    const { container, user } = renderRoute('/app/welcome');
    await screen.findByRole('heading', { level: 1, name: 'Welcome, Abhi.' });
    expect(await axeViolations(container)).toEqual([]);
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await screen.findByRole('heading', { level: 1, name: 'Your current semester' });
    expect(await axeViolations(container)).toEqual([]);
  });
});
