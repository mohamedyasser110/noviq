# 📡 API Contracts — single source of truth

This directory is the contract layer between the **frontend** and the
**backend** so the two teams can work **separately and in parallel**.
Every file in `api/` describes ONE endpoint's request and response structure
in a language-neutral JSON format. Both sides generate their code from the
same spec — that is what keeps parallel development safe.

## Files
- `api/<resource>.<action>.json` — endpoint contracts (the only files you edit by hand)
- `_envelope.json` — the standard error envelope (shared by every endpoint)
- `example.json` — a complete example to copy
- `_shared/` — stack-agnostic shared error helpers (copy into your app once)
- `openapi/` — generated OpenAPI 3.1 fragments per endpoint (optional, for Postman/codegen)

## Backend targets (pick per project — microservices friendly)
| target   | backend output                            | when to use                |
|----------|-------------------------------------------|----------------------------|
| node     | Express router + zod validation           | DEFAULT — main stack       |
| laravel  | PHP controller + validation rules         | Laravel projects           |
| fastapi  | Python FastAPI router + Pydantic models   | rare Python services       |

## Frontend targets (dynamic — pick per project)
| frontend | output                                      | when to use                |
|----------|---------------------------------------------|----------------------------|
| ts       | TypeScript typed fetch client               | DEFAULT — React/Vite/Next  |
| vanilla  | Vanilla JS (JSDoc) fetch client, no build   | plain HTML/JS projects     |
| all      | Both TS + Vanilla                           | mixed teams                |

## Universal
Every generation also returns an **OpenAPI 3.1 fragment** for the endpoint —
import it into Postman, codegen tools, or any other tech outside the built-in
generators (Angular, Vue, Flutter, mobile, microservice consumers...).

## Team separation
- Backend team → implements the generated route (satisfies the spec).
- Frontend team → consumes the generated client + OpenAPI (listens to the spec).
- Neither waits for the other. Contract change? Update spec → regenerate → both sync.

## Workflow
1. Define or update the contract (see schema below and `example.json`).
2. Run `contract_generate` with the right targets to regenerate:
   - backend: Node / Laravel / FastAPI router
   - frontend: TS / Vanilla client
   - universal: OpenAPI 3.1 fragment
3. Implement both sides **in parallel** against the generated code.
4. Never hand-edit generated files; never change a contract without updating it here first.

## Contract schema (v1)
{
  "version": 1,
  "name": "todos.list",
  "summary": "List todos with pagination",
  "method": "GET",
  "path": "/api/todos",
  "request": {
    "query":  { ...fieldDefs },
    "params": { "id": { "type": "string" } },
    "body":   { "type": "object", "fields": { ...fieldDefs } } | null
  },
  "response": { "type": "object", "fields": { ...fieldDefs } },
  "errors": [ { "status": 400, "code": "VALIDATION_ERROR" } ]
}

## Field types
string | integer | number | boolean | any | null | array(of) | object(fields, name?)
- `optional: true` — not required
- `enum: ["a","b"]` — allowed values (strings)
- `default: 50` — default value
- `format: "date-time"` — semantic hint
- `description: "..."` — human note

## Naming rule (IMPORTANT)
Field names in the contract ARE the wire names. Use camelCase everywhere
(e.g. `createdAt`, `isActive`) — NOT snake_case — so all generated targets
(Node, Laravel, FastAPI, TS client) use identical keys with zero transforms.
Mixing conventions creates drift between frontend and backend.

## Error envelope (all non-2xx)
{ "error": { "code": "UPPER_SNAKE", "message": "string", "details": null } }

## Tools available inside OpenCode
- `contract_init`     — scaffold this directory
- `contract_add`      — add an endpoint contract + generate code for a target
- `contract_generate` — regenerate code from a spec file
- `contract_list`     — list all contracts

## Noviq project notes (2026-09-25 contract-first arch pass)
- Stack: backend `node` (Express, `backend/`) + frontend `vanilla`
  (no build step, `frontend/`). Always generate with
  `target: "node", frontend: "vanilla"`.
- **Contract file names must be all-lowercase** (`contact.setstatus`,
  not `contact.setStatus`): the `contract` tool silently drops specs
  whose `name` contains uppercase letters (no file is written).
- Coverage: 79/79 backend routes have a contract (verified both
  directions by script: every `router.*` in `backend/routes/` matches
  one `contracts/api/*.json` by method+path).
- Backend is split one module per area; `backend/routes/index.js` is a
  mount-only registry: `_shared` (validators) · `public` · `auth` ·
  `chatbot` · `analytics` · `admin`. Mount order = original order;
  overlapping patterns stay in-module in original order
  (`chats-export` before `chats/:sessionId`, `content/keys` before
  `content/:key`). The `/auth` rate limiter is path-scoped
  (`router.use('/auth', …)`) — never bare, or it counts every request.
- Error envelope is LIVE (2026-09-25): every non-2xx returns
  `{ error: { code: "UPPER_SNAKE", message: "string", details } }`
  per `_envelope.json` — backend routes + middleware + rate limiter
  migrated by codemod, frontend reads via `NoviqAPI.errMsg(data)`,
  admin dashboard via `?.error?.message`. Shared helper ported to
  `backend/lib/api-error.js` (CommonJS mirror of
  `contracts/_shared/api-error.node.ts`) and wired into the `app.js`
  error middleware. `openapi.json` documents the envelope per status.
