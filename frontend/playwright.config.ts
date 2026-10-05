import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end checks in a real browser against the mock API (`npm run dev:mock`): no backend, database
 * or GitHub needed. Run with `npm run e2e` (first time: `npm run e2e:install`).
 *
 * PLAYWRIGHT_CHROMIUM_PATH lets an environment that already has a Chromium (e.g. a container image)
 * use it instead of downloading one.
 */
const PORT = 5199;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  timeout: 180_000,
  // Generous waits: the suite runs several browsers at once against a dev server, which is slow on
  // some machines (and CI runners)
  expect: { timeout: 15_000 },
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH }
      : {},
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npm run dev:mock -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
