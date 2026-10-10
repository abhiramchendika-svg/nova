# NOVA — Student Developer OS

> **Your student life, organized in one place.**
> NOVA brings classes, deadlines, grades and developer growth into one calm dashboard, so every morning starts with a clear answer to *what now?*

**Status:** early development (Phase 6 of 8 complete). Accounts, login, first-run setup and settings work end to end; semesters, courses, grading schemes, GPA/CGPA, what-if grades and attendance have their API and pages (Courses, Attendance, Grades); assignments have their API and page, and each course has its own page (attendance, open work, upcoming exams, links), exams have countdown cards and a prep checklist per exam, and the weekly timetable feeds Home, where today’s classes can be marked in one tap. Tasks have their API and page (Today, Upcoming, Done, repeating tasks), and each exam has a study plan that can spread unfinished topics over the days before it; a week and month calendar brings classes, exams, deadlines and tasks together with how full each day is; and Home ranks what needs you (overdue work, close deadlines, attendance at risk, under-prepared exams) with a reason for each. Phase 4 (developer growth) has begun with projects (milestones drive progress, tasks link to projects, and dated milestones join the calendar and Home) and learning goals (topics to tick off, links, and a study plan that spreads unfinished topics over the days to a target date; the goal in focus shows on Home, and setup can add a first goal) and hackathons (deadlines that follow the status, warnings when one falls within two days of an exam, prep tasks, a linked project and a result you write yourself; they show on the calendar and Home), and internship applications (a board by stage and a full list, a history of every move, apply-by dates and next steps on the calendar and Home, and each month's response rate with its formula shown), and GitHub by username (profile, repositories, languages and, with an optional server token, the contribution calendar, with NOVA's own metrics labelled and their formulas shown; saved copies keep it working when GitHub is slow or rate-limited). Phase 5 adds global search with a ⌘K / Ctrl+K command palette, and in-app notifications under a bell (deadlines within 24 hours, overdue tasks, exams in the next 3 days, attendance that slips, hackathon and apply-by deadlines, interviews tomorrow), each type switchable in Settings, and rule-based insights for the week or month (deadline clusters, task completion, attendance trends, exam prep and study time, on-time submissions, stalled projects, internship responses, GitHub activity), each showing its numbers, formula and source records, and staying quiet until there's enough data. Phase 6 audited every page in a real browser (WCAG 2.2 AA in light and dark, 320 px reflow, keyboard, loading, error and empty states, reduced motion) and added a bundle-size budget to CI; see [docs/accessibility.md](docs/accessibility.md) and [docs/performance.md](docs/performance.md). Nothing here is production-ready yet.

## The problem

An engineering student's week lives in five places: the university portal (attendance), group chats (assignments), a to-do app (tasks), a spreadsheet (GPA) and GitHub or Notion (projects, internships). None of them know about each other, so nobody can answer "can I skip Friday's class?", "why is Wednesday so heavy?" or "is my exam the same weekend as that hackathon?".

NOVA puts **Academics + Planning + Developer growth** in one data model, so it can.

| Area | Question it answers |
|---|---|
| Academics | *Know where you stand.* GPA/CGPA with configurable grading, attendance with "can miss / need to attend" math |
| Planner | *Know what to do next.* Tasks, timetable and a unified calendar |
| Developer growth | *Know what you're building toward.* Projects, learning goals, hackathons, internships, GitHub |

## Stack

| Layer | Choice |
|---|---|
| Frontend | React 19, TypeScript (strict), Vite, Tailwind CSS v4 on NOVA design tokens, Radix primitives, TanStack Query, React Router, React Hook Form + Zod |
| Backend | Java 25 LTS, Spring Boot 4.1, Spring Security (session cookies + CSRF), Spring Session JDBC, Spring Data JPA, Flyway |
| Database | PostgreSQL 16 |
| Tests | Vitest, Testing Library, MSW, axe-core · JUnit 5, MockMvc, Testcontainers |
| CI | GitHub Actions |

Why these choices: see [docs/architecture.md](docs/architecture.md) §20.

## Repository layout

```
nova/
├── frontend/          React + TypeScript app (Vite)
├── backend/           Spring Boot API
├── docs/              architecture, database, API and UI design
├── docker-compose.yml local PostgreSQL
└── .github/workflows/ CI
```

## Running locally

### Prerequisites

| Tool | Version |
|---|---|
| Node.js | 22.12+ (24 LTS recommended) with **npm 11+** |
| Java | 25 (Eclipse Temurin) — backend only |
| Docker | Docker Desktop / Engine with Compose — for PostgreSQL |
| Git | any recent version |

### 1. Configure environment

```bash
cp .env.example .env        # PowerShell: Copy-Item .env.example .env
```

`.env` is git-ignored. Never commit real secrets.

### 2. Frontend only (no backend needed)

The frontend ships with an in-browser mock API, so you can run and review the UI without Java or a database:

```bash
cd frontend
npm ci
npm run dev:mock
```

Open http://localhost:5173 and log in with the demo account **demo@nova.dev / nova-demo-2026** (it exists only in the mock), or press **Try the demo**. Both come with three semesters of clearly fictional courses, grades, coursework, tasks and developer data. The mock keeps data in page memory, so a full page reload starts fresh.

### 3. Full stack

