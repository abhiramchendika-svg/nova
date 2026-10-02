import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { addDays, todayIn } from '@/lib/dates';
import { createAcademicStore, type AcademicStore } from '@/mocks/academics';
import type { MockGitHubUser } from '@/mocks/github';
import { createMockDb, DEFAULT_SETTINGS } from '@/mocks/handlers';
import { axeViolations } from '@/test/axe';
import { renderRoute } from '@/test/render';
import { installMockApi, TEST_USER } from '@/test/server';

/** The user id createMockDb gives the logged-in test user. */
const USER_ID = '00000000-0000-4000-8000-000000000001';
const TODAY = todayIn('UTC');
const HOUR = 3_600_000;

/** A fictional GitHub user the mock knows: three repos (one a fork) and a short calendar. */
function octo(changes: Partial<MockGitHubUser> = {}): MockGitHubUser {
  return {
    login: 'octo-student',
    name: 'Octo Student',
    avatarUrl: null,
    htmlUrl: 'https://github.com/octo-student',
    publicRepos: 3,
    followers: 7,
    following: 2,
    createdAt: '2024-01-15T10:00:00Z',
    repos: [
      {
        name: 'bus-tracker',
        fullName: 'octo-student/bus-tracker',
        htmlUrl: 'https://github.com/octo-student/bus-tracker',
        description: 'Live campus buses',
        language: 'Java',
        stars: 5,
        forks: 1,
        fork: false,
        archived: false,
        pushedAt: new Date(Date.now() - HOUR).toISOString(),
      },
      {
        name: 'dotfiles',
        fullName: 'octo-student/dotfiles',
        htmlUrl: 'https://github.com/octo-student/dotfiles',
        description: null,
        language: 'Shell',
        stars: 9,
        forks: 0,
        fork: false,
        archived: false,
        pushedAt: new Date(Date.now() - 30 * 24 * HOUR).toISOString(),
      },
      {
        name: 'spring-boot',
        fullName: 'octo-student/spring-boot',
        htmlUrl: 'https://github.com/octo-student/spring-boot',
        description: 'A fork',
        language: 'Java',
        stars: 0,
        forks: 0,
        fork: true,
        archived: false,
        pushedAt: new Date(Date.now() - 90 * 24 * HOUR).toISOString(),
      },
    ],
    calendar: {
      total: 5,
      days: [
        { date: addDays(TODAY, -1), count: 2 },
        { date: TODAY, count: 3 },
      ],
    },
    ...changes,
  };
}

function setup(fill: (store: AcademicStore) => void = () => {}): AcademicStore {
  const store = createAcademicStore();
  store.githubWorld['octo-student'] = octo();
  fill(store);
  const db = createMockDb({ loggedInAs: TEST_USER });
  db.academics.set(USER_ID, store);
  db.settings.set(USER_ID, { ...DEFAULT_SETTINGS, timezone: 'UTC' });
  installMockApi(db);
  return store;
}

const connected =
  (user: MockGitHubUser = octo()) =>
  (store: AcademicStore) => {
    store.githubWorld[user.login] = user;
    store.github = { user, fetchedAt: new Date().toISOString(), refreshRequestedAt: null };
  };

