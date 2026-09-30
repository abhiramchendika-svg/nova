import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createAcademicStore, seedDemoAcademics, type AcademicStore } from '@/mocks/academics';
import { seedDemoCoursework } from '@/mocks/coursework';
import { createMockDb, DEFAULT_SETTINGS } from '@/mocks/handlers';
import { axeViolations } from '@/test/axe';
import { renderRoute } from '@/test/render';
import { installMockApi, TEST_USER } from '@/test/server';

/** The user id createMockDb gives the logged-in test user. */
const USER_ID = '00000000-0000-4000-8000-000000000001';

function setup(): AcademicStore {
  const store = createAcademicStore();
  seedDemoAcademics(store);
  seedDemoCoursework(store);
  const db = createMockDb({ loggedInAs: TEST_USER });
  db.academics.set(USER_ID, store);
  db.settings.set(USER_ID, { ...DEFAULT_SETTINGS, defaultAttendanceTarget: 75 });
  installMockApi(db);
  return store;
}

const dbmsId = (store: AcademicStore) => store.courses.find((c) => c.name === 'Database Systems')!.id;
const panel = (name: string) => screen.findByRole('region', { name });

// Database Systems in the demo: 26/30 attended (safe at 75%), two open assignments, one exam in
// 9 days with 2 of 4 topics done, and two links.
describe('Course page', () => {
  it('opens from the Courses page and brings the course together', async () => {
    setup();
    const { user } = renderRoute('/app/academics/courses');

    await user.click(await screen.findByRole('link', { name: 'Database Systems' }));
    expect(await screen.findByRole('heading', { level: 1, name: /Database Systems/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Semester 3 courses' })).toBeInTheDocument();

    const attendance = await panel('Attendance');
    expect(attendance).toHaveTextContent('26 of 30 attended');
    expect(attendance).toHaveTextContent('86.7%');
    expect(attendance).toHaveTextContent('You can miss 4 more classes.');

    const assignments = await panel('Assignments');
    expect(assignments).toHaveTextContent('2 open');
    const open = within(assignments).getByRole('list', { name: 'Open assignments for Database Systems' });
    expect(within(open).getAllByRole('listitem')).toHaveLength(2);
    expect(open).toHaveTextContent('ER diagram for the library schemaDue tomorrow');
    expect(
      within(assignments).getByRole('link', { name: 'All assignments for this course' }),
    ).toHaveAttribute('href', expect.stringContaining('/app/academics/assignments?course='));

    const exams = await panel('Upcoming exams');
    expect(exams).toHaveTextContent('Mid-semester 1In 9 days');
    expect(exams).toHaveTextContent('2 of 4 topics ready (50%)');

    const links = await panel('Links');
    const syllabus = within(links).getByRole('link', { name: /Syllabus/ });
    expect(syllabus).toHaveAttribute('href', 'https://example.edu/cse201/syllabus');
    expect(syllabus).toHaveAttribute('target', '_blank');
    expect(syllabus).toHaveAttribute('rel', 'noopener noreferrer');
    expect(syllabus).toHaveTextContent('example.edu');
  });

  it('adds a link, refusing anything but a web address', async () => {
    const store = setup();
    const { user } = renderRoute(`/app/academics/courses/${dbmsId(store)}`);
    const links = await panel('Links');

    await user.click(within(links).getByRole('button', { name: 'Add' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add a link' });
    await user.type(within(dialog).getByLabelText('Title'), 'Past papers');
    await user.type(within(dialog).getByLabelText('Link'), 'javascript:alert(1)');
    await user.click(within(dialog).getByRole('button', { name: 'Add link' }));
    expect(
      await within(dialog).findByText('Use a web link starting with http:// or https://.'),
    ).toBeInTheDocument();

    await user.clear(within(dialog).getByLabelText('Link'));
    await user.type(within(dialog).getByLabelText('Link'), 'https://example.edu/cse201/papers');
    await user.click(within(dialog).getByRole('button', { name: 'Add link' }));

    expect(await within(links).findByRole('link', { name: /Past papers/ })).toHaveAttribute(
      'href',
      'https://example.edu/cse201/papers',
    );
    expect(store.resources.filter((r) => r.courseId === dbmsId(store))).toHaveLength(3);
  });

  it('edits and removes a link', async () => {
    const store = setup();
    const { user } = renderRoute(`/app/academics/courses/${dbmsId(store)}`);
    const links = await panel('Links');

    await user.click(within(links).getByRole('button', { name: 'Edit Lecture recordings' }));
    const dialog = await screen.findByRole('dialog', { name: 'Edit link' });
    const title = within(dialog).getByLabelText('Title');
    await user.clear(title);
    await user.type(title, 'Recordings (2026)');
    await user.click(within(dialog).getByRole('button', { name: 'Save changes' }));
    expect(await within(links).findByRole('link', { name: /Recordings \(2026\)/ })).toBeInTheDocument();

    await user.click(within(links).getByRole('button', { name: 'Delete Syllabus' }));
    const confirm = await screen.findByRole('dialog', { name: 'Remove this link?' });
    await user.click(within(confirm).getByRole('button', { name: 'Remove link' }));
    await waitFor(() =>
      expect(within(links).queryByRole('link', { name: /Syllabus/ })).not.toBeInTheDocument(),
    );
  });

  it('adds an assignment to this course', async () => {
    const store = setup();
    const { user } = renderRoute(`/app/academics/courses/${dbmsId(store)}`);
    const assignments = await panel('Assignments');

    await user.click(within(assignments).getByRole('button', { name: 'Add' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add an assignment' });
    await waitFor(() => expect(within(dialog).getByLabelText('Course')).toHaveValue(dbmsId(store)));
    await user.type(within(dialog).getByLabelText('Title'), 'Indexing notes');
    await user.click(within(dialog).getByRole('button', { name: 'Add assignment' }));

    await waitFor(() => expect(assignments).toHaveTextContent('3 open'));
    expect(assignments).toHaveTextContent('Indexing notes');
  });

  it('links to each exam and adds one for this course', async () => {
    const store = setup();
    const { user } = renderRoute(`/app/academics/courses/${dbmsId(store)}`);
    const exams = await panel('Upcoming exams');
    expect(within(exams).getByRole('link', { name: 'Mid-semester 1' })).toHaveAttribute(
      'href',
      '/app/academics/exams/00000000-0000-4000-8000-0000000de001',
    );

    await user.click(within(exams).getByRole('button', { name: 'Add' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add an exam' });
    await waitFor(() => expect(within(dialog).getByLabelText('Course')).toHaveValue(dbmsId(store)));
    await user.type(within(dialog).getByLabelText('Title'), 'Lab exam');
    await user.selectOptions(within(dialog).getByLabelText('Kind'), 'Lab exam');
    await user.click(within(dialog).getByRole('button', { name: 'Add exam' }));

    // Today's exam comes first, and the course page stays open
    expect(await within(exams).findByRole('link', { name: 'Lab exam' })).toBeInTheDocument();
    expect(exams).toHaveTextContent('Lab examToday');
  });

  it('says so when the course doesn’t exist', async () => {
    setup();
    renderRoute('/app/academics/courses/00000000-0000-4000-8000-00000000beef');
    expect(await screen.findByText('We couldn’t find that course.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to courses' })).toHaveAttribute(
      'href',
      '/app/academics/courses',
    );
  });

  it('has no serious accessibility violations', async () => {
    const store = setup();
    const { container } = renderRoute(`/app/academics/courses/${dbmsId(store)}`);
    await panel('Links');
    expect(await axeViolations(container)).toEqual([]);
  });
});
