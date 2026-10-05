# Accessibility audit

NOVA targets **WCAG 2.2 level AA** (docs/ui-design.md). This page records how that is checked, what
the Phase 6 audit found, and what changed. It is updated with each Phase 6 slice.

## How it's checked

| Layer | Tool | What it covers | Runs |
|---|---|---|---|
| Lint | eslint-plugin-jsx-a11y | Missing labels, invalid ARIA, non-interactive handlers, in the source | `npm run lint`, CI |
| Component tests | axe-core in Vitest (jsdom) | Serious and critical axe rules for each page and dialog in its tested states. Colour contrast is off here because jsdom computes no styles | `npm test`, CI |
| Browser audit | axe-core in Playwright (Chromium) | **Every** rule tagged WCAG 2.0/2.1/2.2 A and AA, **colour contrast included**, on every page and the main overlays, in light and dark, at desktop and phone width | `npm run e2e`, CI |

The browser audit (`frontend/e2e/a11y.spec.ts`) runs against `npm run dev:mock`, so it needs no
backend, and uses the demo account's data so pages are full rather than empty. It covers:

- public pages: landing, log in, register, not found;
- all 28 in-app pages and views, including one of each detail page;
- overlays: the ⌘K search palette, the notifications menu, the account menu, the new-task dialog;
- phone width (390 px): Home, timetable, attendance, calendar week and month, internships, insights,
  and the "More" sheet;
- first-run setup for a new account.

Any violation fails the run and lists the page and the elements.

Phase 6b adds three more browser suites:

| Suite | Checks |
|---|---|
| `e2e/responsive.spec.ts` | Every page at **320**, 768 and 1280 CSS px has no sideways scrolling (WCAG 1.4.10 Reflow); search, the notifications menu and a form dialog fit inside a 320 px screen |
| `e2e/keyboard.spec.ts` | Tabbing through every page, **every stop shows a focus indicator** (2.4.7) and is visible; the skip link is the first stop and moves focus to the content; Ctrl+K search works from the keyboard; dialogs start in their first field, keep focus inside, close on Escape and **return focus to what opened them**; top-bar menus open, move and close from the keyboard |
| `e2e/smoke.spec.ts` | The everyday paths end to end: log in and out, add a task and tick it off, mark a class, find a course with search, read a notification, review the week in Insights |

## Phase 6a findings and fixes

| Finding | Where | Fix |
|---|---|---|
| Colour contrast 2.3:1 (light) / 3.1:1 (dark) on finished blocks, which were faded with `opacity-55` | Home's Today strip and the landing page's example of it | Finished blocks switch to the neutral surface and secondary ink instead of fading; they still read as "done" and now pass 4.5:1 |
| Colour contrast 2.5:1 (light) / 3.5:1 (dark) on finished tasks, faded with `opacity-60` | Calendar week and month | Same: neutral tone plus the strike-through, no opacity |
| Target size: month-view chips 21 px and "+N more" 17 px tall (WCAG 2.2 §2.5.8 asks for 24 px) | Calendar month view | Both are at least 24 px tall |
| `aria-hidden-focus`: while the notifications menu was open, the rest of the page was hidden from assistive tech but still focusable | Top bar menus (notifications, account, theme) | The menus are non-modal (`modal={false}`), like a popover: the page stays exposed, Escape and clicking outside still close them, and focus returns to the button |

| Colour contrast on the "Safe" attendance badge at phone width, found on Windows (newer Chromium) but not in the Linux run: green text on its green tint was 4.61:1, just above 4.5, so a browser's `color-mix` rounding could tip it under | Status and domain badges | The three closest tokens were darkened in light mode: `--good` #1f7a3f → #1a6c37, `--critical` #c8283c → #b8233a, `--developer-text` #0b7a55 → #096c4b. Every coloured text on its tint is now at least 5:1 in both themes, and a new check fails if any pair drops under 5:1, whatever data a page shows |

### Phase 6b

| Finding | Where | Fix |
|---|---|---|
| Sideways scrolling at 320 px (8–28 px): a page grid grew to the width of its widest content (a long time-zone option, a card) | Settings, Projects | Page grids use `grid-cols-1` (a `minmax(0, 1fr)` track) on every page, so content wraps instead |
| Sideways scrolling at 320 px: a panel's action buttons didn't wrap | Exam and learning-goal pages ("Plan…", "Add study task") | Panel actions wrap and align right |
| No visible focus indicator | Account button in the top bar (`outline-none`) | Shows the focus ring like every other control |
| Focus lost to the page body when a dialog closed | Every dialog (they open from state, not a Radix trigger, so Radix had nowhere to return focus) | Dialogs remember what had focus when they opened and return it on close; if that element is gone (e.g. a menu that closed), focus goes to the main content |
| Form dialogs started on the Close button | Every form dialog | Focus starts in the first field, so you can type straight away; dialogs without fields keep Radix's default |

**Making the checks reliable on slower machines.** The first Windows run had three failures that weren't app bugs: axe measured contrast on the grading schemes page while the page was still fading in (half-transparent text reads as low contrast), and two smoke tests gave up after Playwright's default 5 s. The suite now waits for enter animations to finish before measuring, allows 15 s for each expectation and 3 minutes per test, and the notification smoke test closes the task dialog a task notification opens before checking the bell.

After the fixes the browser audit reports **no violations** on any page, overlay or width, in either
theme. Lighthouse follows in 6d.
