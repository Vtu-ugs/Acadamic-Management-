# Security & Production Checklist

This app handles real student PII and financial records. Work through this list
before exposing it beyond a local machine.

## Secrets (do this first)

- [ ] **`JWT_SECRET`** — set a long random value (≥ 32 chars). Generate one:
  ```bash
  openssl rand -hex 32
  ```
  The backend **refuses to boot in `NODE_ENV=production`** if this is unset, too
  short, or still the dev default (`backend/src/config/env.js`).
- [ ] **`DB_PASSWORD`** — set a strong password. Production start-up fails if it
  is empty.
- [ ] Put real values in a git-ignored `.env` (root `.env` for `docker compose`,
  `backend/.env` for local `npm run dev`). Never commit them — see `.gitignore`.
- [ ] Rotate any secret that was ever committed or shared (including the dev
  defaults in `docker-compose.yml` / `.env.example`, which are **not** secret).

## Database

- [ ] Create a **least-privilege MySQL user** for the app (not `root`) with only
  the privileges it needs on the `office_management` schema.
- [ ] Do not expose port 3306 publicly. The compose file binds it to
  `127.0.0.1` only; keep it on a private network in production.
- [ ] Schedule **backups** (e.g. a nightly `mysqldump` to off-box storage) and
  test a restore.

## Transport & network

- [ ] Terminate **HTTPS** in front of the app (reverse proxy / load balancer).
- [ ] Enable HSTS — uncomment the `Strict-Transport-Security` header in
  `frontend/nginx.conf` once TLS is live.
- [ ] Restrict `CORS_ORIGIN` to the real frontend origin(s).

## Runtime protections (already in the code)

- [x] `helmet` security headers on the API; nginx headers (`X-Frame-Options`,
  `X-Content-Type-Options`, `Referrer-Policy`, CSP, `Permissions-Policy`).
- [x] Rate limiting: global API limit + stricter login brute-force limit.
- [x] Request body cap (1 MB JSON) and bounded, type-filtered file uploads.
- [x] Error responses sanitized in production (no stack/DB details leaked).
- [x] Non-root Docker container + graceful shutdown on SIGTERM.
- [x] Passwords hashed with bcrypt; JWT sessions expire (8h).

## Operations

- [ ] Run the API under a process manager (PM2/systemd) or the provided
  container with `restart: unless-stopped`.
- [ ] Ship logs somewhere durable and set a retention policy (audit log lives in
  the `activity_log` table; app logs via `morgan`).
- [ ] Keep dependencies patched (`npm audit`, Dependabot, or similar).

## Reporting

Found a vulnerability? Contact the maintainer privately rather than opening a
public issue.
