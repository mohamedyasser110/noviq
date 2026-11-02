# Noviq — Railway Deployment

Two Railway services in one project. The split mirrors the architecture
that already ships in `docker-compose.yml`: a stateless Next.js tier and
a stateful Express + SQLite tier.

| Service | Directory | Public domain role | State |
|---|---|---|---|
| `noviq-api` | `backend/` | API + admin panel | Railway **volume** (SQLite + uploads) |
| `noviq-web` | `frontend/` | Public website | stateless |

**Order matters.** The frontend is statically generated and its build
prerenders every page by calling the API. Deploy the API first so the
frontend build has something to talk to.

---

## 1. What changed for Railway

| File | Change | Why |
|---|---|---|
| `backend/Dockerfile` | `ENTRYPOINT docker-entrypoint.sh`, storage under `STORAGE_DIR=/app/storage` | a Railway volume is root-owned; the app runs as `node` |
| `backend/docker-entrypoint.sh` | **new** — chowns the volume, then `su-exec node` | better-sqlite3 cannot open a DB it cannot write |
| `backend/.dockerignore` | dropped `.agent-system`; ignore all of `data/` | `app.js` does `require('./.agent-system/message-bus')` — the old ignore list made the image crash on boot |
| `backend/railway.json`, `frontend/railway.json` | **new** | builder + healthcheck + start command, declarative |
| `backend/.railwayignore`, `frontend/.railwayignore` | **new** | keeps `node_modules` / `.next` / `old-version` out of the upload |
| `frontend/next.config.mjs` | `rewrites()` for `/images/:path*`, gated on `API_INTERNAL_URL` | CMS stores uploads as the relative `images/uploads/<file>`; the two tiers have separate filesystems on Railway |
| `frontend/Dockerfile` | ships `i18n.ts` + `i18n/` into the runner | `next start` re-reads `next.config.mjs`, which hands next-intl that path |
| `backend/scripts/snapshot-db.js` | **new** | folds the local WAL into one file so the DB can be migrated |

`frontend/.env.local` is excluded by `frontend/.dockerignore`, so the local
`NEXT_PUBLIC_API_URL=http://127.0.0.1:4322` never leaks into the build.

---

## 2. Environment variables

### `noviq-api`

| Variable | Value |
|---|---|
| `NODE_ENV` | `production` |
| `PORT` | `4322` |
| `STORAGE_DIR` | `/app/storage` |
| `DB_PATH` | `/app/storage/noviq.db` |
| `UPLOADS_DIR` | `/app/storage/uploads` |
| `JWT_SECRET` | 64-char random hex — **the server refuses to boot without it** |
| `ADMIN_PASSWORD` | strong password for `admin` at `/admin` |
| `FRONTEND_URL` | `https://<web-domain>` (CORS allowlist) |
| `FRONTEND_REVALIDATE_URL` | `https://<web-domain>` (no trailing slash) |
| `REVALIDATE_SECRET` | same value as on `noviq-web` |

### `noviq-web`

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_API_URL` | `https://<api-domain>` — **build-time**, triggers a rebuild on change |
| `API_INTERNAL_URL` | `http://noviq-api.internal:4322` — server-side + the `/images` proxy |
| `REVALIDATE_SECRET` | must match the API |
| `NODE_ENV` | `production` |

Railway injects service variables at build time, but a Dockerfile only
reads them where an `ARG` is declared — `frontend/Dockerfile` already
declares `ARG NEXT_PUBLIC_API_URL`, so no change was needed.

---

## 3. Volume

```bash
railway volume add --mount-path /app/storage <api-service>
```

One volume holds both the database and the uploads
(`/app/storage/noviq.db` + `/app/storage/uploads`). Keep the mount path
identical to `STORAGE_DIR`.

---

## 4. Deploy

```powershell
# One command does the lot: project, both services, variables, volume,
# api deploy, web deploy, then CORS pointed back at the web domain.
.\deploy-railway.ps1

# Add -MigrateDb to also push the local database onto the volume.
.\deploy-railway.ps1 -MigrateDb
```

Secrets are generated on first run and written to `.env.railway`
(gitignored) so re-runs keep the same `JWT_SECRET` — rotating it would
invalidate every issued admin session.

<details>
<summary>Manual equivalent</summary>

```bash
# --- API first: the web build prerenders pages against it -------------
cd backend
railway link --service api
railway up

# --- then the web tier -------------------------------------------------
cd ../frontend
railway link --service web
railway variables set --service api "NEXT_PUBLIC_API_URL=https://<api-domain>"
railway up
```

`railway up` from `backend/` uploads that directory only, so each service
gets its own build context and its own `railway.json`.
</details>

---

## 5. Verify before you deploy

Two checks that need no Railway account:

```bash
# Boots the API exactly as the container will: production env, real
# secrets, EMPTY storage dir — so db/init has to create and seed a new
# SQLite file just like on a fresh volume. 8 assertions.
cd backend && node scripts/verify-railway-boot.js
```

```
  ok 1  app.js loaded (incl. .agent-system/message-bus)
  ok 2  database created (4 KB)
  ok 3  seeded 14 tables
  ok 4  admin user present in admin_users (1)
  ok 5  /api/health -> 200 {"status":"ok",...}
  ok 6  /admin -> 301
  ok 7  CORS allows the configured FRONTEND_URL
  ok 8  CORS rejects an unknown origin
```

