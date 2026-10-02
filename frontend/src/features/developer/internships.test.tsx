import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { addDays, todayIn } from '@/lib/dates';
import { createAcademicStore, type AcademicStore } from '@/mocks/academics';
import { createMockDb, DEFAULT_SETTINGS } from '@/mocks/handlers';
import type { StoredInternship, StoredInternshipEvent } from '@/mocks/internships';
import { axeViolations } from '@/test/axe';
import { renderRoute } from '@/test/render';
import { installMockApi, TEST_USER } from '@/test/server';

/** The user id createMockDb gives the logged-in test user. */
const USER_ID = '00000000-0000-4000-8000-000000000001';
const TODAY = todayIn('UTC');
const MONTH = TODAY.slice(0, 7);
const HOUR = 3_600_000;

function application(id: string, company: string, changes: Partial<StoredInternship> = {}): StoredInternship {
  return {
    id,
    company,
    role: 'SDE intern',
    location: null,
    jobUrl: null,
    source: null,
    status: 'APPLIED',
    appliedOn: TODAY,
    deadlineAt: null,
    nextStep: null,
    nextStepAt: null,
    resumeVersion: null,
    notes: null,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    ...changes,
  };
}

const event = (
  applicationId: string,
  fromStatus: StoredInternshipEvent['fromStatus'],
  toStatus: StoredInternshipEvent['toStatus'],
  changedAt: string,
): StoredInternshipEvent => ({ applicationId, fromStatus, toStatus, changedAt });

function setup(fill: (store: AcademicStore) => void = () => {}): AcademicStore {
  const store = createAcademicStore();
  fill(store);
  const db = createMockDb({ loggedInAs: TEST_USER });
  db.academics.set(USER_ID, store);
  db.settings.set(USER_ID, { ...DEFAULT_SETTINGS, timezone: 'UTC' });
  installMockApi(db);
  return store;
}

/** Acme (interview in 2 days, after an assessment), Globex (applied), Initech (saved, apply by tonight), Hooli (rejected). */
function season(store: AcademicStore) {
  store.internships.push(
    application('i-acme', 'Acme', {
      status: 'INTERVIEW',
      nextStep: 'Technical round',
      nextStepAt: `${addDays(TODAY, 2)}T09:30:00.000Z`,
      location: 'Bengaluru',
    }),
    application('i-globex', 'Globex', { role: 'Data intern' }),
    application('i-initech', 'Initech', {
      status: 'SAVED',
      appliedOn: null,
      deadlineAt: new Date(Date.now() + 10 * HOUR).toISOString(),
    }),
    application('i-hooli', 'Hooli', { status: 'REJECTED' }),
  );
  store.internshipEvents.push(
    event('i-acme', null, 'APPLIED', '2026-09-01T00:00:00.000Z'),
    event('i-acme', 'APPLIED', 'ASSESSMENT', '2026-09-02T00:00:00.000Z'),
    event('i-acme', 'ASSESSMENT', 'INTERVIEW', '2026-09-03T00:00:00.000Z'),
    event('i-globex', null, 'APPLIED', '2026-09-01T00:00:00.000Z'),
    event('i-initech', null, 'SAVED', '2026-09-01T00:00:00.000Z'),
    event('i-hooli', null, 'APPLIED', '2026-09-01T00:00:00.000Z'),
    event('i-hooli', 'APPLIED', 'REJECTED', '2026-09-04T00:00:00.000Z'),
  );
}

const column = (name: string) => screen.findByRole('region', { name: new RegExp(`^${name}`) });

