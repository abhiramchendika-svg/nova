# NOVA — Architecture & Product Blueprint

> Status: **Phase 0 (design, not implemented).** Everything here is a plan. Nothing in this document has been built or verified yet.
>
> Companion documents: [database.md](./database.md) · [api.md](./api.md) · [ui-design.md](./ui-design.md)

---

## 1. Product vision

**NOVA answers one question each day: "What do I need to know and do today to stay academically and professionally on track?"**

Today, an engineering student keeps this information in five or more places:

| Need | Where it lives today | Problem |
|---|---|---|
| Timetable, attendance | University portal, a photo of the timetable | Read-only, and it can't answer "can I skip Friday?" |
| Assignments, exams | WhatsApp groups, LMS, memory | Scattered, with no single view of the workload |
| Tasks | Todoist, Notion, sticky notes | Doesn't know about semesters or courses |
| GPA | Spreadsheet, or nothing | Manual and error-prone, with no what-if |
| Projects, hackathons, internships, GitHub | Notion, spreadsheets, GitHub profile | Disconnected from the academic calendar |

General planners such as Todoist and Google Calendar lack academic structure: semesters, class recurrence, credits. Student planners such as MyStudyLife cover academics but ignore professional growth. Notion can do everything, but only after hours of manual setup.

**NOVA's differentiator: academics, planning and developer growth share one data model.** That makes cross-domain answers possible that no single-purpose tool can give, for example:

- "Your DBMS exam is in 9 days, and you also have a hackathon that weekend."
- "Attendance in Compilers is at 76% against your 75% target: you can miss 1 more class."
- "3 of your 5 deadlines this week fall on Wednesday."

**Product principles**

1. **Answer, don't just display.** Every screen leads with a conclusion ("You can miss 2 more classes") before the raw data.
2. **Traceable numbers.** Every computed metric can show how it was calculated, and API data is labelled as such. NOVA never invents numbers.
3. **Configurable, not assumed.** Grading scales, attendance thresholds, week start and timezone all belong to the user.
4. **Fast capture.** Adding an assignment should take under 10 seconds (quick add or ⌘K).
5. **Calm by default.** Show urgency where it's earned and stay quiet otherwise.

## 2. Target users

| Persona | Description | Primary jobs |
|---|---|---|
| **Primary: the builder-student** | 2nd–4th year B.Tech CS/IT student who codes outside class, does hackathons, and applies for internships | Keep grades and attendance safe while shipping projects and landing an internship |
| **Secondary: the focused academic** | Student mainly concerned with GPA, attendance and exams | Know where they stand and what's due |
| **Tertiary: the open-source contributor / self-hoster** | A developer who runs NOVA or contributes to it | Clean setup and a readable codebase |

**Out of scope:** faculty, admins, institutions. NOVA is a personal tool, not a college ERP. This keeps authorization simple (every row belongs to one user) and keeps the product personal.

## 3. User journeys

**J1 — First run (≤ 3 min).** Land on the homepage → Sign up → Onboarding: Welcome → Academic setup (university name, current semester, pick a grading preset or build one) → Courses (add 3–6 quickly: code, name, credits) → Timetable (tap a grid to place classes; skippable) → Goals (one learning goal; skippable) → Developer (GitHub username; skippable) → Dashboard, already populated with their data and a clear "next step" card for anything skipped.

**J2 — Morning check (≤ 30 s).** Open NOVA → the Dashboard brief says "3 things need you today" → scan the Today timeline (classes and scheduled tasks) → check "Needs attention" → start the first task.

**J3 — Capture an assignment (≤ 10 s).** Press `N` or ⌘K → "New assignment" → type title, pick course, set due date → saved. It appears on the dashboard, the calendar and the course page.

**J4 — "Can I skip tomorrow's class?"** Attendance → course row shows 81% (target 75%): "You can miss 2 more classes." → after marking an absence, the projection updates immediately.

**J5 — End of semester.** Grades → enter final grades → semester GPA and CGPA update → try "what-if" grades for the current semester.

**J6 — Internship season.** Developer → Internships → add application → move it through Applied → Assessment → Interview → header analytics show response rate this month.

**J7 — Weekly review (Sunday).** Insights → "You completed 18 of 22 planned tasks (82%)" · "Wednesday holds 3 of 5 deadlines next week" · "GitHub contributions: 41 this month vs 23 last month" → adjust the plan.

## 4. MVP definition

The MVP is **phases 1–5**: a coherent, useful product without AI.

