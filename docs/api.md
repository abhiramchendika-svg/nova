# NOVA — REST API Design

> Status: **Phase 0 design.** Endpoints are implemented phase by phase. The generated OpenAPI spec (`/v3/api-docs`, Swagger UI at `/swagger-ui.html` in the `dev` profile) becomes the source of truth once code exists, and this document keeps the rationale and the contracts that matter most.

## 1. Conventions

| Topic | Rule |
|---|---|
| Base path | `/api/v1`. Versioning in the path is explicit and easy to route. |
| Format | JSON, `camelCase`. Dates are `YYYY-MM-DD`, instants are ISO-8601 with offset (`2026-10-03T23:59:00+05:30`), times are `HH:mm`. |
| IDs | UUID strings |
| Auth | Session cookie (`NOVA_SESSION`, HttpOnly). Every endpoint except `/auth/register`, `/auth/login`, `/auth/csrf` and `/health` requires it; without it the response is `401`. |
| CSRF | `POST/PUT/PATCH/DELETE` must send the `X-XSRF-TOKEN` header, which the frontend's http client reads from the `XSRF-TOKEN` cookie automatically. Missing or invalid → `403` with `code: CSRF_INVALID`. |
| Methods | `GET` read · `POST` create (`201` + `Location`) · `PUT` full replace of editable fields · `PATCH` for narrow state changes (status, progress, mark read) · `DELETE` → `204` |
| Ownership | Another user's resource returns **`404`** (never `403`), so the API doesn't reveal that it exists. |
| Pagination | Only for unbounded collections: `?page=0&size=20` (max 100). Response: `{ "items": [...], "page": 0, "size": 20, "totalItems": 57, "totalPages": 3 }` |
| Sorting / filtering | `?sort=dueAt,asc` (allow-listed fields only); filters as query params, e.g. `?status=IN_PROGRESS&courseId=…` |
| Time context | "Today", "this week" etc. are evaluated in the user's saved timezone. Some endpoints accept `?date=` to view another day. |
| Rate limits | Login: 5/min per IP+email → `429` + `Retry-After`. GitHub refresh: 1 per 5 minutes per user → `429`. |

### Error format (RFC 9457 Problem Details)

```json
HTTP/1.1 400 Bad Request
Content-Type: application/problem+json

{
  "type": "https://nova.dev/problems/validation",
  "title": "Some fields need attention",
  "status": 400,
  "code": "VALIDATION_FAILED",
  "detail": "2 fields are invalid.",
  "instance": "/api/v1/courses",
  "requestId": "7f3c2a9e",
  "errors": [
    { "field": "credits", "message": "must be greater than or equal to 0" },
    { "field": "name", "message": "must not be blank" }
  ]
}
```

| Status | `code` | When | The frontend shows |
|---|---|---|---|
| 400 | `VALIDATION_FAILED` | Bean-validation or business-rule failure | Inline field errors |
| 400 | `MALFORMED_REQUEST` | Unparseable JSON or a wrong type | "Something in that form didn't look right." |
| 401 | `UNAUTHENTICATED` | No or expired session | Redirect to login and keep the return URL |
| 403 | `CSRF_INVALID` | Bad or missing CSRF token | Silent refetch of the token, then one retry |
| 404 | `NOT_FOUND` | Missing or not yours | "We couldn't find that." |
| 409 | `CONFLICT` | Unique violation (e.g. email taken, duplicate attendance slot) | A specific message |
| 422 | `RULE_VIOLATION` | Valid shape but impossible state (e.g. attended > conducted) | Inline message |
| 429 | `RATE_LIMITED` | Too many requests | "Try again in N seconds." |
| 502 | `UPSTREAM_UNAVAILABLE` | GitHub is down or rate-limited and there's no cached data | "We couldn't load your GitHub activity." + Retry |
| 500 | `INTERNAL` | Unexpected | "Something went wrong on our side." + requestId (never a stack trace) |

---

## 2. Endpoints

Legend: 🔓 public · everything else requires a session. **P** marks paginated endpoints. The phase column says when each endpoint is built.

### 2.1 System & auth (Phase 1)

