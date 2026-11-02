const db = require('../db/init');

/* `api` guards the whole PUBLIC read surface, so its default has to suit
   production rather than a single local browser.

   It used to be 10/60s. That is fine on a laptop and wrong on a deployed
   site, and the failure mode is nasty rather than loud: one page render
   reads 4-6 content endpoints, and an admin save triggers a revalidation
   burst that re-renders many pages at once, so the calls arrive in a
   tight cluster. When the limiter trips the frontend does not surface an
   error — lib/team-content.ts catches the 429 and silently falls back to
   the static seed. The user just sees "my save did not take, I'll press
   save again", and the retry works because the window has rolled over by
   then. That reads exactly like a caching bug, and gets debugged as one.

   600/min still stops an abusive crawl while leaving an order of
   magnitude of headroom for a revalidation burst. Override it at runtime
   from the dashboard (Settings -> Rate limits); this value only seeds a
   fresh database.

   The buckets that guard something real stay deliberately tight: auth and
   admin-login are credential endpoints, imagegen is expensive. */
const DEFAULT_LIMITS = {
  api: { max: 600, windowMs: 60 * 1000 },
  auth: { max: 3, windowMs: 60 * 1000 },
  'admin-login': { max: 2, windowMs: 60 * 1000 },
  imagegen: { max: 1, windowMs: 60 * 1000 },
};

function getLimits() {
  const rows = db.prepare("SELECT key, value FROM settings WHERE key LIKE 'rl_%'").all();
  const stored = {};
  for (const r of rows) {
    try { stored[r.key] = JSON.parse(r.value); } catch { stored[r.key] = r.value; }
  }
  const result = {};
  for (const [name, def] of Object.entries(DEFAULT_LIMITS)) {
    const key = `rl_${name}`;
    result[name] = stored[key] ? { max: stored[key].max || def.max, windowMs: stored[key].windowMs || def.windowMs } : { ...def };
  }
  return result;
}

function updateLimits(newLimits) {
  const valid = {};
  for (const [name, def] of Object.entries(DEFAULT_LIMITS)) {
    if (newLimits[name]) {
      const max = Math.max(1, Math.min(10000, parseInt(newLimits[name].max, 10) || def.max));
      const windowMs = Math.max(1000, Math.min(86400000, parseInt(newLimits[name].windowMs, 10) || def.windowMs));
      valid[name] = { max, windowMs };
    }
  }
  const stmt = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
  for (const [name, val] of Object.entries(valid)) {
    const key = `rl_${name}`;
    stmt.run(key, JSON.stringify(val));
  }
  return valid;
}

function createLimiter(name) {
  const rateLimit = require('express-rate-limit');
  return rateLimit({
    windowMs: getLimits()[name].windowMs,
    max: (req) => getLimits()[name].max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: { code: 'RATE_LIMITED', message: 'Too many requests, please try again later.' } },
    handler: (req, res, next, opts) => {
      const logs = require('../lib/logger');
      logs.logEvent('warning', 'rate-limit', `${name} limit hit for ${req.ip}`, req);
      res.status(opts.statusCode || 429).json({ error: { code: 'RATE_LIMITED', message: 'Too many requests, please try again later.' } });
    },
  });
}

module.exports = { getLimits, updateLimits, createLimiter, DEFAULT_LIMITS };
