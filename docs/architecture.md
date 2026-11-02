# Noviq — Architecture & Ownership Map

This file is the single place that explains **how the project is organised and
why**, so a developer can locate, understand and change code without guessing.
It documents the *current* layout (Next.js 15 App Router + Express backend)
and the rules that keep it that way. It does not replace the code — point at
the file, read the rules here, then make the change.

> Status: updated 2026-09-26. If a section is no longer true, fix the section
> in the same commit as the code change.

---

## 0. Deployment shape: split (API-only backend + Next.js UI)

The canonical shape is **two processes**:

| Process | Port | Role |
|---|---|---|
| `frontend/` (Next.js 15) | 3000 | Pure UI. Renders pages, calls the API over fetch. |
| `backend/` (Express + SQLite) | 3001 | API only. Serves `/api/*`, `/admin/*` (dashboard), `/data/content.config.js`. |

The Next.js app talks to Express via `NEXT_PUBLIC_API_URL` (dev) or same-origin
(prod behind a reverse proxy). `SERVE_FRONTEND` defaults to `false`; set it to
`true` only for the legacy single-process co-hosted shape (Express also serves
the built Next.js output — requires `next export` output at `FRONTEND_DIR`).

---

## 1. Top level

```
Noviq - final/
├─ frontend/    Next.js 15 App Router + React 19 + TS + Tailwind CSS + next-intl (locales en, ar)
├─ backend/     Express API + admin dashboard + SQLite
├─ contracts/   the wire contract between the two (single source of truth)
├─ tools/       generator scripts (contract → frontend client)
└─ *.md         docs (this file, THEME-GOAL.md, deploy notes)
```

The API surface is defined **once**, in `contracts/api/*.json` (one file per
endpoint, 79 Noviq routes). Both sides generate from it. That is the whole
point of the layout: a contract change is a spec change + a re-run, not a
hand-edit on two teams.

---

## 2. `contracts/` — the single source of truth

- `api/<resource>.<action>.json` — one endpoint per file. Filenames **must be
  all-lowercase** (the generator drops any spec whose name has uppercase).
- `_envelope.json` — the error envelope every non-2xx returns:
  `{ "error": { "code": "UPPER_SNOTE", "message": "...", "details": ... } }`.
- `openapi.json` — generated OpenAPI 3.1 (70 paths / 79 ops) for
  Postman/codegen consumers.
- `_shared/` — stack-agnostic error helpers (`api-error.ts` for Node, `api-error.js` is mirrored by
  `backend/lib/api-error.js`).

**Field names are the wire names.** camelCase everywhere, zero transforms, in
every language. If a new field is needed, add it to the spec first, then
implement both sides.

Regenerate after any spec change:

```
node tools/gen-endpoints.js        # → frontend/lib/api-client.ts generated client
```

(The backend route layer is implemented by hand against the spec — the
`contract` MCP tools can also emit Node/Laravel/FastAPI routers, but the
current Express app is maintained directly.)

---

## 3. `backend/` — layered Express app

```
backend/
├─ index.js                 entry point: fail-fast secret guard, CORS warning,
│                           listen, graceful shutdown. No business logic.
├─ app.js                   builds the express app (middleware order is the
│                           contract): helmet → cors → compression → morgan →
│                           json → rate-limit → /api routes → /admin static →
│                           SPA fallback → error handler.
├─ config/
│  ├─ index.js              the one env/config object + the single fail-fast
│  │                       secret guard (defaults exported as config.defaults)
│  ├─ prompt-builder.js     (was prompt-builder-config.js)
│  └─ rate-limit.js         (was rate-limit-config.js)
├─ lib/                     cross-cutting, no Express/DB deps
│  ├─ api-error.js          ApiError class + the envelope (CommonJS port of the contract helper)
│  ├─ logger.js             (was logs.js) request/error logging + limit handler
│  ├─ mailer.js             (was mailer.js)
│  └─ monitor.js            (was monitor.js) perf + error snapshot
├─ services/                data access / side effects
│  ├─ content-store.js      rebuilds frontend content.config.js from the DB
│  └─ site-monitor.js       (was site-monitor.js) uptime checks
├─ middleware/auth.js       JWT sign/verify + role check + ensureAdminUser
├─ db/init.js               SQLite schema + seed (runs at boot)
├─ chatbot/                knowledge engine (engine, knowledge, search, ...)
├─ routes/                 one module per domain; index.js is mount-only
│  ├─ index.js              mounts in original order: _shared → public → auth
│  │                        → chatbot → analytics → admin (5 layers)
│  ├─ _shared.js            validators shared across domains
│  ├─ public.js  auth.js  chatbot.js  analytics.js  admin.js
├─ admin/                  the admin dashboard (its own static app)
├─ data/                   SQLite DB (gitignored: noviq.db, -wal, -shm)
└─ tests/                  *.test.js (security, chatbot, admin-content,
                           prompt-builder)
```