| Method | Path | Purpose |
|---|---|---|
| GET 🔓 | `/api/v1/health` | Liveness for the landing page and deploy checks. Returns `{ "status": "UP", "version": "0.1.0" }`. (Actuator `/actuator/health` is kept for infrastructure.) |
| GET 🔓 | `/api/v1/auth/csrf` | Issues the `XSRF-TOKEN` cookie. Returns `204`. |
| POST 🔓 | `/api/v1/auth/register` | Create account and log in |
| POST 🔓 | `/api/v1/auth/login` | Log in |
| POST | `/api/v1/auth/logout` | Invalidate the session → `204` |
| GET | `/api/v1/auth/me` | Current user: `{ id, email, displayName, onboardingCompleted }` |
| GET / PUT | `/api/v1/settings` | Timezone, week start, university, attendance default, theme |
| POST | `/api/v1/settings/onboarding/complete` | Marks onboarding done; returns the settings body |

**Register**

- Request: `{ "email": "a@b.com", "password": "≥10 chars", "displayName": "Abhi" }`
- Response `201`: `{ "id": "…", "email": "a@b.com", "displayName": "Abhi", "onboardingCompleted": false }`
- Errors: `400` (weak password, invalid email), `409` (email already registered). The message is deliberately generic, "An account with this email may already exist", to limit account enumeration.

**Login**

- Request: `{ "email", "password" }`
- Response `200`: same body as `/me`, and the session ID is rotated.
- Errors: `401` "Invalid email or password" (the same message for both cases), `429`.

**Settings PUT**

```json
{ "timezone": "Asia/Kolkata", "weekStart": "MON", "universityName": "SRM University AP",
  "defaultAttendanceTarget": 75.00, "theme": "SYSTEM" }
```

- Response `200`: the same fields plus `onboardingCompleted`.
- Errors: `400` for a timezone that isn't an IANA region (e.g. `+05:30` or `IST` are rejected; `Asia/Kolkata` and `UTC` are accepted), or a target outside (0, 100) or with more than 2 decimals.
- Dashboard widget preferences are added with dashboard personalisation (Phase 6).

**Implementation notes (Phase 1, verified by tests)**

- Session cookie `NOVA_SESSION`: HttpOnly, SameSite=Lax, Secure in production; stored in PostgreSQL by Spring Session; 14-day sliding timeout.
- CSRF: `GET /auth/csrf` sets a readable `XSRF-TOKEN` cookie without creating a session; unsafe requests must echo it in `X-XSRF-TOKEN`.
- Login is rate-limited per client IP + email (5 per minute by default); the `429` includes `Retry-After` and `retryAfterSeconds`.

### 2.2 Grading schemes (Phase 2)

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/v1/grading-schemes` | Built-in presets first, then your own schemes, each with its grades (best first) |
| POST | `/api/v1/grading-schemes` | Create a custom scheme → `201` |
| POST | `/api/v1/grading-schemes/{id}/clone` | Copy a preset (or one of yours) into a new editable scheme named "… (copy)" → `201` |
| PUT | `/api/v1/grading-schemes/{id}` | Replace the name, maximum and grades (your schemes only) |
| DELETE | `/api/v1/grading-schemes/{id}` | `204`. `409` while any semester uses it. |

- Request: `{ "name": "SRM 10-point", "maxPoints": 10, "grades": [ { "id?": "…", "label": "O", "points": 10, "passing": true, "countsInGpa": true }, … ] }`. The order of `grades` is the display order.
- **Updates are applied in place.** A grade sent with its `id` is edited, so courses graded with it keep their grade and their GPA follows the new points. A grade without an `id` is added. An existing grade left out is removed, unless a course still uses it (`409`).
- Errors: `400` for duplicate labels (ignoring case), points above `maxPoints`, no passing grade, 0 or more than 20 grades, or an `id` that isn't one of this scheme's grades. Editing or deleting a built-in preset, or someone else's scheme, returns `404`. A user can have up to 20 schemes (`422`).
- Built-in presets have fixed ids: 10-point scale `00000000-0000-4000-8000-000000000001`, 4.0 scale (US) `…0002`, Pass/Fail `…0003`. They are examples, not assumed university policies.

**Response (one scheme)**

```json
{ "id": "…", "name": "10-point scale", "maxPoints": 10.00, "builtIn": true,
  "grades": [ { "id": "…", "label": "O", "points": 10.00, "passing": true, "countsInGpa": true }, … ] }