- `openapi.json` is assembled from the specs (70 paths / 79 ops).
  Rebuild after any spec change with the `build-openapi.py` script.
- Deleted in this pass (were unloaded, zero references):
  `frontend/js/engine/{intro,hero3d,cursor,theme-crystal}.js`,
  `frontend/css/{intro,theme-crystal}.css`, `frontend/styles.css`,
  `frontend/debug.html`, `frontend/admin/index.html` (legacy shell;
  the live dashboard is `backend/admin/`).

## The API boundary is live (2026-09-26)

The frontend no longer hand-writes `fetch()`. The contract layer now has a
real generated client:

- `tools/gen-endpoints.js` reads every `api/*.json` and writes
  `frontend/js/services/endpoints.js` — one function per endpoint, grouped by
  resource (`Endpoints.contact.submit`, `Endpoints.admin.me`, …). Path params
  come from the `{slot}s` in the path; `request.params` entries that are not
  path slots are treated as query; a summary containing `admin JWT` marks the
  route for the admin token. Re-run the generator after any spec change.
- `frontend/js/services/api.js` is the **transport** (`NoviqAPI`): it owns the
  base origin, the two JWTs (`noviq_token`, `noviq_admin_token`), JSON
  handling and the error envelope. Call sites read `res.json` / `res.ok` and
  use `NoviqAPI.isError` / `NoviqAPI.errMsg`.
- Every backend call site in the frontend routes through `Endpoints.*`. The
  private URL builders and the direct `NOVIQ_API_URL` reads were removed, and
  the `typeof NoviqAPI === 'function' ? … : raw` guard pattern (a latent XSS
  hole) is gone.
- See `ARCHITECTURE.md` for the full layout, load order and rules.

## Noviq frontend rules (2026-09-25 professionalism pass)

The contract layer covers the wire. These are the rules the *other* half
of the project is held to, all of them established by measuring the
rendered page rather than by reading the source. They are recorded in
`frontend/.21st/design.json` (decisions + constraints) as well, so a
design tool and this file agree.

- **Wire format is camelCase, no transforms.** `NoviqAPI` does not
  convert a single key. If a new field is needed, add it to the spec
  first, then implement both sides.
- **Every non-2xx body is the envelope** from `_envelope.json`. The
  frontend reads it through `NoviqAPI.errMsg(data)`; never reach into
  `.message` directly, or an error response that slips through the
  helper renders as `[object Object]`.
- **Type floor 12.5px** — no `font-size` literal below `--fs-caption`,
  in a stylesheet or in an inline `style`. Measured: 0 violations.
- **One visible `h1` per route, zero level skips** — 23 routes,
  213 headings. A heading's level follows its container, and the CSS
  selector that styles it moves in the same commit as the tag.
- **Tap targets** — 24×24 minimum for standalone controls, `--touch-min`
  (44px) under `@media (pointer: coarse)`. Inline links inside a
  sentence are exempt.
- **Every control has an accessible name**, and for translated chrome
  (the two search boxes, the chat input) the name follows the language.
- **Contrast is checked in both themes, booted not flipped** —
  `localStorage['noviq-theme']` selects the theme *before* first paint.
  Flipping `data-theme` at runtime leaves CSS colour transitions frozen
  at their previous value in headless Chromium, which silently reports
  the light-theme ratio for every dark node.
- **The hero badge is a monogram, an 8px gap, then a tagline.** The
  phrase spells its own leading `N`; the monogram is a separate flex
  item, so it is not a ligature and needs no negative margin.
- **`escHtml()` (`js/engine/utils.js`) is the only escaper**, and no
  escape call is ever wrapped in a `typeof x === 'function' ? x(v) : v`
  guard — that fallback renders raw content. The four private copies
  (`portfolioEscape`, `teamEscape`, `resourceEscape`, `escapeHtml`)
  were removed; their 87 call sites now call `escHtml`.
- Assets are cache-busted with `?v=` in `index.html`. Any edit to a CSS
  or JS file that is not restamped keeps serving the old copy.

## Noviq deployment (frontend `server.js`)

| variable | default | why it exists |
|----------|---------|----------------|
| `PORT`   | `8765`  | listen port, so a host does not have to patch the file; an unparseable value falls back rather than throwing |
| `NOVIQ_API_URL` | *(unset)* | origin appended to CSP `connect-src`, so a split deployment's own API is reachable |

- `connect-src` is the one directive that cannot be static: when
  `window.NOVIQ_API_URL` (`js/config/env.js`) points the frontend at a
  separate backend host, `'self'` blocks every `/api` call and it
  surfaces as a network error rather than a policy error. `server.js`
  appends that origin, but only if it parses to a bare `http(s)` origin —
  a value carrying a path, query, credentials or a `;` is dropped, since
  the string is emitted into a response header. The boot log names the
  origin in use and warns when a set value was rejected.
- `.htaccess` mirrors the same policy for the static Apache path, where
  the header cannot be dynamic — a split deployment has to append its API
  origin by hand (noted in the file).
- The Node server and `.htaccess` deny the same set: `/.env`,
  `/server.js`, `/package.json`, `/package-lock.json`, and
  `analytics-visits.json` (plus its `.1` rotation). Keep them in parity.
