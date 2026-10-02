import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { addDays, todayIn } from '@/lib/dates';
import { createAcademicStore, type AcademicStore } from '@/mocks/academics';
import { createMockDb, DEFAULT_SETTINGS } from '@/mocks/handlers';
import type { StoredGoal } from '@/mocks/learning';
import { axeViolations } from '@/test/axe';
import { renderRoute } from '@/test/render';
import { installMockApi, TEST_USER } from '@/test/server';

/** The user id createMockDb gives the logged-in test user. */
const USER_ID = '00000000-0000-4000-8000-000000000001';
const TODAY = todayIn('UTC');

function goal(id: string, title: string, changes: Partial<StoredGoal> = {}): StoredGoal {
  return {
    id,
    title,
    description: null,
    status: 'ACTIVE',
    targetOn: null,
    createdAt: '2026-09-01T00:00:00.000Z',
    ...changes,
  };
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

/** Spring Boot (active, 1 of 3 topics done, due in 9 days), Rust (paused) and SQL (done). */
function shelf(store: AcademicStore) {
  store.learningGoals.push(
    goal('g-spring', 'Spring Boot', {
      targetOn: addDays(TODAY, 9),
      description: 'Enough to build a REST API.',
      createdAt: '2026-09-03T00:00:00.000Z',
    }),
    goal('g-rust', 'Rust', { status: 'PAUSED', createdAt: '2026-09-02T00:00:00.000Z' }),
    goal('g-sql', 'SQL', { status: 'DONE' }),
  );
  ['Dependency injection', 'Spring Data JPA', 'Testing'].forEach((title, position) =>
    store.learningTopics.push({
      id: `t-${position}`,
      goalId: 'g-spring',
      title,
      position,
      doneAt: position === 0 ? '2026-09-10T00:00:00.000Z' : null,
    }),
  );
  store.learningResources.push({
    id: 'r-docs',
    goalId: 'g-spring',
    title: 'Reference docs',
    url: 'https://docs.spring.io',
    createdAt: 1,
  });
}

describe('Learning', () => {
  it('groups goals by status with progress and what’s next', async () => {
    setup(shelf);
    const { container } = renderRoute('/app/developer/learning');

    const active = await screen.findByRole('region', { name: /^Active/ });
    const spring = within(active).getByRole('article', { name: 'Spring Boot' });
    expect(spring).toHaveTextContent('1 of 3 topics');
    expect(spring).toHaveTextContent('Next: Spring Data JPA');
    expect(within(spring).getByRole('link', { name: 'Spring Boot' })).toHaveAttribute(
      'href',
      '/app/developer/learning/g-spring',
    );
    expect(
      within(screen.getByRole('region', { name: /^Paused/ })).getByRole('article', { name: 'Rust' }),
    ).toHaveTextContent('No topics yet');
    expect(screen.getByRole('region', { name: /^Done/ })).toHaveTextContent('SQL');
    expect(await axeViolations(container)).toEqual([]);
  });

  it('starts empty, and a new goal opens with its starter topics', async () => {
    const store = setup();
    const { user, router } = renderRoute('/app/developer/learning');

    expect(await screen.findByText('Know what you’re building toward.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Add a goal' }));
    const dialog = await screen.findByRole('dialog', { name: 'New learning goal' });
    await user.click(within(dialog).getByRole('button', { name: 'Add goal' }));
    expect(await within(dialog).findByText('Name what you’re learning.')).toBeInTheDocument();

    await user.type(within(dialog).getByLabelText('What you’re learning'), 'Docker');
    await user.type(within(dialog).getByLabelText('Topics (optional)'), 'Images{Enter}{Enter} Compose ');
    await user.click(within(dialog).getByRole('button', { name: 'Add goal' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Docker' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe(`/app/developer/learning/${store.learningGoals[0]!.id}`);
    const topics = screen.getByRole('list', { name: 'Topics' });
    expect(
      within(topics)
        .getAllByRole('checkbox')
        .map((c) => c.closest('li')!.textContent),
    ).toEqual(['Images', 'Compose']);
  });

  it('ticks, renames, reorders and removes topics', async () => {
    const store = setup(shelf);
    const { user } = renderRoute('/app/developer/learning/g-spring');

    await screen.findByRole('heading', { level: 1, name: 'Spring Boot' });
    expect(screen.getByText('1 of 3 topics', { exact: false })).toBeInTheDocument();

    await user.click(screen.getByRole('checkbox', { name: 'Spring Data JPA' }));
    await waitFor(() => expect(screen.getByRole('checkbox', { name: 'Spring Data JPA' })).toBeChecked());
    expect(screen.getByText('2 of 3 topics', { exact: false })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Rename Testing' }));
    const rename = screen.getByLabelText('New name for Testing');
    await user.clear(rename);
    await user.type(rename, 'Testing with MockMvc{Enter}');
    expect(await screen.findByRole('checkbox', { name: 'Testing with MockMvc' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Move Testing with MockMvc up' }));
    await waitFor(() =>
      expect(
        within(screen.getByRole('list', { name: 'Topics' }))
          .getAllByRole('checkbox')
          .map((c) => c.closest('li')!.textContent),
      ).toEqual(['Dependency injection', 'Testing with MockMvc', 'Spring Data JPA']),
    );

    await user.click(screen.getByRole('button', { name: 'Add topic' }));
    expect(await screen.findByText('Name the topic.')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Add a topic'), 'Security{Enter}');
    expect(await screen.findByRole('checkbox', { name: 'Security' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Delete Dependency injection' }));
    await waitFor(() => expect(screen.queryByRole('checkbox', { name: 'Dependency injection' })).toBeNull());
    expect(
      store.learningTopics
        .filter((t) => t.goalId === 'g-spring')
        .sort((a, b) => a.position - b.position)
        .map((t) => [t.title, t.position]),
    ).toEqual([
      ['Testing with MockMvc', 0],
      ['Spring Data JPA', 1],
      ['Security', 2],
    ]);
  });

  it('keeps links, refusing anything that isn’t a web address', async () => {
    setup(shelf);
    const { user } = renderRoute('/app/developer/learning/g-spring');

    const links = await screen.findByRole('list', { name: 'Links' });
    expect(within(links).getByRole('link', { name: /Open/ })).toHaveAttribute(
      'href',
      'https://docs.spring.io',
    );

    await user.type(screen.getByLabelText('Link title'), 'Course');
    await user.type(screen.getByLabelText('Web address'), 'javascript:alert(1)');
    await user.click(screen.getByRole('button', { name: 'Add link' }));
    expect(
      await screen.findByText('Use a full web address starting with http:// or https://.'),
    ).toBeInTheDocument();
    await user.clear(screen.getByLabelText('Web address'));
    await user.type(screen.getByLabelText('Web address'), 'https://example.com/course');
    await user.click(screen.getByRole('button', { name: 'Add link' }));
    await waitFor(() => expect(screen.getByRole('list', { name: 'Links' })).toHaveTextContent('Course'));

    await user.click(screen.getByRole('button', { name: 'Edit Reference docs' }));
    const title = screen.getByLabelText('Title for Reference docs');
    await user.clear(title);
    await user.type(title, 'Spring docs');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('button', { name: 'Delete Spring docs' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Delete Spring docs' }));
    await waitFor(() =>
      expect(screen.getByRole('list', { name: 'Links' })).not.toHaveTextContent('Spring docs'),
    );
  });

  it('plans the unfinished topics as study tasks up to the target date', async () => {
    const store = setup(shelf);
    const { user, container } = renderRoute('/app/developer/learning/g-spring');

    await screen.findByText(/No study tasks yet/);
    await user.click(screen.getByRole('button', { name: 'Plan my learning' }));
    const dialog = await screen.findByRole('dialog', { name: 'Plan your learning' });
    const rows = within(dialog).getByRole('list', { name: 'Topics to plan' });
    // The ticked-off topic is left out
    expect(within(rows).getAllByRole('checkbox')).toHaveLength(2);
    expect(within(rows).getByRole('checkbox', { name: 'Spring Data JPA' })).toBeChecked();
    expect(within(rows).queryByRole('checkbox', { name: 'Dependency injection' })).toBeNull();
    expect(within(dialog).getByLabelText('Day for Testing')).toHaveAttribute('max', addDays(TODAY, 9));
    await user.click(within(dialog).getByRole('button', { name: 'Add 2 study tasks' }));

    const list = await screen.findByRole('list', { name: 'Study tasks' });
    expect(list).toHaveTextContent('Study: Spring Data JPA');
    expect(list).toHaveTextContent('Study: Testing');
    const planned = store.tasks.filter((t) => t.learningGoalId === 'g-spring');
    expect(planned.map((t) => t.category)).toEqual(['CODING', 'CODING']);
    expect(planned.every((t) => t.plannedFor! >= TODAY && t.plannedFor! <= addDays(TODAY, 9))).toBe(true);

    // Planning again finds nothing left
    await user.click(screen.getByRole('button', { name: 'Plan my learning' }));
    expect(await screen.findByText('Every unfinished topic already has a study task.')).toBeInTheDocument();
    const again = screen.getByRole('dialog', { name: 'Plan your learning' });
    await user.click(within(again).getAllByRole('button', { name: 'Close' }).at(-1)!);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(await axeViolations(container)).toEqual([]);
  });

  it('adds a study task linked to the goal', async () => {
    const store = setup(shelf);
    const { user } = renderRoute('/app/developer/learning/g-rust');

    await screen.findByRole('heading', { level: 1, name: 'Rust' });
    await user.click(screen.getByRole('button', { name: 'Add study task' }));
    const dialog = await screen.findByRole('dialog', { name: 'New task' });
    await user.type(within(dialog).getByLabelText('Title'), 'Read the Rust book ch. 4');
    await user.click(within(dialog).getByRole('button', { name: 'Add task' }));

    expect(await screen.findByRole('list', { name: 'Study tasks' })).toHaveTextContent(
      'Read the Rust book ch. 4',
    );
    expect(store.tasks.find((t) => t.title === 'Read the Rust book ch. 4')).toMatchObject({
      learningGoalId: 'g-rust',
      category: 'CODING',
    });
  });

  it('deletes a goal but keeps its study tasks', async () => {
    const store = setup(shelf);
    const { user, router } = renderRoute('/app/developer/learning/g-rust');

    await screen.findByRole('heading', { level: 1, name: 'Rust' });
    await user.click(screen.getByRole('button', { name: 'Add study task' }));
    const dialog = await screen.findByRole('dialog', { name: 'New task' });
    await user.type(within(dialog).getByLabelText('Title'), 'Ownership');
    await user.click(within(dialog).getByRole('button', { name: 'Add task' }));
    await screen.findByRole('list', { name: 'Study tasks' });

    await user.click(screen.getByRole('button', { name: 'Delete' }));
    const confirm = await screen.findByRole('dialog', { name: 'Delete this goal?' });
    await user.click(within(confirm).getByRole('button', { name: 'Delete goal' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/app/developer/learning'));
    expect(store.learningGoals.map((g) => g.title)).toEqual(['Spring Boot', 'SQL']);
    expect(store.tasks.find((t) => t.title === 'Ownership')?.learningGoalId).toBeNull();
  });

  it('shows the goal in focus on Home, even without projects', async () => {
    setup(shelf);
    renderRoute('/app');

    const summaries = await screen.findByRole('region', { name: 'Summaries' });
    const line = await within(summaries).findByText(/Learning:/);
    expect(line).toHaveTextContent('Learning: Spring Boot 33%, next: Spring Data JPA');
    expect(within(line).getByRole('link', { name: 'Spring Boot' })).toHaveAttribute(
      'href',
      '/app/developer/learning/g-spring',
    );
    expect(within(summaries).getByRole('link', { name: /Open learning/ })).toHaveAttribute(
      'href',
      '/app/developer/learning',
    );
  });

  it('says so when a goal doesn’t exist', async () => {
    setup();
    renderRoute('/app/developer/learning/nope');
    expect(await screen.findByText('We couldn’t find that goal.')).toBeInTheDocument();
  });
});