Rules:
- **`index.js` and `app.js` stay at the root** — they are the entry points a
  host's "startup file" setting points at. Everything else is a module.
- **Middleware order in `app.js` is load-bearing** (e.g. rate-limit before
  routes, error handler last). Don't reorder without re-reading the comments.
- **One module per domain** under `routes/`. Overlapping patterns stay in the
  same module in original order (`chats-export` before `chats/:sessionId`).
- The `/auth` rate limiter is path-scoped (`router.use('/auth', ...)`), never
  bare.
- **Tests live in `tests/`, named `*.test.js`.** They spawn the app on a
  fixed port (security → 3001, admin-content → 3197).
- Secrets: the two defaults are named constants in `config/index.js`
  (`DEFAULT_JWT_SECRET`, `DEFAULT_ADMIN_PASSWORD`) and exposed as
  `config.defaults`. Change the constant once and the guard follows.

---

## 4. `frontend/` — Next.js 15 App Router

The frontend is a **Next.js 15 App Router** application with React 19,
TypeScript, Tailwind CSS v4, and next-intl for bilingual (en/ar) support.

### 4.1 App Router structure

```
frontend/
├── app/
│   ├── layout.tsx            # Root HTML shell (fonts, metadata, viewport)
│   ├── page.tsx              # Redirects / → /en
│   ├── globals.css           # Global stylesheet
│   ├── not-found.tsx         # Global 404 (locale-agnostic)
│   ├── i18n/config.ts        # locales, defaultLocale, next-intl routing
│   └── [locale]/             # Locale-prefixed routes (en, ar)
│       ├── layout.tsx        # Locale layout with NextIntlClientProvider
│       ├── page.tsx          # Home page
│       ├── about/            # About page
│       ├── services/page.tsx + [slug]/page.tsx  # Service detail pages
│       ├── portfolio/        # Portfolio showcase
│       ├── pricing/          # Pricing plans
│       ├── contact/          # Contact form page
│       ├── careers/          # Careers page
│       ├── resources/        # Resources listing
│       ├── resource/         # Resource detail page
│       ├── industries/       # Industries listing
│       ├── solutions/        # Solutions listing
│       ├── ai-lab/           # AI Lab page
│       ├── team/             # Team page
│       ├── why/              # Why Noviq page
│       ├── toolkit/          # Toolkit page
│       ├── builder/          # Solution builder (client component)
│       └── login/ signup/ account/  # Auth UI
├── components/
│   ├── layout/Navbar.tsx + Footer.tsx
│   ├── sections/             # Page sections (Hero, Stats, ServicesGrid, etc.)
│   ├── shared/              # BackToTop, Loading, JsonLd
│   └── ui/                   # UI primitives (Button, Input, Card, Badge, etc.)
├── lib/
│   ├── i18n.ts               # i18n helpers (readMessage, loadMessages)
│   ├── content-store.ts      # Server-side content accessors
│   ├── api-client.ts         # fetch wrapper (NEXT_PUBLIC_API_URL)
│   ├── navigation.ts         # Locale nav tables
│   └── utils.ts              # Utility functions
├── data/content.ts           # Typed site content
├── i18n/
│   ├── en.json + ar.json     # Canonical message dictionaries
│   └── translations.json     # Generated mirror for layout provider
├── styles/*.css              # Design tokens + section styles
├── public/                   # Static assets (images, icons, favicon)
├── middleware.ts             # next-intl locale routing
├── next.config.mjs           # Next.js config with next-intl plugin
└── tests/playwright/         # E2E tests
```