```

### 2.3 Semesters & grades (Phase 2)

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/v1/semesters` | All your semesters, in order of `ordinal` |
| GET | `/api/v1/semesters/{id}` | One semester |
| POST | `/api/v1/semesters` | Create → `201`. `{ "name", "ordinal", "startsOn?", "endsOn?", "gradingSchemeId", "current", "attendanceTarget?" }` |
| PUT | `/api/v1/semesters/{id}` | Full replace (same body). `current: true` moves the flag here. |
| DELETE | `/api/v1/semesters/{id}` | `204`. Also deletes its courses (the UI asks for confirmation first). |
| POST | `/api/v1/semesters/{id}/make-current` | Moves the "current" flag to this semester |
| GET | `/api/v1/grades/summary` | CGPA, projected CGPA, totals, per-semester GPAs, and a list of what was **excluded** and why |
| POST | `/api/v1/grades/what-if` | Stateless calculation: `{ "overrides": [ { "courseId", "gradeDefinitionId" } ] }` → the same shape as the summary. Nothing is saved. |

- Semester response: `{ "id", "name", "ordinal", "startsOn", "endsOn", "current", "attendanceTarget", "gradingScheme": { "id", "name", "maxPoints" } }`.
- Rules: `ordinal` is 1–20 and unique per user (`400`); `endsOn` can't be before `startsOn` (`400`); the grading scheme must be a preset or yours (`400`); at most one semester is current (moving the flag is automatic; the database enforces it too). Switching the grading scheme while any course in the semester has a grade → `422 RULE_VIOLATION` (clear those grades first). Up to 20 semesters.
- Per-semester GPA lives in `/grades/summary` rather than in the semester list, so it's calculated in exactly one place.

**`/grades/summary` response**

```json
{
  "cgpa": 8.62, "projectedCgpa": 8.71, "scale": 10.00, "cgpaUnavailableReason": null,
  "totalCredits": 84.0, "completedCredits": 64.0,
  "semesters": [ { "id": "…", "name": "Semester 3", "ordinal": 3, "current": true, "scale": 10.00,
                   "gpa": 8.40, "projectedGpa": 8.55, "credits": 22.0, "completedCredits": 18.0, "hasExpectedGrades": true } ],
  "excluded": [ { "courseId": "…", "courseName": "Soft Skills", "semesterId": "…", "reason": "GRADE_NOT_IN_GPA" } ]
}
```

- Official figures (`gpa`, `cgpa`) use FINAL grades; projected figures also include EXPECTED grades.
- GPA values are rounded half-up to 2 decimals, once, from the exact fraction. They are `null` when nothing counts yet (never `0.00`).
- `excluded` reasons: `GRADE_NOT_IN_GPA` (e.g. a Pass in a Pass/Fail scheme) and `ZERO_CREDITS`. Ungraded courses aren't listed.
- If the semesters that count use *different* scales (e.g. 10-point and 4.0), `cgpa`, `projectedCgpa` and `scale` are `null` and `cgpaUnavailableReason` is `"MIXED_SCALES"`. We refuse to average incompatible scales. Each semester's own GPA is still returned.
- **What-if:** each override is treated as an EXPECTED grade for that course, so it changes the projected figures, never the official CGPA. The course must be yours and the grade must belong to its semester's scheme (`400` otherwise); each course may appear once.

