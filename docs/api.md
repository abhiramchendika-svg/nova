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
| GET | `/api/v1/courses?semesterId=` | Courses of a semester, sorted by name. Without `semesterId`: the current semester's (empty if there's none). Attendance per course comes from §2.5; the course page uses the overview. |
| POST | `/api/v1/courses` | Create → `201`. `{ "semesterId", "code?", "name", "credits", "faculty?", "colorHue?", "notes?", "attendanceTarget?" }` |
| GET | `/api/v1/courses/{id}` | One course |
| GET | `/api/v1/courses/{id}/overview` | The course page in one request (see below) |
| PUT / DELETE | `/api/v1/courses/{id}` | Full replace (same body) / delete → `204` |
| PUT | `/api/v1/courses/{id}/grade` | `{ "gradeDefinitionId", "kind": "FINAL" \| "EXPECTED" }`. `400` if the grade isn't from the semester's scheme. |
| DELETE | `/api/v1/courses/{id}/grade` | Clear the grade → `204` |
| GET | `/api/v1/courses/{id}/resources` | The course's links, oldest first |
| POST | `/api/v1/courses/{id}/resources` | Add a link → `201`: `{ "title", "url" }` |
| PUT / DELETE | `/api/v1/courses/{id}/resources/{resourceId}` | Replace (same body) / remove → `204` |

- Course response: `{ "id", "semesterId", "code", "name", "credits", "faculty", "colorHue", "notes", "attendanceTarget", "grade": null | { "gradeDefinitionId", "label", "points", "passing", "countsInGpa", "kind" } }`.
- Rules: `credits` 0–99.9 with at most 1 decimal; `colorHue` 0–359; the semester must be yours (`400`, the same answer whether it's missing or someone else's). Moving a graded course to a semester with a different grading scheme → `422` (clear the grade first). Up to 40 courses per semester.
- **Links:** only `http://` and `https://` URLs with a host are accepted (`400` on `url` otherwise), so `javascript:`, `data:` and `file:` links can never be stored and later rendered as an `href`. The database checks the scheme too. Title ≤ 120 characters, URL ≤ 2048, up to 50 links per course (`422`). A link is only reachable through its own course.

**Course overview** (`GET /api/v1/courses/{id}/overview`, one read-only transaction):

```json
{
  "course": { "…the course response…" },
  "attendance": { "…the per-course stats object from §2.5…" },
  "openAssignments": [ "…up to 5 open assignments, soonest due first (overdue ones lead)…" ],
  "openAssignmentCount": 6,
  "overdueCount": 1,
  "upcomingExams": [ "…up to 3 exam summaries from today on, soonest first…" ],
  "resources": [ { "id", "courseId", "title", "url", "createdAt" } ],
  "timetable": [ "…the course's weekly classes (§2.8)…" ]
}
```

- `timetable`: the course's weekly classes (entries from §2.8), Monday first.

*(Recent activity comes later.)*

