# Performance

Phase 6d measured what NOVA's frontend costs to load, trimmed what was easy, and put a size budget
in CI so it can't quietly grow. NOVA is a client-rendered single-page app: until its JavaScript
runs, the page is blank, so the amount of JavaScript on each first visit is what matters most.

## What a first visit downloads

Measured on the production build (`npm run build`), gzip, by `npm run size`
(`frontend/scripts/bundle-size.mjs`). It follows the build manifest from each starting point
through every chunk that must load before the screen can show, CSS included.

| First visit | JS | CSS |
|---|---|---|
| Landing page (`/`) | 150.3 kB | 13.1 kB |
| Log in (`/login`) | 189.5 kB | 13.1 kB |
| Home after logging in (`/app`) | 245.3 kB | 13.1 kB |

The largest single chunk is React itself (65.8 kB). Every other page is its own small chunk
(1–5 kB) loaded when you open it.

## The budget (enforced in CI)

`frontend/bundle-budget.json` holds the limits: today's sizes plus 10% headroom, for each first
visit and for the largest chunk. CI runs `npm run size` after the build and **fails if any number
goes over**. If growth is deliberate (a new feature that's worth it), run
`npm run build && npm run size -- --update` and commit the new budget, so the decision shows up in
review.

## What changed in 6d

| Change | Why |
|---|---|
| Libraries in their own chunks: `react`, `router`, `query` (TanStack), `forms` (Zod + React Hook Form) | They change far less often than NOVA's own code, so after a deploy returning visitors keep them cached instead of downloading React again |
| The tooltip provider moved from the app root into the app shell | Tooltips only appear in the sidebar, so the landing and login pages no longer load Radix Tooltip |
| The log-in and sign-up pages fetch the app's code (shell, Home, and setup after sign-up) once the browser is idle | Most visits to those pages end in the app, which now appears straight after logging in instead of waiting for its code; it starts only after the page has loaded, so it doesn't compete with it |
| A `robots.txt` (index the public pages, not `/app`) | Without it the preview server answered `/robots.txt` with the app's HTML, which search engines read as an invalid file |

## Lighthouse

Lighthouse 12, mobile preset (simulated slow 4G and a slower CPU), against `vite preview` of the
production build. Only the public pages can be measured this way, since the app needs the backend.
Scores move by a few points between runs, so these are ranges over several runs.

| Page | Performance | Accessibility | Best practices | SEO |
|---|---|---|---|---|
| Landing (`/`) | 95–96 | 100 | 100 | 100 |
| Log in (`/login`) | 86–92 | 100 | 100 | 100 |

Landing: first and largest paint ≈ 2.3 s, total blocking time ≤ 40 ms, layout shift ≈ 0.
Log in is a little slower because its form code (Zod and React Hook Form, 37 kB) loads after the
app's entry, one step later. Making it load with the entry would slow the landing page instead,
which more people see; the trade-off is noted here rather than hidden.

### Re-running it

```bash
cd frontend
npm run build && npx vite preview --port 4173
# in another terminal
npx lighthouse http://localhost:4173/ --only-categories=performance,accessibility,best-practices,seo --view
```
