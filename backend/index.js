/* ============================================================
   NOVIQ BACKEND — entry point
   ------------------------------------------------------------
   Local/VPS:      node index.js
   Shared hosting: set this file as the cPanel Node.js app
                   startup file (Passenger injects PORT).
   ============================================================ */

const app = require('./app');
const config = require('./config');

/* The client portal is mounted HERE, on the running application.
   It is deliberately NOT left to routes/index.js: that file is the
   /api router, which app.js mounts, and app.js was already required
   above — so anything added to it later would arrive too late to be
   applied. That is not a hypothetical: routes/index.js has mounted the
   portal correctly all along, and every /api/portal/* route still
   answered 404 in production, because nothing in this entrypoint ever
   required routes/portal.js.

   Mounting here, before listen(), is the only place a router added to a
   live app.js can actually take effect. Idempotent: the same URL twice
   would only run this once. */
if (!app._portalMounted) {
  app.use(require('./routes/portal'));
  app._portalMounted = true;
}

function failSecurity(reason, hint) {
  console.error('==============================================================');
  console.error('[SECURITY] Refusing to start in production: ' + reason);
  console.error('[SECURITY] ' + hint);
  console.error('==============================================================');
  process.exit(1);
}

/* The two fail-fast secret checks below use config.defaults (the same named
   constants the config guard uses), so the "default" values live in exactly
   one place. */
if (config.NODE_ENV === 'production') {
  if (config.JWT_SECRET === config.defaults.JWT_SECRET) {
    failSecurity('JWT_SECRET is still the default value.', 'Set JWT_SECRET in .env to a long random string (e.g. `openssl rand -hex 32`).');
  }
  if (config.ADMIN_PASSWORD === config.defaults.ADMIN_PASSWORD) {
    failSecurity('ADMIN_PASSWORD is still the default value.', 'Change ADMIN_PASSWORD in .env to a strong, unique password.');
  }
  if (!process.env.FRONTEND_URL) {
    console.warn('==============================================================');
    console.warn('[CORS] FRONTEND_URL is not set — CORS defaults to localhost!');
    console.warn('[CORS] Set FRONTEND_URL in .env (e.g. FRONTEND_URL=https://noviq.com,https://www.noviq.com)');
    console.warn('[CORS] Without it, your deployed frontend will be blocked by CORS.');
    console.warn('==============================================================');
  }
}

const server = app.listen(config.PORT, () => {
  console.log(`[Noviq] Server running on http://localhost:${config.PORT}`);
  console.log(`[Noviq] Mode: ${config.SERVE_FRONTEND ? 'site + API' : 'API only'} | Env: ${config.NODE_ENV}`);
  /* Scheduled backup copies (lib/auto-backup.js). Best-effort by design:
     a scheduler must never prevent boot, and its timer is unref'd so it
     never holds the process open. */
  try {
    require('./lib/auto-backup').startAutoBackup();
  } catch (err) {
    console.error('[backup] scheduler failed to start:', err.message);
  }
});

/* Graceful shutdown — finish in-flight requests before exit.
   Passenger/VPS send SIGTERM; Ctrl+C sends SIGINT. */
function shutdown(signal) {
  console.log(`[Noviq] ${signal} received, shutting down...`);
  server.close(() => {
    console.log('[Noviq] All connections closed. Bye.');
    process.exit(0);
  });
  /* Force-exit after 8s if something hangs (e.g. a long image-gen) */
  setTimeout(() => { console.warn('[Noviq] Force exit (timeout)'); process.exit(1); }, 8000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

module.exports = app;