### 2.4 Courses (Phase 2)

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/v1/courses?semesterId=` | Courses of a semester, sorted by name. Without `semesterId`: the current semester's (empty if there's none). *(Attendance summary and next deadline are added in 2.2–2.3.)* |
| POST | `/api/v1/courses` | Create → `201`. `{ "semesterId", "code?", "name", "credits", "faculty?", "colorHue?", "notes?", "attendanceTarget?" }` |
| GET | `/api/v1/courses/{id}` | One course. *(Becomes the consolidated course page in 2.3: attendance stats, next assignment, next exam, timetable slots, resources, recent activity.)* |
| PUT / DELETE | `/api/v1/courses/{id}` | Full replace (same body) / delete → `204` |
| PUT | `/api/v1/courses/{id}/grade` | `{ "gradeDefinitionId", "kind": "FINAL" \| "EXPECTED" }`. `400` if the grade isn't from the semester's scheme. |
| DELETE | `/api/v1/courses/{id}/grade` | Clear the grade → `204` |
| POST / DELETE | `/api/v1/courses/{id}/resources[/{resourceId}]` | Manage links `{ "title", "url" }` (http/https only) |

- Course response: `{ "id", "semesterId", "code", "name", "credits", "faculty", "colorHue", "notes", "attendanceTarget", "grade": null | { "gradeDefinitionId", "label", "points", "passing", "countsInGpa", "kind" } }`.
- Rules: `credits` 0–99.9 with at most 1 decimal; `colorHue` 0–359; the semester must be yours (`400`, the same answer whether it's missing or someone else's). Moving a graded course to a semester with a different grading scheme → `422` (clear the grade first). Up to 40 courses per semester.

### 2.5 Attendance (Phase 2)

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/v1/attendance?semesterId=` | Per-course stats (see below) |
| GET | `/api/v1/courses/{id}/attendance/records` **P** | History, newest first |
| POST | `/api/v1/courses/{id}/attendance/records` | Mark one class: `{ "heldOn": "2026-09-26", "slot": 1, "status": "ABSENT" }`. `409` if that slot is already marked; use PUT to change it. |
| PUT / DELETE | `/api/v1/attendance/records/{recordId}` | Change status / remove |
| PUT | `/api/v1/courses/{id}/attendance/baseline` | `{ "conducted": 34, "attended": 28 }`. `422` if attended > conducted. |

**Per-course stats object**

```json
{
  "courseId": "…", "courseName": "Database Systems",
  "conducted": 34, "attended": 28, "percentage": 82.35,
  "target": 75.00, "targetSource": "SEMESTER",
  "canMiss": 3, "needToAttend": 0,
  "status": "SAFE"
}
```

- `status` is one of `SAFE`, `AT_RISK` (can miss ≤ 1), `BELOW`, or `NO_TARGET`.
- With no target set, `target`, `canMiss` and `needToAttend` are `null` and `status` is `NO_TARGET`. NOVA never invents a policy.

