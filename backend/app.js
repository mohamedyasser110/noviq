/* ============================================================
   NOVIQ BACKEND — Express app
   ------------------------------------------------------------
   API-first backend, deployable standalone on shared hosting
   (cPanel → Setup Node.js App → startup file: index.js).
   Frontend serving is optional via SERVE_FRONTEND config.
   ============================================================ */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const fs = require('fs');
const path = require('path');

const config = require('./config');
const monitor = require('./lib/monitor');
const { ApiError } = require('./lib/api-error');
const { createLimiter } = require('./config/rate-limit');
const { limitHandler } = require('./lib/logger');

monitor.installProcessHooks();

require('./db/init');
const { ensureAdminUser } = require('./middleware/auth');
ensureAdminUser();

const apiRoutes = require('./routes/index');
const { buildConfigSource } = require('./services/content-store');

// -------------------------------------------------------
const app = express();

/* Shared hosting runs behind a proxy (Passenger/LiteSpeed) */
app.set('trust proxy', 1);

app.use(monitor.middleware);

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", 'https://cdnjs.cloudflare.com', 'https://unpkg.com'],
      scriptSrcAttr: ["'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", 'https://api.mymemory.translated.net'],
      frameAncestors: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
    },
  },
}));
app.use(cors({
  origin(origin, cb) {
    /* Allow same-origin/no-origin requests and whitelisted domains */
    if (!origin || config.CORS_ORIGINS.includes(origin)) return cb(null, true);
    return cb(null, false);
  },
  credentials: true,
}));
app.use(compression());
app.use(morgan(config.NODE_ENV === 'production' ? 'combined' : 'dev'));
/* Body limit.
 *
 * 8 MB was sized for the admin uploader, which caps a single file at 5 MB.
 * The backup archive needs more: a real one is ~7 MB of zip, and it arrives
 * as a base64 data URL, which inflates by 4/3 — about 9.6 MB on the wire
 * before the JSON envelope. At 8 MB the parser rejected every inspect and
 * restore with a bare 413, so the dashboard showed "the upload failed" for
 * an archive that was perfectly valid.
 *
 * 64 MB covers a 48 MB decoded archive with room for base64 and JSON. It is
 * a parser-level bound only; each route still enforces its own real limit
 * (MAX_BACKUP_UPLOAD in routes/admin.js, 5 MB for uploads), so raising this
 * does not widen what any endpoint accepts — it only stops the parser from
 * refusing a body the route would have judged for itself. */
app.use(express.json({ limit: '64mb' }));
app.use(express.urlencoded({ extended: true, limit: '64mb' }));

const apiLimiter = createLimiter('api');
/* Public API is rate-limited; admin API is JWT-protected already and
   must never be throttled by the low public defaults (it would break
   the dashboard with 429 "Failed to load" errors).
   Agent Bus is also excluded to allow unrestricted coordination traffic. */
app.use('/api/', (req, res, next) => {
  if (req.path.startsWith('/admin') || req.path.startsWith('/agent-bus')) return next();
  apiLimiter(req, res, next);
});

/* ---- All API endpoints (see routes/index.js) ---- */
app.use('/api', apiRoutes);

/* ---- Agent Collaboration Message Bus ---- */
/* Mounts the central message bus for multi-agent coordination under /api/agent-bus.
   Provides file locks, agent registry, event log, schema registry, and SSE streaming.
   See .agent-system/README.md for full protocol documentation. */
const { app: agentBusRouter } = require('./.agent-system/message-bus');
app.use('/api/agent-bus', agentBusRouter);

/* ---- Admin dashboard (always served by the backend) ---- */
app.use('/admin', express.static(path.join(__dirname, 'admin')));
app.get('/admin/{*splat}', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin', 'index.html'));
});

/* ---- Uploaded media (admin previews + any consumer) ----
   Serves the uploaded files as `images/uploads/<file>`, which is the
   shape the CMS stores (see routes/admin.js) and the shape the site's
   <img src> resolves to.

   SECURITY: this used to serve `<uploads-root>/..` (the PARENT) so that
   the relative path would resolve. That is safe while uploads live under
   frontend/public/images and the database lives in backend/data — the
   two parents are unrelated. It stops being safe the moment they share a
   parent, which is exactly what a single Docker volume does
   (DB_PATH=/app/storage/noviq.db, UPLOADS_DIR=/app/storage/uploads):
   serving /app/storage verbatim published the entire SQLite database at
   GET /images/noviq.db, including the -wal and -shm siblings. Anyone
   could download every contact submission, newsletter address, CMS
   document and admin password hash.

   So the parent mount is now conditional: it only happens when the
   database does NOT live inside it. Uploads are always served directly
   at /images/uploads, which is the only path the CMS actually emits. */
