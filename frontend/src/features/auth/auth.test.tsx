import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createMockDb } from '@/mocks/handlers';
import { axeViolations } from '@/test/axe';
import { renderRoute } from '@/test/render';
import { installMockApi, server, TEST_USER } from '@/test/server';
import { API } from '@/mocks/http';
import { http, HttpResponse } from 'msw';
import { WAKE_RETRY_MS } from './api';
import { safeNextPath } from './schemas';

describe('route guard', () => {
  it('sends logged-out visitors to login and remembers where they were going', async () => {
    installMockApi();
    const { router } = renderRoute('/app/planner/tasks');
    await screen.findByRole('heading', { name: 'Welcome back' });
    expect(router.state.location.pathname).toBe('/login');
    expect(router.state.location.search).toBe(`?next=${encodeURIComponent('/app/planner/tasks')}`);
  });

  it('lets a logged-in user into the app shell', async () => {
    installMockApi(createMockDb({ loggedInAs: TEST_USER }));
    renderRoute('/app');
    expect(await screen.findByRole('heading', { level: 1, name: /Abhi\./ })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Main' })).toBeInTheDocument();
  });
});

describe('a sleeping server', () => {
  it('says it is waking up, keeps checking, then lets the user in', async () => {
    installMockApi(createMockDb({ loggedInAs: TEST_USER }));
    server.use(
      http.get(
        `${API}/auth/me`,
        () =>
          new HttpResponse('<html>Waking up</html>', {
            status: 503,
            headers: { 'Content-Type': 'text/html' },
          }),
        { once: true },
      ),
    );
    renderRoute('/app');
    expect(await screen.findByRole('heading', { name: 'Waking up NOVA’s server…' })).toBeInTheDocument();
    expect(
      await screen.findByRole('heading', { level: 1, name: /Abhi\./ }, { timeout: WAKE_RETRY_MS + 5_000 }),
    ).toBeInTheDocument();
  });
});

describe('login', () => {
  it('validates before calling the server', async () => {
    installMockApi();
    const { user } = renderRoute('/login');
    await user.click(await screen.findByRole('button', { name: 'Log in' }));
    expect(await screen.findByText('Enter your email.')).toBeInTheDocument();
    expect(screen.getByText('Enter your password.')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true');
  });

  it('shows one generic message for wrong credentials', async () => {
    const db = createMockDb();
    db.users.set(TEST_USER.email, { ...TEST_USER, id: 'u1', onboardingCompleted: false });
    installMockApi(db);
    const { user } = renderRoute('/login');
    await user.type(await screen.findByLabelText('Email'), TEST_USER.email);
    await user.type(screen.getByLabelText('Password'), 'wrong-password-123');
    await user.click(screen.getByRole('button', { name: 'Log in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('That email and password don’t match');
  });

  it('logs in and continues to the page the user asked for', async () => {
    const db = createMockDb();
    db.users.set(TEST_USER.email, { ...TEST_USER, id: 'u1', onboardingCompleted: false });
    installMockApi(db);
    const { user, router } = renderRoute(`/login?next=${encodeURIComponent('/app/insights')}`);
    await user.type(await screen.findByLabelText('Email'), TEST_USER.email);
    await user.type(screen.getByLabelText('Password'), TEST_USER.password);
    await user.click(screen.getByRole('button', { name: 'Log in' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/app/insights'));
    expect(await screen.findByRole('heading', { name: 'Insights' })).toBeInTheDocument();
  });

  it('has no serious accessibility violations', async () => {
    installMockApi();
    const { container } = renderRoute('/login');
    await screen.findByRole('heading', { name: 'Welcome back' });
    expect(await axeViolations(container)).toEqual([]);
  });
});

describe('register', () => {
  it('requires a password of at least 10 characters', async () => {
    installMockApi();
    const { user } = renderRoute('/register');
    await user.type(await screen.findByLabelText('What should we call you?'), 'Abhi');
    await user.type(screen.getByLabelText('Email'), 'new@example.com');
    await user.type(screen.getByLabelText('Password'), 'short');
    await user.click(screen.getByRole('button', { name: 'Create account' }));
    expect(await screen.findByText('Use at least 10 characters.')).toBeInTheDocument();
  });

  it('explains a duplicate email without confirming the account exists', async () => {
    const db = createMockDb();
    db.users.set(TEST_USER.email, { ...TEST_USER, id: 'u1', onboardingCompleted: false });
    installMockApi(db);
    const { user } = renderRoute('/register');
    await user.type(await screen.findByLabelText('What should we call you?'), 'Someone');
    await user.type(screen.getByLabelText('Email'), TEST_USER.email);
    await user.type(screen.getByLabelText('Password'), 'another-long-password');
    await user.click(screen.getByRole('button', { name: 'Create account' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('may already exist');
  });

  it('creates the account and starts setup', async () => {
    installMockApi();
    const { user, router } = renderRoute('/register');
    await user.type(await screen.findByLabelText('What should we call you?'), 'Riya Sharma');
    await user.type(screen.getByLabelText('Email'), 'riya@example.com');
    await user.type(screen.getByLabelText('Password'), 'a-long-enough-password');
    await user.click(screen.getByRole('button', { name: 'Create account' }));
    // Home sends a new account to onboarding first
    await waitFor(() => expect(router.state.location.pathname).toBe('/app/welcome'));
    expect(await screen.findByRole('heading', { level: 1, name: 'Welcome, Riya.' })).toBeInTheDocument();
  });
});

describe('logout', () => {
  it('ends the session and returns to login', async () => {
    installMockApi(createMockDb({ loggedInAs: TEST_USER }));
    const { user, router } = renderRoute('/app');
    await user.click(await screen.findByRole('button', { name: `Account: ${TEST_USER.displayName}` }));
    await user.click(await screen.findByRole('menuitem', { name: 'Log out' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
  });
});

describe('safeNextPath', () => {
  it.each([
    [null, '/app'],
    ['', '/app'],
    ['/app/tasks', '/app/tasks'],
    ['https://evil.example', '/app'],
    ['//evil.example', '/app'],
    ['/\\evil.example', '/app'],
  ])('%s → %s', (input, expected) => {
    expect(safeNextPath(input)).toBe(expected);
  });
});
