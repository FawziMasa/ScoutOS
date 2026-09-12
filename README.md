# ScoutOS

ScoutOS is a production-oriented Scout group operations system. It combines
multi-unit account administration, Scout records, immutable points history,
attendance, Events, Gallery, and Finance in one role-aware web application.

## Architecture

- `frontend/` — React 19, TypeScript, Vite, responsive role-aware UI.
- `backend/` — Node.js 20 HTTP API, bearer sessions, `scrypt` password hashes.
- `backend/database/schema.js` — additive, self-healing MySQL schema bootstrap.
- `database/` — fresh-install and reference SQL migrations.
- `docs/` — deployment, permissions, module, and audit notes.

The API supports `ADMIN`, `GROUP_LEADER`, `UNIT_LEADER`, and `SCOUT`. Unit
Leaders can be assigned to several canonical units through `user_units`.
Authorization is enforced from the authenticated database account on the
backend; frontend navigation is only the matching user experience.

## Current modules

- Account setup, login, session invalidation, and secure password reset.
- Admin-only Scout invitations with self-service password setup, explicit
  invitation states, resend/revoke controls, and soft deactivation.
- Multi-unit Scout CRUD, points ledger and leaderboard.
- Unit-scoped attendance sessions, history, status/date/search filters.
- Events and unit-scoped registration management.
- Gallery albums, batch image upload, search, grid, and lightbox.
- Finance drafts, Admin approvals, immutable status history, approved reversals,
  scope-safe CSV export, totals, balance/debt state, filters, and refresh.
- Scout portal for own profile, points, and attendance history.

## Local development

Prerequisites: Node.js 20+ and a MySQL database.

Backend:

```powershell
cd backend
Copy-Item .env.example .env
npm ci
npm run migrate
npm run dev
```

Fill `backend/.env` with local database values and long random secrets first.
Never commit that file. The API listens on `http://localhost:4000` by default.

Frontend, in a second terminal:

```powershell
cd frontend
npm ci
npm run dev
```

Vite proxies `/api` to the local backend. For a separate backend, copy
`frontend/.env.example` to `.env.local` and set `VITE_API_URL` to the backend
URL including `/api`.

## Verification

```powershell
cd backend
npm run check
npm test

cd ../frontend
npm run lint
npm run build
```

With database credentials configured, run the read-only production integrity
audit after migrations:

```powershell
cd backend
npm run migrate
npm run audit:data
```

GitHub Actions repeats the backend and frontend checks for pushes to `main` and
for pull requests.

## Deployment

### Render backend

- Root directory: `backend`
- Build command: `npm ci`
- Start command: `npm start`
- Health path: `/api/health`
- Configure the database, `FRONTEND_URL`, `BACKEND_PUBLIC_URL`, `JWT_SECRET`,
  SMTP variables, and optional Cloudinary variables from `.env.example`.

The startup bootstrap is additive and runs before the server accepts requests.
For an explicit release step, run `npm run migrate`, then `npm run audit:data`.

### Vercel frontend

- Root directory: `frontend`
- Build command: `npm run build`
- Output directory: `dist`
- Set `VITE_API_URL=https://<render-service>/api`.

`frontend/vercel.json` rewrites browser routes to the SPA entry point, including
password-reset and Scout invitation pages.

## Operations and security notes

- Production must use a stable `JWT_SECRET`; otherwise sessions are invalidated
  when an ephemeral host regenerates the fallback secret.
- Password reset uses Brevo SMTP with a verified sender, an SMTP key (not an API
  key), port 2525, `SMTP_SECURE=false`, and IPv4 (`SMTP_FAMILY=4`).
- Gallery media is served through one-hour signed links. Production should set
  a stable `GALLERY_MEDIA_SECRET`, or it falls back to `JWT_SECRET`.
- Gallery never relies on Render's local filesystem. Cloudinary is recommended;
  a persistent MySQL file table is the built-in fallback.
- Account deletion is soft deactivation and Scout deletion is archival, keeping
  attendance and points history intact.

See [access control](docs/access-control.md),
[password reset deployment](docs/password-reset.md),
[Scout account invitations](docs/account-invitations.md),
[Gallery](docs/gallery.md), [Finance](docs/finance.md), and the
[security/regression audit](docs/security-regression-audit.md). Production
release, backup, restore, and rotation steps are in the
[operations runbook](docs/operations.md).
