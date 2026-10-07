# Contributing to NOVA

Thanks for helping. NOVA is a student project built in the open, so small, careful contributions are
very welcome: a typo, a failing edge case, a clearer error message, or a whole feature.

By taking part you agree to follow the [Code of Conduct](CODE_OF_CONDUCT.md).

## Before you start

- **Bugs and ideas:** open an issue first (Bug report, Feature request or Docs), so we can agree on
  the fix before you spend time on it. Small, obvious fixes can go straight to a pull request.
- **Security problems:** don't open a public issue. See [SECURITY.md](SECURITY.md).
- **Good first issues** are labelled [`good first issue`](../../labels/good%20first%20issue).

## Set up (about 10 minutes)

The [README](README.md#running-locally) has the full steps. In short:

```bash
git clone https://github.com/<you>/nova.git && cd nova
cp .env.example .env             # PowerShell: Copy-Item .env.example .env

# UI only, no Java or database: an in-browser mock API with demo data
cd frontend && npm ci && npm run dev:mock      # log in as demo@nova.dev / nova-demo-2026

# Full stack
docker compose up -d                            # PostgreSQL
cd backend && ./mvnw spring-boot:run            # Windows: .\mvnw.cmd spring-boot:run
cd frontend && npm run dev                      # second terminal; open http://localhost:5173
```

You need Node.js 22.12+ with npm 11+, Java 25 (Temurin) and Docker. Most frontend work only needs
Node.

## How the code is organised

- `backend/src/main/java/dev/nova/<feature>/`: one package per feature (academics, planner,
  developer, insights, notification, search, …). Inside: entity, repository, service, controller,
  DTOs, and **pure rule classes** (e.g. `AttendanceCalculator`, `InsightRules`) that hold the logic
  and have no Spring or database code, so they're easy to unit-test.
- `backend/src/main/resources/db/migration/`: Flyway SQL migrations, `V<n>__what_it_does.sql`.
  Never edit a migration that has been merged; add a new one.
- `frontend/src/features/<feature>/`: pages, dialogs, API hooks (TanStack Query) and types.
- `frontend/src/components/`: shared UI (buttons, dialogs, fields, empty and error states).
- `frontend/src/mocks/`: the in-browser mock API. It mirrors the real API (docs/api.md), so a
  backend change that the UI relies on needs a matching mock change.
- `docs/`: architecture, database, API, UI design, accessibility and performance notes.

### Adding a feature, end to end

1. **API first:** describe the endpoints in `docs/api.md` and any tables in `docs/database.md`.
2. **Backend:** a migration, then the feature package. Put decisions in a pure rules class and test
   it with JUnit; add a `…FlowTest` (extends `IntegrationTest`) for the HTTP flow, including another
   user being refused (ownership) and invalid input (validation errors).
3. **Mock:** port the behaviour to `frontend/src/mocks/` so the UI can be built and tested alone.
4. **Frontend:** the page under `features/`, with loading, error and empty states, and a test in
   `*.test.tsx` that includes an `axeViolations` check.
5. **Docs:** update the README status and the relevant doc.

## Checks to run before a pull request

CI runs all of these; running them locally first saves a round trip.

```bash
cd backend && ./mvnw verify                 # unit + full-stack tests (Docker must be running)

cd frontend
npm run format:check && npm run lint && npm run typecheck
npm test                                    # Vitest
npm run build && npm run size               # bundle-size budget
npm run e2e                                 # Playwright: accessibility, reflow, keyboard, states, smoke
```

`npm run e2e:install` downloads Chromium for Playwright the first time.

## Conventions

- **Branches:** `feat/short-name`, `fix/short-name`, `docs/…`, `test/…`, `chore/…`.
- **Commits:** [Conventional Commits](https://www.conventionalcommits.org/), e.g.
  `feat(planner): repeat a task every weekday`, `fix(attendance): count cancelled classes as neither`.
  Types used here: `feat`, `fix`, `perf`, `refactor`, `test`, `docs`, `build`, `ci`, `chore`.
- **Formatting:** Prettier for the frontend (`npm run format`), the project's `.editorconfig`
  everywhere; Java uses 4-space indentation.
- **Tests:** never call a live external API. GitHub is faked in backend tests and mocked with MSW
  in frontend tests.
- **Accessibility is part of "done":** labels on every control, visible focus, keyboard support, and
  no new axe violations (see [docs/accessibility.md](docs/accessibility.md)).
- **Honest numbers:** anything NOVA computes shows its formula or source; GitHub data is never
  invented or estimated.
- **Secrets:** never commit them. Configuration comes from environment variables
  (see `.env.example`).

## Pull requests

- Keep each one focused: one feature or fix.
- Fill in the template: what changed, why, how you tested it, screenshots for UI changes (light and
  dark).
- A maintainer reviews within a few days. Expect questions; they're about the code, not about you.

## Labels

Issues and pull requests use: `bug`, `enhancement`, `documentation`, `frontend`, `backend`,
`database`, `accessibility`, `good first issue`, `help wanted`, `dependencies`. They're defined in
[.github/labels.yml](.github/labels.yml); a maintainer can create or update them all with the
**Sync labels** workflow (Actions → Sync labels → Run workflow).

## Ideas that would make good contributions

These are real gaps, listed in [docs/architecture.md](docs/architecture.md) §5:

- Export the calendar as an ICS file, so NOVA shows up in Google or Apple Calendar.
- CSV import for courses and grades.
- Drag a task to another day on the calendar.
- Email or browser-push notifications (the in-app generator is built to feed more channels).
- Sign in with GitHub (OAuth), so the contribution calendar works without a server token.
