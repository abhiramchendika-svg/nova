import { expect, test, type Locator, type Page } from '@playwright/test';
import { appPaths } from './pages';
import { goTo, logIn } from './support';

/**
 * Phase 6b: content reflows down to 320 CSS px (WCAG 1.4.10) and at tablet and desktop widths, with
 * no sideways scrolling of the page. Wide content that scrolls inside its own box (none today) would
 * still pass, since only the page itself is measured.
 */
const WIDTHS = [320, 768, 1280];

/** The page's horizontal overflow in px, and the deepest elements sticking out. */
async function overflow(page: Page) {
  return page.evaluate(() => {
    const doc = document.documentElement;
    const over = doc.scrollWidth - doc.clientWidth;
    if (over <= 0) return null;
    const culprits: string[] = [];
    for (const el of document.querySelectorAll('body *')) {
      const box = el.getBoundingClientRect();
      const sticksOut = (e: Element) => e.getBoundingClientRect().right > doc.clientWidth + 1;
      if (sticksOut(el) && box.width > 0 && ![...el.children].some(sticksOut)) {
        culprits.push(`${el.tagName.toLowerCase()} "${(el.textContent ?? '').trim().slice(0, 30)}"`);
      }
    }
    return `+${over}px: ${culprits.slice(0, 3).join(', ')}`;
  });
}

for (const width of WIDTHS) {
  test(`every page fits ${width} px without scrolling sideways`, async ({ page }) => {
    test.setTimeout(240_000);
    await page.setViewportSize({ width, height: 900 });
    await logIn(page);
    const found: Record<string, string> = {};
    for (const path of ['/app', ...(await appPaths(page)).slice(1)]) {
      await goTo(page, path);
      const o = await overflow(page);
      if (o) found[path] = o;
    }
    expect(found).toEqual({});
  });
}

test('dialogs and menus fit a 320 px screen', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await logIn(page);
  const inside = async (name: string, locator: Locator) => {
    const box = (await locator.boundingBox())!;
    expect(box.x, `${name} left edge`).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width, `${name} right edge`).toBeLessThanOrEqual(320);
  };
  await page.getByRole('button', { name: /^Search/ }).click();
  await inside('search', page.getByRole('dialog', { name: 'Search NOVA' }));
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: /^Notifications/ }).click();
  await inside('notifications', page.getByRole('menu'));
  await page.keyboard.press('Escape');
  await goTo(page, '/app/planner/tasks');
  await page.getByRole('button', { name: 'New task' }).click();
  await inside('new task', page.getByRole('dialog', { name: 'New task' }));
});