| In MVP | Deferred |
|---|---|
| Email/password accounts with sessions | Password reset by email, social login, 2FA |
| Semesters, courses, configurable grading, GPA/CGPA, what-if | Transcript PDF import |
| Attendance (baseline plus per-class records), projections | Automatic sync with the university portal (no public APIs; scraping is fragile and may break terms of use) |
| Assignments, exams with topic checklist | File attachments |
| Tasks with simple recurrence (daily / weekdays / weekly) | Full RRULE recurrence, subtasks |
| Timetable plus unified calendar (read and drag-free) | Drag-to-reschedule, Google Calendar sync |
| Projects, learning goals, hackathons, internships | Public portfolio page |
| GitHub: public profile by username, plus optional OAuth connect | GitHub App, webhooks |
| Insights (rule-based, traceable) | AI features (Phase 8, needs approval) |
| In-app notifications (generated on schedule) | Email / push delivery |
| ⌘K command palette plus global search | Full-text ranking |
| Light/dark/system theme, responsive, accessible | Native mobile app |

## 5. Future roadmap (post-MVP, not committed)

1. Public read-only **portfolio page** (`nova.app/u/abhi`) generated from projects, hackathons and GitHub, with explicit opt-in per item.
2. **ICS export** of the calendar, so NOVA shows up in Google or Apple Calendar.
3. Email and browser-push notification channels (the architecture is already prepared, see §9.6).
4. Drag-to-reschedule calendar and time-blocking for tasks.
5. Phase 8 AI features, only after the core is stable and you approve: academic planner, natural-language questions over NOVA data.
6. Import helpers such as CSV import for courses and grades.

## 6. UI/UX direction (summary; the full spec is in ui-design.md)

**Research takeaways** (sources are at the end of this document):

- High-performing SaaS dashboards put the most important "north star" item top-left, favour **action-oriented** widgets over passive reporting, and use collapsible left sidebars for multi-module tools.
- Charts should be readable without hovering, using proven chart types (bar, line, progress) and no decorative charts.
- Existing student apps split into two camps: academic structure without growth (MyStudyLife) or flexibility with heavy setup (Notion). NOVA should feel structured on day one.
- Dark mode is expected in developer tools.

**NOVA's design language, "Signal":**

- **Answer-first typography.** Every panel opens with a short sentence or one big number, then the details.
- **Three domain hues** that stay consistent everywhere: Academics = *Indigo*, Planner = *Amber*, Developer = *Mint*, plus one brand accent, *Flare* (coral). In the calendar, the colour tells you the domain at a glance.
- **The time axis is the spine.** The dashboard's hero is a *Today strip*: a horizontal timeline with a live "now" marker. Deadlines use a 7-day **load bar** that shows workload per day.
- **Mono numerals.** Metrics, times and course codes use a monospace face with tabular figures, which gives a quiet developer feel without looking like a terminal.
- **Hairlines, not heavy cards.** Surfaces are separated by 1px lines and spacing, and shadows are reserved for floating layers. This avoids the "wall of cards" look.
- Dark mode is **designed separately**: an ink-blue base (not pure black) with raised surfaces lighter than the base, and domain hues re-tuned for contrast.

## 7. Design system (summary)

Full tokens are in [ui-design.md](./ui-design.md): colour (OKLCH, semantic tokens, both themes), type scale, 4-px spacing, radius, elevation, motion, breakpoints, and component specs (buttons, inputs, cards, badges, tables, charts, dialogs, navigation, empty/loading/error states). **Tokens are the single source of truth:** they are defined once as CSS custom properties and exposed to Tailwind v4 via `@theme`, and no component uses raw hex values.

## 8. Information architecture

I changed your suggested navigation in three places:

| Change | Why |
|---|---|
| **"Planner → Today" is merged into the Dashboard ("Home")** | Having both a dashboard and a Today page means two screens compete to answer the same question. Home becomes *the* Today view, and Planner focuses on managing tasks and time. |
| **"Timetable" moves to Academics; "Calendar" becomes Planner's single time view (Day / Week / Month)** | The timetable is academic *setup* (recurring class slots); the calendar is where you *see* all time-bound items. Keeping a separate Timetable view in Planner would duplicate the calendar's week view. |
| **"GPA / CGPA" is renamed "Grades"** | It covers grades, the grading scheme and what-if, which is more than two numbers. |