describe('Internships', () => {
  it('shows the board, this month’s numbers and the funnel', async () => {
    setup(season);
    const { container } = renderRoute('/app/developer/internships');

    const interview = await column('Interview');
    expect(within(interview).getByRole('article', { name: 'SDE intern at Acme' })).toHaveTextContent(
      /Technical round: .+, 09:30/,
    );
    const saved = await column('Saved');
    expect(within(saved).getByRole('article', { name: 'SDE intern at Initech' })).toHaveTextContent(
      'Not sent yet',
    );
    expect(screen.queryByRole('article', { name: 'SDE intern at Hooli' })).toBeNull();
    expect(screen.getByText(/1 closed \(rejected or withdrawn\)/)).toBeInTheDocument();

    // 3 sent this month: Acme (assessment, interview), Globex (no answer), Hooli (rejected) → 2 of 3
    const month = await screen.findByRole('group', { name: 'This month' });
    expect(month).toHaveTextContent('Applied3');
    expect(month).toHaveTextContent('Interviews1');
    expect(month).toHaveTextContent('Response rate66.7%');
    expect(screen.getByText(/responded ÷ applied \(2 of 3\)/)).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'All-time funnel' })).toHaveTextContent('Applied3');
    expect(screen.getByText('1 saved · 1 rejected · 0 withdrawn')).toBeInTheDocument();
    expect(await axeViolations(container)).toEqual([]);
  });

  it('moves an application along from its card and remembers each step', async () => {
    const store = setup(season);
    const { user } = renderRoute('/app/developer/internships');

    await column('Applied');
    await user.selectOptions(screen.getByLabelText('Stage of Data intern at Globex'), 'ASSESSMENT');
    const assessment = await column('Assessment');
    await waitFor(() =>
      expect(within(assessment).getByRole('article', { name: 'Data intern at Globex' })).toBeInTheDocument(),
    );
    expect(
      store.internshipEvents.filter((e) => e.applicationId === 'i-globex').map((e) => e.toStatus),
    ).toEqual(['APPLIED', 'ASSESSMENT']);

    // Sending a saved one fills in today as its applied date
    await user.selectOptions(screen.getByLabelText('Stage of SDE intern at Initech'), 'APPLIED');
    await waitFor(() => expect(store.internships.find((i) => i.id === 'i-initech')!.appliedOn).toBe(TODAY));
  });

  it('adds an application, checking it first', async () => {
    const store = setup();
    const { user, router } = renderRoute('/app/developer/internships');

    await screen.findByText('Track every application in one place.');
    await user.click(screen.getByRole('button', { name: 'Add an application' }));
    const dialog = await screen.findByRole('dialog', { name: 'New application' });
    await user.type(within(dialog).getByLabelText('Company'), 'Acme');
    await user.type(within(dialog).getByLabelText('Job link (optional)'), 'jobs.acme.example');
    await user.click(within(dialog).getByRole('button', { name: 'Add application' }));
    expect(await within(dialog).findByText('Name the role.')).toBeInTheDocument();
    expect(
      within(dialog).getByText('Use a full web address starting with http:// or https://.'),
    ).toBeInTheDocument();

    await user.type(within(dialog).getByLabelText('Role'), 'Backend intern');
    await user.clear(within(dialog).getByLabelText('Job link (optional)'));
    await user.type(within(dialog).getByLabelText('Job link (optional)'), 'https://jobs.acme.example/1');
    await user.type(within(dialog).getByLabelText('What’s next (optional)'), 'Online assessment');
    fireEvent.change(within(dialog).getByLabelText('Next step on (optional)'), {
      target: { value: addDays(TODAY, 4) },
    });
    await user.click(within(dialog).getByRole('button', { name: 'Add application' }));

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Backend intern at Acme' }),
    ).toBeInTheDocument();
    const saved = store.internships[0]!;
    expect(router.state.location.pathname).toBe(`/app/developer/internships/${saved.id}`);
    expect(saved).toMatchObject({ status: 'APPLIED', appliedOn: TODAY });
    // Without a time, a next step means 09:00 that day
    expect(saved.nextStepAt).toBe(`${addDays(TODAY, 4)}T09:00:00.000Z`);
    expect(screen.getByRole('list', { name: 'Stage history' })).toHaveTextContent('Added as applied');
  });

  it('lists everything, closed ones too, a page at a time', async () => {
    setup((store) => {
      season(store);
      for (let n = 0; n < 22; n++) {
        store.internships.push(
          application(`i-old-${n}`, `Old ${String(n).padStart(2, '0')}`, {
            status: 'REJECTED',
            appliedOn: addDays(TODAY, -30 - n),
          }),
        );
      }
    });
    const { user } = renderRoute('/app/developer/internships?view=list');

    const list = await screen.findByRole('list', { name: 'Applications' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(20);
    expect(screen.getByText('Page 1 of 2')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(await screen.findByText('Page 2 of 2')).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('Stage'), 'SAVED');
    await waitFor(() =>
      expect(
        within(screen.getByRole('list', { name: 'Applications' })).getAllByRole('listitem'),
      ).toHaveLength(1),
    );
    expect(screen.getByRole('list', { name: 'Applications' })).toHaveTextContent('SDE intern at Initech');
  });

  it('shows another month’s numbers', async () => {
    setup((store) => {
      season(store);
      store.internships.push(application('i-aug', 'Earlier', { appliedOn: '2026-08-14' }));
    });
    renderRoute('/app/developer/internships');

    await screen.findByText(/responded ÷ applied \(2 of 3\)/);
    fireEvent.change(screen.getByLabelText('Month'), { target: { value: '2026-08' } });
    expect(await screen.findByText(/sent in August 2026/)).toBeInTheDocument();
    expect(screen.getByText(/responded ÷ applied \(0 of 1\)/)).toBeInTheDocument();
    expect(MONTH).not.toBe('2026-08');
  });

  it('keeps prep tasks and its history on its page', async () => {
    const store = setup(season);
    const { user, container } = renderRoute('/app/developer/internships/i-acme');

    await screen.findByRole('heading', { level: 1, name: 'SDE intern at Acme' });
    expect(screen.getByRole('region', { name: 'Coming up' })).toHaveTextContent('Technical round');
    expect(
      within(screen.getByRole('list', { name: 'Stage history' }))
        .getAllByRole('listitem')
        .map((li) => li.querySelector('span')?.textContent),
    ).toEqual(['Assessment → Interview', 'Applied → Assessment', 'Added as applied']);

    await user.click(screen.getByRole('button', { name: 'Add prep task' }));
    const dialog = await screen.findByRole('dialog', { name: 'New task' });
    await user.type(within(dialog).getByLabelText('Title'), 'Revise graphs');
    await user.click(within(dialog).getByRole('button', { name: 'Add task' }));
    expect(await screen.findByRole('list', { name: 'Prep tasks' })).toHaveTextContent('Revise graphs');
    expect(store.tasks[0]).toMatchObject({ internshipId: 'i-acme', category: 'INTERNSHIP' });

    await user.selectOptions(screen.getByLabelText('Stage'), 'OFFER');
    await waitFor(() =>
      expect(screen.getByRole('list', { name: 'Stage history' })).toHaveTextContent('Interview → Offer'),
    );
    expect(await axeViolations(container)).toEqual([]);
  });

  it('deletes an application but keeps its prep tasks', async () => {
    const store = setup(season);
    store.tasks.push({
      id: 't-1',
      title: 'Tailor resume',
      description: null,
      category: 'INTERNSHIP',
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
      hackathonId: null,
      internshipId: 'i-globex',
      createdAt: 1,
    });
    const { user, router } = renderRoute('/app/developer/internships/i-globex');

    await screen.findByRole('heading', { level: 1, name: 'Data intern at Globex' });
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    const confirm = await screen.findByRole('dialog', { name: 'Delete this application?' });
    await user.click(within(confirm).getByRole('button', { name: 'Delete application' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/app/developer/internships'));
    expect(store.internships.map((i) => i.id)).not.toContain('i-globex');
    expect(store.internshipEvents.some((e) => e.applicationId === 'i-globex')).toBe(false);
    expect(store.tasks[0]!.internshipId).toBeNull();
  });

  it('puts the next step on the calendar', async () => {
    setup(season);
    renderRoute(`/app/planner/calendar?date=${addDays(TODAY, 2)}`);
    const step = await screen.findByRole('link', { name: /^Internship: Acme: Technical round, 09:30/ });
    expect(step).toHaveAttribute('href', '/app/developer/internships/i-acme');
  });

  it('shows what’s due and what’s next on Home', async () => {
    setup(season);
    renderRoute('/app');
    const attention = await screen.findByRole('region', { name: /Needs attention/ });
    expect(await within(attention).findByText(/Apply by (today|tomorrow) at/)).toBeInTheDocument();
    const summaries = screen.getByRole('region', { name: 'Summaries' });
    expect(await within(summaries).findByText(/internship applications in play/)).toHaveTextContent(
      /2 internship applications in play; next: Technical round at Acme, .+, 09:30/,
    );
  });

  it('says so when an application doesn’t exist', async () => {
    setup();
    renderRoute('/app/developer/internships/nope');
    expect(await screen.findByText('We couldn’t find that application.')).toBeInTheDocument();
  });
});