### 2.5 Attendance (Phase 2)

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/v1/attendance?semesterId=` | Per-course stats for a semester (the current one by default; `[]` if there's none) |
| GET | `/api/v1/courses/{id}/attendance` | One course's stats |
| GET | `/api/v1/courses/{id}/attendance/records` **P** | History, newest first (`?page=0&size=20`, size ≤ 100) |
| POST | `/api/v1/courses/{id}/attendance/records` | Mark one class → `201`: `{ "heldOn": "2026-09-26", "slot": 1, "status": "ABSENT" }`. `slot` defaults to 1. |
| PUT | `/api/v1/attendance/records/{recordId}` | Change the status: `{ "status": "PRESENT" }` |
| DELETE | `/api/v1/attendance/records/{recordId}` | Remove a mark → `204` |
| PUT | `/api/v1/courses/{id}/attendance/baseline` | `{ "conducted": 34, "attended": 28 }` → the recalculated stats |

- `status` is `PRESENT`, `ABSENT` or `CANCELLED`. Cancelled classes are kept in the history but never counted.
- Errors: `409` if that course, day and slot is already marked (change or delete the mark instead); `400` for a date in the future (in the user's timezone) or a slot outside 1–12; `422 RULE_VIOLATION` if a baseline has attended > conducted. Another user's course or record returns `404`.

**Per-course stats object**

```json
{
  "courseId": "…", "courseCode": "CSE 201", "courseName": "Database Systems",
  "baselineConducted": 34, "baselineAttended": 28,
  "present": 0, "absent": 1, "cancelled": 1,
  "conducted": 35, "attended": 28, "percentage": 80.00,
  "target": 75.00, "targetSource": "DEFAULT",
  "canMiss": 2, "needToAttend": 0,
  "status": "SAFE"
}
```

- `conducted` and `attended` include the baseline; `present`, `absent` and `cancelled` count marked classes only.
- The target comes from the course, else its semester, else the user's default (`targetSource`: `COURSE`, `SEMESTER` or `DEFAULT`).
- `status`: `SAFE`, `AT_RISK` (at or above target but can miss ≤ 1 more), `BELOW`, `NO_TARGET`, or `NO_CLASSES` (a target is set but nothing has been held yet; `percentage` is `null`).
- With no target anywhere, `target`, `targetSource`, `canMiss` and `needToAttend` are `null` and `status` is `NO_TARGET`. NOVA never invents a policy.

### 2.6 Assignments (Phase 2)

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/v1/assignments` **P** | Filters (all optional): `status` (repeatable), `courseId`, `priority`, `dueFrom` (inclusive), `dueTo` (exclusive). `sort=dueAt,asc` (default) or `createdAt`, either direction. |
| POST | `/api/v1/assignments` | Create → `201`: `{ "courseId", "title", "description?", "dueAt": "2026-10-03T23:59:00+05:30", "priority?", "estimatedMinutes?" }` |
| GET / PUT / DELETE | `/api/v1/assignments/{id}` | Read / full replace (same body; status and progress are untouched) / delete → `204` |
| PATCH | `/api/v1/assignments/{id}/progress` | `{ "status?", "progressPct?" }`, at least one |

- Response: `{ "id", "courseId", "courseCode", "courseName", "title", "description", "dueAt", "priority", "status", "estimatedMinutes", "progressPct", "submittedAt", "completedAt", "urgency" }`.
- `priority`: `LOW`, `MEDIUM` (default), `HIGH`. `status`: `NOT_STARTED`, `IN_PROGRESS`, `SUBMITTED`, `COMPLETED`. Sorting by priority isn't offered: the stored names don't sort meaningfully, and a deadline list sorted by due date is what students scan.
- **Progress rules** (the database checks the same): `COMPLETED` forces 100% and sets `completedAt`; `SUBMITTED` sets `submittedAt`; going back to `NOT_STARTED`/`IN_PROGRESS` clears both, and `NOT_STARTED` means 0%; progress above 0 on a not-started assignment (with no status sent) moves it to `IN_PROGRESS`. Repeating a status keeps its original timestamp.
- **`urgency`** (`OVERDUE`, `DUE_TODAY`, `DUE_TOMORROW`, `THIS_WEEK` = within 7 calendar days, `LATER`) is calculated in the user's timezone from calendar days, not 24-hour windows: 23:30 → 00:15 is "tomorrow". It is `null` for submitted and completed work. It drives the deadline indicators.
- Rules: title ≤ 160, description ≤ 4000, `estimatedMinutes` 1–10000. The course must be yours (`400` on `courseId`, the same answer whether it's missing or someone else's); another user's assignment is `404`.

### 2.7 Exams (Phase 2)

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/v1/exams?upcoming=true&courseId=` | Summaries, soonest first. `upcoming` keeps exams starting **today or later** in the user's timezone (this morning's exam stays until the day ends). |
| POST | `/api/v1/exams` | Create → `201`: `{ "courseId", "title", "kind?", "startsAt", "durationMinutes?", "location?", "topics?": ["Normalization", "Transactions"] }` |
| GET / PUT / DELETE | `/api/v1/exams/{id}` | Detail with topics / full replace (same body; `topics` is ignored) / delete → `204` |
| POST | `/api/v1/exams/{id}/topics` | Add a topic at the end → `201` with the updated exam: `{ "title" }` |
| PATCH | `/api/v1/exams/{id}/topics/{topicId}` | Any of `{ "done", "title", "position" }` → the updated exam |
| DELETE | `/api/v1/exams/{id}/topics/{topicId}` | Remove → `204` |

- Summary: `{ "id", "courseId", "courseCode", "courseName", "title", "kind", "startsAt", "durationMinutes", "location", "daysUntil", "prep": { "done", "total", "percentage" } }`. The detail adds `"topics": [{ "id", "title", "position", "done", "doneAt" }]` in order.
- `kind`: `QUIZ`, `MIDTERM`, `FINAL`, `LAB`, `OTHER` (default). `daysUntil` counts calendar days in the user's timezone: `0` today, `1` tomorrow, negative once past.
- `prep.percentage` is a whole number rounded half-up (1 of 8 → 13), and `null` while the checklist is empty.
- Topic positions are always `0…n-1`: moving a topic shifts the others, deleting renumbers. A `position` outside that range is `400`.
- Rules: title ≤ 120, location ≤ 60, `durationMinutes` 1–1440; topic titles ≤ 160, up to 100 topics per exam and 50 exams per course (`422`). Another user's exam, or a topic from a different exam, is `404`.
- *(Linked study tasks arrive with Tasks in Phase 3.)*

### 2.8 Timetable (Phase 2)

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/v1/timetable?semesterId=` | Every weekly class in a semester (the current one by default; `[]` if there's none), Monday first, then by start time |
| GET | `/api/v1/timetable/day?date=` | A date's classes (today in the user's timezone by default), each with its attendance slot and any mark |
| POST | `/api/v1/timetable` | Create → `201`: `{ "courseId", "dayOfWeek": 1-7, "startsAt": "09:00", "endsAt": "09:50", "kind?", "location?", "instructor?" }` |
| PUT / DELETE | `/api/v1/timetable/{id}` | Full replace (same body) / delete → `204` |

