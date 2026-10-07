# Security

## Reporting a vulnerability

Please **don't open a public issue** for a security problem. Report it privately through GitHub:
**Security → Report a vulnerability** on this repository (private vulnerability reporting). Include
what you found, how to reproduce it and what an attacker could do.

You'll get a reply within a week. Once a fix is ready, the advisory is published with credit to you,
unless you'd rather stay anonymous.

## Supported versions

NOVA is a student project without releases yet: only the `main` branch is supported, and fixes land
there.

## What's in scope

The backend API, authentication and sessions, authorisation (one user reaching another's data), and
the frontend. The public demo runs on free hosting tiers, so please don't load-test or attack it; run
NOVA locally instead (see the README).

## How NOVA protects data

- Passwords are hashed with BCrypt; sessions are server-side (Spring Session, PostgreSQL) in an
  HttpOnly, SameSite cookie, Secure behind HTTPS.
- Every state-changing request needs a CSRF token; login attempts are rate-limited.
- Every query is scoped to the signed-in user, and another user's record answers 404, never 403, so
  ids can't be probed. Full-stack tests check this for each feature.
- Errors never include stack traces or internal messages; each response carries a request id for
  support instead.
- No secrets in the repository: configuration comes from environment variables (`.env.example`).