try {
  const uploadsDir = config.UPLOADS_DIR;
  const uploadsRoot = path.dirname(uploadsDir);
  const dbPath = path.resolve(config.DB_PATH);

  /* True when the database sits inside the directory we would publish. */
  const dbInsideRoot =
    dbPath === uploadsRoot || dbPath.startsWith(uploadsRoot + path.sep);

  const staticOpts = {
    setHeaders(res, filePath) {
      if (/\.(?:png|jpe?g|webp|gif|ico|woff2?|ttf)$/i.test(filePath)) {
        res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
      } else {
        res.setHeader('Cache-Control', 'no-cache');
      }
    },
  };

  /* Mounts are registered UNCONDITIONALLY. express.static resolves its
     root per request, so a folder that does not exist yet simply 404s
     until it appears and then serves normally — which is what we want,
     because the volume's uploads/ folder is created by the container
     entrypoint and may land after this module is evaluated. Gating the
     registration on fs.existsSync instead meant an uploads folder that
     was missing at boot stayed unservable for the life of the process. */

  /* Canonical mount — the exact directory, so nothing above it leaks. */
  app.use('/images/uploads', express.static(uploadsDir, staticOpts));

  if (dbInsideRoot) {
    console.warn(
      '[Noviq] uploads: DB lives inside ' + uploadsRoot +
      ' — parent mount skipped (serving uploads only)'
    );
  } else {
    /* Legacy co-hosted layout: the parent is an images tree, safe to
       publish, and it is what serves the shipped public/images/*. */
    app.use('/images', express.static(uploadsRoot, staticOpts));
    app.use('/uploads', express.static(uploadsDir, staticOpts));
  }
} catch (err) {
  console.warn('[Noviq] uploads static skipped: ' + err.message);
}

/* ---- Live content config (frontend loads this when co-hosted) ---- */
app.get('/data/content.config.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.send(buildConfigSource());
});

/* ---- Parity with frontend/server.js DENY_EXACT / DENY_PREFIX: never expose
   raw visitor records, our own server source or dependency manifests through
   the co-hosted static mount (Apache .htaccess blocks these already; the
   Node path must block them too, or a plain GET leaks them). ---- */
const DENY_EXACT = new Set(['/analytics-visits.json', '/server.js', '/.env', '/package.json', '/package-lock.json']);
const DENY_PREFIX = ['/analytics-visits.json']; /* + its .1 rotation copy */
app.use((req, res, next) => {
  const u = (req.path || '').toLowerCase();
  if (DENY_EXACT.has(u) || DENY_PREFIX.some(p => u === p || u.startsWith(p + '.'))) {
    return res.status(404).send('Not found');
  }
  next();
});

/* ---- Optional frontend serving (disable with SERVE_FRONTEND=false) ----
   Guard: the frontend is now a Next.js app (no index.html on disk).
   If the entry file is missing, fall back to API-only instead of 500ing
   every non-API request via sendFile(ENOENT). ---- */
const FRONTEND_INDEX = path.join(config.FRONTEND_DIR, 'index.html');
const canServeFrontend = config.SERVE_FRONTEND && fs.existsSync(FRONTEND_INDEX);
if (config.SERVE_FRONTEND && !canServeFrontend) {
  console.warn(`[Noviq] SERVE_FRONTEND=true but no index.html in ${config.FRONTEND_DIR} (Next.js frontend runs separately on :4321) — serving API only.`);
}
if (canServeFrontend) {
  /* Asset caching: static files get a day + SWR week; HTML always revalidates */
  app.use(express.static(config.FRONTEND_DIR, {
    setHeaders(res, filePath) {
      if (/\.(?:css|js|png|jpe?g|webp|svg|gif|ico|woff2?|ttf)$/i.test(filePath)) {
        res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
      } else {
        res.setHeader('Cache-Control', 'no-cache');
      }
    },
  }));
  app.get('/{*splat}', (req, res) => {
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(path.join(config.FRONTEND_DIR, 'index.html'));
  });
} else {
  app.get('/', (req, res) => res.json({ name: 'Noviq API', status: 'ok' }));
}

/* ---- Error handler (shared envelope via lib/api-error.js,
   a CommonJS port of contracts/_shared/api-error.node.ts) ---- */
app.use((err, req, res, _next) => {
  monitor.recordError(err, req);
  /* Malformed JSON body — Express sets err.type='entity.parse.failed' */
  if (err.type === 'entity.parse.failed' || err.type === 'entity.too.large') {
    const code = err.type === 'entity.too.large' ? 413 : 400;
    const errorCode = err.type === 'entity.too.large' ? 'PAYLOAD_TOO_LARGE' : 'VALIDATION_ERROR';
    return res.status(code).json({ error: { code: errorCode, message: err.type === 'entity.too.large' ? 'Request body too large.' : 'Invalid JSON body.', details: null } });
  }
  if (err instanceof ApiError) {
    return res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details } });
  }
  console.error('[Server Error]', err.stack);
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error', details: null } });
});

module.exports = app;
