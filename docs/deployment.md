# Deployment

NOVA's live demo runs on three free services:

| Part | Host | What it runs |
|---|---|---|
| Frontend | **Vercel** (Hobby) | The Vite build in `frontend/`, plus a proxy: `/api/*` is forwarded to the backend |
| Backend | **Render** (free web service, Singapore) | The Docker image in `backend/Dockerfile`, profile `prod` |
| Database | **Neon** (free, AWS Asia Pacific – Singapore) | PostgreSQL; Flyway creates the tables on the backend's first start |

```
browser ──► nova.vercel.app ──/api/*──► nova-api.onrender.com ──► Neon PostgreSQL
            (static files,      + X-Nova-Proxy-Secret      (Spring Boot,      (scales to zero
             CSP headers)                                   sleeps when idle)   when idle)
```

The browser only ever talks to the Vercel domain, so the session and CSRF cookies are first-party, exactly as in development (where Vite does the proxying).

## How the pieces protect each other

- **Proxy secret.** Vercel adds the header `X-Nova-Proxy-Secret` to every `/api` call. With the `prod` profile the backend refuses to start without `NOVA_PROXY_SECRET` (at least 32 characters) and answers `403` to any `/api` call that doesn't carry it (`ProxyGuardFilter`), except `/api/v1/health`. Calling the Render URL directly therefore gets nowhere.
- **Client IPs.** Because only the proxy can reach the API, the backend trusts the first `X-Forwarded-For` entry, which Vercel sets to the visitor's IP and doesn't let callers forge (`ClientAddress`). Login and demo rate limits use it. Without the secret (local development) forwarded headers are ignored.
- **Cookies.** `prod` sets the Secure flag on the session and XSRF-TOKEN cookies (Render terminates HTTPS, so the app itself sees HTTP).
- **Content Security Policy.** `frontend/vercel.json` allows scripts only from the site itself plus the one inline theme script, by hash. `npm run csp` (also in CI) fails if that script changes without the hash being updated.

## Free-tier behaviour, and what NOVA does about it

| Limit | Effect | Handling |
|---|---|---|
| Render free sleeps after 15 idle minutes; waking takes about a minute, plus Spring Boot's start on 0.1 CPU | The first request after a quiet spell is slow | The site pings `/api/v1/health` as soon as the landing or login page opens; the session check keeps retrying for ~2½ minutes and shows "Waking up NOVA's server…"; the **Keep the demo warm** workflow pings every 10 minutes |
| Render free: 750 instance hours a month per workspace | One service running all month uses ~744 | Keep only this one free service in the workspace |
| Vercel waits up to 120 s for the backend | A very slow wake-up can still time out | Shown as "waking up", retried automatically |
| Neon free scales to zero after 5 idle minutes; 100 CU-hours a month | Each wake-up costs a few hundred milliseconds | Nothing keeps the database awake needlessly: health checks don't query it, the pool keeps no idle connections, and Spring Session's clean-up runs hourly instead of every minute |
| Start-up time on 0.1 CPU | Slow cold starts | The image ships a JDK 25 AOT cache trained at build time (`app.aot`) |

## Run the production image locally (Docker Desktop)

This is the same image and profile Render runs, against the local PostgreSQL from `docker-compose.yml`.

1. In `.env` (copied from `.env.example`), set `NOVA_PROXY_SECRET` to 32+ random characters:
   ```powershell
   # PowerShell
   -join ((48..57)+(65..90)+(97..122) | Get-Random -Count 40 | % {[char]$_})
   ```
2. Build and start the database and backend:
   ```bash
   docker compose --profile app up --build
   ```
   The first build downloads Maven, the dependencies and two JDK 25 images, so it takes a few minutes. Watch for `Started NovaApplication in … seconds` in the log.
3. Check the guard from a second terminal:
   ```bash
   curl -i http://localhost:8080/api/v1/health          # 200: no secret needed
   curl -i http://localhost:8080/api/v1/auth/me         # 403: no secret, like a direct call to Render
   ```
4. Serve the production frontend build through a proxy that adds the secret (like Vercel):
   ```bash
   cd frontend
   npm run build
   npm run preview        # http://localhost:4173
   ```
   Open http://localhost:4173, press **Try the demo**, and click through a few pages.
5. Compare start-up times with and without the AOT cache, at Render's CPU size:
   ```bash
   # PowerShell: $env:NOVA_BACKEND_CPUS="0.1"; docker compose --profile app up
   NOVA_BACKEND_CPUS=0.1 docker compose --profile app up
   NOVA_BACKEND_CPUS=0.1 NOVA_AOT=off docker compose --profile app up
   ```
   Compare the `Started NovaApplication in … seconds` lines.

`docker compose down` stops everything; `docker compose down -v` also deletes the local data.

## Deploy (first time)

Do these in order; each step needs a value from the one before.

### 1. Neon

1. Create a project: Postgres 16, region **AWS Asia Pacific (Singapore)**.
2. Copy the **direct** connection details (turn "Connection pooling" off in the connect dialog; the backend has its own pool, and Flyway needs a direct connection).
3. Turn them into a JDBC URL with user and password kept separate:
   `jdbc:postgresql://<endpoint>.ap-southeast-1.aws.neon.tech/<database>?sslmode=require&channelBinding=require`

### 2. Render

1. **New → Blueprint**, connect the GitHub repository; Render reads `render.yaml`.
2. Fill in `NOVA_DB_URL`, `NOVA_DB_USER`, `NOVA_DB_PASSWORD` (and optionally `GITHUB_SERVER_TOKEN`). `NOVA_PROXY_SECRET` is generated.
3. Wait for the first deploy (it builds the Docker image), then open `https://<service>.onrender.com/api/v1/health`: it should answer `{"status":"UP",…}`. Any other `/api` URL answers `403`, which is correct.
4. Copy the generated `NOVA_PROXY_SECRET` from the service's Environment page.

### 3. Vercel

1. **Add New → Project**, import the repository, set **Root Directory** to `frontend` (framework: Vite; `vercel.json` sets the build).
2. Environment variables (Production and Preview):
   - `NOVA_API_ORIGIN` = `https://<service>.onrender.com` (no trailing slash)
   - `NOVA_PROXY_SECRET` = the value from Render
   - `VITE_REPO_URL` = `https://github.com/<you>/nova` (optional: the landing page's GitHub link)
3. Deploy, open the site, and press **Try the demo**.

### 4. GitHub

1. Repository **Settings → Secrets and variables → Actions → Variables**: add `NOVA_SITE_URL` = the Vercel URL. The **Keep the demo warm** workflow starts pinging; run it once by hand from the Actions tab to check.
2. GitHub pauses scheduled workflows in repositories with no activity for 60 days; re-enable it from the Actions tab if that happens.

## Updating

- Pushing to `main` runs CI. Render deploys the backend once CI passes (`autoDeployTrigger: checksPass`, only when `backend/` changed); Vercel deploys the frontend on every push.
- New database migrations run automatically on the backend's next start.
- Rotating the proxy secret: change it on Render, then on Vercel, then redeploy both (requests fail with `403` in between).

## Not verified yet

These depend on the live services and are checked during the first deploy (Phase 7c):

- that Vercel forwards the visitor's IP to Render as the first `X-Forwarded-For` entry (if not, per-IP limits fall back to Vercel's address; the global demo limits still hold);
- that Vercel passes query strings through the `/api` route unchanged;
- the actual cold-start time on Render's free instance, with and without the AOT cache.