### 2.6 Assignments (Phase 2)

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/v1/assignments` **P** | Filters: `status`, `courseId`, `priority`, `dueFrom`, `dueTo`. Sort: `dueAt`, `priority`, `createdAt`. |
| POST | `/api/v1/assignments` | `{ "courseId", "title", "description?", "dueAt", "priority", "estimatedMinutes?" }` |
| GET / PUT / DELETE | `/api/v1/assignments/{id}` | Read / update / delete |
| PATCH | `/api/v1/assignments/{id}/progress` | `{ "status?", "progressPct?" }`. The server sets `submittedAt`/`completedAt`, and `COMPLETED` forces 100%. |

Each item includes a computed `urgency` (`OVERDUE`, `DUE_TODAY`, `DUE_TOMORROW`, `THIS_WEEK`, `LATER`), calculated in the user's timezone. It drives the visual deadline indicators.

### 2.7 Exams (Phase 2)

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/v1/exams?upcoming=true` | With `daysUntil` (calendar days in the user's zone), `prep: { done, total, percentage }` |
| POST | `/api/v1/exams` | `{ "courseId", "title", "kind", "startsAt", "durationMinutes?", "location?", "topics?": ["Normalization", "Transactions"] }` |
| GET / PUT / DELETE | `/api/v1/exams/{id}` | The detail view includes topics and linked study tasks |
| POST | `/api/v1/exams/{id}/topics` | Add topic |
| PATCH | `/api/v1/exams/{id}/topics/{topicId}` | `{ "done": true }` or `{ "title", "position" }` |
| DELETE | `/api/v1/exams/{id}/topics/{topicId}` | Remove |

### 2.8 Timetable (Phase 2)

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/v1/timetable` | All weekly slots for the current semester |
| GET | `/api/v1/timetable/day?date=` | Slots for that date, with attendance status if marked |
| POST | `/api/v1/timetable` | `{ "courseId", "dayOfWeek": 1-7, "startsAt": "09:00", "endsAt": "09:50", "kind", "location?", "instructor?" }` |
| PUT / DELETE | `/api/v1/timetable/{id}` | Update / delete |

- **Overlap:** overlapping slots are *allowed* (labs sometimes overlap) but come back with `overlapsWith: [ids]`, so the UI can warn about them.

### 2.9 Tasks (Phase 3)

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/v1/tasks/today?date=` | Open tasks planned for that date, due that date, or overdue, plus tasks completed that date. Ordered by priority score. |
| GET | `/api/v1/tasks/upcoming?days=14` | Open tasks with a future plan or due date, grouped by day |
| GET | `/api/v1/tasks/completed` **P** | Newest first |
| GET | `/api/v1/tasks` **P** | Generic filters: `category`, `status`, `courseId`, `projectId`, `examId` |
| POST | `/api/v1/tasks` | `{ "title", "description?", "category", "priority", "plannedFor?", "dueAt?", "estimatedMinutes?", "recurrence", "courseId?", "examId?", "projectId?" }` |
| GET / PUT / DELETE | `/api/v1/tasks/{id}` | `DELETE ?series=true` deletes future open instances of a recurring task |
| PATCH | `/api/v1/tasks/{id}/status` | `{ "status": "DONE" }`. Completing a recurring task **creates the next instance** and returns `{ "task": …, "nextInstance": … }`. Re-opening does not delete the generated instance. |

### 2.10 Calendar (Phase 3)

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/v1/calendar?from=2026-09-28&to=2026-10-04` | Unified, read-only feed (max 62-day range → otherwise `400`) |

```json
{
  "items": [
    { "type": "CLASS", "id": "tt_…", "title": "Database Systems", "start": "…T09:00+05:30", "end": "…T09:50+05:30", "domain": "ACADEMICS", "ref": { "kind": "course", "id": "…" }, "meta": { "location": "LH-204" } },
    { "type": "ASSIGNMENT_DUE", "id": "…", "title": "ER diagram", "start": "…T23:59+05:30", "allDay": false, "domain": "ACADEMICS", "urgency": "THIS_WEEK" },
    { "type": "EXAM", … }, { "type": "TASK", … }, { "type": "HACKATHON", … }, { "type": "INTERNSHIP_DEADLINE", … }
  ],
  "load": [ { "date": "2026-09-30", "deadlines": 3, "exams": 0, "classMinutes": 250, "plannedTaskMinutes": 90 } ]
}
```

- Class instances are **expanded server-side** from timetable slots within the semester's date range.
- `load` powers the "workload at a glance" bar.

### 2.11 Dashboard (Phase 1 shell → filled in Phases 2–5)

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/v1/dashboard?date=` | A single aggregate for Home, with sections omitted if hidden in the widget settings |

```json
{
  "date": "2026-09-26",
  "brief": { "needsYouCount": 3, "sentence": "3 things need you today." },
  "today": [ { "type": "CLASS", "start": "09:00", "end": "09:50", "title": "Data Structures", "location": "LH-101" },
             { "type": "TASK", "start": null, "title": "Complete Java assignment", "estimatedMinutes": 90 } ],
  "needsAttention": [ { "kind": "ASSIGNMENT_DUE", "title": "Database assignment", "reason": "Due tomorrow 23:59", "score": 87, "link": "/app/academics/assignments?focus=…" },
                      { "kind": "ATTENDANCE_AT_RISK", "title": "Compilers", "reason": "76.5% · can miss 0 more (target 75%)", "score": 70, "link": "…" } ],
  "academics": { "semesterName": "Semester 3", "gpa": 8.40, "cgpa": 8.62, "credits": 22.0, "lowestAttendance": { "courseName": "Compilers", "percentage": 76.47 } },
  "deadlines": { "next7Days": [ … ], "load": [ … ] },
  "exams": [ { "title": "Data Structures — Mid 1", "daysUntil": 12, "prepPct": 40 } ],
  "productivity": { "doneToday": 2, "openToday": 3, "weekCompletion": { "done": 11, "planned": 15 }, "streakDays": 4 },
  "developer": { "github": { "source": "GITHUB_API", "contributionsThisWeek": 7, "fetchedAt": "…", "stale": false },
                 "activeProjects": 2, "topGoal": { "title": "Spring Boot", "pct": 64 } }
}
```

- **The `needsAttention` score is deterministic and documented** (0–100), for example:
  `score = typeWeight + urgencyWeight(hoursUntilDue) + priorityWeight`
  The weights are constants in `PriorityScorer`, and each item carries a human `reason`, so the ranking is explainable.
- `streakDays` = consecutive days (ending today or yesterday) with ≥1 completed task. It only appears once there's ≥3 days of history, per the brief's "streak where meaningful".

### 2.12 Projects, learning, hackathons, internships (Phase 4)

| Method | Path | Notes |
|---|---|---|
| GET/POST | `/api/v1/projects` | `?status=`; each item has computed `progressPct` + `progressSource` (`MILESTONES` \| `MANUAL`) |
| GET/PUT/DELETE | `/api/v1/projects/{id}` | Detail includes milestones, linked tasks and hackathons |
| POST/PATCH/DELETE | `/api/v1/projects/{id}/milestones[/{mid}]` | `{ "title", "dueOn?" }`, `{ "done": true }` |
| GET/POST | `/api/v1/learning-goals` | Each with `progress: { done, total, pct }` |
| GET/PUT/DELETE | `/api/v1/learning-goals/{id}` | |
| POST/PATCH/DELETE | `/api/v1/learning-goals/{id}/topics[/{tid}]` | Reorder with `{ "position" }` |
| GET/POST | `/api/v1/hackathons` | `?status=` |
| GET/PUT/DELETE | `/api/v1/hackathons/{id}` | `result` is free text entered by the user and never inferred |
| GET/POST | `/api/v1/internships` **P** | `?status=` |
| GET/PUT/DELETE | `/api/v1/internships/{id}` | |
| PATCH | `/api/v1/internships/{id}/status` | `{ "status": "INTERVIEW" }` → appends to the status history |
| GET | `/api/v1/internships/analytics?month=2026-09` | `{ "applied": 9, "interviews": 2, "offers": 0, "responseRate": { "value": 33.3, "formula": "responded / applied", "responded": 3, "applied": 9 } }` |

### 2.13 GitHub (Phase 4)

| Method | Path | Purpose |
|---|---|---|
| PUT | `/api/v1/github/account` | Public mode: `{ "username": "abhiram-c" }`. The server validates the user exists → `400` if not. |
| GET | `/api/v1/github/oauth/start` | Redirects to GitHub (scope `read:user`, CSRF-safe `state` stored in the session) |
| GET | `/api/v1/github/oauth/callback` | Exchanges the code, encrypts the token, redirects to `/app/developer/github?connected=1`. On error: `?error=denied`. |
| DELETE | `/api/v1/github/account` | Disconnects: revokes the token and deletes the account and its snapshots |
| GET | `/api/v1/github/overview` | Profile, top repos, language breakdown, contributions (weekly/monthly) |
| POST | `/api/v1/github/refresh` | Forces a refresh (throttled → `429`) |

- **Every GitHub response** includes `"source": "GITHUB_API"`, `fetchedAt` and `stale: boolean`.
- **Derived values** sit in a separate `"novaMetrics": { … }` block, each with a `formula` string.
- If GitHub is unavailable and a snapshot exists, the response is `200` with `stale: true`. If there's no snapshot, it's `502 UPSTREAM_UNAVAILABLE`.

### 2.14 Insights, notifications, search (Phase 5)

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/v1/insights?window=WEEK` | A list of insights (see below). Only rules whose data exists produce output. |
| GET | `/api/v1/notifications` **P** | `?unread=true` |
| GET | `/api/v1/notifications/unread-count` | Bell badge (cheap query, polled every 60 s while the tab is visible) |
| PATCH | `/api/v1/notifications/{id}` | `{ "read": true }` |
| POST | `/api/v1/notifications/read-all` | |
| GET | `/api/v1/search?q=dbms&limit=5` | `{ "courses": [...], "assignments": [...], "tasks": [...], "projects": [...], "internships": [...], "hackathons": [...] }`. `q` must be ≥ 2 chars. |

**Insight object (traceable by construction)**

```json
{
  "id": "DEADLINE_CLUSTER",
  "severity": "INFO",
  "text": "3 of your 5 deadlines next week fall on Wednesday.",
  "evidence": { "window": "2026-09-28..2026-10-04", "counts": { "2026-09-30": 3, "2026-10-02": 2 } },
  "sources": [ { "kind": "assignment", "id": "…" }, { "kind": "assignment", "id": "…" } ],
  "link": "/app/planner/calendar?view=week&date=2026-09-28"
}
```

Each rule has a minimum-data guard. For example, "task completion rate" needs ≥ 5 planned tasks in the window, and "GitHub activity increased" needs both months to have data. Otherwise the rule stays silent.

### 2.15 Onboarding (Phase 2+)

Onboarding reuses the endpoints above (settings, grading schemes, semesters, courses, timetable, learning goals, GitHub account) and ends with `POST /settings/onboarding/complete`. There's no special onboarding API, which means no duplicated logic.
