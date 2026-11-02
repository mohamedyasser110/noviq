# Verification & Admin Overrides

Two things are documented here because they are easy to get wrong:
the localStorage content-override layer, and the test suites that prove
the frontend still works.

---

## 1. Admin content overrides (localStorage)

### Why it exists

Site copy lives in `data/content.ts`, which is compiled into the bundle.
That makes it immutable without a rebuild. The override layer lets an
admin change copy from the browser and see it applied immediately, with
`data/content.ts` staying the base layer.

`data/content.ts` referenced `lib/content-admin.ts` in its header comment;
before this work that file did not exist. It does now.

### Files

| File | Role |
|---|---|
| `lib/content-admin.ts` | Storage + deep-merge logic. No React — usable from server code. |
| `components/shared/useContentOverrides.ts` | `'use client'` React hook. |
| `components/shared/ContentOverrideBridge.tsx` | Applies overrides to tagged DOM nodes after hydration. Mounted once in `app/[locale]/layout.tsx`. |

### Two ways to consume it

**A. DOM bridge (opt-in, no restructuring).** Tag any node in a server or
client component — the attribute is all that is required:

```tsx
<h1 data-content-path="whyHeader.title">{content.whyHeader.title}</h1>
<h3 data-content-path={`why.${i}.title`}>{item.title}</h3>
```

Mounted once in the locale layout, `ContentOverrideBridge` finds every
`[data-content-path]`, looks the dotted path up in the stored patch, and
writes the value in.

Value mapping: `string`/`number` → `textContent`; `boolean` → toggles
`hidden`; `array` → joined with ` · `. Objects are skipped rather than
rendered as `[object Object]`. A path with no override is left untouched.

**B. Hook (React tree).** When a component already receives the whole
content object:

```tsx
'use client';
import { useContentOverrides } from '@/components/shared/useContentOverrides';

export default function Section({ base }: { base: MyContent }) {
  const { content, hasOverrides } = useContentOverrides(base);
  // ...
}
```

### API

```ts
import {
  getContentOverrides,      // -> Record<string, unknown>   ({} on server)
  setContentOverride,       // (path, value) => boolean
  clearContentOverride,     // (path) => boolean
  clearAllContentOverrides,
  applyContentOverrides,    // (base, patch?) => merged deep copy
  saveContentOverrides,     // (patch) => boolean, notifies listeners in-tab
  CONTENT_OVERRIDES_KEY,    // 'noviq_content_overrides_v1'
} from '@/lib/content-admin';
```

### Storage shape

A **sparse** patch of dotted paths — only edited fields are stored, so the
payload stays small and merging is a pure deep-merge:

```json
{
  "whyHeader.title": "Custom headline",
  "why.0.title": "Renamed card",
  "footer.tagline": "New tagline"
}
```

### Safety properties (each has a test)

- **SSR-safe.** `localStorage` is guarded; every read returns the base
  value on the server. No SSR crash.
- **No hydration mismatch.** The bridge runs in an effect *after*
  hydration, and the hook returns `base` on the first client render. The
  server HTML and first client render always agree; overrides appear a
  tick later.
- **Versioned key.** `noviq_content_overrides_v1` — a schema change cannot
  leave a stale patch behind. Reads fall back through older versions.
- **Never mutates the base.** `applyContentOverrides` deep-clones.
- **No phantom fields.** A path that does not resolve against the base is
  skipped, so a typo in an admin UI cannot invent structure. Out-of-range
  array indices, non-integer indices, and paths that walk through a scalar
  are all rejected.
- **Corrupt data is inert.** Unparseable JSON returns `{}` — the page
  still renders.
- **Cross-tab.** Listens to `storage`, plus a custom
  `noviq:content-overrides` event for same-tab live preview.

---

## 2. Contact form: two paths, one backend

`POST /api/contact` exists on **both** tiers, and the backend is always
the source of truth for persistence.

