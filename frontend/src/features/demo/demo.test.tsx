import { screen, waitFor, within } from '@testing-library/react';
import { http } from 'msw';
import { describe, expect, it } from 'vitest';
import { createMockDb } from '@/mocks/handlers';
import { API, problem } from '@/mocks/http';
import { axeViolations } from '@/test/axe';
import { renderRoute } from '@/test/render';
import { installMockApi, server, TEST_USER } from '@/test/server';
import { timeLeft } from './api';

describe('try the demo', () => {
  it('starts a demo from the landing page and opens the app with fictional data', async () => {
    const db = installMockApi();
    const { user, router } = renderRoute('/');
    await user.click(await screen.findByRole('button', { name: 'Try the demo' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/app'));
    const banner = await screen.findByRole('complementary', { name: 'Demo account' });
    expect(banner).toHaveTextContent('You’re in a demo.');
    expect(banner).toHaveTextContent(/deleted in about 2[34] hours/);
    expect(await screen.findByRole('heading', { level: 1, name: /Demo\./ })).toBeInTheDocument();

    // A fresh account with its own copy of the demo data, in the browser's timezone
    const demo = [...db.users.values()].find((u) => u.email.endsWith('@demo.nova.invalid'));
    expect(demo).toBeDefined();
    expect(db.academics.get(demo!.id)?.courses).toHaveLength(9);
    expect(db.settings.get(demo!.id)?.timezone).toBe(Intl.DateTimeFormat().resolvedOptions().timeZone);
  });

  it('can be started from the login page too', async () => {
    installMockApi();
    const { user, router } = renderRoute('/login');
    await user.click(await screen.findByRole('button', { name: 'Try the demo' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/app'));
    expect(await screen.findByRole('complementary', { name: 'Demo account' })).toBeInTheDocument();
  });

  it('explains a busy demo in minutes, not seconds', async () => {
    installMockApi();
    server.use(
      http.post(`${API}/demo`, () =>
        problem(429, 'RATE_LIMITED', 'Too many attempts', { retryAfterSeconds: 540 }),
      ),
    );
    const { user } = renderRoute('/');
    await user.click(await screen.findByRole('button', { name: 'Try the demo' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Lots of people are trying the demo right now. Try again in about 9 minutes.',
    );
  });

  it('says so when the server has demos switched off', async () => {
    installMockApi();
    server.use(http.post(`${API}/demo`, () => problem(404, 'NOT_FOUND', 'Not found')));
    const { user } = renderRoute('/login');
    await user.click(await screen.findByRole('button', { name: 'Try the demo' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('The demo isn’t available on this server.');
  });

  it('leaves the demo for a real account by logging out first', async () => {
    const db = installMockApi();
    const { user, router } = renderRoute('/');
    await user.click(await screen.findByRole('button', { name: 'Try the demo' }));
    const banner = await screen.findByRole('complementary', { name: 'Demo account' });
    await user.click(within(banner).getByRole('button', { name: 'Create your own account' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/register'));
    expect(db.sessionEmail).toBeNull();
  });

  it('shows no banner to a normal account', async () => {
    installMockApi(createMockDb({ loggedInAs: TEST_USER }));
    renderRoute('/app');
    await screen.findByRole('heading', { level: 1, name: /Abhi\./ });
    expect(screen.queryByRole('complementary', { name: 'Demo account' })).not.toBeInTheDocument();
  });

  it('has no serious accessibility violations with the banner showing', async () => {
    installMockApi();
    const { user, container } = renderRoute('/');
    await user.click(await screen.findByRole('button', { name: 'Try the demo' }));
    await screen.findByRole('complementary', { name: 'Demo account' });
    await screen.findByRole('heading', { level: 1, name: /Demo\./ });
    expect(await axeViolations(container)).toEqual([]);
  });
});

describe('timeLeft', () => {
  const now = Date.parse('2026-10-07T06:00:00Z');
  it.each([
    ['2026-10-08T06:00:00Z', 'in about 24 hours'],
    ['2026-10-07T08:30:00Z', 'in about 2 hours'],
    ['2026-10-07T07:10:00Z', 'in about an hour'],
    ['2026-10-07T06:59:00Z', 'in less than an hour'],
    ['2026-10-07T05:00:00Z', 'in less than an hour'],
  ])('%s → %s', (expiresAt, expected) => {
    expect(timeLeft(expiresAt, now)).toBe(expected);
  });
});
