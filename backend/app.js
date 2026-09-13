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
const path = require('path');

const config = require('./config');
const monitor = require('./monitor');
const { createLimiter } = require('./rate-limit-config');
const { limitHandler } = require('./logs');

monitor.installProcessHooks();

require('./db/init');
const { ensureAdminUser } = require('./middleware/auth');
ensureAdminUser();

const apiRoutes = require('./routes');
const { buildConfigSource } = require('./content-store');

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
app.use(express.json({ limit: '8mb' }));
app.use(express.urlencoded({ extended: true, limit: '8mb' }));

const apiLimiter = createLimiter('api');
/* Public API is rate-limited; admin API is JWT-protected already and
   must never be throttled by the low public defaults (it would break
   the dashboard with 429 "Failed to load" errors). */
app.use('/api/', (req, res, next) => {
  if (req.path.startsWith('/admin')) return next();
  apiLimiter(req, res, next);
});

/* ---- All API endpoints (see routes/index.js) ---- */
app.use('/api', apiRoutes);

/* ---- Admin dashboard (always served by the backend) ---- */
app.use('/admin', express.static(path.join(__dirname, 'admin')));
app.get('/admin/{*splat}', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin', 'index.html'));
});

/* ---- Live content config (frontend loads this when co-hosted) ---- */
app.get('/data/content.config.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.send(buildConfigSource());
});

/* ---- Optional frontend serving (disable with SERVE_FRONTEND=false) ---- */
if (config.SERVE_FRONTEND) {
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

/* ---- Error handler ---- */
app.use((err, req, res, _next) => {
  monitor.recordError(err, req);
  /* Malformed JSON body — Express sets err.type='entity.parse.failed' */
  if (err.type === 'entity.parse.failed' || err.type === 'entity.too.large') {
    const code = err.type === 'entity.too.large' ? 413 : 400;
    return res.status(code).json({ error: err.type === 'entity.too.large' ? 'Request body too large.' : 'Invalid JSON body.' });
  }
  console.error('[Server Error]', err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

module.exports = app;
