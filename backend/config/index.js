/* ============================================================
   NOVIQ SERVER CONFIG
   ------------------------------------------------------------
   All environment-driven settings in one place.
   On shared hosting (cPanel → Setup Node.js App) set these as
   environment variables, or create server/.env (KEY=value lines).
   ============================================================ */

const fs = require('fs');
const path = require('path');

/* This file now lives in config/, one level below the backend root that it
   used to be. Every path below is anchored to the backend root, so a future
   move of this folder cannot silently re-point the .env / db / frontend. */
const BACKEND_ROOT = path.join(__dirname, '..');

/* Tiny .env loader (no dependency needed on shared hosting) */
const ENV_FILE = path.join(BACKEND_ROOT, '.env');
if (fs.existsSync(ENV_FILE)) {
  for (const line of fs.readFileSync(ENV_FILE, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) {
      /* .trim() matters: the capture group `(.*)` is greedy, so it swallows
         trailing whitespace and `\s*$` then matches nothing. Without the trim
         a line like `SERVE_FRONTEND=false␠␠` yields "false  ", which fails
         every string comparison downstream and silently flips a boolean flag.
         .trim() also runs before the quote-strip, so `␠"false"␠` works too. */
      process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
    }
  }
}

/* The two secrets that must never ship to production with their default
   values. Named once so the fail-fast guard below and the value that
   config falls back to can never drift apart. index.js re-uses these
   instead of re-hardcoding the literals. */
const DEFAULT_JWT_SECRET = 'noviq-admin-secret-change-in-production';
const DEFAULT_ADMIN_PASSWORD = 'noviq2026';

const config = {
  /* Port: Passenger/cPanel injects PORT automatically.
     Local default is 4322 — 3001 is commonly taken by other dev servers. */
  PORT: parseInt(process.env.PORT, 10) || 4322,

  /* Security — CHANGE JWT_SECRET in production! */
  JWT_SECRET: process.env.JWT_SECRET || DEFAULT_JWT_SECRET,
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || DEFAULT_ADMIN_PASSWORD,
  ADMIN_EMAIL: process.env.ADMIN_EMAIL || '',

  /* SQLite database file (lives inside the backend folder) */
  DB_PATH: process.env.DB_PATH || path.join(BACKEND_ROOT, 'data', 'noviq.db'),
  /* Allowed CORS origins, comma-separated.
     The Next.js app is pinned to :4321 (see frontend/package.json scripts
     and frontend/.env.local), so it is in the default allowlist — otherwise
     the browser blocks the contact/chat/newsletter calls.
       Example: FRONTEND_URL=https://noviq.com,https://www.noviq.com */
  CORS_ORIGINS: (process.env.FRONTEND_URL
    || 'http://localhost:4321,http://127.0.0.1:4321')
    .split(',').map(s => s.trim()).filter(Boolean),

  /* Serve the frontend from this server?
     Modern shape is TWO processes: Next.js on :4321 (UI) and this Express
     app on :4322 (API only). Default is now false; the cross-origin UI
     reaches the API over CORS. The old single-process co-host is still
     possible: SERVE_FRONTEND=true serves the built Next.js output at
     FRONTEND_DIR (shared-hosting only). */
  /* Anything other than an explicit truthy token means "don't serve the
     frontend". The old test was `!== 'false'`, so `0`, `no`, `off`, and
     `false␠␠` (trailing spaces — the .env loader now trims, but env vars
     injected by a host do not) all resolved to TRUE and silently turned on
     static serving. cPanel checkboxes in particular write 0/1, not true/false.
     Only these count as true: true, 1, yes, on. */
  SERVE_FRONTEND: ['true', '1', 'yes', 'on'].includes(
    String(process.env.SERVE_FRONTEND ?? '').trim().toLowerCase()
  ),

  /* Frontend directory (used for static serving + content.config.js rebuild) */
  FRONTEND_DIR: process.env.FRONTEND_DIR || path.join(BACKEND_ROOT, '..', 'frontend'),

  /* ---- On-demand revalidation (purges the Next.js cache after an edit) ----
     The frontend is statically generated with a short ISR window as a safety
     net, but Next answers with the STALE page first and rebuilds in the
     background — so an admin's "save, then refresh" can still show the old
     copy once. After every successful content save the backend pings the
     frontend's /api/revalidate route, which drops its CMS cache tag, so the
     NEXT visitor sees the new copy immediately.

     FRONTEND_REVALIDATE_URL: origin of the Next app (no trailing slash).
       Default is the local dev port, matching the rest of this config.
     REVALIDATE_SECRET: must equal the frontend's REVALIDATE_SECRET. When
       either is missing the purge is SKIPPED silently — the site still
       updates through the ISR window, just one refresh later. */
  FRONTEND_REVALIDATE_URL: (process.env.FRONTEND_REVALIDATE_URL || 'http://127.0.0.1:4321').replace(/\/+$/, ''),
  REVALIDATE_SECRET: process.env.REVALIDATE_SECRET || '',

  NODE_ENV: process.env.NODE_ENV || 'development',
};

/* Uploads directory: explicit UPLOADS_DIR wins. Otherwise follow
   FRONTEND_DIR with hosting-aware layout detection:
   - Next.js checkout  → <root>/public/images/uploads (served at /images/…)
   - static export dir → <root>/images/uploads (served at /images/…)
   Either way the PUBLIC URL stays `images/uploads/<file>` — only the
   disk location moves. Critical on shared hosting where
   FRONTEND_DIR=public_html (no public/ subfolder there). */
function resolveUploadsDir() {
  if (process.env.UPLOADS_DIR) return process.env.UPLOADS_DIR;
  try {
    if (fs.existsSync(path.join(config.FRONTEND_DIR, 'public'))) {
      return path.join(config.FRONTEND_DIR, 'public', 'images', 'uploads');
    }
  } catch {}
  return path.join(config.FRONTEND_DIR, 'images', 'uploads');
}
config.UPLOADS_DIR = resolveUploadsDir();

/* Production guard: refuse to start with the default secrets. The defaults
   are the named constants above, so changing them in one place updates the
   guard automatically. This is the single fail-fast point — index.js only
   warns about CORS and does not re-check the secrets. */
/* Expose the defaults so the entry point (index.js) can run the same
   fail-fast check against the SAME constants instead of re-hardcoding
   the literals. One place defines what "default" means. */
config.defaults = { JWT_SECRET: DEFAULT_JWT_SECRET, ADMIN_PASSWORD: DEFAULT_ADMIN_PASSWORD };

if (config.NODE_ENV === 'production') {
  if (config.JWT_SECRET === DEFAULT_JWT_SECRET) {
    console.error('[SECURITY] FATAL: JWT_SECRET is default in production. Set JWT_SECRET env var.');
    process.exit(1);
  }
  if (config.ADMIN_PASSWORD === DEFAULT_ADMIN_PASSWORD) {
    console.error('[SECURITY] FATAL: ADMIN_PASSWORD is default in production. Set ADMIN_PASSWORD env var.');
    process.exit(1);
  }
}

module.exports = config;
