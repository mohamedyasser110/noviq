/* ============================================================
   NOVIQ SERVER CONFIG
   ------------------------------------------------------------
   All environment-driven settings in one place.
   On shared hosting (cPanel → Setup Node.js App) set these as
   environment variables, or create server/.env (KEY=value lines).
   ============================================================ */

const fs = require('fs');
const path = require('path');

/* Tiny .env loader (no dependency needed on shared hosting) */
const ENV_FILE = path.join(__dirname, '.env');
if (fs.existsSync(ENV_FILE)) {
  for (const line of fs.readFileSync(ENV_FILE, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
}

const config = {
  /* Port: Passenger/cPanel injects PORT automatically */
  PORT: parseInt(process.env.PORT, 10) || 3001,

  /* Security — CHANGE JWT_SECRET in production! */
  JWT_SECRET: process.env.JWT_SECRET || 'noviq-admin-secret-change-in-production',
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || 'noviq2026',
  ADMIN_EMAIL: process.env.ADMIN_EMAIL || '',

  /* SQLite database file (lives inside the backend folder) */
  DB_PATH: process.env.DB_PATH || path.join(__dirname, 'data', 'noviq.db'),
  /* Allowed CORS origins, comma-separated.
     Example: FRONTEND_URL=https://noviq.com,https://www.noviq.com */
  CORS_ORIGINS: (process.env.FRONTEND_URL || 'http://localhost:3001,http://localhost:8000,http://127.0.0.1:5500')
    .split(',').map(s => s.trim()).filter(Boolean),

  /* Serve the frontend folder from this server?
     true  → single app serves site + API (local dev / VPS)
     false → backend is API-only (frontend hosted separately) */
  SERVE_FRONTEND: (process.env.SERVE_FRONTEND || 'true').toLowerCase() !== 'false',

  /* Frontend directory (used for static serving + content.config.js rebuild) */
  FRONTEND_DIR: process.env.FRONTEND_DIR || path.join(__dirname, '..', 'frontend'),

  NODE_ENV: process.env.NODE_ENV || 'development',
};

/* Uploads directory: explicit UPLOADS_DIR wins, otherwise always follow
   FRONTEND_DIR so admin image uploads land inside the actually-served
   frontend (critical on shared hosting where FRONTEND_DIR=public_html). */
config.UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(config.FRONTEND_DIR, 'images', 'uploads');

/* Production guard: refuse to start with default secrets */
if (config.NODE_ENV === 'production') {
  if (config.JWT_SECRET === 'noviq-admin-secret-change-in-production') {
    console.error('[SECURITY] FATAL: JWT_SECRET is default in production. Set JWT_SECRET env var.');
    process.exit(1);
  }
  if (config.ADMIN_PASSWORD === 'noviq2026') {
    console.error('[SECURITY] FATAL: ADMIN_PASSWORD is default in production. Set ADMIN_PASSWORD env var.');
    process.exit(1);
  }
}

module.exports = config;
