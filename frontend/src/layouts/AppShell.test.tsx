import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createMockDb } from '@/mocks/handlers';
import { axeViolations } from '@/test/axe';
import { renderRoute } from '@/test/render';
import { installMockApi, TEST_USER } from '@/test/server';
import { titleForPath } from './navigation';

describe('app shell', () => {
  it('marks the current page in the main navigation', async () => {
    installMockApi(createMockDb({ loggedInAs: TEST_USER }));
    renderRoute('/app/academics/grades');
    const nav = await screen.findByRole('navigation', { name: 'Main' });
    expect(within(nav).getByRole('link', { name: 'Grades' })).toHaveAttribute('aria-current', 'page');
    expect(within(nav).getByRole('link', { name: 'Home' })).not.toHaveAttribute('aria-current');
  });

  it('shows an honest placeholder for sections from later phases', async () => {
    installMockApi(createMockDb({ loggedInAs: TEST_USER }));
    renderRoute('/app/developer/github');
    expect(await screen.findByRole('heading', { name: 'GitHub' })).toBeInTheDocument();
    expect(screen.getByText(/planned for Phase 4/)).toBeInTheDocument();
  });

  it('opens "More" on mobile with every section', async () => {
    installMockApi(createMockDb({ loggedInAs: TEST_USER }));
    const { user } = renderRoute('/app');
    await user.click(await screen.findByRole('button', { name: 'More' }));
    const dialog = await screen.findByRole('dialog', { name: 'Everything in NOVA' });
    expect(within(dialog).getByRole('link', { name: 'Internships' })).toBeInTheDocument();
    expect(within(dialog).getByRole('link', { name: 'Insights' })).toBeInTheDocument();
  });

  it('Home has intentional empty states and no serious accessibility violations', async () => {
    installMockApi(createMockDb({ loggedInAs: TEST_USER }));
    const { container } = renderRoute('/app');
    await screen.findByRole('heading', { level: 1 });
    // Today's classes load from the timetable API, so the empty state arrives with the response
    expect(await screen.findByText('Your day is clear.')).toBeInTheDocument();
    expect(await screen.findByText('Nothing due this week. Enjoy the breathing room.')).toBeInTheDocument();
    expect(await screen.findByText('Nothing needs you right now.')).toBeInTheDocument();
    expect(await axeViolations(container)).toEqual([]);
  });
});

describe('titleForPath', () => {
  it.each([
    ['/app', 'Home'],
    ['/app/planner/calendar', 'Calendar'],
    ['/app/academics/exams/123', 'Exams'],
    ['/app/unknown', 'NOVA'],
  ])('%s → %s', (path, title) => {
    expect(titleForPath(path)).toBe(title);
  });
});
