import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { addDays, todayIn } from '@/lib/dates';
import { createAcademicStore, type AcademicStore } from '@/mocks/academics';
import type { StoredMilestone, StoredProject } from '@/mocks/developer';
import { createMockDb, DEFAULT_SETTINGS } from '@/mocks/handlers';
import { axeViolations } from '@/test/axe';
import { renderRoute } from '@/test/render';
import { installMockApi, TEST_USER } from '@/test/server';

/** The user id createMockDb gives the logged-in test user. */
const USER_ID = '00000000-0000-4000-8000-000000000001';
const TODAY = todayIn('UTC');

function project(id: string, name: string, changes: Partial<StoredProject> = {}): StoredProject {
  return {
    id,
    name,
    description: null,
    techStack: [],
    repoUrl: null,
    demoUrl: null,
    status: 'IDEA',
    startedOn: null,
    targetOn: null,
    createdAt: `2026-0${id.length % 9}-01T00:00:00.000Z`,
    ...changes,
  };
}

function milestone(
  id: string,
  projectId: string,
  title: string,
  position: number,
  changes: Partial<StoredMilestone> = {},
) {
  return { id, projectId, title, dueOn: null, position, doneAt: null, ...changes };
}

function setup(fill: (store: AcademicStore) => void = () => {}): AcademicStore {
  const store = createAcademicStore();
  fill(store);
  const db = createMockDb({ loggedInAs: TEST_USER });
  db.academics.set(USER_ID, store);
  db.settings.set(USER_ID, { ...DEFAULT_SETTINGS, timezone: 'UTC' });
  installMockApi(db);
  return store;
}

/** A project in development with three milestones (the first done), plus an idea and an archived one. */
function portfolio(store: AcademicStore) {
  store.projects.push(
    project('p-dev', 'Bus tracker', {
      status: 'DEVELOPMENT',
      techStack: ['Spring Boot', 'React'],
      repoUrl: 'https://github.com/example/bus',
      createdAt: '2026-09-01T00:00:00.000Z',
    }),
    project('p-idea', 'Flashcards CLI', { createdAt: '2026-09-02T00:00:00.000Z' }),
    project('p-old', 'Old blog', { status: 'ARCHIVED', createdAt: '2026-01-01T00:00:00.000Z' }),
  );
  store.milestones.push(
    milestone('m-1', 'p-dev', 'GPS sends positions', 0, { doneAt: '2026-09-10T00:00:00.000Z' }),
    milestone('m-2', 'p-dev', 'Map shows buses', 1, { dueOn: addDays(TODAY, 2) }),
    milestone('m-3', 'p-dev', 'Arrival estimates', 2),
  );
}

const card = (name: string) => screen.findByRole('article', { name });

