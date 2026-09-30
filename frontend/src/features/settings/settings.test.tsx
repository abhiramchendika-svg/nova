import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { THEME_STORAGE_KEY } from '@/features/theme/theme';
import { createMockDb, DEFAULT_SETTINGS, type MockDb } from '@/mocks/handlers';
import { axeViolations } from '@/test/axe';
import { renderRoute } from '@/test/render';
import { installMockApi, TEST_USER } from '@/test/server';
import { deviceTimeZone } from './timezones';
import type { SettingsRequest } from './types';

/** The user id createMockDb gives the logged-in test user. */
const USER_ID = '00000000-0000-4000-8000-000000000001';

function setup(settings: Partial<SettingsRequest> = {}): MockDb {
  const db = createMockDb({ loggedInAs: TEST_USER });
  db.settings.set(USER_ID, { ...DEFAULT_SETTINGS, ...settings });
  installMockApi(db);
  return db;
}

const saved = (db: MockDb) => db.settings.get(USER_ID)!;
const theme = () => document.documentElement.getAttribute('data-theme');

describe('Settings page', () => {
  it('saves time zone, week start, university and target together', async () => {
    const db = setup();
    const { user } = renderRoute('/app/settings');

    const zone = await screen.findByLabelText('Time zone');
    expect(zone).toHaveValue('UTC');
    const save = screen.getByRole('button', { name: 'Save changes' });
    expect(save).toBeDisabled(); // nothing to save yet

    await user.clear(zone);
    await user.type(zone, 'Asia/Kolkata');
    expect(await screen.findByText(/^It’s \d\d:\d\d there now\./)).toBeInTheDocument();
    await user.click(screen.getByLabelText('Sunday'));
    await user.type(screen.getByLabelText('University (optional)'), '  Example University ');
    await user.type(screen.getByLabelText('Default attendance target % (optional)'), '75');
    await user.click(save);

    expect(await screen.findByText('Saved.')).toBeInTheDocument();
    expect(saved(db)).toMatchObject({
      timezone: 'Asia/Kolkata',
      weekStart: 'SUN',
      universityName: 'Example University',
      defaultAttendanceTarget: 75,
      theme: 'SYSTEM',
    });
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled();
  });

  it('refuses a made-up time zone and a target outside 0–100', async () => {
    const db = setup();
    const { user } = renderRoute('/app/settings');
    const zone = await screen.findByLabelText('Time zone');

    await user.clear(zone);
    await user.type(zone, 'Mars/Olympus_Mons');
    await user.type(screen.getByLabelText('Default attendance target % (optional)'), '120');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(
      await screen.findByText('Choose a time zone from the list, like Asia/Kolkata.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Use a number between 0 and 100, like 75.')).toBeInTheDocument();
    expect(saved(db).timezone).toBe('UTC');
  });

  it('offers this device’s time zone when the saved one differs', async () => {
    setup({ timezone: deviceTimeZone() === 'Pacific/Auckland' ? 'Asia/Tokyo' : 'Pacific/Auckland' });
    const { user } = renderRoute('/app/settings');
    await screen.findByLabelText('Time zone');

    await user.click(
      screen.getByRole('button', { name: `Use this device’s time zone (${deviceTimeZone()})` }),
    );
    expect(screen.getByLabelText('Time zone')).toHaveValue(deviceTimeZone());
    expect(screen.queryByRole('button', { name: /Use this device’s time zone/ })).not.toBeInTheDocument();
  });

  it('previews a theme, discards it, then saves one to the account', async () => {
    const db = setup({ theme: 'LIGHT' });
    const { user } = renderRoute('/app/settings');
    const appearance = await screen.findByRole('region', { name: 'Appearance' });
    await waitFor(() => expect(theme()).toBe('light'));

    await user.click(within(appearance).getByLabelText('Dark'));
    expect(theme()).toBe('dark'); // preview
    await user.click(screen.getByRole('button', { name: 'Discard' }));
    await waitFor(() => expect(theme()).toBe('light'));

    await user.click(within(appearance).getByLabelText('Dark'));
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(saved(db).theme).toBe('DARK'));
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
  });

  it('puts the saved theme back if a preview is left unsaved', async () => {
    setup({ theme: 'LIGHT' });
    const { user, router } = renderRoute('/app/settings');
    const appearance = await screen.findByRole('region', { name: 'Appearance' });

    await user.click(within(appearance).getByLabelText('Dark'));
    expect(theme()).toBe('dark');
    await router.navigate('/app');
    await waitFor(() => expect(theme()).toBe('light'));
  });

  it('has no serious accessibility violations', async () => {
    setup();
    const { container } = renderRoute('/app/settings');
    await screen.findByLabelText('Time zone');
    expect(await axeViolations(container)).toEqual([]);
  });
});

describe('Theme sync', () => {
  it('applies the account’s theme after sign-in and remembers it in this browser', async () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'light');
    setup({ theme: 'DARK' });
    renderRoute('/app');

    await waitFor(() => expect(theme()).toBe('dark'));
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
  });

  it('saves a theme picked from the top bar to the account', async () => {
    const db = setup({ theme: 'SYSTEM' });
    const { user } = renderRoute('/app');
    await screen.findByRole('heading', { level: 1 });

    await user.click(screen.getByRole('button', { name: /^Theme:/ }));
    await user.click(await screen.findByRole('menuitemradio', { name: 'Dark' }));

    expect(theme()).toBe('dark');
    await waitFor(() => expect(saved(db).theme).toBe('DARK'));
  });

  it('keeps the Settings form in step with a theme picked from the top bar', async () => {
    setup({ theme: 'LIGHT' });
    const { user } = renderRoute('/app/settings');
    const appearance = await screen.findByRole('region', { name: 'Appearance' });

    await user.click(screen.getByRole('button', { name: /^Theme:/ }));
    await user.click(await screen.findByRole('menuitemradio', { name: 'Dark' }));

    await waitFor(() => expect(within(appearance).getByLabelText('Dark')).toBeChecked());
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled();
  });
});
