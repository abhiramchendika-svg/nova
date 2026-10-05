import { expect, test, type Page } from '@playwright/test';
import { appPaths } from './pages';
import { DEMO, goTo, settle } from './support';

/**
 * Phase 6c: every page has a real loading state, a real error state with a way to retry, and an
 * empty state that says what to do, rather than a blank area or a crash. Faults come from the mock's
 * `window.__novaMock` (src/mocks/browser.ts).
 */

const ZERO_ID = '00000000-0000-4000-8000-0000000000ff';

/** Pages that have something to show (or a form) even for a new account. */
const NOT_EMPTY_FOR_NEW_ACCOUNTS = [
  '/app/academics/grades/schemes', // the built-in grading presets
  '/app/developer/github', // the connect form
  '/app/settings',
];

/** Logs in with faults already set, so even Home's first queries see them. */
async function logInWith(page: Page, setUp: (mock: NonNullable<Window['__novaMock']>) => void) {
  await page.goto('/login?next=%2Fapp');
  await page.waitForFunction(() => window.__novaMock !== undefined);
  await page.evaluate(`(${setUp.toString()})(window.__novaMock)`);
  await page.getByLabel('Email').fill(DEMO.email);
  await page.getByLabel('Password', { exact: true }).fill(DEMO.password);
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page.getByRole('button', { name: /^Account/ })).toBeVisible();
}

function trackCrashes(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
}

test('when the server fails, Home says so and offers to try again', async ({ page }) => {
  const crashes = trackCrashes(page);
  await logInWith(page, (mock) => mock.failRequests(['*']));
  const alert = page
    .locator('main [role="alert"]')
    .filter({ has: page.getByRole('button', { name: 'Try again' }) });
  await expect(alert.first()).toBeVisible();
  // …and recovers once the server is back
  await page.evaluate(() => window.__novaMock!.reset());
  // Each panel failed on its own and retries on its own
  while ((await alert.count()) > 0) {
    const before = await alert.count();
    await alert.first().getByRole('button', { name: 'Try again' }).click();
    await expect(alert).toHaveCount(before - 1);
  }
  expect(crashes).toEqual([]);
});

test('when the server fails, every other page says so and offers to try again', async ({ page }) => {
  test.setTimeout(420_000);
  const crashes = trackCrashes(page);
  await logInWith(page, () => {});
  const paths = await appPathsFor(page);
  await page.evaluate(() => window.__novaMock!.failRequests(['*']));
  const missing: string[] = [];
  for (const path of paths) {
    await page.evaluate(() => window.__novaMock!.forgetCache!());
    await goTo(page, path);
    const alert = page
      .locator('main [role="alert"]')
      .filter({ has: page.getByRole('button', { name: 'Try again' }) });
    try {
      // Two retries with back-off come first (src/app/queryClient.ts)
      await expect(alert.first()).toBeVisible({ timeout: 9_000 });
    } catch {
      missing.push(path);
    }
  }
  expect(missing).toEqual([]);
  expect(crashes).toEqual([]);
});

test('while data loads, every page shows that it is loading', async ({ page }) => {
  const crashes = trackCrashes(page);
  await logInWith(page, () => {});
  const paths = await appPathsFor(page);
  await page.evaluate(() => window.__novaMock!.slowDown(1500));
  const missing: string[] = [];
  for (const path of paths) {
    await page.evaluate(() => window.__novaMock!.forgetCache!());
    await page.evaluate((p) => {
      window.history.pushState({}, '', p);
      window.dispatchEvent(new PopStateEvent('popstate'));
    }, path);
    const busy = page.locator('main [aria-busy="true"], main [role="status"]');
    try {
      await expect(busy.first()).toBeAttached({ timeout: 1_200 });
    } catch {
      missing.push(path);
    }
    await settle(page);
  }
  expect(missing).toEqual([]);
  expect(crashes).toEqual([]);
});

test('a brand-new account sees what to do next on every page, not a blank', async ({ page }) => {
  const crashes = trackCrashes(page);
  await page.goto('/register');
  await page.getByLabel('What should we call you?').fill('New Student');
  await page.getByLabel('Email').fill('new-student@example.com');
  await page.getByLabel('Password', { exact: true }).fill('correct-horse-battery');
  await page.getByRole('button', { name: /Create/ }).click();
  await page.waitForURL('**/app/welcome');
  await page.getByRole('button', { name: 'Skip setup' }).click();
  await expect(page.getByRole('button', { name: /^Account/ })).toBeVisible();
  const found: Record<string, string> = {};
  for (const path of await appPathsFor(page)) {
    await goTo(page, path);
    const main = page.locator('main');
    if ((await main.locator('[role="alert"]').count()) > 0) {
      found[path] = `error: ${await main.locator('[role="alert"]').first().innerText()}`;
    } else if ((await main.locator('h1').count()) === 0) {
      found[path] = 'no page heading';
    } else if (
      !path.includes(ZERO_ID) &&
      !NOT_EMPTY_FOR_NEW_ACCOUNTS.includes(path) &&
      (await main.locator('[data-empty-state]').count()) === 0
    ) {
      found[path] = 'no empty state';
    }
  }
  expect(found).toEqual({});
  expect(crashes).toEqual([]);
});

/** The demo's pages, or with a made-up id for detail pages when the account has no records. */
async function appPathsFor(page: Page): Promise<string[]> {
  const paths = await appPaths(page);
  return paths.map((p) => p.replace(/\/undefined$/, `/${ZERO_ID}`)).filter((p) => p !== '/app');
}
