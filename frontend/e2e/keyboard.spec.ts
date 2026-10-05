import { expect, test, type Page } from '@playwright/test';
import { appPaths } from './pages';
import { focusFirstStop, goTo, logIn } from './support';

/** Phase 6b: everything works from the keyboard, and you can always see where focus is. */

/** Tabs through the page from the top and returns stops that show no focus indicator. */
async function stopsWithoutRing(page: Page, limit = 150): Promise<string[]> {
  await focusFirstStop(page);
  const seen = new Set<string>();
  const bad: string[] = [];
  for (let i = 0; i < limit; i++) {
    if (i > 0) await page.keyboard.press('Tab');
    const stop = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el || el === document.body) return null;
      const cs = getComputedStyle(el);
      const box = el.getBoundingClientRect();
      const visible =
        (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) ||
        cs.boxShadow !== 'none' ||
        // Inputs whose wrapper shows the ring (focus-within)
        (el.parentElement !== null && getComputedStyle(el.parentElement).boxShadow !== 'none');
      const name = el.getAttribute('aria-label') ?? (el.textContent ?? '').trim().slice(0, 40);
      return {
        key: `${el.tagName}|${name}|${Math.round(box.top + window.scrollY)}|${Math.round(box.left)}`,
        label: `${el.tagName.toLowerCase()} "${name}"`,
        ok: visible && box.width > 0 && box.height > 0,
      };
    });
    if (!stop || seen.has(stop.key)) break;
    seen.add(stop.key);
    if (!stop.ok) bad.push(stop.label);
  }
  return bad;
}

test('every focus stop on every page shows a focus indicator', async ({ page }) => {
  test.setTimeout(300_000);
  await logIn(page);
  const found: Record<string, string[]> = {};
  for (const path of await appPaths(page)) {
    await goTo(page, path);
    const bad = await stopsWithoutRing(page);
    if (bad.length) found[path] = bad;
  }
  expect(found).toEqual({});
});

test('the skip link is the first stop and jumps past the navigation', async ({ page }) => {
  await logIn(page);
  // The first focusable element in the page is the skip link, so it's the first Tab after a load
  const first = await page.evaluate(() => {
    const el = document.querySelector<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    return el?.textContent?.trim();
  });
  expect(first).toBe('Skip to content');
  const skip = page.getByRole('link', { name: 'Skip to content' });
  await skip.focus();
  await expect(skip).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.locator('main#main')).toBeFocused();
});

test('Ctrl+K search works from the keyboard and gives focus back', async ({ page }) => {
  await logIn(page);
  await page.locator('main#main').focus();
  await page.keyboard.press('Control+k');
  const dialog = page.getByRole('dialog', { name: 'Search NOVA' });
  await expect(dialog.getByRole('combobox')).toBeFocused();
  await page.keyboard.type('compilers');
  await expect(dialog.getByRole('group', { name: 'Courses' })).toBeVisible();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/app\/academics\/courses\//);
  await expect(dialog).toBeHidden();
});

test('dialogs keep focus inside, close on Escape and return focus', async ({ page }) => {
  await logIn(page);
  await goTo(page, '/app/planner/tasks');
  const opener = page.getByRole('button', { name: 'New task' });
  await opener.focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'New task' });
  await expect(dialog.getByLabel('Title')).toBeFocused();
  for (let i = 0; i < 25; i++) {
    await page.keyboard.press('Tab');
    expect(await dialog.evaluate((d) => d.contains(document.activeElement))).toBe(true);
  }
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(opener).toBeFocused();
});

test('top-bar menus open, move and close from the keyboard', async ({ page }) => {
  await logIn(page);
  const bell = page.getByRole('button', { name: /^Notifications/ });
  await bell.focus();
  await page.keyboard.press('Enter');
  const menu = page.getByRole('menu');
  await expect(menu).toBeVisible();
  await page.keyboard.press('ArrowDown');
  await expect(
    menu
      .getByRole('menuitem')
      .filter({ has: page.locator(':focus') })
      .or(menu.locator(':focus')),
  ).toHaveCount(1);
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
  await expect(bell).toBeFocused();
});
