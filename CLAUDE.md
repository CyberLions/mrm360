# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

MRM360 — a club management platform for the Penn State Cybersecurity Club: members, teams,
events/attendance, payments, inventory, and heavy integration with external self-hosted
services (Authentik OIDC, Discord, Nextcloud, Wiki.js, ListMonk, Wiretap, Defguard, GitHub).

pnpm workspace with two packages: `frontend/` (Vue 3 + Vite) and `backend/` (Next.js API +
BullMQ worker). Node 22, pnpm.

## Commands

Run from the repo root unless noted:

```bash
pnpm install                # install both workspaces
pnpm dev                    # runs frontend + backend (parallel). Backend also spawns the worker.
pnpm build                  # build both
pnpm lint                   # lint both (eslint --fix in each)
```

Backend (`cd backend`):

```bash
pnpm dev                    # prisma generate + next dev on :3011 + tsx worker
pnpm worker                 # run the BullMQ worker alone (src/tasks/worker.ts)
pnpm db:generate            # prisma generate  (also run after schema edits)
pnpm db:push                # push schema to DB without a migration
pnpm db:migrate             # prisma migrate dev (creates a migration)
pnpm db:studio              # Prisma Studio
pnpm test                   # vitest run
pnpm test:watch
pnpm exec vitest run src/__tests__/semester.test.ts   # single test file
pnpm run type-check         # NOTE: not defined here; use `pnpm exec tsc --noEmit`
pnpm create-admin           # scripts/create-admin.ts — promote a user to ADMIN
```

The many `test:*` and `check*` scripts in `backend/package.json` are **manual integration probes**
against live external services (`scripts/test*.ts`), not part of the automated suite. The real
unit tests live in `backend/src/__tests__/` and run under vitest.

Frontend (`cd frontend`): `pnpm dev` (:3010, proxies `/api` → `:3011`), `pnpm build`,
`pnpm type-check` (vue-tsc), `pnpm lint`.

### Local infra

Use the devcontainer (`.devcontainer/`) — it brings up Postgres (:3012), Redis (:3013), and
runs `prisma generate` + `db push` on create. Otherwise supply your own Postgres + Redis via
`backend/.env` (copy `backend/env.example`; frontend `frontend/env.example`).

## Architecture

### Backend request flow

Next.js **API routes only** (`backend/src/pages/api/**`) — there is no Next.js UI. A route
handler composes middleware wrappers and delegates all real work to a **manager**:

```
withCORS( withAuth( withPermissions( handler, ['users:read'] ) ) )
```

- `middleware/authMiddleware.ts` — `withAuth` expects `Authorization: Bearer <JWT>`, verifies it,
  loads the user, and attaches `req.user` with an **effective role**.
- `middleware/permissionMiddleware.ts` — `withPermissions` does string-based `resource:action`
  checks against a role→permissions map. `permissions/abilities.ts` additionally defines CASL
  abilities (`defineAbilitiesFor(user)`) used inside managers for row-level checks.
- `middleware/errorHandler.ts` — `handleApiError` / `ApiError`; throw these from managers.
- Input validation is **Zod** schemas declared at the top of each route file.
- Swagger docs are JSDoc `@swagger` blocks above handlers; served at `/api/docs` (spec) and
  `/docs` (UI).

**Managers** (`src/managers/*Manager.ts`) hold all business logic and own Prisma access. Routes
should stay thin. Prisma client singleton: `@/models/prismaClient`.

### Roles — system role vs class rank

`Role` enum mixes two concepts. `ADMIN | EXEC_BOARD | MEMBER` are **system roles** (permissions);
`FIRST_YEAR | SECOND_YEAR | … | ALUMNI_OTHER` are **class ranks** (used only for Discord role
assignment). Always normalize with `getEffectiveSystemRole()` from `@/utils/roleUtils` before
making an authz decision — a class-rank value there means `MEMBER`. Membership of the Authentik
groups `tech-team` or `executive-board` (`hasAdminGroups()`) elevates a user to `ADMIN` at
request time regardless of the stored role.

### Auth

OIDC via Authentik. The **frontend** drives the OAuth2 authorization-code flow
(`frontend/src/utils/oauth.ts`), stores `accessToken` in `localStorage`, and sends it as a
Bearer token on every API call (`frontend/src/services/api.ts` interceptor). Backend
`/api/auth/*` = `login`, `logout`, `session`. Redis-backed sessions in
`utils/sessionManager.ts` (24h TTL, `session:` prefix).

The app is served under multiple hostnames (e.g. `join.` mirrors `mrm.`). Authentik only
redirects to one canonical `redirect_uri` host, so `oauth.ts` hops to the canonical host before
starting the flow and mirrors CSRF state + post-login target into a cookie scoped to the shared
parent domain. Be careful editing this — per-origin storage does not survive the subdomain hop.

