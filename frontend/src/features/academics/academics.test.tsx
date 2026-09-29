import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createAcademicStore, PRESETS, seedDemoAcademics, type AcademicStore } from '@/mocks/academics';
import { createMockDb } from '@/mocks/handlers';
import { axeViolations } from '@/test/axe';
import { renderRoute } from '@/test/render';
import { installMockApi, TEST_USER } from '@/test/server';

/** The user id createMockDb gives the logged-in test user. */
const USER_ID = '00000000-0000-4000-8000-000000000001';

function loggedInWith(store: AcademicStore = createAcademicStore()) {
  const db = createMockDb({ loggedInAs: TEST_USER });
  db.academics.set(USER_ID, store);
  installMockApi(db);
  return store;
}

function demoStore() {
  const store = createAcademicStore();
  seedDemoAcademics(store);
  return store;
}

// ───────────── Courses ─────────────

describe('Courses page', () => {
  it('walks a new student from no semester to a first course', async () => {
    loggedInWith();
    const { user } = renderRoute('/app/academics/courses');

    expect(await screen.findByText('Start with your current semester.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Add semester' }));

    const dialog = await screen.findByRole('dialog', { name: 'Add a semester' });
    expect(within(dialog).getByLabelText('Name')).toHaveValue('Semester 1');
    expect(within(dialog).getByLabelText('Number')).toHaveValue('1');
    // The first semester is current by default
    expect(within(dialog).getByLabelText('This is my current semester')).toBeChecked();
    await waitFor(() => expect(within(dialog).getByLabelText('Grading scheme')).toHaveValue(PRESETS[0]!.id));
    await user.click(within(dialog).getByRole('button', { name: 'Add semester' }));

    expect(await screen.findByText('No courses in Semester 1 yet.')).toBeInTheDocument();
    expect(screen.getByText('Current')).toBeInTheDocument();

    await user.click(screen.getAllByRole('button', { name: /Add course/ })[0]!);
    const courseDialog = await screen.findByRole('dialog', { name: 'Add a course' });
    await user.type(within(courseDialog).getByLabelText('Code (optional)'), 'CSE 201');
    await user.type(within(courseDialog).getByLabelText('Name'), 'Database Systems');
    await user.type(within(courseDialog).getByLabelText('Credits'), '4');
    await user.click(within(courseDialog).getByRole('button', { name: 'Add course' }));

    expect(await screen.findByText('Database Systems')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '1 course' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: '1 course' })).toHaveTextContent('CSE 201Database Systems4 credits');
  });

  it('validates a course before sending it', async () => {
    const store = demoStore();
    loggedInWith(store);
    const { user } = renderRoute('/app/academics/courses');

    await user.click(await screen.findByRole('button', { name: 'Add course' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add a course' });
    await user.type(within(dialog).getByLabelText('Credits'), '4.25');
    await user.click(within(dialog).getByRole('button', { name: 'Add course' }));

    expect(await within(dialog).findByText('Give the course a name.')).toBeInTheDocument();
    expect(within(dialog).getByText('Use a number like 3 or 4.5 (at most 1 decimal).')).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Credits')).toHaveAttribute('aria-invalid', 'true');
  });

  it('shows the server’s answer on the right field', async () => {
    loggedInWith(demoStore());
    const { user } = renderRoute('/app/academics/courses');

    await user.click(await screen.findByRole('button', { name: 'Add semester' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add a semester' });
    const number = within(dialog).getByLabelText('Number');
    await user.clear(number);
    await user.type(number, '2'); // Semester 2 already exists
    await user.click(within(dialog).getByRole('button', { name: 'Add semester' }));

    expect(
      await within(dialog).findByText('You already have a semester with this number.'),
    ).toBeInTheDocument();
  });

  it('switches semesters and moves the current flag', async () => {
    loggedInWith(demoStore());
    const { user } = renderRoute('/app/academics/courses');

    expect(await screen.findByText('Database Systems')).toBeInTheDocument(); // current semester first
    await user.selectOptions(screen.getByLabelText('Semester'), 'Semester 1');
    expect(await screen.findByText('Calculus')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Make current' }));
    await waitFor(() =>
      expect(screen.getByRole('option', { name: 'Semester 1 (current)' })).toBeInTheDocument(),
    );
    expect(screen.queryByRole('button', { name: 'Make current' })).not.toBeInTheDocument();
  });

  it('edits and deletes a course', async () => {
    loggedInWith(demoStore());
    const { user } = renderRoute('/app/academics/courses');

    await user.click(await screen.findByRole('button', { name: 'Edit Compilers' }));
    const dialog = await screen.findByRole('dialog', { name: 'Edit course' });
    const name = within(dialog).getByLabelText('Name');
    await user.clear(name);
    await user.type(name, 'Compiler Design');
    await user.click(within(dialog).getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByText('Compiler Design')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Delete Compiler Design' }));
    const confirm = await screen.findByRole('dialog', { name: 'Delete this course?' });
    await user.click(within(confirm).getByRole('button', { name: 'Delete course' }));
    await waitFor(() => expect(screen.queryByText('Compiler Design')).not.toBeInTheDocument());
    expect(screen.getByRole('heading', { name: '2 courses' })).toBeInTheDocument();
  });

  it('asks for the semester’s name before deleting it and its courses', async () => {
    loggedInWith(demoStore());
    const { user } = renderRoute('/app/academics/courses');

    await user.click(await screen.findByRole('button', { name: 'Delete semester' }));
    const confirm = await screen.findByRole('dialog', { name: 'Delete Semester 3?' });
    const button = within(confirm).getByRole('button', { name: 'Delete semester' });
    expect(button).toBeDisabled();
    await user.type(within(confirm).getByLabelText('Type “Semester 3” to confirm'), 'Semester 3');
    expect(button).toBeEnabled();
    await user.click(button);

    await waitFor(() => expect(screen.queryByRole('option', { name: /Semester 3/ })).not.toBeInTheDocument());
  });

  it('has no serious accessibility violations', async () => {
    loggedInWith(demoStore());
    const { container } = renderRoute('/app/academics/courses');
    await screen.findByText('Database Systems');
    expect(await axeViolations(container)).toEqual([]);
  });
});

// ───────────── Grades ─────────────
// Demo data (mocks/academics.ts), all on the 10-point scale:
//   Semester 1: 4×A(8) + 4×O(10) + 3×B+(7) = 93 / 11 → 8.45
//   Semester 2: 4×A+(9) + 4×O(10) + 3×A(8) = 100 / 11 → 9.09
//   Semester 3 (current): Database Systems 4×A+ expected; OS and Compilers ungraded
//   CGPA = 193 / 22 = 8.77; projected = (193 + 36) / 26 = 8.81

describe('Grades page', () => {
  it('points a new student to their courses first', async () => {
    loggedInWith();
    renderRoute('/app/academics/grades');
    expect(await screen.findByText('Your grades live in your semesters.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Add a semester' })).toHaveAttribute(
      'href',
      '/app/academics/courses',
    );
  });

  it('leads with CGPA, then each semester’s GPA', async () => {
    loggedInWith(demoStore());
    renderRoute('/app/academics/grades');

    const overview = await screen.findByRole('region', { name: 'Overview' });
    expect(within(overview).getByText('8.77')).toBeInTheDocument();
    expect(within(overview).getByText('/ 10')).toBeInTheDocument();
    expect(within(overview).getByText('8.81')).toBeInTheDocument(); // projected
    expect(overview).toHaveTextContent('22 of 33 credits completed.');

    const s1 = screen.getByRole('region', { name: 'Semester 1' });
    expect(within(s1).getByText('8.45')).toBeInTheDocument();
    const s3 = screen.getByRole('region', { name: 'Semester 3 (current)' });
    expect(s3).toHaveTextContent('GPA —');
    expect(s3).toHaveTextContent('projected 9.00');
  });

  it('saves a grade and recalculates', async () => {
    loggedInWith(demoStore());
    const { user } = renderRoute('/app/academics/grades');

    // Current semester: a new grade defaults to "expected". Projected: (229 + 4×10) / 30 = 8.97
    await user.selectOptions(await screen.findByLabelText('Grade for Operating Systems'), 'O · 10');
    const overview = screen.getByRole('region', { name: 'Overview' });
    await waitFor(() => expect(overview).toHaveTextContent('Projected 8.97'));
    expect(screen.getByLabelText('Grade type for Operating Systems')).toHaveValue('EXPECTED');
    expect(within(overview).getByText('8.77')).toBeInTheDocument(); // official CGPA unchanged

    // Making it final moves it into the official CGPA: (193 + 40) / 26 = 8.96
    await user.selectOptions(screen.getByLabelText('Grade type for Operating Systems'), 'Final');
    await waitFor(() => expect(within(overview).getByText('8.96')).toBeInTheDocument());
  });

  it('tries what-if grades without saving them', async () => {
    const store = demoStore();
    loggedInWith(store);
    const { user } = renderRoute('/app/academics/grades');

    await user.click(await screen.findByRole('switch', { name: 'Try what-if grades' }));
    expect(screen.getByText(/Nothing is saved in this mode/)).toBeInTheDocument();

    // Compilers as O: (229 + 3×10) / 29 = 8.93
    await user.selectOptions(screen.getByLabelText('What-if grade for Compilers'), 'O · 10');
    const whatIf = screen.getByRole('region', { name: 'What-if' });
    await waitFor(() => expect(whatIf).toHaveTextContent('CGPA would be 8.93'));
    expect(screen.getByRole('region', { name: 'Semester 3 (current)' })).toHaveTextContent('what-if 9.43'); // (4×9 + 3×10) / 7

    await user.click(within(whatIf).getByRole('button', { name: 'Reset' }));
    expect(screen.getByLabelText('What-if grade for Compilers')).toHaveValue('');

    await user.click(screen.getByRole('switch', { name: 'Try what-if grades' }));
    expect(screen.getByLabelText('Grade for Compilers')).toHaveValue(''); // still ungraded
    expect(store.courses.find((c) => c.name === 'Compilers')?.gradeDefinitionId).toBeNull();
  });

  it('explains why there is no CGPA when scales differ', async () => {
    const store = demoStore();
    const four = PRESETS[1]!;
    const exchange = {
      ...store.semesters[0]!,
      id: 'ex',
      name: 'Exchange term',
      ordinal: 4,
      current: false,
      gradingScheme: { id: four.id, name: four.name, maxPoints: 4 },
    };
    store.semesters.push(exchange);
    store.courses.push({
      ...store.courses[0]!,
      id: 'ex-c',
      semesterId: 'ex',
      name: 'Databases abroad',
      gradeDefinitionId: four.grades[0]!.id,
      gradeKind: 'FINAL',
    });
    loggedInWith(store);
    renderRoute('/app/academics/grades');

    const overview = await screen.findByRole('region', { name: 'Overview' });
    expect(overview).toHaveTextContent('Your semesters use different grading scales');
    expect(within(overview).getByText('—')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Exchange term' })).toHaveTextContent('GPA 4.00');
  });

  it('has no serious accessibility violations, including in what-if mode', async () => {
    loggedInWith(demoStore());
    const { container, user } = renderRoute('/app/academics/grades');
    await screen.findByRole('region', { name: 'Overview' });
    expect(await axeViolations(container)).toEqual([]);
    await user.click(screen.getByRole('switch', { name: 'Try what-if grades' }));
    expect(await axeViolations(container)).toEqual([]);
  });
});

// ───────────── Grading schemes ─────────────

describe('Grading schemes page', () => {
  it('shows presets as read-only and copies one into an editable scheme', async () => {
    loggedInWith();
    const { user } = renderRoute('/app/academics/grades/schemes');

    expect(await screen.findByRole('heading', { name: '10-point scale' })).toBeInTheDocument();
    expect(screen.getAllByText('Preset')).toHaveLength(3);
    expect(screen.queryByRole('button', { name: 'Edit 10-point scale' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Copy 10-point scale' }));
    expect(await screen.findByRole('heading', { name: '10-point scale (copy)' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit 10-point scale (copy)' })).toBeInTheDocument();
  });

  it('creates a scheme, checking labels and points first', async () => {
    loggedInWith();
    const { user } = renderRoute('/app/academics/grades/schemes');

    await user.click(await screen.findByRole('button', { name: 'New scheme' }));
    const dialog = await screen.findByRole('dialog', { name: 'New grading scheme' });
    await user.type(within(dialog).getByLabelText('Name'), 'My university');
    await user.click(within(dialog).getByRole('button', { name: 'Add grade' }));
    await user.type(within(dialog).getByLabelText('Grade 3 label'), 'a'); // clashes with "A"
    const points = within(dialog).getByLabelText('Grade 3 points');
    await user.clear(points);
    await user.type(points, '11'); // above the maximum of 10
    await user.click(within(dialog).getByRole('button', { name: 'Create scheme' }));

    expect(await within(dialog).findByText('Each grade needs a different label.')).toBeInTheDocument();
    expect(within(dialog).getByText('Above the maximum.')).toBeInTheDocument();

    const label = within(dialog).getByLabelText('Grade 3 label');
    await user.clear(label);
    await user.type(label, 'B');
    await user.clear(points);
    await user.type(points, '8');
    // Order is display order: move B above F
    await user.click(within(dialog).getByRole('button', { name: 'Move grade 3 up' }));
    await user.click(within(dialog).getByRole('button', { name: 'Create scheme' }));

    const created = await screen.findByRole('list', { name: 'Grades in My university' });
    expect(
      within(created)
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual(['A10', 'B8', 'F0fail']);
  });

  it('edits a scheme in place', async () => {
    loggedInWith();
    const { user } = renderRoute('/app/academics/grades/schemes');
    await user.click(await screen.findByRole('button', { name: 'Copy Pass/Fail' }));
    await user.click(await screen.findByRole('button', { name: 'Edit Pass/Fail (copy)' }));

    const dialog = await screen.findByRole('dialog', { name: 'Edit grading scheme' });
    const name = within(dialog).getByLabelText('Name');
    await user.clear(name);
    await user.type(name, 'Audit courses');
    await user.click(within(dialog).getByRole('button', { name: 'Save scheme' }));

    expect(await screen.findByRole('heading', { name: 'Audit courses' })).toBeInTheDocument();
  });

  it('explains why a scheme in use can’t be deleted', async () => {
    const store = demoStore();
    const own = { ...PRESETS[0]!, id: 'own', name: 'Mine', builtIn: false };
    store.schemes.push(own);
    store.semesters[0]!.gradingScheme = { id: 'own', name: 'Mine', maxPoints: 10 };
    loggedInWith(store);
    const { user } = renderRoute('/app/academics/grades/schemes');

    await user.click(await screen.findByRole('button', { name: 'Delete Mine' }));
    const confirm = await screen.findByRole('dialog', { name: 'Delete this grading scheme?' });
    await user.click(within(confirm).getByRole('button', { name: 'Delete scheme' }));
    expect(await within(confirm).findByRole('alert')).toHaveTextContent(
      'A semester uses this grading scheme',
    );
  });

  it('has no serious accessibility violations', async () => {
    loggedInWith();
    const { container } = renderRoute('/app/academics/grades/schemes');
    await screen.findByRole('heading', { name: '10-point scale' });
    expect(await axeViolations(container)).toEqual([]);
  });
});