```
Home (Dashboard)                      /app
Academics                             /app/academics          ← overview: semester, GPA, attendance summary
  ├─ Courses                          /app/academics/courses[/:id]
  ├─ Assignments                      /app/academics/assignments
  ├─ Exams                            /app/academics/exams[/:id]
  ├─ Attendance                       /app/academics/attendance
  ├─ Grades                           /app/academics/grades
  └─ Timetable                        /app/academics/timetable
Planner
  ├─ Tasks  (Today · Upcoming · Done) /app/planner/tasks
  └─ Calendar (Day · Week · Month)    /app/planner/calendar
Developer                             /app/developer          ← overview: GitHub + projects + learning
  ├─ Projects                         /app/developer/projects[/:id]
  ├─ Learning                         /app/developer/learning[/:id]
  ├─ Hackathons                       /app/developer/hackathons
  ├─ Internships                      /app/developer/internships
  └─ GitHub                           /app/developer/github
Insights                              /app/insights
Settings                              /app/settings/{profile,academic,notifications,appearance,integrations}
```

**Global chrome:** ⌘K command palette (search plus actions), a Quick-add button (`N`), the notifications bell, and the theme toggle.

**By viewport:**

- **≥1280px:** expanded sidebar (240px).
- **1024–1279px:** icon rail (64px) with tooltips.
- **<1024px:** top bar plus a **bottom tab bar** (Home · Planner · Academics · Developer · More), a center Quick-add button, and full-screen sheets instead of dialogs.

## 9. Backend architecture

### 9.1 Style: a layered, feature-packaged modular monolith

One deployable Spring Boot application, organized **by feature** (package-by-feature) and **layered inside each feature**:

```
HTTP → Controller (DTOs, validation, HTTP status) → Service (business rules, transactions) → Repository (Spring Data JPA) → PostgreSQL
                                        ↘ Calculators (pure Java: GPA, attendance, priority, insights) — no Spring, no DB
```

- **Why a monolith?** One developer, one database, one deploy. Microservices would add network calls, distributed transactions and deploy complexity with no benefit at this scale. Being able to explain *why not microservices* is itself a good interview answer.
- **Why package-by-feature?** Everything about "attendance" lives in one folder, so a contributor can understand one feature without reading the whole codebase.
- **Pure calculators** (`GpaCalculator`, `AttendanceCalculator`, `PriorityScorer`, and the insight rules) have **no framework dependencies**. They're trivially unit-testable, which is where correctness matters most.

### 9.2 Cross-cutting concerns

| Concern | Approach |
|---|---|
| DTOs | Java `record`s for request and response. Entities are never serialized directly, which avoids leaking fields, lazy-loading exceptions and accidental mass assignment. |
| Mapping | Hand-written static mappers per feature (small, explicit and debuggable). MapStruct is optional later. |
| Validation | Jakarta Bean Validation on request DTOs (`@NotBlank`, `@Size`, `@DecimalMin`) plus service-level rules (e.g. `attended ≤ conducted`). |
| Errors | `@RestControllerAdvice` returning **RFC 9457 Problem Details** (`application/problem+json`) with a stable `code` field the frontend maps to human-readable messages. |
| Ownership / authorization | Every owned table has `user_id`. Repositories expose `findByIdAndUserId`, and anything that isn't yours returns **404, not 403**, so the API doesn't reveal that another user's record exists. |
| Time | Store instants as `timestamptz` (UTC). The user's IANA timezone lives in settings. "Today", "due tomorrow" and weekly windows are computed in the **user's** zone using an injected `Clock`, which makes them deterministic in tests. |
| Migrations | **Flyway** versioned SQL (`V1__init.sql` …) with `ddl-auto=validate`. The schema is reviewed as code, and Hibernate never alters the database. |
| API docs | springdoc-openapi generates OpenAPI 3 and Swagger UI in dev. Its compatibility with Boot 4.1 **will be verified in Phase 1**. |
| Caching | Caffeine (in-process) for GitHub responses and the dashboard aggregate (short TTL, evicted on writes). No Redis: a single instance doesn't need it. |
| Scheduling | `@Scheduled` job (hourly) generates notifications. It's idempotent via a unique `dedupe_key`. |
| Observability | Spring Boot Actuator (`/actuator/health`); structured logs; a request-id filter. |

### 9.3 Authentication (decision)

**Options considered**

| Option | Pros | Cons |
|---|---|---|
| **A. Server session with an HttpOnly cookie (Spring Security + Spring Session JDBC)** ✅ | The token is never readable by JavaScript, so XSS can't steal it. Logout and revocation are instant. Built into Spring Security. Sessions live in Postgres, so they survive restarts. | Needs CSRF protection, and cookies need same-site handling. |
| B. JWT in localStorage | Stateless and popular in tutorials | Readable by XSS, hard to revoke, and refresh-token logic adds work |
| C. JWT in an HttpOnly cookie | Fixes the XSS exposure | You still need CSRF protection *and* revocation logic, so it's the complexity of both |

