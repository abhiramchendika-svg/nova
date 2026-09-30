# NOVA — Student Developer OS

> **Your student life, organized in one place.**
> NOVA brings classes, deadlines, grades and developer growth into one calm dashboard, so every morning starts with a clear answer to *what now?*

**Status:** early development (Phase 2 of 8). Accounts, login and settings work end to end; semesters, courses, grading schemes, GPA/CGPA, what-if grades and attendance have their API and pages (Courses, Attendance, Grades); assignments have their API and page, and each course has its own page (attendance, open work, upcoming exams, links), and exams have countdown cards and a prep checklist per exam. Planner and developer features arrive in Phases 3–4. Nothing here is production-ready yet.

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

Open http://localhost:5173 and log in with the demo account **demo@nova.dev / nova-demo-2026** (it exists only in the mock). It comes with three semesters of clearly fictional courses and grades. The mock keeps data in page memory, so a full page reload starts fresh.

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

Open http://localhost:5173 and create an account. The Vite dev server proxies `/api` to the backend, so the browser only ever talks to one origin and the session and CSRF cookies are first-party.

### Environment variables

| Variable | Used by | Default | Purpose |
|---|---|---|---|
| `NOVA_DB_URL` | backend | `jdbc:postgresql://localhost:5432/nova` | JDBC URL |
| `NOVA_DB_USER` / `NOVA_DB_PASSWORD` | backend | `nova` / `change-me-locally` | Database credentials (match `docker-compose.yml`) |
| `NOVA_COOKIE_SECURE` | backend | `false` | Set `true` behind HTTPS so cookies are Secure |
| `NOVA_CORS_ORIGINS` | backend | empty | Only for cross-origin tooling; normal use is same-origin |
| `PORT` | backend | `8080` | HTTP port |
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
```

Tests never call a real external API. Backend integration tests start a throwaway PostgreSQL 16 container; frontend tests mock the network with MSW.

## Documentation

- [Architecture & product blueprint](docs/architecture.md)
- [Database design](docs/database.md)
- [REST API design](docs/api.md)
- [UI design system ("Signal")](docs/ui-design.md)

## Roadmap

| Phase | Scope | Status |
|---|---|---|
| 0 | Product & technical blueprint | Done |
| 1 | Foundation: frontend shell, design system, accounts and login, settings API, CI | Done |
| 2 | Academics: semesters, courses, grading, GPA/CGPA, attendance, assignments, exams, timetable | In progress |
| 3 | Planner: tasks, calendar, Today view | Planned |
| 4 | Developer growth: projects, learning goals, hackathons, internships, GitHub | Planned |
| 5 | Insights and notifications | Planned |
| 6 | UI polish and accessibility audit | Planned |
| 7 | Open-source readiness and live demo | Planned |

## Known limitations

- `npm run dev` needs the backend running; without it the app shows "We couldn't check your session." Use `npm run dev:mock` for UI-only work.
- The login rate limiter is in memory, which suits a single instance; multiple instances would need a shared store.
- The theme choice is saved per browser; syncing it to the account arrives with the Settings page (Phase 2).
- Courses, Attendance, Grades and Grading schemes are live. The other sections show an honest "on the way" placeholder until their phase ships.

## License

[MIT](LICENSE) © 2026 Abhiram Chendika