> The test binds port **0**, not 4322. That is deliberate: your own dev
> backend holds 4322, so a rehearsal that silently answers from that
> process looks like it passed while testing nothing.

```bash
# Folds the local WAL into one file so the DB can be migrated.
node scripts/snapshot-db.js
```

---

## 6. Migrating the local database

A fresh volume is seeded by `db/init.js`, which reproduces the shipped
defaults — **not** your local edits. To bring the real content over:

```bash
# 1. stop the local backend, then fold the WAL into one file
cd backend && node scripts/snapshot-db.js

# 2. push it to the volume (restart the service afterwards)
cd backend
Get-Content -AsByteStream -ReadCount 0 data\noviq.db |
  railway ssh --service api "cat > /app/storage/noviq.db && chown node:node /app/storage/noviq.db"
railway restart --service api
```

Uploads are separate files. Copy `frontend/public/images/uploads/` the
same way, or re-upload through `/admin` after the first deploy.

---

## 7. Verify after deploy

```bash
curl https://<api-domain>/api/health      # { status: 'ok' }
curl https://<web-domain>/en              # 200
curl https://<web-domain>/api/health      # proxies to the API
curl -I https://<web-domain>/images/uploads/<file>   # proxied to the API
```

Admin panel: `https://<api-domain>/admin` (user `admin`).

---

## 8. Gotchas

Every item below was actually hit during this deployment, not
hypothetical. Each one presents as a confusing symptom rather than as its
own cause.

- **A 502 on the whole site means the domain has no target port.**
  `railway domain` creates a Railway service domain with `Target port: -`
  and the proxy then has nowhere to send traffic — even though the
  container is listening and the logs say `✓ Ready`. Fix:
  `railway domain update <domain> --port <port> -s <service>`.

- **Private DNS is `<service>.railway.internal`, not `<service>.internal`.**
  Confirm with `railway private-network status -s <svc> --json` and copy
  the `hostname` field. A wrong value fails as a 502 `UPSTREAM_UNAVAILABLE`
  from the proxy route, which looks like the backend is down.

- **`rewrites()` is evaluated at BUILD time, not at runtime.** Next.js
  writes the result into `.next/routes-manifest.json`. A rewrite gated on a
  runtime-only variable silently produces a build with **no rewrite at
  all**, and only the misses 404. Use a build-time variable
  (`NEXT_PUBLIC_API_URL`) for anything inside `rewrites()`. Verify with:
  `jq .rewrites.afterFiles .next/routes-manifest.json` after a local build.

- **One volume for both the DB and uploads publishes the database.**
  `app.js` serves the uploads *parent* at `/images`, so with
  `DB_PATH=/app/storage/noviq.db` and `UPLOADS_DIR=/app/storage/uploads`
  the file is downloadable at `/images/noviq.db` — plus the `-wal` and
  `-shm` siblings. `app.js` now refuses the parent mount when the database
  lives inside it. `verify-railway-boot.js` asserts both halves of this.

- **`revalidatePath('/en', 'layout')` does not purge a dynamic segment.**
  `/en` is the *resolved* form of `[locale]`. The purge logs as executed,
  the route re-renders, and the page still serves old content for 100s+.
  Use `revalidatePath('/', 'layout')` — the root layout is the one target
  every route is nested under.

- **A rate-limited API read looks exactly like a caching bug.** The
  frontend degrades silently: `lib/team-content.ts` catches any error and
  falls back to the static seed, so a 429 presents as "my save did not
  take, I'll press save again". A save triggers a revalidation burst that
  re-renders many pages at once, which is what trips the limit. The `api`
  bucket is 600/min for this reason; `auth`, `admin-login` and `imagegen`
  stay tight. Change it live with `backend/scripts/raise-rate-limit.js`.

- **A failed deploy keeps serving the previous image.** `railway status`
  shows `Online · Deploy failed` while the site is perfectly healthy, so
  the new code silently did not land. Always read
  `railway deployment list -s <svc>` for SUCCESS, not `railway status`.

- **`railway.json` is deprecated** (works until 2026-12-01) in favour of
  `.railway/railway.ts`. `railway config migrate` converts it.

### Verifying an admin save actually propagates

```bash
cd backend
node scripts/measure-cms-latency.js <web-origin> <api-origin> team
```

Polls the page every 500ms after a save and restores the original content.
Healthy is well under a second; anything past ~2s means a purge is being
missed. `scripts/diagnose-stale-cms.js` is the same idea at fixed offsets,
kept because the two disagreeing is what exposed the rate limit.

## 9. Scripts

All of these take a live origin, run against the real deployment, and
restore anything they change.

| Script | What it proves |
|---|---|
| `verify-railway-boot.js` | production boot: seed, admin user, health, CORS, DB not exposed, uploads served (10 checks) |
| `measure-cms-latency.js` | an admin save is visible in under a second |
| `audit-images.js` | every image on every page returns 200 |
| `verify-upload-live.js` | upload → API serves it → site serves identical bytes |
| `push-brand.js` | copy the local social/brand fields to a live deployment |
| `raise-rate-limit.js` | widen the public API bucket without a redeploy |
| `snapshot-db.js` | fold the local WAL into one migratable file |
| `dump-brand.js` | show which CMS social fields exist locally |