- Entry: `{ "id", "courseId", "courseCode", "courseName", "colorHue", "dayOfWeek", "startsAt", "endsAt", "kind", "location", "instructor", "overlapsWith": [ids] }`.
- `dayOfWeek` is ISO (1 = Monday). Times are `"HH:mm"` on the user's wall clock, stored as `time` without a zone, so a 09:00 class stays at 09:00 across DST. `kind`: `LECTURE` (default), `LAB`, `TUTORIAL`, `OTHER`.
- **Overlap:** overlapping classes are *allowed* (labs sometimes clash with lectures) and come back with `overlapsWith`, so the UI can warn. Only classes in the same semester are compared; one ending at 09:50 and the next starting at 09:50 don't overlap.
- Rules: `endsAt` must be after `startsAt` (`400` on `endsAt`); the course must be yours (`400` on `courseId`); up to 20 weekly classes per course (`422`). Another user's entry is `404`.

**Day view**

```json
{
  "date": "2026-10-05", "dayOfWeek": 1, "semesterId": "…", "inTerm": true,
  "classes": [
    { "entry": { "…entry…" }, "slot": 1, "attendance": null },
    { "entry": { "…entry…" }, "slot": 2, "attendance": { "recordId": "…", "status": "ABSENT" } }
  ]
}
```

- Classes come from the **current** semester, in start-time order. `inTerm` is `false` (and `classes` empty) when there's no current semester, or the date is outside its `startsOn`–`endsOn`.
- `slot` numbers a course's classes that day in start-time order (1, 2 …), the same slot attendance uses, so marking a class from Home is `POST /courses/{id}/attendance/records` with `{ heldOn: date, slot, status }`.

