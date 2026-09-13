/* ============================================================
   NOVIQ BACKEND — entry point
   ------------------------------------------------------------
   Local/VPS:      node index.js
   Shared hosting: set this file as the cPanel Node.js app
                   startup file (Passenger injects PORT).
   ============================================================ */

const app = require('./app');
const config = require('./config');

function failSecurity(reason, hint) {
  console.error('==============================================================');
  console.error('[SECURITY] Refusing to start in production: ' + reason);
  console.error('[SECURITY] ' + hint);
  console.error('==============================================================');
  process.exit(1);
}

if (config.NODE_ENV === 'production') {
  if (config.JWT_SECRET === 'noviq-admin-secret-change-in-production') {
    failSecurity('JWT_SECRET is still the default value.', 'Set JWT_SECRET in .env to a long random string (e.g. `openssl rand -hex 32`).');
  }
  if (config.ADMIN_PASSWORD === 'noviq2026') {
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
