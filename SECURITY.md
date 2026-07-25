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

- [x] **HTTPS is terminated by the nginx frontend** (`frontend/nginx.conf`):
  port 80 redirects to 443, TLS is served on 443, and HSTS is enabled. The
  cert/key are mounted from `./certs` (see `docker-compose.yml`), never baked
  into the image or committed.
- [ ] **Generate the certificate on the server** (once): `.\scripts\generate-cert.ps1`.
  For a **LAN / IP** deployment this is self-signed — traffic is encrypted, but
  browsers show a one-time "not private" warning that you accept. Note: HSTS is
  ignored by browsers for bare IP addresses; it only takes effect with a hostname.
- [ ] **If you have a public domain**, replace the self-signed cert with a real
  one for a trusted, warning-free connection (see the Let's Encrypt path below).
- [ ] Set `CORS_ORIGIN` to the exact origin users hit, e.g. `https://<server-ip>`
  or `https://ams.example.com` (scheme + host, no trailing slash).

### Upgrading to a trusted certificate (Let's Encrypt)

Only possible once a **domain name** points at the server and ports 80/443 are
reachable. Two common options:

1. **Certbot, then reuse the existing nginx config.** On a host with the domain
   pointing to it, run certbot to obtain a cert, then drop the resulting
   `fullchain.pem` / `privkey.pem` into `./certs` as `server.crt` / `server.key`
   (or point `ssl_certificate*` in `nginx.conf` at their paths). Renew every ~60
   days and restart the frontend container. This keeps the current single-container
   layout.
2. **Front the stack with a proxy that auto-manages TLS** — e.g. Caddy,
   Traefik, or a Cloudflare Tunnel — and let it terminate HTTPS, forwarding to
   the frontend container over the internal network. Least manual renewal work.

With a real cert, remove the browser-warning caveat above; HSTS then applies fully.

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