```bash
# 1. Database (from the repository root)
docker compose up -d

# 2. Backend on http://localhost:8080 (Flyway creates the tables on first start)
cd backend
./mvnw spring-boot:run          # Windows PowerShell: .\mvnw.cmd spring-boot:run

# 3. Frontend on http://localhost:5173 (in a second terminal)
cd frontend
npm ci
npm run dev
```

Open http://localhost:5173 and create an account, or press **Try the demo** for a temporary account with made-up data (deleted after 24 hours). The Vite dev server proxies `/api` to the backend, so the browser only ever talks to one origin and the session and CSRF cookies are first-party.

### 4. The production image (optional)

`docker compose --profile app up --build` builds the backend's Docker image and runs it with the production profile, as Render does. [Deployment](docs/deployment.md) walks through it, including testing the production frontend build against it.

### Environment variables

| Variable | Used by | Default | Purpose |
|---|---|---|---|
| `NOVA_DB_URL` | backend | `jdbc:postgresql://localhost:5432/nova` | JDBC URL |
| `NOVA_DB_USER` / `NOVA_DB_PASSWORD` | backend | `nova` / `change-me-locally` | Database credentials (match `docker-compose.yml`) |
| `NOVA_COOKIE_SECURE` | backend | `false` | Set `true` behind HTTPS so cookies are Secure |
| `NOVA_CORS_ORIGINS` | backend | empty | Only for cross-origin tooling; normal use is same-origin |
| `PORT` | backend | `8080` | HTTP port |
| `NOVA_PROXY_SECRET` | backend, Vite | empty | Shared secret the website's proxy sends with every API call. Empty for normal local development; required by the `prod` profile and the Docker backend. See [Deployment](docs/deployment.md) |
| `NOVA_DEMO_ENABLED` | backend | `true` | "Try the demo" accounts (temporary, fictional data, deleted after 24 h, rate-limited). `false` turns them off |
| `GITHUB_SERVER_TOKEN` | backend | empty | Optional. A GitHub fine-grained token with no extra permissions; enables the contribution calendar (profiles and repositories work without it). Set it in the shell that runs the backend (PowerShell: `$env:GITHUB_SERVER_TOKEN="…"`). Never commit it. |
| `VITE_API_MOCKS` | frontend | `false` | `true` runs the UI against the in-browser mock API |
| `VITE_REPO_URL` | frontend | empty | Repository link on the landing page |

## Testing

```bash
# Backend: unit tests + full-stack tests against PostgreSQL in Docker (Testcontainers).
# Docker must be running.
cd backend
./mvnw verify                   # Windows: .\mvnw.cmd verify

# Frontend
cd frontend
npm test            # unit + component tests (Vitest, MSW, axe-core)
npm run lint        # ESLint incl. jsx-a11y
npm run typecheck   # tsc
npm run build       # production build
npm run size        # what each first visit downloads, checked against bundle-budget.json
npm run csp         # vercel.json Content-Security-Policy matches the built inline script (after build)
npm run e2e:install # once: downloads Chromium for Playwright
npm run e2e         # real-browser checks (mock API): accessibility, reflow, keyboard, loading/error/empty states, reduced motion, smoke flows
```

Tests never call a real external API. Backend integration tests start a throwaway PostgreSQL 16 container; frontend tests mock the network with MSW.

## Documentation

- [Architecture & product blueprint](docs/architecture.md)
- [Accessibility audit](docs/accessibility.md)
- [Performance](docs/performance.md)
- [Deployment](docs/deployment.md): Vercel + Render + Neon, the production Docker image, and running it locally
- [Database design](docs/database.md)
- [REST API design](docs/api.md)
- [UI design system ("Signal")](docs/ui-design.md)

## Roadmap

| Phase | Scope | Status |
|---|---|---|
| 0 | Product & technical blueprint | Done |
| 1 | Foundation: frontend shell, design system, accounts and login, settings API, CI | Done |
| 2 | Academics: semesters, courses, grading, GPA/CGPA, attendance, assignments, exams, timetable | Done |
| 3 | Planner: tasks, calendar, Today view | Done |
| 4 | Developer growth: projects, learning goals, hackathons, internships, GitHub | Done (GitHub OAuth deferred) |
| 5 | Search, notifications and insights | Done |
| 6 | UI polish and accessibility audit | Done |
| 7 | Open-source readiness and live demo | In progress (contributor docs, "Try the demo" and deploy setup done; going live next) |

## Known limitations

- `npm run dev` needs the backend running; without it the app shows "We couldn't check your session." Use `npm run dev:mock` for UI-only work.
- The login rate limiter is in memory, which suits a single instance; multiple instances would need a shared store.
- The theme is saved to your account (and mirrored in the browser so pages open without a flash); signed-out pages use the browser’s own choice.
- GitHub works from a public username; the optional GitHub OAuth connect (private-contribution counts) is not built yet.
- Notifications are in-app only; there are no email or push reminders.
- There is no public live demo yet; it arrives later in Phase 7.

## Contributing

Contributions are welcome — start with [CONTRIBUTING.md](CONTRIBUTING.md), which covers setup, how the code is organised, how to add a feature end to end and what a pull request needs. Issues labelled `good first issue` are a good way in.

- [Code of Conduct](CODE_OF_CONDUCT.md)
- [Security policy](SECURITY.md) — please report vulnerabilities privately, not in a public issue.

Repository labels live in [`.github/labels.yml`](.github/labels.yml) (apply them with the **Sync labels** workflow), and Dependabot opens weekly grouped updates for npm and Maven.

## License

[MIT](LICENSE) © 2026 Abhiram Chendika