**Recommendation: A.** For a first-party SPA talking to its own backend, server sessions are the simpler *and* more secure default. JWTs solve problems NOVA doesn't have (many independent services, third-party API consumers). Details:

- Passwords are hashed with **BCrypt** (Spring's `DelegatingPasswordEncoder`, strength 12).
- Session cookie: `HttpOnly; Secure; SameSite=Lax`, with a 14-day sliding expiry and a session ID rotated on login (prevents session fixation).
- **CSRF:** Spring's cookie-to-header pattern (`XSRF-TOKEN` cookie, `X-XSRF-TOKEN` header) for all state-changing requests.
- **Same-origin deployment:** the frontend host proxies `/api/*` to the backend (Vercel rewrite in prod, Vite proxy in dev). The browser therefore sees *one* origin, cookies are first-party, and CORS isn't needed in production. That avoids third-party-cookie blocking entirely. CORS is still configured (explicit allow-list, no wildcard with credentials) for local tooling.
- Login rate limiting (Bucket4j, e.g. 5 attempts per minute per IP+email) to slow down password guessing.

### 9.4 Security of GitHub tokens

See §13. OAuth tokens are **encrypted at rest** (AES-GCM, with the key taken from an environment variable), are never returned to the frontend, and are never logged.

### 9.5 Performance posture

- Dashboard: **one** `GET /api/v1/dashboard` call. The service runs a handful of targeted, indexed queries (no N+1 problems, checked with Hibernate statistics in tests) and returns a compact DTO.
- Lists that grow without bound (completed tasks, internships, notifications) are **paginated**. Bounded lists (courses in a semester) are not.
- `spring.jpa.open-in-view=false`, so lazy-loading in views can't cause hidden queries.
- Frontend code-splits per route (`React.lazy`).
- Don't optimize further until measured.

### 9.6 Notifications (extensible, not over-engineered)

```
NotificationScheduler (@Scheduled: a minute after start-up, then an hour after each run; every user, one transaction each)
  → NotificationGenerator (reads the user's data; skips types switched off)
  → NotificationRules (pure: due within 24 h, overdue the morning after, exam in ≤ 3 days, attendance got worse,
                       hackathon/apply-by deadline within 24 h, interview tomorrow)
  → NotificationStore.insertIfNew(dedupeKey)   // unique (user_id, dedupe_key) + ON CONFLICT DO NOTHING → never duplicates
  → in-app only (the bell and /app/notifications). An email or push channel would be another consumer of the same
    drafts; not built.
```

Implemented in Phase 5b. Details and the full rule table: [api.md §2.14](./api.md).

## 10. Frontend architecture

| Concern | Choice | Why |
|---|---|---|
| Build | **Vite** | Fast development server, standard React tooling |
| Framework | **React 19 + TypeScript (strict)** | As requested; strict mode catches bugs at compile time |
| Routing | **React Router** (data-router API) | Mature, widely known, enough for our needs. TanStack Router is excellent but adds learning overhead without a clear win here. |
| Server state | **TanStack Query** | Caching, deduplication, retries, background refetch, and optimistic updates where safe. This is 90% of our "state". |
| Client state | React state plus **Context** for auth/theme, and **URL search params** for filters | Filters in the URL are shareable and survive refresh. No Redux: we have no complex client-only state that justifies it. |
| Forms | **React Hook Form + Zod** | Typed schemas, accessible errors, and the same rules the server enforces |
| Styling | **Tailwind CSS v4** mapped to NOVA tokens | Utility classes on top of our own design tokens, so there's no "template look" |
| Primitives | **Radix UI** primitives (Dialog, Popover, Dropdown, Tabs, Tooltip), wrapped in NOVA components | Accessibility (focus trapping, ARIA, keyboard support) comes built-in. We style them ourselves. Inspired by the shadcn approach of owning the component code, not a dependency. |
| Charts | **Recharts** (thin wrappers), plus hand-rolled SVG for sparklines and the load bar | Declarative and good enough. Every chart also gets a text alternative. |
| Motion | **Motion** (formerly Framer Motion) for layout and presence; CSS transitions for micro-interactions | Respects `prefers-reduced-motion` |
| Command palette | **cmdk** | Accessible ⌘K palette |
| Dates | **date-fns** + `date-fns-tz` | Tree-shakeable, immutable |
| Tests | **Vitest + React Testing Library + MSW + user-event**; **Playwright** for a few end-to-end smoke flows (Phase 6/7) | MSW mocks the API at the network layer, so tests never hit a real backend or GitHub |
| Lint/format | ESLint (typescript-eslint, jsx-a11y, react-hooks) + Prettier | jsx-a11y catches accessibility mistakes early |

**Layering inside the frontend:**

```
pages/routes  →  features/<domain>/components  →  features/<domain>/api (TanStack Query hooks)  →  services/http (fetch wrapper: CSRF, errors → ProblemDetail)
                                                ↘ components/ui (design-system primitives, no domain knowledge)
```

**Rules:**

- Only `features/*/api` talks to the network.
- `components/ui` never imports from `features`.
- Components stay under about 200 lines. Split them when they grow.

## 11. Database schema

See [database.md](./database.md): 23 tables (plus Spring Session's 2), with ERD, keys, constraints, indexes, and the rationale for every table.

## 12. API architecture

See [api.md](./api.md). Summary: REST under `/api/v1`, JSON, session cookie and CSRF, RFC 9457 errors, cursor-less page/size pagination for large collections, a `GET /api/v1/dashboard` aggregate, `GET /api/v1/calendar?from&to` as a unified feed, and `GET /api/v1/search?q=`.

## 13. GitHub integration strategy

**Two modes, both explicit to the user:**

| Mode | How | What we can show | Rate limit |
|---|---|---|---|
| **Public (username only)** — default | Server calls GitHub with NOVA's own server token (`GITHUB_SERVER_TOKEN`, a fine-grained token with no scopes) or unauthenticated in local dev | Public repos, languages, stars, public events, contribution calendar via GraphQL (public contributions only) | 5,000/hr with the server token (shared across all users); 60/hr unauthenticated |
| **Connected (OAuth)** — optional | GitHub OAuth App, scope `read:user` (no `repo` scope; we don't need private code) | Adds private-contribution *counts* if the user enabled that on their GitHub profile | 5,000/hr per user |

**Data sources:**

- **GraphQL** `user.contributionsCollection(from, to)` for commit/PR/issue/review counts and the contribution calendar (one request for a year of data).
- **REST** `/users/{u}/repos?per_page=100` (paginated by following the `Link` header) for repositories and languages.

**Caching and rate limits:**

1. Results are stored in `github_snapshots` (JSON payload, `etag`, `fetched_at`).
2. Serve from the snapshot if it's younger than its TTL (profile/repos 6h, contributions 1h).
3. Otherwise refresh with a conditional request (`If-None-Match: etag`). A 304 means "still fresh", and GitHub's docs state that a 304 from a correctly authorized conditional request does not count against the primary rate limit. This applies to REST. GraphQL has no ETags, so contributions rely on the TTL alone.
4. Read the `x-ratelimit-remaining` and `x-ratelimit-reset` headers. When the limit is low or on a 403/429, **serve the stale snapshot** with a "Last updated 3h ago" label and back off until the reset time.
5. "Refresh" button: throttled to once per 5 minutes per user.

**Honesty rules (from your brief):**

- UI labels: **"From GitHub"** (raw API values such as repos, stars, contributions) vs **"NOVA metric"** (derived values, e.g. "Contributions this month vs last month +78%"), each with an info tooltip that states the formula.
- If data can't be fetched, show an error state, never zeros. Zero is a real value and would be a lie.

**Token handling:** OAuth `code` → exchanged server-side → token encrypted (AES-256-GCM, `NOVA_ENCRYPTION_KEY`) → stored in `github_accounts`. Disconnecting deletes the token and revokes it via GitHub's API. The token never reaches the browser.

**Testing:** a `GitHubClient` interface. The HTTP implementation is tested with Spring's `MockRestServiceServer` (JSON fixtures) covering pagination, 304, 403 rate-limit, 404 and 5xx; full-stack tests swap in an in-memory client. Tests never call the real GitHub. (Changed from WireMock in 4e: no extra dependency.)

**Storage (4e):** normalised tables (`github_accounts`, `github_repos`, `github_contribution_days`) rather than JSON snapshots; see database.md V13.

## 14. Testing strategy

| Layer | Tool | What | Target |
|---|---|---|---|
| Pure calculators | JUnit 5 + AssertJ, `@ParameterizedTest` | GPA/CGPA, attendance (can-miss, need-to-attend), priority score, insight rules, recurrence, deadline buckets, timezones | Exhaustive edge cases; 100% branch coverage on calculators |
| Services | JUnit + Mockito | Business rules, ownership checks, transactions | Every rule |
| Controllers | `@WebMvcTest` + MockMvc | Status codes, validation errors, JSON shape, auth required, CSRF | Every endpoint's happy path plus main errors |
| Repositories / integration | `@DataJpaTest` / `@SpringBootTest` + **Testcontainers PostgreSQL** | Custom queries, constraints, Flyway migrations on real Postgres (not H2, which behaves differently) | Custom queries plus migration smoke |
| GitHub client | MockRestServiceServer | Pagination, ETag, rate limits, errors | All failure modes |
| Frontend units | Vitest + RTL | Formatters, date bucketing, components (ProgressRing, LoadBar, EmptyState) | Critical logic |
| Frontend interactions | RTL + user-event + MSW | Quick-add, attendance projection updates, task complete (optimistic update plus rollback), form validation, ⌘K | Critical flows |
| Accessibility | jest-axe / vitest-axe on key components; Playwright + axe later | No serious violations | Key screens |
| E2E (later) | Playwright | Sign up → onboarding → dashboard | 2–3 smoke flows |

**Principles:**

- Tests use a fixed `Clock` for anything time-based.
- No test touches the network.
- CI runs everything on every PR.
- Coverage is measured with JaCoCo/Vitest coverage, reported but not gamed.

## 15. Security strategy

| Threat | Mitigation |
|---|---|
| Password theft | BCrypt(12), minimum 10 characters, check against a small list of the most common passwords; generic "invalid email or password" message |
| Brute force | Bucket4j login rate limit; account lockout is deliberately avoided (it's a DoS vector) |
| Session hijack | HttpOnly/Secure/SameSite cookies, session ID rotation, server-side invalidation on logout |
| CSRF | Spring CSRF token (cookie-to-header) |
| XSS | React escapes output by default; no `dangerouslySetInnerHTML`; strict CSP header in prod (`default-src 'self'`); URLs validated (`https?://` only) before rendering links |
| IDOR (accessing others' data) | `user_id` scoping in every repository query, plus tests that user B gets a 404 on user A's IDs |
| Mass assignment | Request DTOs contain only editable fields; entities are never bound directly |
| SQL injection | JPA parameter binding only; no string-concatenated queries |
| Secrets | `.env` (git-ignored), `.env.example` committed; GitHub secret scanning and push protection enabled; tokens encrypted at rest |
| Info leakage | Problem Details without stack traces; details logged server-side with a request ID |
| Dependencies | Dependabot (Maven + npm + Actions), CodeQL workflow |

## 16. Open-source strategy

- **License: MIT.** It's simple and permissive, the norm for portfolio projects, and maximizes reuse. (AGPL would protect against closed SaaS forks but discourages casual contributors.)
- **Contributor experience:** `docker compose up` gives Postgres; `./mvnw spring-boot:run` + `npm run dev` gives a working app with **seed data** (`dev` profile), so reviewers see a populated NOVA in 2 minutes.
- `CONTRIBUTING.md` (setup, branch naming, Conventional Commits, how to add a feature module), `CODE_OF_CONDUCT.md` (Contributor Covenant 2.1), `SECURITY.md` (private vulnerability reporting via GitHub).
- Issue forms (bug, feature, docs), PR template with checklist, labels (`good first issue`, `help wanted`, `frontend`, `backend`, `database`, `documentation`, `enhancement`, `bug`).
- **Only real issues.** As we build, genuinely deferred work (e.g. "ICS export") becomes real issues, some marked `good first issue`.
- README with a live demo link, screenshots in both themes, and an architecture diagram.

## 17. Folder structure

```
nova/
├── backend/
│   ├── pom.xml
│   ├── mvnw, .mvn/
│   └── src/
│       ├── main/java/dev/nova/
│       │   ├── NovaApplication.java
│       │   ├── common/            # error handling (ProblemDetail), Clock config, pagination, BaseEntity, validation
│       │   ├── security/          # SecurityConfig, CSRF, rate limiting, current-user resolver
│       │   ├── auth/              # register/login/logout/me
│       │   ├── user/              # User, UserSettings
│       │   ├── academics/
│       │   │   ├── grading/       # GradingScheme, GradeDefinition, GpaCalculator
│       │   │   ├── semester/
│       │   │   ├── course/
│       │   │   ├── attendance/    # AttendanceCalculator
│       │   │   ├── assignment/
│       │   │   ├── exam/
│       │   │   └── timetable/
│       │   ├── planner/
│       │   │   ├── task/          # recurrence
│       │   │   └── calendar/      # aggregates calendar items (no table)
│       │   ├── developer/
│       │   │   ├── project/
│       │   │   ├── learning/
│       │   │   ├── hackathon/
│       │   │   ├── internship/
│       │   │   └── github/        # GitHubClient, snapshots, token crypto
│       │   ├── dashboard/         # DashboardService, PriorityScorer
│       │   ├── insights/          # InsightRule implementations
│       │   ├── notification/
│       │   └── search/
│       │     (each feature: *Controller, *Service, *Repository, entity, dto/, *Mapper)
│       ├── main/resources/
│       │   ├── application.yml, application-dev.yml, application-prod.yml
│       │   └── db/migration/      # Flyway V1__...sql
│       └── test/java/dev/nova/... # mirrors main; calculators have dedicated test classes
├── frontend/
│   ├── package.json, vite.config.ts, tsconfig.json, eslint.config.js
│   ├── public/
│   └── src/
│       ├── app/                   # App.tsx, router.tsx, providers (QueryClient, Theme, Auth)
│       ├── layouts/               # MarketingLayout, AppShell (sidebar/rail/bottom-nav), OnboardingLayout
│       ├── pages/                 # thin route components that compose features
│       ├── features/
│       │   ├── auth/  onboarding/  dashboard/
│       │   ├── academics/  planner/  developer/  insights/  notifications/  search/  settings/
│       │   └── <feature>/{api/, components/, hooks/, utils/, types.ts}
│       ├── components/
│       │   ├── ui/                # Button, Input, Dialog, Card, Badge, Table, Progress, Tabs, Tooltip, DatePicker...
│       │   └── patterns/          # EmptyState, ErrorState, Skeletons, PageHeader, StatBlock, LoadBar, ProgressRing
│       ├── services/http.ts       # fetch wrapper, CSRF, ProblemDetail parsing
│       ├── hooks/                 # useMediaQuery, useHotkey, useReducedMotion
│       ├── styles/                # tokens.css, globals.css
│       ├── types/  utils/
│       └── test/                  # setup, MSW handlers, fixtures
├── docs/                          # architecture, database, api, ui-design, interview-preparation
├── docker-compose.yml             # postgres (+ optional backend) for local dev
├── .github/                       # workflows/, ISSUE_TEMPLATE/, pull_request_template.md, dependabot.yml
├── .env.example
├── README.md  CONTRIBUTING.md  CODE_OF_CONDUCT.md  SECURITY.md  LICENSE
```

**Monorepo:** one repository with `backend/` and `frontend/`. It gives one README, one issue tracker and atomic PRs across API and UI. CI jobs are filtered by path.

## 18. Development phases

| Phase | Deliverable (each one works end-to-end) | Exit criteria |
|---|---|---|
| **0** Blueprint | These docs plus visual mockup | Approved 2026-09-28 (navigation as proposed, SAVED status added, visual direction accepted) |
| **1** Foundation | Repo, Spring Boot + Flyway + Postgres (Docker), health endpoint, **auth (register/login/logout/me)**, user settings, React shell with routing, tokens, sidebar/rail/bottom nav, theme switching, landing page, dashboard shell with empty states, CI skeleton | `mvn verify` and `npm test` green; a user can sign up, log in and see the shell; landing page responsive |
| **2** Academics | Grading schemes, semesters, courses, grades + GPA/CGPA, attendance, assignments, exams, timetable, onboarding steps 1–4 | Calculator tests exhaustive; course page consolidates data |
| **3** Planner | Tasks (views, recurrence), calendar (day/week/month), dashboard: Today strip, Needs attention, load bar | Dashboard answers "what now?" with real data |
| **4** Developer | Projects, learning goals, hackathons, internships + analytics, GitHub (public + OAuth), onboarding steps 5–6 | GitHub failure modes tested with WireMock |
| **5** Insights + notifications | Rule-based insights with evidence links; scheduled in-app notifications; ⌘K search | Every insight traceable to its source records |
| **6** UI polish | Accessibility audit, motion, responsive review, dark mode tuning, states audit, performance | Lighthouse a11y ≥ 95; manual keyboard pass |
| **7** Open source + deploy | Docs, templates, workflows, screenshots, **live demo deploy** (Vercel + Render + Neon), seeded demo account | A new contributor runs it from the README alone |
| **8** AI (optional) | Proposal only, then implementation after approval | — |

**Note on your phase plan:** I moved **auth into Phase 1**. Because NOVA is multi-user, every table from Phase 2 on needs a real `user_id` and ownership checks. Adding auth later would mean retrofitting every query and test.

## 19. Technical risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Scope is large for one student | High | Strict phase gates; polish fewer screens; defer anything in §5 |
| Timezone/date bugs ("due tomorrow" wrong near midnight IST) | High | `timestamptz` + user zone + injected `Clock`; dedicated tests around midnight and week boundaries |
| Floating-point GPA errors (e.g. 8.499999) | Medium | `BigDecimal` in Java, `numeric` in Postgres, round only for display (HALF_UP, 2 dp) |
| GitHub rate limits on a shared server token in the demo | Medium | Snapshot cache + ETag + stale-while-error + per-user refresh throttle |
| Free-tier hosting: Render web services sleep after 15 min idle (~1 min cold start); **Render's free Postgres expires after 30 days** | High | Use **Neon** (persistent free Postgres) instead of Render Postgres; show a friendly "waking up the server" state; documented in README |
| Spring Boot 4.x ecosystem gaps (e.g. springdoc, Testcontainers integration versions) | Medium | Verify in Phase 1 before committing; fallback is Boot 4.0.x, which has the same code style |
| Cross-site cookie issues between Vercel and Render | Medium | Same-origin via `/api` rewrite (§9.3); tested in the Phase 7 deploy |
| Design ambition exceeds implementation time | Medium | The design system is built in Phase 1; each later phase reuses components instead of inventing new ones |
| Contributors break calculations | Low | Calculators are pure and 100% tested; CI required on PRs |

## 20. Technology stack and justification

| Layer | Choice | Version policy | Justification |
|---|---|---|---|
| Language (BE) | **Java 25 LTS** (Eclipse Temurin) | LTS, the same JDK locally, in CI and in the Docker image | Your strongest language. Records, pattern matching, virtual threads. The dev machine has JDK 26, a non-LTS release with about 6 months of updates, so Temurin 25 is installed alongside it and `maven.compiler.release=25`. Decided 2026-09-28. |
| Framework | **Spring Boot 4.1** (Spring Framework 7) | Current stable (4.1.0 released June 2026; OSS support ~12 months) | The 3.5 line reached OSS end-of-life in June 2026, so starting a new project on it would be a mistake. |
| Build | **Maven** (wrapper committed) | — | As requested; the wrapper gives reproducible builds |
| DB | **PostgreSQL 16+** | — | Relational integrity, `timestamptz`, `jsonb` for snapshots, partial indexes, `citext` |
| Migrations | **Flyway** | — | Versioned, reviewable SQL |
| Auth | Spring Security + Spring Session JDBC | — | §9.3 |
| Cache | Caffeine | — | In-process, zero ops |
| API docs | springdoc-openapi | Verify Boot 4 compatibility | Interactive docs for contributors |
| BE tests | JUnit 5, AssertJ, Mockito, Testcontainers, WireMock | — | §14 |
| FE | **React 19 + TypeScript + Vite** | Current majors at Phase 1 | As requested |
| FE data | TanStack Query v5 | — | Server-state caching |
| FE UI | Tailwind v4, Radix primitives, Motion, cmdk, Recharts, date-fns | — | §10 |
| FE tests | Vitest, RTL, MSW, Playwright | — | §14 |
| Container | Docker Compose (Postgres for dev) | — | One-command database |
| CI | GitHub Actions | — | Build, test and lint on each PR |
| Hosting (demo) | **Vercel** (frontend + `/api` rewrite) · **Render** (backend Docker image, free) · **Neon** (Postgres, free) | Free tiers, verified again in Phase 7 | Free, and gives same-origin cookies |

**Stack changes I deliberately did *not* make:** no Python; no Next.js (NOVA is an authenticated app behind a login, so server rendering adds complexity without benefit, and a static landing page works fine with Vite); no Redux; no microservices; no Redis; no GraphQL on our own API (REST is simpler to explain and document).

---

### Sources (research, September 2026)

- [HeroDevs — Spring Boot versions, EOL dates and latest releases](https://www.herodevs.com/blog-posts/spring-boot-versions-eol-dates-and-latest-releases-april-2026)
- [Spring blog — Spring Boot 4.1.0 available now](https://spring.io/blog/2026/06/10/spring-boot-4/)
- [GitHub Docs — Rate limits for the REST API](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api)
- [GitHub Docs — Best practices for using the REST API (conditional requests)](https://docs.github.com/en/rest/using-the-rest-api/best-practices-for-using-the-rest-api)
- [GitHub Docs — GraphQL rate and query limits](https://docs.github.com/en/graphql/overview/rate-limits-and-query-limits-for-the-graphql-api)
- [SaaSFrame — Anatomy of high-performance SaaS dashboard design (2026)](https://www.saasframe.io/blog/the-anatomy-of-high-performance-saas-dashboard-design-2026-trends-patterns)
- [Duetoday — Best study planner apps for students 2026 (compared)](https://www.duetoday.ai/blog/best-study-planner-apps-for-students/)
- [Render — Platforms with a real free tier in 2026](https://render.com/articles/platforms-with-a-real-free-tier-for-developers-in-2026)
- [shadcn/ui — Tailwind v4](https://ui.shadcn.com/docs/tailwind-v4)
- [TanStack Query — docs](https://tanstack.com/query/v5/docs/framework/react/installation)