### 4.2 Conventions

- **Server components by default.** All pages are async server components
  with `params: Promise<{ locale: string }>`. Only `builder` and `signup`
  are client components (they use `use(params)`).
- **i18n via next-intl.** Messages live in `i18n/en.json` and `i18n/ar.json`.
  The `loadMessages()` helper in `lib/i18n.ts` loads locale JSON for server
  components. `readMessage()` safely resolves dot-separated keys with
  fallbacks for missing translations.
- **Strict dependency direction:** Pages → Components → lib → data/i18n.
  Components never import pages; lib never imports components.
- **Component colocation:** UI primitives in `components/ui/`, page sections
  in `components/sections/`, layout in `components/layout/`, shared utilities
  in `components/shared/`.

### 4.3 The API boundary (verified split shape)

The frontend talks to the Express backend **only** through `lib/api-client.ts`.
There are **no `app/api/*` route handlers** — the `contact` and `health` stubs
were deleted; those routes live on the Express backend at `:4322`.

- `lib/api-client.ts` — the single transport. Reads `NEXT_PUBLIC_API_URL`
  (set in `frontend/.env.local`, example in `frontend/.env.example`).
  Returns the **bare success payload** on 2xx (e.g. `{ id, message }`
  or `{ status:'ok', timestamp }`). On 4xx/5xx it rejects with an
  `ApiError` whose `status`, `code`, `message` and `details` come from the
  backend's error envelope `{ error: { code, message, details } }`.
- **Never** `fetch('/api/...')` directly in a component — go through
  `api.<resource>.<action>(...)` in `api-client.ts`. That is the one place
  the base URL and the error envelope are interpreted.
- CORS: Express allows `http://localhost:4321` (and `:4322`, `:5500`,
  `:5500`) by default via `FRONTEND_URL` / `CORS_ORIGINS` in
  `backend/config/index.js`.

---

## 5. Content, not code

- **Copy** (nav, hero, services, ...) lives in `data/content.ts` within the
  frontend. Rendering reads it; it is not hardcoded in HTML.
- **i18n messages** live in `i18n/en.json` and `i18n/ar.json`. The
  `readMessage()` helper provides safe fallbacks when keys are missing.
- **Live content** (resources, portfolio, team, chatbot knowledge, contact
  leads) is edited from `backend/admin/` and lands in SQLite;
  `backend/services/content-store.js` rebuilds frontend content for co-hosted
  deployments.

---

## 6. Verification harness (run before shipping)

| Check | How | What it proves |
|---|---|---|
| TypeScript check | `npx tsc --noEmit` (frontend) | no type errors |
| backend suites | `backend/tests/*.test.js` | 25 security / 29 chatbot / admin-content / prompt-builder |
| boot + smoke | `curl http://127.0.0.1:4322/api/health` | backend is up, returns `{status:ok,timestamp}` |
| CORS preflight | `curl -X OPTIONS .../api/contact -H "Origin: http://localhost:4321"` | browser can call the API from `:3000` |
| contact E2E | POST `/api/contact` via `api.contact.submit` shape | bare 2xx payload `{id,message}` on success; `{error:{code,message}}` on 400 |
| frontend route sweep | `http://localhost:4321/en` + all `[locale]` routes | 200 responses |
| contrast (both themes) | boot via localStorage theme | WCAG-AA compliant |
| heading outline | all routes | exactly 1 visible h1 each |
| tap targets / labels | coarse pointer audit | 0 sub-24px, 0 unnamed controls |

---

## 7. Open decisions (do not guess — ask)

1. **Build output.** For shared-hosting deployment, `next export` produces a
   static site that can be served by Express' static middleware or Apache.
   For co-hosted VPS, proxy `/` to the Next.js Node server.
2. **Static vs. dynamic rendering.** Pages using `loadMessages()` are server
   components that load translations at build time for SSG. Pages requiring
   runtime data should be marked as dynamic.
3. **Stray contract specs.** `agent-bus.lock/message/schema` are not Noviq
   routes (no backend handler) and use snake_case (against the camelCase
   rule). Decide: implement, delete, or move to a separate registry.