### 2.9 Tasks (Phase 3)

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/v1/tasks/today?date=` | `{ "date", "tasks", "completed" }`: open tasks planned for the date or earlier, or due before it ends (overdue included), in "what now?" order; plus tasks completed that date, newest first. Date defaults to today in the user's timezone. |
| GET | `/api/v1/tasks/upcoming?days=14` | `{ "from", "to", "days": [{ "date", "tasks" }], "unscheduled" }`: open tasks after today, up to `days` (1–62, else `400` on `days`) |
| GET | `/api/v1/tasks/completed` **P** | Done tasks, most recently completed first |
| GET | `/api/v1/tasks` **P** | Filters: `category`, `status` (repeatable), `courseId`, `examId`, `projectId`, `learningGoalId`, `hackathonId`, `internshipId`; `sort=plannedFor\|dueAt\|createdAt[,asc\|desc]` (default newest first; anything else `400` on `sort`) |
| POST | `/api/v1/tasks` | Create → `201`: `{ "title", "description?", "category?", "priority?", "plannedFor?", "plannedStart?", "dueAt?", "estimatedMinutes?", "recurrence?", "courseId?", "examId?", "projectId?", "learningGoalId?", "hackathonId?", "internshipId?" }` |
| POST | `/api/v1/tasks/batch` | `{ "tasks": [ …1–30 task bodies… ] }` → `201 { "tasks": [...] }`. All or nothing; a problem with one is reported on `tasks[i].field` (e.g. `tasks[1].title`). Used by an exam's "Plan my revision" and a learning goal's "Plan my learning". |
| GET / PUT / DELETE | `/api/v1/tasks/{id}` | Read / full replace (same body, status excluded) / delete → `204`. `DELETE ?series=true` also deletes the open repeats planned on or after this one. |
| PATCH | `/api/v1/tasks/{id}/status` | `{ "status": "TODO" \| "IN_PROGRESS" \| "DONE" }` → `{ "task", "nextInstance" }` |

- Task: `{ "id", "title", "description", "category", "priority", "status", "plannedFor", "plannedStart", "dueAt", "estimatedMinutes", "completedAt", "recurrence", "seriesId", "courseId", "courseCode", "courseName", "examId", "examTitle", "projectId", "projectName", "learningGoalId", "learningGoalTitle", "hackathonId", "hackathonName", "internshipId", "internshipName", "overdue", "urgency" }`. `internshipName` reads "Role at Company".
- **Two kinds of date.** `plannedFor` is the day you mean to do it (optionally at `plannedStart`, `"HH:mm"` on your wall clock); `dueAt` is a hard deadline (an instant). Either, both or neither. With neither, a task is "unscheduled" and appears in `upcoming.unscheduled`.
- `category`: `ACADEMIC`, `CODING`, `PERSONAL`, `INTERNSHIP`, `OPEN_SOURCE`, `PROJECT`; defaults to `ACADEMIC` when a course or exam is linked, else `PROJECT` when a project or hackathon is, else `INTERNSHIP` when an application is, else `CODING` when a learning goal is, else `PERSONAL`. `priority`: `LOW`, `MEDIUM` (default), `HIGH`. `estimatedMinutes` 1–1440.
- **Links:** the course and exam must be yours (`400` on `courseId` / `examId`); an exam from a different course than `courseId` is `400` on `examId`; linking only an exam links its course too. The project, learning goal, hackathon and application must be yours (`400` on `projectId` / `learningGoalId` / `hackathonId` / `internshipId`). Deleting any of them keeps the task and clears the link.
- **Today's order:** overdue → due today → priority (high first) → start time (untimed last) → deadline → oldest. Upcoming groups by `plannedFor`, or by the deadline's local day when there's no plan; within a day by start time, then priority.
- `overdue` is `true` for an open task past `dueAt`; `urgency` (as for assignments) is null without a deadline or once done. `completedAt` is set exactly while `status` is `DONE`; completing again keeps the first time.
- **Repeats** (`recurrence`: `NONE`, `DAILY`, `WEEKDAYS`, `WEEKLY`) need `plannedFor` (`400` on `plannedFor`); `plannedStart` needs `plannedFor` too (`400` on `plannedStart`). A repeating task gets a `seriesId`. Completing it creates the next instance (same details; the deadline moves by the same number of days in your timezone) and returns it as `nextInstance`. If that day's instance already exists (e.g. completed, reopened, completed again) `nextInstance` is `null`, and reopening never deletes a generated instance. Two repeats in a series can't share a day (`409`).
- Another user's task is `404`.

### 2.10 Calendar (Phase 3)

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/v1/calendar?from=2026-09-28&to=2026-10-04` | One read-only feed over the timetable, exams, assignments and tasks. Both dates inclusive, in the user's timezone; `to` before `from`, or more than 62 days, is `400` on `to`. |

```json
{
  "from": "2026-09-28", "to": "2026-10-04", "timezone": "Asia/Kolkata",
  "items": [
    { "key": "class:…:2026-09-28", "type": "CLASS", "refId": "…", "title": "Database Systems", "date": "2026-09-28",
      "startTime": "09:00", "endTime": "09:50", "done": false, "courseId": "…", "courseCode": "CSE 201",
      "courseName": "Database Systems", "colorHue": 210, "location": "LH-204", "kind": "LECTURE", "priority": null },
    { "key": "assignment:…", "type": "ASSIGNMENT_DUE", "title": "ER diagram", "date": "2026-09-30", "startTime": "23:59", "endTime": null, "priority": "HIGH", "…": "…" },
    { "key": "task:…", "type": "TASK", "title": "Read notes", "date": "2026-10-01", "startTime": null, "endTime": null, "…": "…" }
  ],
  "load": [ { "date": "2026-09-28", "deadlines": 1, "exams": 0, "hackathons": 0, "internshipSteps": 0, "classMinutes": 250, "plannedTaskMinutes": 90 } ]
}
```

