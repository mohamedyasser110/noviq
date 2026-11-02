# Noviq — Engineering the Future Through Technology

Global software & AI engineering company website. Monorepo with a
Next.js frontend and an Express + SQLite backend.

```
Noviq - final/
├── frontend/             # Next.js 15 App Router · React 19 · TS · Tailwind v4 · next-intl (en/ar)
│   ├── Dockerfile
│   └── STRUCTURE.md
├── backend/              # Express JSON API + admin panel + SQLite
│   ├── Dockerfile
│   └── README.md
├── nginx/                # Reverse proxy & SSL production configuration
│   └── nginx.conf
├── docker-compose.yml    # 1-click Docker production deployment
├── ecosystem.config.js   # PM2 configuration for VPS deployment
├── contracts/            # API contracts (see contracts/README.md)
├── docs/                 # All project documentation
│   ├── DEPLOYMENT.md
│   ├── architecture.md
│   ├── architecture-analysis.md
│   ├── design-system.md
│   ├── database-migration.md
│   ├── deployment-prompt.md
│   ├── deployment-shared-hosting.md
│   ├── qodix-analysis.md
│   ├── agent-collaboration-system.md
│   └── agent-collaboration-summary.md
└── run.bat               # One-click local launcher
```

## Documentation

All project docs live in [`docs/`](docs/):

| Document | Description |
|---|---|
| [DEPLOYMENT.md](docs/DEPLOYMENT.md) | **Production deployment guide** (Docker Compose, PM2, Nginx, SSL) |
| [architecture.md](docs/architecture.md) | Architecture & ownership map |
| [architecture-analysis.md](docs/architecture-analysis.md) | Agent collaboration architecture analysis |
| [design-system.md](docs/design-system.md) | Design system & brand identity |
| [database-migration.md](docs/database-migration.md) | SQLite → MySQL/Supabase migration guide |
| [deployment-prompt.md](docs/deployment-prompt.md) | AI-assisted deployment prompt |
| [deployment-shared-hosting.md](docs/deployment-shared-hosting.md) | Shared hosting deployment guide |
| [qodix-analysis.md](docs/qodix-analysis.md) | Qodix design analysis |
| [agent-collaboration-system.md](docs/agent-collaboration-system.md) | Real-time agent collaboration system |
| [agent-collaboration-summary.md](docs/agent-collaboration-summary.md) | Agent collaboration implementation summary |

## Ports

| Service | Port | Where it is set |
|---|---|---|
| Frontend (Next.js UI) | **4321** | `frontend/package.json` (`dev`/`start`), `run.bat` `SITE_PORT` |
| Backend (Express API + admin) | **4322** | `backend/.env` → `PORT`, default in `backend/config/index.js`, `run.bat` `API_PORT` |

`run.bat` is the one-click launcher and now uses the same pair.

`4321`/`4322` were chosen because `3000`, `3001` and `8080` are commonly taken
by other local dev servers. The frontend talks to the API via
`NEXT_PUBLIC_API_URL=http://127.0.0.1:4322` (`frontend/.env.local`), and the
backend allowlists the UI origin in `CORS_ORIGINS`
(`FRONTEND_URL=http://localhost:4321,http://127.0.0.1:4321`).

> **Changing a port means changing all of these together** — the frontend
> silently calls the wrong API otherwise, with no startup error:
> `backend/.env` (`PORT`, `FRONTEND_URL`), `frontend/.env.local`
> (`NEXT_PUBLIC_API_URL`), `frontend/package.json` (`dev`/`start`),
> `run.bat` (`SITE_PORT`/`API_PORT`).
> **`NEXT_PUBLIC_API_URL` is inlined at build time — rebuild the frontend
> after changing it.**

## Run locally

```bash
# Backend API + admin  -> http://localhost:4322
cd backend && npm install && npm start

# Frontend UI          -> http://localhost:4321
cd frontend && npm install && npm run dev
```

The backend runs API-only (`SERVE_FRONTEND=false`) — see `backend/README.md`.

## Verify

```bash
cd frontend
npm run type-check   # tsc --noEmit — must be clean
npm run build        # 66 static pages (33 routes × en/ar), must succeed
npm run test:e2e     # Playwright
```

## i18n

Localized routes `/en/…` and `/ar/…` (RTL) via next-intl.
Message dictionaries live in `frontend/i18n/en.json` + `ar.json`
(single source of truth); `translations.json` is a generated mirror —
see `frontend/STRUCTURE.md` before editing copy.