1. **Direct (default).** `components/sections/Contact.tsx` calls
   `api.contact.submit()`, which resolves `NEXT_PUBLIC_API_URL`
   (`http://127.0.0.1:4322`) and hits the Express backend straight from
   the browser. This works because the backend allowlists the frontend
   origin — see `CORS_ORIGINS` in `backend/config/index.js`. The default
   allowlist covers `localhost:4321` and `127.0.0.1:4321`; **a frontend
   on any other port or origin will be blocked by CORS.**

2. **Same-origin proxy.** `app/api/contact/route.ts` forwards to the same
   backend endpoint from the server. Use this when the browser cannot
   make a cross-origin call — a preview deployment outside
   `CORS_ORIGINS`, or a same-origin reverse proxy in production. It
   relays the backend's status and error envelope verbatim, and returns
   `502 UPSTREAM_UNAVAILABLE` if the backend is down.

   Override the upstream with `API_INTERNAL_URL` (server-only, never
   shipped to the browser).

The SQLite `INSERT` into `contacts` and the `notifyNewLead()` email both
happen in the backend. The proxy only forwards.

> This route used to be a stub that returned `{ success: true }` without
> persisting anything — a silent data-loss path. It is now a real proxy.

---

## 3. Test suites

`npm run test:offline` needs no server:

| Script | Checks |
|---|---|
| `npm run type-check` | `tsc --noEmit` |
| `npm run test:unit` | override deep-merge logic (14 assertions) |
| `npm run test:i18n` | `en.json` / `ar.json` key parity, plus the LIVE database dictionary (`GET /api/content/i18n/:locale`) in both directions |

With a server running on `:3100`:

| Script | Checks |
|---|---|
| `npm run test:routes` | 69 checks: every localized page, static + API routes, 404s, redirect targets |
| `npm run test:contact` | proxy validation (400s) + real SQLite insert (201 + increasing id) |
| `npm run test:overrides` | Playwright: override applied → cleared → corrupt patch |

Full gate: `npm run verify`.

### Running the server for the tests

```powershell
# production build (the stable option)
$env:NODE_OPTIONS="--max-old-space-size=3072"
.\node_modules\.bin\next.cmd build
.\node_modules\.bin\next.cmd start -p 3100
$env:ATTACH="1"; $env:PORT="3100"; npm run test:routes

# cleanup
npm run test:cleanup
```

`ATTACH=1` makes `verify-routes.cjs` probe an already-running server
instead of spawning one. Without it the script boots `next start` itself.

---

## 4. Machine note: builds fail under memory pressure

`next build` on this machine dies partway through with a **silent exit 1**,
or with `ENOENT` on a manifest it had just written
(`pages-manifest.json`, `build-manifest.json`, `*.nft.json`). The failing
file varies run to run, because the build dies at whichever stage runs out
of memory first.

Measured cause: **system commit charge was ~38 GB of a 42 GB limit**, with
hundreds of background processes (the editor, browsers, a database server,
and ~35 MCP node workers). It is not corruption, and not `output:
'standalone'` — deleting `.next` and using a separate `distDir` both still
failed, while bounding the heap made it pass.

Mitigations already in place:

- `"build": "node --max-old-space-size=3584 ./node_modules/next/dist/bin/next build"`
  — forces V8 to collect instead of ballooning. **Do not remove this.**
- `distDir: process.env.NEXT_DIST_DIR || '.next'` — build into a separate
  folder so a running `next dev` cannot touch production artifacts. (Mixing
  the two makes the dev server 500 with a stale `prerender-manifest.json`.)

**Before building, free memory** — close browser tabs and unused apps, or
raise the pagefile limit. If a build is killed, check for orphaned
`next build` processes first: two of them running at once will double the
memory use *and* corrupt each other's `.next`.

```powershell
# find and kill only this project's orphaned builds
Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
  Where-Object { $_.CommandLine -like "*Noviq - final\frontend*" -and $_.CommandLine -like "*next*build*" } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
```