describe('Projects page', () => {
  it('groups projects by status and keeps archived ones behind a toggle', async () => {
    setup(portfolio);
    const { user, container } = renderRoute('/app/developer/projects');

    const building = await screen.findByRole('region', { name: /^In development/ });
    const bus = within(building).getByRole('article', { name: 'Bus tracker' });
    expect(bus).toHaveTextContent('1 of 3 milestones');
    expect(bus).toHaveTextContent('Next: Map shows buses');
    expect(within(bus).getByRole('link', { name: /github\.com\/example\/bus/ })).toHaveAttribute(
      'target',
      '_blank',
    );
    expect(within(bus).getByRole('link', { name: 'Bus tracker' })).toHaveAttribute(
      'href',
      '/app/developer/projects/p-dev',
    );
    expect(
      within(await screen.findByRole('region', { name: /^Ideas/ })).getByText('No milestones yet'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('article', { name: 'Old blog' })).not.toBeInTheDocument();
    expect(await axeViolations(container)).toEqual([]);

    await user.click(screen.getByRole('button', { name: 'Show archived (1)' }));
    expect(await card('Old blog')).toBeInTheDocument();
  });

  it('invites the first project', async () => {
    setup();
    renderRoute('/app/developer/projects');
    expect(await screen.findByText('Your first project starts here.')).toBeInTheDocument();
  });

  it('adds a project with a tidy tech stack and opens it', async () => {
    const store = setup();
    const { user, router } = renderRoute('/app/developer/projects');

    await user.click(await screen.findByRole('button', { name: 'New project' }));
    const dialog = await screen.findByRole('dialog', { name: 'New project' });
    await user.type(within(dialog).getByLabelText('Name'), 'Campus app');
    await user.selectOptions(within(dialog).getByLabelText('Status'), 'DEVELOPMENT');
    const stack = within(dialog).getByLabelText('Tech stack (optional)');
    await user.type(stack, 'Java{Enter}react,REACT{Enter}Docker{Enter}');
    await user.click(within(dialog).getByRole('button', { name: 'Remove Docker' }));
    expect(within(dialog).getByRole('list', { name: 'Technologies' })).toHaveTextContent('Javareact');

    await user.type(within(dialog).getByLabelText('Repository (optional)'), 'github.com/me/app');
    await user.click(within(dialog).getByRole('button', { name: 'Add project' }));
    expect(
      await within(dialog).findByText('Use a full web address starting with http:// or https://.'),
    ).toBeInTheDocument();
    await user.clear(within(dialog).getByLabelText('Repository (optional)'));
    await user.type(within(dialog).getByLabelText('Repository (optional)'), 'https://github.com/me/app');
    await user.click(within(dialog).getByRole('button', { name: 'Add project' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Campus app' })).toBeInTheDocument();
    expect(store.projects[0]).toMatchObject({
      name: 'Campus app',
      status: 'DEVELOPMENT',
      techStack: ['Java', 'react'],
      repoUrl: 'https://github.com/me/app',
    });
    expect(router.state.location.pathname).toBe(`/app/developer/projects/${store.projects[0]!.id}`);
  });
});

describe('Project page', () => {
  it('tracks milestones: add, tick, move, edit and delete', async () => {
    const store = setup(portfolio);
    const { user, container } = renderRoute('/app/developer/projects/p-dev');

    const panel = await screen.findByRole('region', { name: 'Milestones' });
    expect(within(panel).getByText('1 of 3 milestones done')).toBeInTheDocument();
    expect(await axeViolations(container)).toEqual([]);

    await user.type(within(panel).getByLabelText('Add a milestone'), 'Beta launch');
    fireEvent.change(within(panel).getByLabelText('Due (optional)'), {
      target: { value: addDays(TODAY, 10) },
    });
    await user.click(within(panel).getByRole('button', { name: 'Add milestone' }));
    expect(await within(panel).findByText('1 of 4 milestones done')).toBeInTheDocument();

    await user.click(within(panel).getByLabelText(/^Map shows buses/));
    expect(await within(panel).findByText('2 of 4 milestones done')).toBeInTheDocument();

    await user.click(within(panel).getByRole('button', { name: 'Move Beta launch up' }));
    await waitFor(() =>
      expect(
        within(panel)
          .getAllByRole('checkbox')
          .map((c) => c.closest('li')!.textContent),
      ).toEqual([
        expect.stringContaining('GPS sends positions'),
        expect.stringContaining('Map shows buses'),
        expect.stringContaining('Beta launch'),
        expect.stringContaining('Arrival estimates'),
      ]),
    );

    await user.click(within(panel).getByRole('button', { name: 'Edit Beta launch' }));
    const rename = within(panel).getByLabelText('New name for Beta launch');
    await user.clear(rename);
    await user.type(rename, 'Public beta');
    fireEvent.change(within(panel).getByLabelText('Due date for Beta launch'), { target: { value: '' } });
    await user.click(within(panel).getByRole('button', { name: 'Save' }));
    expect(await within(panel).findByLabelText('Public beta')).toBeInTheDocument();
    expect(store.milestones.find((m) => m.title === 'Public beta')).toMatchObject({
      dueOn: null,
      position: 2,
    });

    await user.click(within(panel).getByRole('button', { name: 'Delete Arrival estimates' }));
    expect(await within(panel).findByText('2 of 3 milestones done')).toBeInTheDocument();
  });

  it('adds tasks linked to the project, and keeps them when the project goes', async () => {
    const store = setup(portfolio);
    const { user, router } = renderRoute('/app/developer/projects/p-dev');

    const tasks = await screen.findByRole('region', { name: 'Tasks' });
    await user.click(within(tasks).getByRole('button', { name: 'Add task' }));
    const dialog = await screen.findByRole('dialog', { name: 'New task' });
    await waitFor(() => expect(within(dialog).getByLabelText('Project (optional)')).toHaveValue('p-dev'));
    await user.type(within(dialog).getByLabelText('Title'), 'Set up CI');
    await user.click(within(dialog).getByRole('button', { name: 'Add task' }));

    expect(await within(tasks).findByLabelText('Set up CI')).toBeInTheDocument();
    expect(store.tasks[0]).toMatchObject({ title: 'Set up CI', projectId: 'p-dev', category: 'PROJECT' });

    await user.click(screen.getByRole('button', { name: 'Delete' }));
    const confirm = await screen.findByRole('dialog', { name: 'Delete this project?' });
    await user.click(within(confirm).getByRole('button', { name: 'Delete project' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/app/developer/projects'));
    expect(store.projects.map((p) => p.id)).not.toContain('p-dev');
    expect(store.milestones.some((m) => m.projectId === 'p-dev')).toBe(false);
    expect(store.tasks[0]).toMatchObject({ title: 'Set up CI', projectId: null });
  });
});

describe('Projects elsewhere', () => {
  it('puts dated milestones on the calendar and Home', async () => {
    setup(portfolio);
    renderRoute(`/app/planner/calendar?date=${TODAY}`);

    const link = await screen.findByRole('link', { name: /^Milestone: Map shows buses, Bus tracker/ });
    expect(link).toHaveAttribute('href', '/app/developer/projects/p-dev');
  });

  it('sums up projects on Home', async () => {
    setup(portfolio);
    renderRoute('/app');

    const summaries = await screen.findByRole('region', { name: 'Summaries' });
    expect(await within(summaries).findByText(/1 in development · 2 active projects/)).toBeInTheDocument();
    expect(within(summaries).getByText(/Next milestone:/)).toHaveTextContent(
      /Next milestone: Map shows buses \(Bus tracker\), due /,
    );
  });
});
