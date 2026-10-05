import { expect, test, type Page } from '@playwright/test';
import { goTo, logIn } from './support';

/**
 * Phase 6c: motion respects the system's "reduce motion" setting (WCAG 2.3.3). NOVA's motion is all
 * CSS driven by the --dur-* tokens, which drop to 0 ms under prefers-reduced-motion.
 */

/**
 * Everything on the page set up to move or fade: CSS animations, and transitions of anything but
 * colour, with a duration above zero. Read from computed styles, so it doesn't depend on catching an
 * animation mid-flight (which is timing-sensitive on a busy machine).
 */
async function movingThings(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const found = new Set<string>();
    const seconds = (list: string) =>
      Math.max(...list.split(',').map((d) => parseFloat(d) * (d.includes('ms') ? 0.001 : 1)));
    for (const el of document.querySelectorAll<HTMLElement>('body *')) {
      const cs = getComputedStyle(el);
      const label = `${el.tagName.toLowerCase()}.${String(el.className).split(' ').slice(0, 2).join('.')}`;
      if (cs.animationName !== 'none' && seconds(cs.animationDuration) > 0) {
        found.add(`animation ${cs.animationName} on ${label}`);
      }
      const props = cs.transitionProperty.split(',').map((p) => p.trim());
      const moves = props.some((p) =>
        ['all', 'transform', 'opacity', 'translate', 'scale', 'stroke-dashoffset'].includes(p),
      );
      if (moves && seconds(cs.transitionDuration) > 0) {
        found.add(`transition ${cs.transitionProperty} on ${label}`);
      }
    }
    return [...found];
  });
}

async function pageAndDialog(page: Page): Promise<string[]> {
  const found: string[] = [];
  await logIn(page);
  for (const path of ['/app/academics/courses', '/app/planner/calendar', '/app/insights']) {
    await page.evaluate((p) => {
      window.history.pushState({}, '', p);
      window.dispatchEvent(new PopStateEvent('popstate'));
    }, path);
    await page.locator('main h1').waitFor();
    found.push(...(await movingThings(page)));
  }
  await goTo(page, '/app/planner/tasks');
  await page.getByRole('button', { name: 'New task' }).click();
  await page.getByRole('dialog', { name: 'New task' }).waitFor();
  found.push(...(await movingThings(page)));
  return found;
}

test.describe('with reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('pages and dialogs appear without moving or fading', async ({ page }) => {
    expect(await pageAndDialog(page)).toEqual([]);
  });

  test('loading placeholders don’t shimmer', async ({ page }) => {
    await logIn(page);
    await page.evaluate(() => {
      window.__novaMock!.forgetCache!();
      window.__novaMock!.slowDown(1500);
    });
    await page.evaluate(() => {
      window.history.pushState({}, '', '/app/insights');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    await page.locator('main [aria-busy="true"]').first().waitFor();
    expect(await movingThings(page)).toEqual([]);
  });
});

test('without the setting, the same pages do animate (so the check above means something)', async ({
  page,
}) => {
  expect((await pageAndDialog(page)).some((a) => a.startsWith('animation nova-enter'))).toBe(true);
});