### Background jobs (BullMQ + Redis)

`src/tasks/queue.ts` declares ~11 named queues (`QUEUE_NAMES`). `src/tasks/worker.ts` is the
single entrypoint that instantiates a `Worker` per queue; each processor lives in
`src/tasks/workers/*Worker.ts` and exports `processXJob` + `processXJobFailed`. Producers are
`src/services/*QueueService.ts` and the managers. `BackgroundTask` (Prisma) tracks long-running
jobs and subtasks surfaced in the UI (`taskManager`, `/api/tasks`).

Team provisioning is the big one: creating/updating a `Team` fans out to Authentik groups,
Nextcloud group folders, Wiki.js pages/permissions, Discord channels+roles, and optionally
GitHub teams / Wiretap projects — see `teamProvisioningManager` and
`workers/teamProvisioningProcessor.ts`.

### External service integration pattern

Each integration in `src/services/` follows the same shape:

- `xService.ts` — the client-facing API
- `xServiceFactory.ts` — `createServiceFromEnv()` / `createService(config)`; validates config
- `xConfigValidator.ts` (`src/utils/`) — env/config validation, warns on mock/placeholder values
- `xApiClient.ts` — low-level HTTP
- `xTransformers.ts` — map external ↔ internal shapes

All external config is read from env with mock fallbacks (`src/config/externalServices.ts`), so
the app boots without any integration configured — calls just fail/no-op. Discord role/channel
IDs are stored in the `DiscordConfig` table, populated by `scripts/populate-discord-config.ts`
(also runs on worker startup).

### Frontend

Vue 3 `<script setup>` + TS, Vite, Pinia, Vue Router, Tailwind, vee-validate/yup.

- Runtime config: **not** Vite env vars. `public/env.js` sets `window.ENV` and is regenerated
  from `env.js.template` by the nginx container entrypoint at deploy time. Access via
  `window.ENV.VITE_*`.
- `src/services/api.ts` — single `ApiService` class wrapping axios; attaches the Bearer token,
  and on a missing token for a non-auth request triggers `authStore.handleNoAuthentication()`.
- One Pinia store per domain in `src/stores/` (`authStore`, `userStore`, `eventStore`, …).
- `src/router/index.ts` — `/` and unknown paths go to `/join` for anonymous visitors (the
  onboarding entry point) and `/dashboard` for logged-in users. Direct navigation to a
  protected route sends anonymous users straight to Authentik login; the guard also sends
  authenticated-but-not-onboarded users to the public `/join` flow (`onboardingCompleted` from
  the session response, `meta.onboarding` marks the exempt routes). Route guards also use
  `composables/usePermissions`.
- Two layouts: `DefaultLayout` and `KioskLayout` (unattended check-in / inventory kiosk pages).
- QR codes: members get a QR for event check-in; kiosk pages scan via `@zxing/browser`.

### Database

Prisma + Postgres, schema at `backend/prisma/schema.prisma`. Core entities: `User`, `Group` /
`UserGroup` (Authentik mirror), `Team` / `UserTeam` (self-referential parent/subteams),
`Event` / `RSVP` / `CheckIn`, `WorkshopSeries` (semester-aware recurring events), `Payment`
(dues, semester/yearly), `InventoryBin` / `InventoryItem` / `ItemLoan`, `DiscordAccount` /
`DiscordConfig`, `BackgroundTask`. `utils/semester.ts` derives the current semester used by
assignments and payments.

## Conventions

- Backend path alias `@/*` → `backend/src/*` (mirrored in `tsconfig.json`, `vitest.config.ts`).
  Frontend `@/*` → `frontend/src/*`.
- `next.config.js` sets `typescript.ignoreBuildErrors` when `NEXT_IGNORE_TYPE_ERRORS=true` —
  container builds use this because there are known legacy type errors outside the prod route
  bundle. Don't rely on `next build` to catch type errors; run `tsc --noEmit`.
- Logging: `@/utils/logger` (backend). Don't `console.log` in backend code.
- Timezone for outgoing emails / ICS invites comes from the `TIMEZONE` env var (IANA id).

## Deployment

`.github/workflows/build-and-deploy.yml` on push to `main` / `staging`: builds three images
(backend, worker, frontend — Dockerfiles in `*/.docker/`) to `registry.psuccso.org`, then
redeploys the Rancher/k8s deployments. Backend and worker are **separate containers** from the
same image tree — the API container runs `next start`, the worker container runs the compiled
`dist/worker.cjs`. Production must run `next start` (not `next dev`, which does runtime builds
and verbose query logging).
