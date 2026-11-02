# Noviq Frontend — Structure

Next.js 15 App Router + React 19 + TypeScript + Tailwind CSS v4 + next-intl (locales `en`, `ar`).

```
frontend/
├── app/
│   ├── globals.css           # Legacy global stylesheet (see styles/ below)
│   ├── robots.ts / sitemap.ts
│   ├── api/
│   │   ├── contact/route.ts  # Contact-form receiver (POST)
│   │   └── health/route.ts   # Health check (GET)
│   ├── i18n/config.ts + routing.ts  # locales/routing (imported by lib + middleware)
│   └── [locale]/
│       ├── layout.tsx        # THE root layout: owns <html>/<body>, <head> font links,
│       │                     # setRequestLocale, NextIntlClientProvider, metadata
│       │                     # (generated per locale), Navbar/Footer/BackToTop/JsonLd,
│       │                     # generateStaticParams
│       ├── page.tsx          # Home: Hero+Stats+Services+Industries+Process+Testimonials+Liftoff+Contact
│       ├── not-found.tsx     # The only 404 (locale-aware)
│       ├── services/page.tsx + services/[slug]/page.tsx (9 slugs × 2 locales, SSG)
│       ├── about/ industries/ solutions/ portfolio/ pricing/ contact/
│       ├── careers/ resources/ resource/ faq/ ai-lab/ team/ why/ toolkit/
│       ├── builder/          # Client-side solution configurator + estimate (use(params))
│       └── login/ signup/ account/  # Auth UI (backend owns session logic)
├── components/
│   ├── layout/Navbar.tsx + Footer.tsx   # Client, useTranslations('nav'/'footer')
│   ├── sections/Hero|Stats|ServicesGrid|Industries|Process|Testimonials|Contact|Liftoff
│   ├── shared/BackToTop.tsx, Loading.tsx, JsonLd.tsx
│   └── ui/                   # Radix-based primitives
├── lib/
│   ├── i18n.ts               # locales re-export + readMessage(messages, 'a.b') +
│   │                         # loadMessages(locale) helpers (server-safe dict loader)
│   ├── nav-admin.ts          # Admin-editable nav: hide/show/remove base items,
│   │                         # APPEND new ones (see "The header menu" below)
│   ├── content-store.ts      # Typed server-side accessors over data/content.ts
│   ├── api-client.ts         # fetch wrapper (NEXT_PUBLIC_API_URL)
│   ├── navigation.ts         # locale nav tables
│   └── utils.ts
├── data/nav.ts              # Header menu source of truth: NAV_PRIMARY + NAV_MORE
├── data/content.ts          # Typed site content (services, industries, …)
├── i18n.ts                   # THE getRequestConfig (exactly one; plugin entry, see next.config.mjs)
├── styles/globals.css     # THE only loaded stylesheet (imported by app/[locale]/layout.tsx)
├── old-version/css/*.css  # 28 ARCHIVED vanilla-SPA sheets - NOT loaded, NOT
│                             # imported. Reference only; do not import.
├── public/images|icons|favicon.svg
├── middleware.ts             # next-intl locale routing (localePrefix: always)
├── next.config.mjs           # withNextIntl('./i18n.ts') + redirects + security headers
│                             # distDir honours $NEXT_DIST_DIR (default '.next') — use a
│                             # separate folder when a dev server is running
├── scripts/                  # server-less visual QA (see note below)
│   ├── mkpreview.mjs         # .next/server/app/{en,ar}.html -> standalone HTML (CSS inlined)
│   ├── shots.mjs             # screenshots from file:// — en/ar @1440 + en @390
│   ├── audit.mjs             # horizontal-overflow audit @ 390/768/1440 × en/ar
│   └── probe.mjs             # computed-style dump (colors, sizes, radii)
└── tests/playwright/         # E2E (npm run test:e2e)
```

> **Server-less visual QA** — on this machine `next dev` / `next start` do not
> stay alive, so visual checks run against the **prerendered** HTML with the
> compiled CSS inlined: no dev server, no port, no flakiness.
> Always `rm -rf .next` before `next build` — a stale `en.html` is NOT proof
> the build is current. `i18n.ts` is required by the plugin; if it goes
> missing, restore it (a `.bak` may exist).

## The header menu

`data/nav.ts` is the single source of truth, split in two so the 1280px
header never overflows:

| List | Desktop | Mobile |
|---|---|---|
| `NAV_PRIMARY` (Home … Contact, incl. **Our Team**) | inline | first |
| `NAV_MORE` (AI Lab, Pricing, Resources, Careers, Toolkit, FAQ, Why, API Docs) | "More" dropdown | under a "More" group |
| admin-added items | "More" dropdown | under a "More" group |

`lib/nav-admin.ts` lets an admin edit that without a rebuild:

```ts
addNavItem({ key, href, labelEn, labelAr, icon? }) // append -> always lands in "More"
hideNavItem(key) / showNavItem(key) / toggleNavItem(key)
removeNavItem(key)   // admin-added only
clearNavState()
```

Shape stored under `noviq_nav_v1` in localStorage:

```json
{ "hidden": ["pricing"], "extra": [{ "key": "case", "href": "/case", "labelEn": "Case" }] }
```