describe('GitHub', () => {
  it('connects by username, checking it first', async () => {
    const store = setup();
    const { user, container } = renderRoute('/app/developer/github');

    await screen.findByRole('heading', { name: 'Connect your GitHub' });
    expect(await axeViolations(container)).toEqual([]);
    await user.type(screen.getByLabelText('GitHub username'), 'not a name');
    await user.click(screen.getByRole('button', { name: 'Connect' }));
    expect(await screen.findByText(/letters, numbers and single hyphens/)).toBeInTheDocument();

    await user.clear(screen.getByLabelText('GitHub username'));
    await user.type(screen.getByLabelText('GitHub username'), 'nobody-here');
    await user.click(screen.getByRole('button', { name: 'Connect' }));
    expect(await screen.findByText('We couldn’t find that GitHub user.')).toBeInTheDocument();

    await user.clear(screen.getByLabelText('GitHub username'));
    await user.type(screen.getByLabelText('GitHub username'), '@Octo-Student');
    await user.click(screen.getByRole('button', { name: 'Connect' }));
    expect(await screen.findByRole('region', { name: 'Profile' })).toHaveTextContent('Octo Student');
    expect(store.github?.user.login).toBe('octo-student');
  });

  it('shows what GitHub says and NOVA’s own numbers, each labelled', async () => {
    setup(connected());
    const { user, container } = renderRoute('/app/developer/github');

    const profile = await screen.findByRole('region', { name: 'Profile' });
    expect(profile).toHaveTextContent('From GitHub');
    expect(profile).toHaveTextContent('Public repositories3');
    expect(within(profile).getByRole('link', { name: /github.com\/octo-student/ })).toHaveAttribute(
      'href',
      'https://github.com/octo-student',
    );

    const metrics = screen.getByRole('region', { name: 'Contributions' });
    expect(metrics).toHaveTextContent('NOVA metric');
    expect(metrics).toHaveTextContent('Current streak2 days');
    expect(metrics).toHaveTextContent('Active weeks1 of 12');
    // The formulas are on the page, not only in a tooltip
    expect(metrics).toHaveTextContent('Longest streak:most days in a row');

    const calendar = screen.getByRole('region', { name: 'Contribution calendar' });
    expect(calendar).toHaveTextContent('5 public contributions in the last year');

    // Forks are left out; most recent push first, then by stars
    const repos = screen.getByRole('list', { name: 'Repositories' });
    expect(
      within(repos)
        .getAllByRole('link')
        .map((a) => a.textContent),
    ).toEqual(['bus-tracker (opens in a new tab)', 'dotfiles (opens in a new tab)']);
    await user.click(screen.getByRole('button', { name: 'Stars' }));
    expect(
      within(screen.getByRole('list', { name: 'Repositories' }))
        .getAllByRole('link')
        .map((a) => a.textContent),
    ).toEqual(['dotfiles (opens in a new tab)', 'bus-tracker (opens in a new tab)']);

    expect(screen.getByRole('list', { name: 'Languages' })).toHaveTextContent('Java50%Shell50%');
    expect(await axeViolations(container)).toEqual([]);
  });

  it('says plainly when the calendar isn’t available instead of showing zeros', async () => {
    setup(connected(octo({ calendar: null })));
    renderRoute('/app/developer/github');

    const calendar = await screen.findByRole('region', { name: 'Contribution calendar' });
    expect(calendar).toHaveTextContent('needs a GitHub token on the server');
    expect(screen.queryByRole('region', { name: 'Contributions' })).toBeNull();
  });

  it('refreshes at most every five minutes and can disconnect', async () => {
    const store = setup(connected());
    const { user } = renderRoute('/app/developer/github');

    await screen.findByRole('region', { name: 'Profile' });
    await user.click(screen.getByRole('button', { name: 'Refresh' }));
    await waitFor(() => expect(store.github?.refreshRequestedAt).not.toBeNull());
    await user.click(screen.getByRole('button', { name: 'Refresh' }));
    expect(await screen.findByText(/once every five minutes/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Disconnect' }));
    const confirm = await screen.findByRole('dialog', { name: 'Disconnect GitHub?' });
    await user.click(within(confirm).getByRole('button', { name: 'Disconnect' }));
    expect(await screen.findByRole('heading', { name: 'Connect your GitHub' })).toBeInTheDocument();
    expect(store.github).toBeNull();
  });

  it('shows a project’s repository stats when its link points at one of your repos', async () => {
    setup((store) => {
      connected()(store);
      store.projects.push({
        id: 'p-1',
        name: 'Bus tracker',
        description: null,
        techStack: [],
        repoUrl: 'https://github.com/Octo-Student/bus-tracker.git',
        demoUrl: null,
        status: 'DEVELOPMENT',
        startedOn: null,
        targetOn: null,
        createdAt: '2026-09-01T00:00:00.000Z',
      });
    });
    renderRoute('/app/developer/projects/p-1');

    expect((await screen.findByText('From GitHub:')).closest('p')).toHaveTextContent(
      'From GitHub:5 stars1 forkJavalast push',
    );
  });

  it('puts this month’s contributions and the last push on Home', async () => {
    setup(connected());
    renderRoute('/app');

    const summaries = await screen.findByRole('region', { name: 'Summaries' });
    expect(await within(summaries).findByText(/public contributions this month/)).toHaveTextContent(
      /GitHub: [35] public contributions this month · last push to bus-tracker/,
    );
  });
});
