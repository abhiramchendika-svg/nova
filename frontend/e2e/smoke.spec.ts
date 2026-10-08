import { expect, test } from '@playwright/test';
import { goTo, logIn } from './support';

/** Phase 6b smoke flows: the everyday paths through NOVA, end to end in a real browser (mock API). */

test('log in and out', async ({ page }) => {
  await logIn(page);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Demo\./);
  await page.getByRole('button', { name: /^Account/ }).click();
  await page.getByRole('menuitem', { name: 'Log out' }).click();
  await expect(page).toHaveURL(/\/login$/);
});

test('try the demo from the landing page, then leave it for a real account', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Try the demo' }).click();
  await expect(page).toHaveURL(/\/app$/);
  const banner = page.getByRole('complementary', { name: 'Demo account' });
  await expect(banner).toContainText('You’re in a demo.');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Demo\./);
  await banner.getByRole('button', { name: 'Create your own account' }).click();
  await expect(page).toHaveURL(/\/register$/);
});

test('add a task for today and tick it off', async ({ page }) => {
  await logIn(page);
  await goTo(page, '/app/planner/tasks');
  await page.getByLabel('Add a task for today').fill('Buy a lab coat');
  await page.keyboard.press('Enter');
  const done = page.getByRole('checkbox', { name: 'Buy a lab coat' });
  await expect(done).toBeVisible();
  // Ticking it moves it to "Done today" (a new row), so click rather than check()
  await done.click();
  await expect(page.getByRole('region', { name: /^Done today/ })).toContainText('Buy a lab coat');
});

test('mark a class and see the projection change', async ({ page }) => {
  await logIn(page);
  await goTo(page, '/app/academics/attendance');
  const compilers = page.getByRole('region', { name: /Compilers/ });
  await compilers.getByRole('button', { name: 'Absent' }).click();
  await expect(compilers).toContainText('Marked absent for today.');
  await expect(compilers).toContainText('76.2%');
});

test('find a course with search and open it', async ({ page }) => {
  await logIn(page);
  await page.getByRole('button', { name: /^Search/ }).click();
  await page.getByRole('combobox').fill('database');
  await page.getByRole('option', { name: /^Database Systems/ }).click();
  await expect(page).toHaveURL(/\/app\/academics\/courses\//);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Database Systems/);
});

test('read a notification', async ({ page }) => {
  await logIn(page);
  const bell = page.getByRole('button', { name: /^Notifications, \d+ unread$/ });
  const before = Number((await bell.getAttribute('aria-label'))!.match(/(\d+) unread/)![1]);
  await bell.click();
  const first = page.getByRole('menuitem', { name: /\(unread\)/ }).first();
  await first.click();
  await expect(page).not.toHaveURL(/\/app$/);
  // A task's notification opens the task in a dialog; close it to get back to the page
  const dialog = page.getByRole('dialog');
  if (await dialog.isVisible()) {
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  }
  await expect(page.getByRole('button', { name: /^Notifications/ })).toHaveAttribute(
    'aria-label',
    before - 1 === 0 ? 'Notifications' : `Notifications, ${before - 1} unread`,
  );
});

test('review the week in Insights', async ({ page }) => {
  await logIn(page);
  await page.getByRole('link', { name: 'All insights' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Insights' })).toBeVisible();
  await expect(page.getByRole('figure', { name: 'Deadlines ahead' })).toBeVisible();
  await page.getByRole('link', { name: 'This month' }).click();
  await expect(page).toHaveURL(/window=month/);
});
