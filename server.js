/* ============================================================
   NOVIQ — single-process production server
   ------------------------------------------------------------
   Serves the Next.js site AND the Express API/admin from ONE
   Node app on ONE domain (Hostinger Node.js hosting):
     /api/*, /admin, /images/uploads, /uploads, /data/*  → Express
     /api/revalidate, /api/analytics (Next route handlers) → Next.js
     everything else                                       → Next.js

   Build: npm run build      Start: npm start (node server.js)
   ============================================================ */

const http = require('http');
const path = require('path');
const crypto = require('crypto');

const FRONTEND_DIR = path.join(__dirname, 'frontend');
const PORT = process.env.PORT || 3000;
const SELF_ORIGIN = /^\d+$/.test(String(PORT)) ? `http://127.0.0.1:${PORT}` : '';

/* ---- Same-origin defaults (env vars set in hPanel always win) ----
   These must be in place BEFORE the backend config is required. */
process.env.NODE_ENV = process.env.NODE_ENV || 'production';
/* Next.js renders the site; Express must not serve the legacy static one. */
process.env.SERVE_FRONTEND = 'false';
/* Both tiers live in this process, so one shared secret is enough for the
   backend → /api/revalidate cache purge. A random one per boot is fine. */
process.env.REVALIDATE_SECRET = process.env.REVALIDATE_SECRET || crypto.randomBytes(32).toString('hex');
if (SELF_ORIGIN) {
  /* Server components / ISR fetch the API over HTTP; point them at ourselves.
     When the host hands us a socket instead of a port, set API_INTERNAL_URL
     and FRONTEND_REVALIDATE_URL to the public origin in hPanel. */
  process.env.API_INTERNAL_URL = process.env.API_INTERNAL_URL || SELF_ORIGIN;
  process.env.FRONTEND_REVALIDATE_URL = process.env.FRONTEND_REVALIDATE_URL || SELF_ORIGIN;
}

const NEXT_API_ROUTES = new Set(['/api/revalidate', '/api/analytics']);
const BACKEND_PREFIXES = ['/api/', '/admin/', '/images/uploads/', '/uploads/', '/data/'];

function isBackendPath(url) {
  const pathname = url.split('?')[0];
  if (NEXT_API_ROUTES.has(pathname)) return false;
  if (pathname === '/api' || pathname === '/admin') return true;
  return BACKEND_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

/* listen() is called BEFORE the heavy requires below: Hostinger kills the
   app if it has not called listen() within 3 seconds. The requires are
   synchronous, so no request is handled before `api` / `siteReady` exist. */
const server = http.createServer((req, res) => {
  if (isBackendPath(req.url)) return api(req, res);
  siteReady
    .then(() => handleSite(req, res))
    .catch(() => {
      res.statusCode = 503;
      res.end('Site is not available — check the server logs.');
    });
});

server.listen(PORT, () => {
  console.log(`[Noviq] Site + API running on port ${PORT} | Env: ${process.env.NODE_ENV}`);
  /* Scheduled backups — best-effort, must never prevent boot. */
  try {
    require('./backend/lib/auto-backup').startAutoBackup();
  } catch (err) {
    console.error('[backup] scheduler failed to start:', err.message);
  }
});

/* ---- Express (API + admin) ---- */
const api = require('./backend/app');
/* Same mount as backend/index.js — the portal router is not part of app.js. */
if (!api._portalMounted) {
  api.use(require('./backend/routes/portal'));
  api._portalMounted = true;
}

/* ---- Next.js (site) — resolved from frontend/node_modules ---- */
const next = require(require.resolve('next', { paths: [FRONTEND_DIR] }));
const site = next({ dev: false, dir: FRONTEND_DIR });
const handleSite = site.getRequestHandler();
/* prepare() is async; site requests wait for it. */
const siteReady = site.prepare();
siteReady.catch((err) => {
  console.error('[Noviq] Next.js failed to start — was `npm run build` run?', err);
});

/* Graceful shutdown — finish in-flight requests before exit. */
function shutdown(signal) {
  console.log(`[Noviq] ${signal} received, shutting down...`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 8000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
