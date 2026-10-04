# NOVA — UI Design System ("Signal")

> Status: **Phase 0 specification.** It is implemented as `frontend/src/styles/tokens.css` plus the `components/ui` library in Phase 1. A rendered reference mockup (landing hero plus dashboard, light and dark) accompanies this document. Wherever it differs from this spec, **this document wins**.

## 1. Design intent

NOVA is a **command center for one person's week**. The UI should feel calm, precise and fast, closer to a well-made instrument than a colourful student app.

| We are | We are not |
|---|---|
| Answer-first: a sentence or number, then detail | A wall of equal-weight cards |
| Time-shaped: the day and the week are the spine | A list of unrelated widgets |
| Colour-as-meaning: 3 domain hues, used consistently | Decorative gradients everywhere |
| Quietly technical: mono numerals, keyboard-first | A terminal cosplay |
| Dense where scanning, spacious where deciding | Uniformly airy or uniformly cramped |

**Signature elements (what makes NOVA recognisable):**

1. **The Brief:** a one-line, data-generated sentence at the top of Home, e.g. "3 things need you today. Next up: Database Systems at 11:00."
2. **The Today strip:** a horizontal time axis (fitted to the day's first and last item, default 08:00–18:00) with classes as blocks, due times as ticks, and a live **now line**.
3. **The Load bar:** a 7-day bar showing deadlines, exams and class hours per day, so you can see Wednesday is heavy without reading anything.
4. **The Tri-mark:** the logo is three points, one per domain (Academics · Planner · Developer), arranged as a small constellation. The same three hues carry through the product.

## 2. Colour

Tokens are CSS custom properties, exposed to Tailwind v4 via `@theme`. **Components reference semantic tokens only, never raw hex.**

### 2.1 Neutrals (slightly cool, biased toward the Academics blue)

| Token | Light | Dark | Use |
|---|---|---|---|
| `--bg` | `#F4F6FA` | `#0C1019` | App canvas |
| `--surface` | `#FFFFFF` | `#131926` | Panels, sidebar |
| `--surface-2` | `#EEF1F6` | `#1A2131` | Hover, inset areas, table headers |
| `--surface-3` | `#E4E8F0` | `#222A3D` | Pressed / selected |
| `--line` | `#E1E5EE` | `#252D40` | Hairlines, dividers |
| `--line-strong` | `#C9CFDC` | `#34405A` | Input borders |
| `--ink` | `#111522` | `#E9ECF4` | Primary text (≥ 15:1) |
| `--ink-2` | `#4A5266` | `#A9B1C6` | Secondary text (≥ 7:1) |
| `--ink-3` | `#626A7F` | `#7F89A3` | Tertiary, placeholders (≥ 4.5:1 on surface) |
| `--primary` | `#111522` | `#E9ECF4` | Primary button fill (ink-on-light / light-on-dark) |
| `--on-primary` | `#FFFFFF` | `#0C1019` | Text on primary |

**Dark mode is designed, not inverted.**

- The base is ink-blue (`#0C1019`), never `#000`, to reduce halation.
- Elevation goes **lighter** as surfaces rise (bg → surface → surface-2), instead of relying on shadows.
- Domain hues are stepped separately for the dark surface (see below).
- Text is `#E9ECF4`, not pure white.

### 2.2 Domain hues (categorical: identity, never status)

These were validated with a CVD/contrast checker as a 3-colour set, **all pairs**, in both modes. Deutan ΔE ≥ 9.2, normal-vision ΔE ≥ 20.9.

| Domain | Token | Light | Dark | Text-safe variant (≥ 4.5:1) light / dark |
|---|---|---|---|---|
| Academics | `--academics` | `#2A78D6` | `#3987E5` | `#1D5FB2` / `#7FB2F5` |
| Planner | `--planner` | `#EB6834` | `#D95926` | `#B34217` / `#F59A74` |
| Developer | `--developer` | `#1BAF7A` | `#199E70` | `#0B7A55` / `#5ED3A6` |

Each hue also has a **tint** for backgrounds, a 12% mix into the surface: `--academics-tint: color-mix(in oklch, var(--academics) 12%, var(--surface))`.

**Rules:**

- Coloured text always uses the text-safe variant.
- Developer green in light mode is 2.8:1 against white, below 3:1. Every Developer-coloured mark therefore also carries a visible text label (the "relief" rule), which NOVA does anyway.

### 2.3 Status (reserved; always icon + label, never colour alone)

| Token | Light | Dark | Icon |
|---|---|---|---|
| `--critical` | `#C8283C` | `#FF6B7D` | `alert-octagon` (overdue, below attendance target) |
| `--warning` | `#8A5E00` (text) / `#F2B233` (fill) | `#F5C451` | `alert-triangle` (at risk, due < 24h) |
| `--good` | `#1F7A3F` | `#5CCB85` | `check-circle` (safe, completed) |
| `--info` | `--ink-2` | `--ink-2` | `info` |

Status and domain can look similar (Planner orange vs warning amber, Developer green vs good). They're kept apart **by form**: status always appears as an icon + label chip or a 3px severity stripe on a list row, and never as a calendar fill.

### 2.4 Focus and selection

- `--focus`: `#2A78D6` light / `#7FB2F5` dark. The ring is 2px, offset 2px, `:focus-visible` only.
- `::selection` uses the academics tint.

## 3. Typography

| Role | Family | Why |
|---|---|---|
| Display (page titles, hero, landing) | **Bricolage Grotesque** (variable, opsz 12–96, wt 500–700) | Characterful grotesque with optical sizing. It gives NOVA a voice without being playful. Used sparingly. |
| UI / body | **Instrument Sans** (variable, 400–600) | Clean, slightly condensed and very legible at 13–15px. Avoids the everywhere-Inter look. |
| Data / mono | **JetBrains Mono** (400–600, tabular) | Numbers, times, course codes, percentages, keyboard hints. Tabular figures keep columns aligned. |

All three are SIL OFL fonts, **self-hosted via `@fontsource`** (no runtime Google request, better privacy and offline support), with `font-display: swap` and system fallbacks:

- Instrument Sans falls back to `ui-sans-serif, system-ui, "Segoe UI", Roboto, sans-serif`.
- JetBrains Mono falls back to `ui-monospace, "SF Mono", Consolas, monospace`.

**Type scale** (rem, with 1rem = 16px; app density uses 14px body):

| Token | Size / line-height | Weight | Family | Use |
|---|---|---|---|---|
| `display-xl` | 64 / 68 (clamp 40→64) | 650 | Display | Landing hero only |
| `display` | 36 / 42 | 650 | Display | Landing section heads |
| `title` | 24 / 30 | 600 | Display | Page title ("Academics") |
| `heading` | 17 / 24 | 600 | UI | Panel heading |
| `body` | 14 / 21 | 400 | UI | Default app text |
| `body-lg` | 16 / 25 | 400 | UI | Landing body, dialogs, onboarding |
| `label` | 12 / 16 | 550, +0.04em, uppercase | UI | Eyebrows, table headers |
| `caption` | 12 / 16 | 400 | UI | Meta text |
| `metric-xl` | 40 / 44 | 500 | Mono | Hero number (CGPA, days-to-exam) |
| `metric` | 22 / 28 | 500 | Mono | Panel numbers |
| `mono` | 13 / 20 | 450 | Mono | Times, codes, inline numbers |

**Rules:**

- Keep line length ≤ 70ch for prose.
- Headings get `text-wrap: balance`.
- All numbers that update or align use `font-variant-numeric: tabular-nums`.

## 4. Space, size, radius, elevation

- **Spacing:** a 4px base. The allowed steps are `0, 2, 4, 6, 8, 12, 16, 20, 24, 32, 40, 48, 64, 96`. The gap *between* sibling groups is always larger than the padding *inside* them (the proximity principle).
- **Density:**
  - Rows are 40px (compact tables use 36px).
  - Controls are 36px tall (32px small, 44px on touch).
  - Hit targets are ≥ 44×44 on touch devices.
- **Radius:**

  | Token | Size | Use |
  |---|---|---|
  | `--r-xs` | 4px | Badges, bar ends |
  | `--r-sm` | 6px | Inputs, buttons |
  | `--r-md` | 10px | Panels, popovers |
  | `--r-lg` | 14px | Dialogs, sheets |
  | `--r-full` | — | Avatars, progress rings |

  Radii are deliberately small, for a technical, precise feel.
- **Elevation:** panels have **no shadow**; a 1px `--line` border separates them. Shadows are used only for floating layers:

  | Token | Value |
  |---|---|
  | `--shadow-pop` (popover, menu) | `0 8px 24px -8px rgb(17 21 34 / .18), 0 0 0 1px var(--line)` |
  | `--shadow-dialog` | `0 24px 64px -16px rgb(17 21 34 / .28)` |

  In dark mode, shadows are near-invisible, so floating layers use `--surface-2` plus a `--line-strong` border.

## 5. Layout and breakpoints

| Breakpoint | Width | Shell |
|---|---|---|
| `sm` | < 640 | Top bar (logo · search · bell) + **bottom tab bar** (Home, Planner, Academics, Developer, More) with a raised centre **+** for quick add. Single column. Dialogs become full-height sheets. |
| `md` | 640–1023 | As `sm`, but content uses 2 columns where useful |
| `lg` | 1024–1279 | **Icon rail** (64px) with tooltips, plus a top bar |
| `xl` | ≥ 1280 | **Expanded sidebar** (232px) with section groups, and a 12-column content grid (max 1360px, 24px gutters) |

**Home layout (xl):**

```
┌ Brief ─────────────────────────────────────────────────────────────┬ Quick add ┐
│ "Saturday 26 Sep · 3 things need you today"                        │           │
├ Today strip (8 col) ───────────────────────────────┬ Needs attention (4 col) ───┤
│ 07 ─── 09 [DS] ── 11 [DBMS] ── 14 ▲Java due ── now│ ▌Database assignment · 1d │
│                                                    │ ▌Compilers attendance     │
├ Academics (4) ──────────┬ Planner (4) ──────────────┼ Developer (4) ─────────────┤
│ CGPA 8.62 · GPA 8.40    │ 2/5 today · week 11/15    │ 7 contributions this week │
│ lowest att. 76% Comp.   │ streak 4 days             │ 2 active · Spring Boot 64%│
├ Next 7 days: Load bar + deadline list (8) ─────────┴ Exams countdown (4) ───────┤
└─────────────────────────────────────────────────────────────────────────────────┘
```

**Hierarchy:**

- The **Brief** and **Today strip** are primary (largest type, top-left).
- **Needs attention** is the action queue.
- The three domain panels are secondary summaries: no borders, just tinted headers carrying the domain dot. They're each **one row tall** to avoid the wall-of-cards effect.
- The week sits at the bottom.

**Tablet / mobile adaptation (not shrinking):**

- The Today strip becomes a **vertical agenda list**.
- Needs attention moves **above** the agenda (action first on small screens).
- The three domain summaries become a horizontally scrollable row of compact stat chips.
- The Load bar stays, since 7 bars fit at 360px.

## 6. Components

All interactive primitives wrap Radix (Dialog, Popover, DropdownMenu, Tabs, Tooltip, Switch, Checkbox, Select), so keyboard and ARIA behaviour come built-in. Each spec lists variants → sizes → states.

| Component | Spec |
|---|---|
| **Button** | Variants: `primary` (ink fill), `secondary` (surface + line-strong border), `ghost`, `danger` (critical text; fill only in destructive confirm dialogs). Sizes `sm 32` / `md 36` / `lg 44`. States: hover (surface-2 / 8% lighten), active (translateY 0.5px), disabled (40% opacity, `aria-disabled`), loading (inline spinner, width locked). An icon-only button **requires** `aria-label`. |
| **Input / Textarea / Select** | 36px, `--r-sm`, line-strong border. Focus: border `--focus` + ring. Label above (never placeholder-as-label). Helper text below in ink-3. Errors: critical text + icon, `aria-describedby`, `aria-invalid`. |
| **Date / time picker** | Popover calendar (Radix Popover + our grid). Keyboard: arrows, PageUp/Down, Enter. Natural shortcuts in the text field: `tomorrow`, `fri`, `+3d`. |
| **Panel** (card) | Surface, 1px line, `--r-md`, 20px padding. A header row holds an optional domain dot, the heading and a trailing action (ghost button, "View all →"). **No shadow.** |
| **Stat** | `label` + `metric` + optional delta or caption. Values from GitHub carry a small "GitHub" source tag; NOVA-derived values carry an ⓘ with the formula in a tooltip. |
| **Badge / Chip** | 20px, `--r-xs`, 12px label. Kinds: domain (tint bg + text-safe hue), status (icon + label), neutral. |
| **Progress bar** | 6px track (surface-3), fill in the domain hue, 4px rounded end, percentage in mono to the right. `role="progressbar"` with `aria-valuenow`. |
| **Progress ring** | Learning goals and exam prep. 44px/64px, 5px stroke; the centre holds a mono %. The same ARIA as the bar. |
| **Table** | Header uses `label` style on surface-2; rows 40px with hairline separators; row hover surface-2; numeric columns right-aligned tabular. At `< md`, it collapses to a **stacked list** (key fields only), not horizontal scroll. |
| **Dialog / Sheet** | Radix Dialog; `--r-lg`, max-width 520px; focus trapped; Esc closes; the primary action is on the right. On `< md` it's a bottom sheet with a drag handle. Destructive actions require the name typed only for semester deletion (it cascades); otherwise a simple confirm. |
| **Dropdown / Menu** | `--shadow-pop`; 32px items; shortcuts shown in mono on the right. |
| **Tabs / Segmented** | Underline tabs for page sections; a segmented control for views (Today · Upcoming · Done; Day · Week · Month). |
| **Navigation** | Sidebar groups use `label`-style section titles. Active item: surface-3 background plus a 2px domain-coloured left edge, with `aria-current="page"`. |
| **Command palette (⌘K / Ctrl K)** | cmdk. Groups: Actions ("New assignment…"), Navigate, Results (from `/search`). Recent items shown when empty. Opens under 50ms (no network until 2 characters typed). |
| **Toast** | Bottom-right (bottom-centre on mobile), 4s, with an **Undo** for deletes and completes. Announced via `aria-live="polite"`. |
| **Notification panel** | Popover from the bell; unread dot; "Mark all read"; each item links to its source. |
| **Today strip** | SVG/HTML hybrid. Blocks are positioned by one time scale. The now line uses `--ink` with a 6px dot. Items are focusable; the tooltip shows the full title, time and location. A screen-reader alternative: a visually hidden ordered list of the same items. |
| **Load bar** | 7 columns: stacked **deadlines** (planner hue), **exams** (academics hue), and a thin **class-hours** baseline. A 2px surface gap separates segments. The day label and count are below; today is outlined. Its `aria-label` summarises: "Wednesday: 3 deadlines, 1 exam". |
| **Charts (Insights, GitHub)** | Recharts wrappers: 2px lines, bars with 4px rounded data ends anchored at the baseline, a recessive grid (line colour at 60%), axis labels in ink-3, hover crosshair + tooltip, and a legend when there are ≥ 2 series. **One y-axis only.** Every chart has a "View as table" toggle. Phase 5c's two Insights charts are small hand-rolled SVG bar charts (`features/insights/DayBars.tsx`) to the same spec; Recharts comes in only when a chart needs more than that. |

## 7. States (every data view implements all four)

| State | Pattern |
|---|---|
| **Loading** | Skeletons that match the final layout (text lines, 36px rows, ring placeholders) with a subtle shimmer (disabled with reduced motion). Show them after 150ms to avoid a flash on fast responses. Spinners are only for button-level actions. |
| **Empty** | An icon-free, typographic empty state: a heading, one sentence, a primary action, and an optional secondary "Learn how" link. The copy is specific to each area (see §9). |
| **Error** | Inline in the panel: "We couldn't load your GitHub activity." / "Check your connection and try again." [Retry]. Never a raw status code. `requestId` is shown in small mono for bug reports. |
| **Stale** (GitHub) | Data stays visible with a caption, "Last updated 3h ago · GitHub is rate-limiting us; we'll retry at 14:20." |
| **Partial** | The dashboard never blocks on one failing section; each panel handles its own error. |

## 8. Motion

| Token | Duration | Easing | Use |
|---|---|---|---|
| `--dur-1` | 120ms | `cubic-bezier(.2,0,0,1)` | Hover, press, toggles |
| `--dur-2` | 180ms | same | Popovers, tabs, list insert |
| `--dur-3` | 260ms | `cubic-bezier(.2,.8,.2,1)` | Dialogs, sheets, page enter (fade + 6px rise) |
| Progress | 600ms | ease-out | Bars and rings animate from their previous value, never from 0 on every render |

- **Completing a task:** the checkbox fills, the title is struck through over 180ms, then the row collapses. Undo is available in a toast.
- **`prefers-reduced-motion: reduce`:** durations drop to 0 except opacity fades (≤ 120ms); no shimmer, no rise, no number counting.

## 9. Voice and microcopy

- Plain, second person, short. Conclusions before data.
- **Empty-state examples:**

  | Area | Heading / sentence | Action |
  |---|---|---|
  | Projects | "Your first project starts here." / "Track what you're building, from idea to shipped." | [Add project] |
  | Assignments | "Nothing due yet. Enjoy the breathing room." | [Add assignment] |
  | Attendance, no target | "Set your attendance target to see how many classes you can miss." | [Set target] |
  | GitHub | "Connect GitHub to see your activity next to your coursework." | [Add username] |
  | Insights, too little data | "Insights appear once NOVA has a week of your data." | — |

- **Numbers:**
  - Percentages have 1 decimal place in detail views and are whole numbers in summaries.
  - GPA always has 2 decimals.
  - Relative dates for ≤ 7 days ("in 3 days", "tomorrow 23:59"), absolute after that ("Sat 18 Oct").

## 10. Accessibility checklist (the Phase 6 gate)

- [ ] Semantic landmarks (`header`, `nav`, `main`), one `h1` per page, logical heading order
- [ ] Full keyboard operation; a visible `:focus-visible` ring; skip-to-content link
- [ ] Contrast: text ≥ 4.5:1, large text/UI ≥ 3:1, in **both themes**
- [ ] Colour never carries meaning alone (icons, labels, patterns)
- [ ] Forms: labels, `aria-describedby` errors, error summary on submit
- [ ] Charts: text summaries plus a table view
- [ ] `aria-live` for toasts and async results; `aria-busy` on loading regions
- [ ] Reduced motion honoured; no content depends on hover alone (touch)
- [ ] Automated axe checks in tests plus a manual screen-reader pass (NVDA/VoiceOver) on Home, Attendance and Tasks

## 11. Theme implementation

- Tokens are defined on `:root` (light), `:root[data-theme="dark"]`, and `@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) }` for System.
- The preference is stored in `user_settings.theme` (so it syncs across devices) **and** mirrored to `localStorage`. A tiny inline script in `index.html` applies it before first paint, which prevents a flash of the wrong theme.

## 12. Landing page structure

1. **Nav:** Tri-mark + "NOVA", Features, Open source (GitHub link), Log in, [Get started].
2. **Hero:** "Your student life, organized in one place." Sub: "NOVA brings your classes, deadlines, grades and developer growth into one calm dashboard, so every morning starts with a clear answer to *what now?*" CTAs: [Get started, free] and [See how it works]. On the right, a live-looking **product preview** (the real Home component rendered with demo data, not a screenshot image, so it stays in sync).
3. **Three pillars** (each with a small real component preview):
   - Academic: "Know where you stand." (attendance "can miss 3" + CGPA)
   - Productivity: "Know what to do next." (Today strip + Needs attention)
   - Developer Growth: "Know what you're building toward." (learning ring + GitHub week)
4. **How it connects:** one example showing a cross-domain insight.
5. **Built in the open:** stack badges, MIT licence, a link to the repo, a "Contribute" CTA.
6. **Footer:** GitHub, docs, security policy, licence.
