import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { expect, type Page } from '@playwright/test';

const require = createRequire(import.meta.url);
const AXE_SOURCE = readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');

/** The demo account `npm run dev:mock` comes with (src/mocks/browser.ts). */
export const DEMO = { email: 'demo@nova.dev', password: 'nova-demo-2026' };

/** WCAG 2.2 A and AA, the target in docs/ui-design.md. */
const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

/** Logs the demo account in and waits for Home. */
export async function logIn(page: Page): Promise<void> {
  await page.goto('/login?next=%2Fapp');
  await page.getByLabel('Email').fill(DEMO.email);
  await page.getByLabel('Password', { exact: true }).fill(DEMO.password);
  await page.getByRole('button', { name: 'Log in' }).click();
  await page.waitForURL('**/app');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
}

/**
 * Moves to an in-app path without reloading: the mock API lives in the page, so a reload would log
 * the demo out. Waits until nothing on the page is still loading.
 */
export async function goTo(page: Page, path: string): Promise<void> {
  await page.evaluate((p) => {
    window.history.pushState({}, '', p);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, path);
  await settle(page);
}

export async function settle(page: Page): Promise<void> {
  await page.waitForFunction(() => document.querySelectorAll('[aria-busy="true"]').length === 0);
  // Let lazy chunks and follow-up queries render
  await page.waitForTimeout(400);
}

/** Every WCAG 2.2 A/AA violation on the page, colour contrast included, as readable lines. */
export async function axeViolations(page: Page): Promise<string[]> {
  if (!(await page.evaluate(() => 'axe' in window))) {
    await page.addScriptTag({ content: AXE_SOURCE });
  }
  return page.evaluate(async (tags) => {
    // @ts-expect-error axe is injected above
    const results = await window.axe.run(document, {
      runOnly: { type: 'tag', values: tags },
      resultTypes: ['violations'],
    });
    return (results.violations as { id: string; help: string; nodes: { target: string[] }[] }[]).map(
      (v) => `${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(' ')).join(', ')})`,
    );
  }, WCAG_TAGS);
}

/** Ids of the first record of each kind in the demo data, for detail pages. */
export async function demoIds(page: Page) {
  return page.evaluate(async () => {
    const first = async (path: string) => {
      const body = (await (await fetch(`/api/v1${path}`)).json()) as
        { id: string }[] | { items: { id: string }[] };
      return (Array.isArray(body) ? body : body.items)[0]?.id;
    };
    return {
      course: await first('/courses'),
      exam: await first('/exams'),
      project: await first('/projects'),
      goal: await first('/learning-goals'),
      hackathon: await first('/hackathons'),
      internship: await first('/internships'),
    };
  });
}
