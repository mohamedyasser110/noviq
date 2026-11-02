# Noviq Backend — API Server

Express.js + SQLite. Serves the JSON API; the Next.js frontend in
`../frontend` runs separately (`npm run dev` / `next start` on :4321).

```
backend/
├── app.js            # Express app: JSON API, admin panel, optional static serving
├── index.js          # Entry point (loads config, fail-fast guards, listen)
├── config/index.js   # All env-driven settings (PORT, JWT_SECRET, DB_PATH,
│                     # CORS_ORIGINS, SERVE_FRONTEND, FRONTEND_DIR, UPLOADS_DIR)
├── routes/           # admin.js auth.js chatbot.js public.js analytics.js …
├── lib/ services/    # content-store, site-monitor, agent-bus, …
├── middleware/auth.js
├── chatbot/          # Chatbot engine + data
├── admin/            # Bundled admin panel (served at /admin)
├── db/ data/         # SQLite files (gitignored at runtime)
└── tests/            # mocha/jest suites (incl. agent-bus smoke)
```

## Run

```bash
cd backend
npm install
npm start            # PORT=4322 by default
```

Copy `.env.example` → `.env` and set `JWT_SECRET` + `ADMIN_PASSWORD`
(production refuses to boot on the compiled-in defaults).

## Frontend interplay

- `SERVE_FRONTEND=true` (default) serves `FRONTEND_DIR` (`../frontend`)
  **only if it contains an `index.html`** — otherwise the server logs a
  warning and runs API-only (this is the normal state with the Next.js
  frontend, which has no `index.html`).
- `UPLOADS_DIR` defaults to `<FRONTEND_DIR>/images/uploads` so admin image
  uploads land inside the actually-served frontend when one exists.
- Contact/newsletter/assessment/consultation/health/content endpoints are
  consumed by `frontend/lib/api-client.ts` (`NEXT_PUBLIC_API_URL`) and by
  the Next.js `app/api/*` route handlers.
- `/analytics-visits.json`, `/server.js`, `/.env`, `/package*.json` are
  explicitly denied over HTTP (see `app.js` deny lists).