- `type`: `CLASS` (a weekly timetable entry on each matching date inside the current semester's `startsOn`–`endsOn`), `EXAM`, `ASSIGNMENT_DUE` (open assignments only), `TASK` (planned on that day, open or done; `done` says which) `TASK_DUE` (an open task's deadline, unless the task is planned for that same day) and `MILESTONE` (an open project milestone on its due day, untimed; its `refId` is the project, with `projectId` and `projectName` set), `HACKATHON` (each day of a hackathon that isn't skipped, untimed; `kind` is its format, `location` its venue) and `HACKATHON_DEADLINE` (the deadline that matters for its status, §2.12, at its time; `kind` is `REGISTRATION` or `SUBMISSION`, and the title starts "Register:" or "Submit:"). A hackathon item's `refId` is the hackathon. `INTERNSHIP_DEADLINE` (a saved application's apply-by time, titled "Apply: Role at Company") and `INTERNSHIP_STEP` (the next step of an application that isn't rejected or withdrawn, at its time, titled "Company: step"; `kind` is the application's status) point at the application.
- Times are `"HH:mm"` on the user's wall clock. A block (class, exam with a duration, timed task) has both times, with `endTime` `"24:00"` when it runs past midnight; a deadline has only `startTime`; an untimed task has neither. A timed task is as long as its estimate, or 30 minutes without one.
- `key` is unique in the response (a weekly class appears once per date); `refId` is the timetable entry, exam, assignment or task it comes from. The title of a class is its course's name.
- Items are ordered by day, untimed first, then start time, then type, then title.
- `load` has one entry per day in the range: deadlines (assignments, tasks (including a deadline on a task's own planned day) milestones, hackathon deadlines and apply-by dates), exams, hackathons on that day, internship steps, class minutes, and the estimates of open tasks planned that day.

### 2.11 Dashboard (Phase 3; developer activity joins in Phase 4)

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/v1/dashboard` | Home's aggregate for today in the user's timezone: what needs the user, ranked, and the academics and planner summary cards |

Home also uses `/timetable/day` (today's classes), `/tasks/today` (today's tasks), `/calendar` (the next 7 days) and `/exams?upcoming=true`, so this endpoint only carries what isn't available elsewhere.

```json
{
  "date": "2026-10-01",
  "needsAttention": [
    { "kind": "ASSIGNMENT_OVERDUE", "refId": "…", "title": "Scheduler report", "courseCode": "CSE 203",
      "reason": "Overdue by 2 days", "score": 85, "link": "/app/academics/assignments?course=…" },
    { "kind": "ATTENDANCE_AT_RISK", "refId": "…", "title": "Compilers", "courseCode": "CSE 205",
      "reason": "72.5% · below your 75% target; attend the next 3 classes", "score": 70, "link": "/app/academics/courses/…" }
  ],
  "academics": { "semesterId": "…", "semesterName": "Semester 3", "gpa": 8.40, "cgpa": 8.62, "credits": 22.0,
                 "lowestAttendance": { "courseId": "…", "courseName": "Compilers", "percentage": 72.5, "target": 75 } },
  "planner": { "openToday": 3, "doneToday": 2, "weekDone": 11, "weekPlanned": 15, "streakDays": 4 },
  "developer": { "inDevelopment": 1, "activeProjects": 2,
                 "nextMilestone": { "projectId": "…", "projectName": "Bus tracker", "title": "Map shows buses", "dueOn": "2026-10-04", "overdue": false },
                 "activeGoals": 2,
                 "focusGoal": { "goalId": "…", "title": "Spring Boot", "percentage": 40, "nextTopic": "Spring Security", "targetOn": "2026-11-15" } }
}
```

- **`needsAttention`** (at most 8, highest score first, then by title) holds: open assignments and open tasks that are overdue or due within 48 hours (`*_OVERDUE`, `*_DUE_SOON`); current-semester courses whose attendance is below target or at risk (`ATTENDANCE_AT_RISK`); exams within 7 days with under half of a non-empty checklist done (`EXAM_PREP`); a hackathon's deadline that matters (§2.12) within 48 hours or already missed while the event isn't over (`HACKATHON_DEADLINE`); and a hackathon starting within 21 days (or already on) that clashes with an exam (`HACKATHON_EXAM_CLASH`, one per hackathon, naming the first exam); and a saved application's apply-by date within 48 hours or passed in the last 7 days (`INTERNSHIP_DEADLINE`). Each item has a plain `reason` and an in-app `link`.
- **The score is deterministic and documented** (0–100), from `PriorityScorer`, where every weight is a named constant:
  - Overdue work: 60, plus priority, plus 5 per full day overdue (up to 25).
  - Due within 48 hours: 40, plus priority, plus 25 (6 hours or less left), 15 (24 hours or less) or 5.
  - Attendance below target: 55, plus 5 per percentage point short, rounded up (up to 25). At target but able to miss no more classes: 45. Able to miss only one more: 35.
  - An exam within 7 days with prep under 50%: 30, plus 4 per day closer than 7, plus 1 per 5 points of prep missing below 50%.
  - A hackathon deadline within 48 hours: as medium-priority work due soon. Already missed: 45.
  - A hackathon clashing with an exam: 30, plus 2 per day closer than 21 (from 0 once it's on).
  - An apply-by date within 48 hours: as medium-priority work due soon. Passed (within 7 days): 40.
  - Priority adds 15 (high), 8 (medium) or 0 (low).
- **`academics`** is `null` without a current semester. `gpa`/`cgpa` are `null` until there are grades. `lowestAttendance` is the current semester's course with the lowest percentage among those with classes held.
- **`developer`**: `activeProjects` counts projects that are an idea, planning or in development; `nextMilestone` is the soonest open milestone with a due date among them (`null` if none). `activeGoals` counts `ACTIVE` learning goals; `focusGoal` is the active goal with the nearest target date (undated goals after dated ones, then the newest), with its progress `percentage` (`null` without topics) and `nextTopic` (`null` when none is open), or `null` with no active goal. `upcomingHackathons` counts hackathons that aren't past; `nextHackathon` (`hackathonId`, `name`, `startsOn`, `endsOn`, `daysUntil`, `status`) is the one among them with the earliest start date, or `null`. `activeApplications` counts applications that are sent and still in play (applied, assessment, interview, offer); `nextInternshipStep` (`internshipId`, `company`, `role`, `step`, `at`) is the soonest upcoming next step among applications still in play, or `null`. GitHub activity joins in 4e.
- **`planner`**: `openToday`/`doneToday` match `/tasks/today`. `weekPlanned` counts tasks planned in the current week (by the user's week start), and `weekDone` counts how many of those are done. `streakDays` = consecutive days (ending today, or yesterday if nothing is finished yet today) with at least one completed task, looking back up to 60 days; it is `null` until the streak reaches 3.

### 2.12 Projects, learning, hackathons, internships (Phase 4)

| Method | Path | Notes |
|---|---|---|
| GET / POST | `/api/v1/projects` | List, newest first (`?status=` may repeat; none means all) / create → `201` |
| GET / PUT / DELETE | `/api/v1/projects/{id}` | Read / full replace / delete → `204` (milestones go too; linked tasks stay and lose the link) |
| POST | `/api/v1/projects/{id}/milestones` | `{ "title", "dueOn?" }` → `201` with the whole project |
| PUT | `/api/v1/projects/{id}/milestones/{mid}` | Replace title and due date (`null` clears it) → the project |
| PATCH | `/api/v1/projects/{id}/milestones/{mid}` | `{ "done"?, "position"? }` (at least one); `position` moves it and renumbers the rest → the project |
| DELETE | `/api/v1/projects/{id}/milestones/{mid}` | → the project, renumbered |
| GET / POST | `/api/v1/learning-goals` | List, newest first (`?status=` may repeat) / create → `201` (with optional starter `topics`) |
| GET / PUT / DELETE | `/api/v1/learning-goals/{id}` | Read / full replace (`topics` ignored) / delete → `204` (topics and links go too; study tasks stay and lose the link) |
| POST | `/api/v1/learning-goals/{id}/topics` | `{ "title" }` → `201` with the whole goal |
| PATCH | `/api/v1/learning-goals/{id}/topics/{tid}` | `{ "done"?, "title"?, "position"? }` (at least one) → the goal |
| DELETE | `/api/v1/learning-goals/{id}/topics/{tid}` | → the goal, renumbered |
| POST | `/api/v1/learning-goals/{id}/resources` | `{ "title", "url" }` → `201` with the whole goal |
| PUT / DELETE | `/api/v1/learning-goals/{id}/resources/{rid}` | Replace / remove a link → the goal |
| GET / POST | `/api/v1/hackathons` | List: upcoming first (soonest start, undated last), then past (most recent first); `?status=` may repeat / create → `201` |
| GET / PUT / DELETE | `/api/v1/hackathons/{id}` | Read / full replace / delete → `204` (prep tasks stay and lose the link; a linked project is untouched) |
| GET / POST | `/api/v1/internships` **P** | Most recently applied first, saved (no applied date) after, then newest; `?status=` may repeat / create → `201` |
| GET / PUT / DELETE | `/api/v1/internships/{id}` | Read / full replace / delete → `204` (history goes too; prep tasks stay and lose the link) |
| PATCH | `/api/v1/internships/{id}/status` | `{ "status": "INTERVIEW" }` → the application; a real change appends to the history |
| GET | `/api/v1/internships/analytics?month=2026-09` | `{ "month", "applied", "assessments", "interviews", "offers", "rejected", "responseRate": { "value": 33.3, "formula": "responded / applied", "responded": 3, "applied": 9 }, "allTime": { "saved", "applied", "assessment", "interview", "offer", "rejected", "withdrawn" } }` |

**Projects (Phase 4a).** Body: `{ "name", "description?", "techStack?": [..], "repoUrl?", "demoUrl?", "status?", "startedOn?", "targetOn?" }`.

- Project: `{ "id", "name", "description", "techStack", "repoUrl", "demoUrl", "status", "startedOn", "targetOn", "progress": { "done", "total", "percentage" }, "nextMilestone", "openTasks", "milestones": [...], "createdAt" }`; milestone: `{ "id", "title", "dueOn", "position", "done", "doneAt", "overdue" }`.
- `status`: `IDEA` (default), `PLANNING`, `DEVELOPMENT`, `COMPLETED`, `ARCHIVED`.
- **Progress comes only from milestones** (done of total, a whole percentage rounded half-up, `null` with no milestones); it is never stored or set by hand. `nextMilestone` is the first open milestone in checklist order; `overdue` means open and due before today in the user's timezone. `openTasks` counts linked tasks that aren't done.
- `techStack`: trimmed, blanks dropped, case-insensitive duplicates removed (first spelling kept), up to 15 of up to 30 characters (`400` on `techStack`). Links must be full `http(s)://` addresses with a host (`400` on `repoUrl` / `demoUrl`); empty means none. `targetOn` can't be before `startedOn` (`400` on `targetOn`).
- Milestones are kept in a dense 0…n−1 order, like exam topics. Up to 100 projects per user and 100 milestones per project (`422`). Another user's project or milestone is `404`.
- Tasks link to a project with `projectId` (§2.9). Open milestones with a due date appear on the calendar (§2.10) and Home (§2.11).

**Learning goals (Phase 4b).** Body: `{ "title", "description?", "status?", "targetOn?", "topics?": [..] }`; `topics` (up to 100, each 1–160 characters, `400` on `topics[i]`) is read on create only.

- Goal: `{ "id", "title", "description", "status", "targetOn", "progress": { "done", "total", "percentage" }, "nextTopic", "openTasks", "topics": [...], "resources": [...], "createdAt" }`; topic: `{ "id", "title", "position", "done", "doneAt" }`; resource: `{ "id", "title", "url" }`.
- `status`: `ACTIVE` (default), `PAUSED`, `DONE`. Title 1–100 characters, description up to 4000.
- **Progress comes only from topics**, as for projects (whole percentage rounded half-up, `null` without topics). `nextTopic` is the first open topic in order; `openTasks` counts linked tasks that aren't done.
- Topics keep a dense 0…n−1 order; a `position` outside it is `400` on `position`. Resource links must be full `http(s)://` addresses (`400` on `url`), titles 1–120 characters.
- Up to 50 goals per user, 100 topics and 20 links per goal (`422`). Another user's goal, topic or link is `404`.
- **Study tasks** link with `learningGoalId` (§2.9). "Plan my learning" is the client-side revision planner (as for exams): one task per unfinished topic without a task yet, spread from today to the target date (or 14 days without one), saved through `POST /tasks/batch` with category `CODING`.

**Hackathons (Phase 4c).** Body: `{ "name", "organizer?", "mode?", "location?", "websiteUrl?", "startsOn?", "endsOn?", "registrationDeadline?", "submissionDeadline?", "status?", "teamName?", "teamMembers?", "projectId?", "result?", "repoUrl?", "demoUrl?", "certificateUrl?", "notes?" }`.

- Hackathon: the body's fields (deadlines as instants) plus `projectName`, `past`, `daysUntil`, `deadline`, `examClashes`, `openTasks` and `createdAt`.
- `status` is progress only: `INTERESTED` (default), `REGISTERED`, `PARTICIPATING`, `SUBMITTED`, `FINISHED`, `SKIPPED`. **How it went is `result`**: free text the user writes (up to 160 characters), never inferred. `mode`: `ONLINE`, `OFFLINE`, `HYBRID`.
- **`past`**: finished or skipped, or its last day (`endsOn`, else `startsOn`) is before today in the user's timezone. Undated and open is never past. `daysUntil` counts days from today to `startsOn` (negative once it has started; `null` when undated).
- **`deadline`** is the one that matters for the status, `{ "kind", "at", "missed" }`: registration while `INTERESTED` (else submission), submission while `REGISTERED` or `PARTICIPATING`, none after that or once past. `missed` means it has passed.
- **`examClashes`**: exams on a day from two days before the start to two days after the end, as `{ "examId", "title", "courseCode", "on" }` by time; empty once past or when undated.
- `endsOn` needs `startsOn` (`400` on `startsOn`) and can't be before it (`400` on `endsOn`); registration can't close after submissions (`400` on `registrationDeadline`). Links must be full `http(s)://` addresses (`400` on the field). The project must be yours (`400` on `projectId`). Name 1–120 characters; organiser and venue up to 120, team name 80, teammates 500 (free text: teammates aren't NOVA users), notes 4000.
- Up to 100 hackathons per user (`422`). Another user's hackathon is `404`.
- **Prep tasks** link with `hackathonId` (§2.9). Hackathon days and the deadline that matters are on the calendar (§2.10); deadlines, exam clashes and the next hackathon are on Home (§2.11).

**Internships (Phase 4d).** Body: `{ "company", "role", "location?", "jobUrl?", "source?", "status?", "appliedOn?", "deadlineAt?", "nextStep?", "nextStepAt?", "resumeVersion?", "notes?" }`.

- Application: the body's fields (instants for `deadlineAt` and `nextStepAt`) plus `deadlineMissed`, `openTasks`, `history` (`[{ "fromStatus", "toStatus", "changedAt" }]`, oldest first; the first has no `fromStatus`), `createdAt` and `updatedAt`.
- `status`: `SAVED`, `APPLIED` (default), `ASSESSMENT`, `INTERVIEW`, `OFFER`, `REJECTED`, `WITHDRAWN`. Rejected and withdrawn are closed; the board shows the rest. Any stage can follow any other.
- **Applied date:** anything past `SAVED` has one; when it's missing (on create, update or a status change) it becomes today in the user's timezone. On update, a missing `appliedOn` keeps the current one.
- **Dates that matter:** `deadlineAt` (apply by) only while `SAVED`, and `deadlineMissed` once it has passed; the next step while the application isn't closed.
- **Analytics** count the stages an application has ever reached (its history plus its current status), so moving on from an interview still counts the interview. A month's numbers cover applications whose `appliedOn` is in that month (default: this month in the user's timezone; `400` on `month` unless "YYYY-MM"). "Responded" means it reached assessment, interview, offer or rejected; withdrawing isn't an answer. `responseRate.value` = responded ÷ applied × 100, one decimal rounded half-up, `null` with nothing applied. `allTime` counts how many reached applied, assessment, interview and offer, and how many are saved, rejected or withdrawn now.
- Company and role 1–120 characters; location and next step up to 120, source and resume version 60, notes 4000. `jobUrl` must be a full `http(s)://` address (`400` on `jobUrl`). Up to 1000 applications per user (`422`). Another user's application is `404`.
- **Prep tasks** link with `internshipId` (§2.9). Apply-by dates and next steps are on the calendar (§2.10); apply-by dates, the count in play and the next step are on Home (§2.11).

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

- **Phase 2 flow** (`/app/welcome`): You (time zone, university, attendance target → `PUT /settings`) → Semester (`POST /semesters`) → Courses (`POST /courses`, one per row) → Timetable (`POST /timetable`, skippable) → Goals (one learning goal with starter topics, `POST /learning-goals`, skippable; Phase 4b) → `POST /settings/onboarding/complete` → Home. "Skip setup" calls the same completion endpoint. A GitHub step joins in 4e.
- Home sends an account whose `onboardingCompleted` is `false` (from `/auth/me`) to `/app/welcome`; deep links into the app are never redirected.
- Resuming uses saved data, not a stored step: no current semester → the first step (pre-filled); a semester without courses → Courses; otherwise → Timetable.
- Migration V7 marks accounts that already had a semester before onboarding shipped as onboarded, so existing users never see it.