Why a separate store instead of `applyContentOverrides()`: that function
deliberately refuses to invent slots, which is right for copy but makes
"admin adds a nav link" impossible. Guards: admin items always render in the
overflow slot; `href` must be an in-app absolute path (external,
protocol-relative and `javascript:` URLs are rejected); duplicate and
base-shadowing keys are refused; 40 extra items max; labels/hrefs truncated;
a corrupt or tampered payload is normalized rather than trusted.

Hydration is safe: the server and the first client render both use the base
nav, then the stored state is applied in an effect — same contract as
`useContentOverrides`. Tests: `npm run test:nav` (48 checks, compiles the
real `.ts` with `tsc -p tests/tsconfig.navtest.json` first).

## Conventions

- **ONE `<html>` / `<body>`, ever.** `app/[locale]/layout.tsx` owns them.
  Do **not** add `app/layout.tsx` back: a root layout that also renders
  `<html>` nests a second `<html>` inside the first, which is invalid HTML.
  The browser then keeps the *outer* element's attributes, so `/ar` served
  `lang="en"` (only `dir="rtl"` survived) and React logged a hydration
  mismatch. Same reason there is no `app/page.tsx` (`middleware.ts` +
  the `/` → `/en` redirect in `next.config.mjs` handle `/`) and no
  `app/not-found.tsx` (it would need its own `<html>`); `app/[locale]/
  not-found.tsx` is the single 404.
- **Server by default.** Pages are async server components with
  `params: Promise<{ locale: string }>` (Next 15). Only `builder` and
  `signup` are client components (they use `use(params)`).
- **No `onClick` navigation in server components** — use `<Link>`.
  (Prerender fails otherwise: "Event handlers cannot be passed…".)
- **Static rendering + next-intl:** every page under `[locale]` needs the
  locale in the request cache. `app/[locale]/layout.tsx` calls
  `setRequestLocale(locale)` and exports `generateStaticParams()` for
  `en`/`ar`; any page calling next-intl server APIs during prerender must
  do the same (see `services/[slug]/page.tsx`).
- **Messages:** the dictionary is edited in the **admin** (Translations tab) and
  stored in the **database** (`content` row `i18n_en` / `i18n_ar`). That is the
  single source of truth, served to the site at `GET /api/content/i18n/:locale`.
  `i18n/en.json` + `i18n/ar.json` in this repo are the build-time **offline
  fallback** only — the site merges the live dictionary over them, so an admin
  edit never needs a rebuild.
  When you change a key in a `.json` file you must also push it to the database
  (the file alone will not change the site), and `npm run test:i18n` checks the
  bundled files against the live dictionary in both directions.
  `i18n/translations.json` was a generated third copy and is no longer written or
  read — deleting it removes one more way for the admin and the site to disagree.
- **Types:** `npm run type-check` (`tsc --noEmit`) is the gate and is clean.
  `next.config.mjs` also sets `typescript.ignoreBuildErrors` /
  `eslint.ignoreDuringBuilds` as belt-and-braces — do not rely on them.
- **Build isolation on Windows:** `next dev` and `next build` must not share
  `.next` (the dev server rewrites `server/pages-manifest.json` and webpack
  packs mid-build → `ENOENT` on `pages-manifest.json` / `.next/export/500.html`
  / `PackFileCacheStrategy`). Build with
  `$env:NEXT_DIST_DIR='.next-build'; npm run build` while any dev server runs.
  `next.config.mjs` reads `distDir` from `$NEXT_DIST_DIR` (default `.next`).
- **Low-memory machines:** if `next build` exits 1 with no output, or fails
  with `ENOENT` on a manifest it just wrote, that is **commit exhaustion**,
  not a corrupt tree. Check `FreeVirtualMemory`; if it is under ~3 GB, close
  node/IDE processes and bound the heap:
  `$env:NODE_OPTIONS='--max-old-space-size=2048'; npm run build`

## Run

Ports: **UI :4321** (pinned in `package.json` scripts), **API :4322**
(`backend/.env`). Override with `-p` / `PORT` if you need to.

```powershell
npm install

# development (hot reload)  -> http://localhost:4321
$env:NODE_OPTIONS='--max-old-space-size=1536'
npm run dev

# production                -> http://localhost:4321
$env:NODE_OPTIONS='--max-old-space-size=2048'; npm run build
$env:NODE_OPTIONS='--max-old-space-size=1024'; npm start
```

The backend API runs separately on :4322 (`cd ../backend && npm start`).
The UI reaches it via `NEXT_PUBLIC_API_URL` in `.env.local`.

## Verify

| Check | Result |
|---|---|
| `npm run type-check` | clean (0 diagnostics) |
| `npm run build` | exit 0, 66/66 pages (33 routes × en/ar) |
| `/en` | `lang="en" dir="ltr"`, 1 `<html>`, 8 sections, 0 console errors |
| `/ar` | `lang="ar" dir="rtl"`, 1 `<html>`, 8 sections, 0 console errors |
| `/en/nope` | 404 via `app/[locale]/not-found.tsx` |
| `/api/health`, `/api/contact` | 200 |
| `npm run test:nav` | 48/48 — base shape, append, rejections, hostile store, caps |
| `npm run test:navbar` | 24/24 — no CTA in header, menu opens, links render (en + ar) |

The desktop navbar shows the high-signal routes inline plus a **More**
dropdown; the mobile drawer groups the same items under a "More" heading.
