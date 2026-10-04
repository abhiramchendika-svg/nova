import { expect, test } from '@playwright/test';
import { axeViolations, demoIds, goTo, logIn, settle } from './support';

/**
 * Phase 6a: every page and overlay, in light and dark, desktop and phone width, has no WCAG 2.2 A/AA
 * violations, colour contrast included (which the jsdom tests can't check).
 */
for (const theme of ['light', 'dark'] as const) {
  test.describe(`${theme} theme`, () => {
    test.use({ colorScheme: theme });

    test('public pages', async ({ page }) => {
      const found: Record<string, string[]> = {};
      for (const path of ['/', '/login', '/register', '/nowhere']) {
        await page.goto(path);
        await settle(page);
        const v = await axeViolations(page);
        if (v.length) found[path] = v;
      }
      expect(found).toEqual({});
    });

    test('every page in the app', async ({ page }) => {
      await logIn(page);
      const ids = await demoIds(page);
      const paths = [
        '/app',
        '/app/academics/courses',
        `/app/academics/courses/${ids.course}`,
        '/app/academics/assignments',
        '/app/academics/exams',
        `/app/academics/exams/${ids.exam}`,
        '/app/academics/timetable',
        '/app/academics/attendance',
        '/app/academics/grades',
        '/app/academics/grades/schemes',
        '/app/planner/tasks',
        '/app/planner/tasks?view=upcoming',
        '/app/planner/tasks?view=done',
        '/app/planner/calendar',
        '/app/planner/calendar?view=month',
        '/app/developer/projects',
        `/app/developer/projects/${ids.project}`,
        '/app/developer/learning',
        `/app/developer/learning/${ids.goal}`,
        '/app/developer/hackathons',
        `/app/developer/hackathons/${ids.hackathon}`,
        '/app/developer/internships',
        `/app/developer/internships/${ids.internship}`,
        '/app/developer/github',
        '/app/insights',
        '/app/insights?window=month',
        '/app/notifications',
        '/app/settings',
      ];
      const found: Record<string, string[]> = {};
      for (const path of paths) {
        await goTo(page, path);
        const v = await axeViolations(page);
        if (v.length) found[path] = v;
      }
      expect(found).toEqual({});
    });

    test('overlays: search, notifications, a form dialog, menus', async ({ page }) => {
      await logIn(page);
      const found: Record<string, string[]> = {};
      const check = async (name: string) => {
        await page.waitForTimeout(300);
        const v = await axeViolations(page);
        if (v.length) found[name] = v;
        await page.keyboard.press('Escape');
      };
      await page.getByRole('button', { name: /^Search/ }).click();
      await expect(page.getByRole('dialog', { name: 'Search NOVA' })).toBeVisible();
      await check('search palette');
      await page.getByRole('button', { name: /^Notifications/ }).click();
      await expect(page.getByRole('menu')).toBeVisible();
      await check('notifications menu');
      await page.getByRole('button', { name: /^Account/ }).click();
      await check('account menu');
      await goTo(page, '/app/planner/tasks');
      await page.getByRole('button', { name: 'New task' }).click();
      await expect(page.getByRole('dialog', { name: 'New task' })).toBeVisible();
      await check('new task dialog');
      expect(found).toEqual({});
    });

    test('phone width', async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await logIn(page);
      const found: Record<string, string[]> = {};
      for (const path of [
        '/app',
        '/app/academics/timetable',
        '/app/academics/attendance',
        '/app/planner/calendar',
        '/app/planner/calendar?view=month',
        '/app/developer/internships',
        '/app/insights',
      ]) {
        await goTo(page, path);
        const v = await axeViolations(page);
        if (v.length) found[path] = v;
      }
      await page.getByRole('button', { name: 'More' }).click();
      await expect(page.getByRole('dialog', { name: 'Everything in NOVA' })).toBeVisible();
      const more = await axeViolations(page);
      if (more.length) found['"More" sheet'] = more;
      expect(found).toEqual({});
    });

    test('coloured text on its tint keeps a margin above 4.5:1', async ({ page }) => {
      // Contrast this close to the line can flip between browser versions (color-mix rounding), so the
      // tokens keep at least 5:1 and this checks every pair whatever data a page happens to show.
      await page.goto('/');
      const ratios = await page.evaluate((t) => {
        document.documentElement.dataset.theme = t;
        const css = getComputedStyle(document.documentElement);
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 1;
        const g = canvas.getContext('2d')!;
        const rgb = (color: string) => {
          const probe = document.createElement('div');
          probe.style.color = color;
          document.body.append(probe);
          const resolved = getComputedStyle(probe).color;
          probe.remove();
          g.clearRect(0, 0, 1, 1);
          g.fillStyle = resolved;
          g.fillRect(0, 0, 1, 1);
          return [...g.getImageData(0, 0, 1, 1).data].slice(0, 3);
        };
        const lum = (c: number[]) =>
          c
            .map((v) => v / 255)
            .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
            .reduce((n, v, i) => n + v * [0.2126, 0.7152, 0.0722][i]!, 0);
        const ratio = (a: number[], b: number[]) => {
          const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
          return Math.round(((hi! + 0.05) / (lo! + 0.05)) * 100) / 100;
        };
        const token = (name: string) => css.getPropertyValue(`--${name}`).trim();
        const surface = token('surface');
        // [text token, tint token, tint %] as in globals.css
        const pairs: [string, string, number][] = [
          ['academics-text', 'academics', 12],
          ['planner-text', 'planner', 12],
          ['developer-text', 'developer', 12],
          ['critical', 'critical', 11],
          ['warning', 'warning-fill', 16],
          ['good', 'good', 11],
        ];
        return Object.fromEntries(
          pairs.map(([text, tint, pct]) => [
            `${text} on tint-${tint}`,
            ratio(rgb(token(text)), rgb(`color-mix(in oklch, ${token(tint)} ${pct}%, ${surface})`)),
          ]),
        );
      }, theme);
      const tooLow = Object.fromEntries(Object.entries(ratios).filter(([, r]) => r < 5));
      expect(tooLow).toEqual({});
    });

    test('first-run setup', async ({ page }) => {
      await page.goto('/register');
      await page.getByLabel('What should we call you?').fill('Test Person');
      await page.getByLabel('Email').fill(`setup-${theme}@example.com`);
      await page.getByLabel('Password', { exact: true }).fill('correct-horse-battery');
      await page.getByRole('button', { name: /Create/ }).click();
      await page.waitForURL('**/app/welcome');
      await settle(page);
      expect(await axeViolations(page)).toEqual([]);
    });
  });
}
