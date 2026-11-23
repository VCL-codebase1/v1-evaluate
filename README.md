# V11 Estimate

Workspace app for RFQs, estimation sheets, approvals, and reporting built with Next.js (App Router), React, and TypeScript.

## Local development

```bash
cd v1-evaluate
npm install
cp .env.example .env.local   # then set DATABASE_URL, SESSION_SECRET, JWT_SECRET
npm run db:migrate
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Useful commands:

- `npm run db:migrate` — apply pending SQL migrations from `db/migrations/` (tracked in `schema_migrations`)
- `npm run lint` — run ESLint
- `npm run build` — production build
- `npm start` — run the production server after build

## Environment variables

Copy `.env.example` and set values before deploying:

- `DATABASE_URL` — Postgres connection string (required; use SSL in production/Supabase)
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` — Supabase Auth configuration (required)
- `SESSION_SECRET` — signs the web session cookie (required in production)
- `JWT_SECRET` — signs `/api/v1` access/refresh tokens (required in production)

Use long, random values and keep them private. **Never commit `.env.local` or share credentials.**

## Database & migrations

- Schema changes are managed as ordered SQL files in `db/migrations/` and applied with `npm run db:migrate` (idempotent per migration, recorded in `schema_migrations`).
- The app expects migrations to be applied (it verifies `schema_migrations` on DB access) rather than mutating schema at runtime.
- Initial migration (`0001_init`) creates core tables, indexes, default exchange rates, and counters. `0002_production_auth_hardening` adds auth/reset/throttle tables and removes any legacy seeded demo users from existing databases.

## Estimation sheet

Representatives use the standard cost sheet. Line managers open **Estimation sheet** and get the BRD columns (manufacturer, model, part number, specification, sourcing, freight method, and the NGN totals). The sheet scrolls sideways; a swipe cue stays up until the table moves. Local items do not receive foreign sourcing charges.

## Authentication & API notes

- Web sign-in (`/login`) authenticates against Supabase Auth, then resolves the active organization-scoped workspace profile. Login throttling and lockout state are stored in Postgres.
- No demo accounts are seeded. Provision the first/admin user with `node scripts/create-admin.mjs --email admin@example.com --name "Admin"` (or use the admin UI at `/admin/users` once an Admin exists).
- Password reset: `/forgot-password` requests Supabase Auth recovery email and `/reset-password` consumes the provider recovery session. Configure Supabase Auth email templates and SMTP before deployment.
- Exchange rates: each organization must set positive NGN-per-USD/EUR/GBP rates in **Exchange rates** before saving estimates that use those currencies. No sample foreign exchange values are supplied to new organizations.
- Bearer-token API: `/api/v1/*`. Interactive docs: [http://localhost:3000/api/docs](http://localhost:3000/api/docs). OpenAPI 1.1.0: [http://localhost:3000/api/v1/openapi.json](http://localhost:3000/api/v1/openapi.json). v1 auth/refresh tokens are DB-backed with throttling/lockout and role checks for privileged operations.
- Health check: `GET /api/health` (returns unhealthy unless Postgres and Supabase Auth are configured).

## Provisioning, backups, and operations

- **User provisioning/role admin**: Admin-only APIs `GET/POST /api/admin/users` and `PATCH /api/admin/users/:id` plus UI `/admin/users`. CLI bootstrap: `node scripts/create-admin.mjs ...`.
- **Secrets**: rotate `SESSION_SECRET`, `JWT_SECRET`, and any exposed `DATABASE_URL`/DB passwords before production use. Keep secrets out of source control.
- **Pooling/runtimes**: tune `DB_POOL_MAX`, `DB_IDLE_TIMEOUT`, `DB_CONNECT_TIMEOUT`, `DB_MAX_LIFETIME`, `DB_PREPARE` per runtime (serverless: very small pool; prefer Supabase transaction pooler for serverless; keep `DB_PREPARE=false` with transaction poolers).
- **Backup/restore**: enable automated backups (e.g. Supabase PITR/backups), test restore regularly to a staging DB, document RPO/RTO, and run `npm run db:migrate` after restore before serving traffic.
- **Observability**: auth/admin/security events emit structured JSON logs; forward logs to your platform/SIEM and alert on repeated auth failures, 429s, DB health degradation, and migration failures.

## Production readiness notes

Implemented in-repo: Postgres-backed workspace persistence with explicit migrations, signed/expiring web sessions, DB-backed users and v1 refresh tokens, login/reset throttling and account lockout, Admin user provisioning/role management APIs and UI, password reset token flow (hash stored, single-use/expiry), baseline security headers, DB-aware health check, and a self-hosted API docs page without third-party script dependencies.

Still required for real production deployments:

- **`/api/v1` data parity**: v1 estimate/sheet/workflow/rates/audit/report/dashboard operations now use the same organization-scoped Postgres repository as the workspace.
- **Password reset delivery**: configure and verify Supabase Auth email templates and SMTP in the Supabase project.
- **CSP & defense-in-depth**: add a tailored Content-Security-Policy, CSRF protections where appropriate for cookie-auth flows, and full authorization review of all workspace mutations by role/business ownership.
- **Ops**: configure log aggregation/metrics/alerting, automated backups and tested restores, and CI secrets/DB for the migration+build pipeline (`.github/workflows/ci.yml` expects `DATABASE_URL`, `SESSION_SECRET`, `JWT_SECRET`).
- **Security hygiene**: rotate any credentials/secrets ever exposed outside secure secret stores and restrict database/network access.



- run migrate : **npm run db:migrate** to sync database changes 
