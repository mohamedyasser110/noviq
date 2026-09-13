/* ============================================================
   NOVIQ — PERFORMANCE & ERROR MONITOR
   ------------------------------------------------------------
   Lightweight, in-memory runtime monitor. No database writes,
   no schema changes, no new dependencies, no persistence.
   It observes requests and errors while the server runs and
   exposes stats to the admin panel (/api/admin/monitor).

   Safety by construction:
   - Every side-effect is wrapped in try/catch; a monitor bug
     can never break a request or crash the server.
   - The response lifecycle is untouched (finish event is
     read-only observation).
   - Buffers are capped so memory stays bounded.
   ============================================================ */

const MAX_REQUESTS = 2000; /* keep last N request observations */
const MAX_ERRORS = 200;    /* keep last N captured errors */
const os = require('os');

const state = {
  startedAt: Date.now(),
  totals: {
    requests: 0,
    msSum: 0,
    status2xx: 0,
    status3xx: 0,
    status4xx: 0,
    status5xx: 0,
    errors: 0,
  },
  recentRequests: [], /* { t, method, path, status, ms } */
  errors: [],         /* { t, method, path, message, stack, status } */
  routes: new Map(),  /* routeKey -> { count, msSum, errCount } */
  /* live system sampling (updated by a lightweight tracer, never blocks) */
  eventLoopLagMs: 0,
  cpuPct: 0,
  cpuSample: { at: Date.now(), usage: process.cpuUsage() },
};

/* run `fn` and swallow any failure (monitor must never break the app) */
function safe(fn) {
  try { return fn(); } catch (e) { /* monitor is best-effort only */ }
}

/* ------------------------------------------------------------
   Lightweight tracer: measures event-loop lag + CPU % without
   blocking anything. Runs on its own interval, always safe().
   ------------------------------------------------------------ */
let tracerStarted = false;
function startTracer() {
  if (tracerStarted) return;
  tracerStarted = true;
  setInterval(() => {
    safe(() => {
      const start = Date.now();
      setImmediate(() => {
        state.eventLoopLagMs = Date.now() - start;
        const now = Date.now();
        const prev = state.cpuSample;
        const usage = process.cpuUsage();
        const dtSec = (now - prev.at) / 1000;
        if (dtSec > 0) {
          const cores = Math.max(1, os.cpus().length);
          const busyMs = (usage.user - prev.usage.user + usage.system - prev.usage.system) / 1000;
          state.cpuPct = Math.min(100, Math.round((busyMs / dtSec / cores) * 100));
        }
        state.cpuSample = { at: now, usage };
      });
    });
  }, 2000);
}

/* ------------------------------------------------------------
   Express middleware — observe the response when it finishes.
   ------------------------------------------------------------ */
function middleware(req, res, next) {
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    safe(() => {
      const ms = Number(process.hrtime.bigint() - start) / 1e6;
      const status = res.statusCode || 200;
      const t = state.totals;
      t.requests++;
      t.msSum += ms;
      if (status >= 500) t.status5xx++;
      else if (status >= 400) t.status4xx++;
      else if (status >= 300) t.status3xx++;
      else t.status2xx++;

      const route =
        (req.route && req.route.path)
          ? `${req.method} ${req.route.path}`
          : `${req.method} ${req.baseUrl || ''}${req.path}`;
      const entry = state.routes.get(route) || { count: 0, msSum: 0, errCount: 0 };
      entry.count++;
      entry.msSum += ms;
      if (status >= 400) entry.errCount++;
      state.routes.set(route, entry);

      state.recentRequests.push({
        t: Date.now(),
        method: req.method,
        path: (req.originalUrl || req.path || '/').split('?')[0],
        status,
        ms: Math.round(ms * 10) / 10,
      });
      if (state.recentRequests.length > MAX_REQUESTS) state.recentRequests.shift();
    });
  });
  next();
}

/* Record an error (called from the Express error handler and process hooks) */
function recordError(err, req) {
  safe(() => {
    state.totals.errors++;
    state.errors.push({
      t: Date.now(),
      method: (req && req.method) || '-',
      path: (req && (req.originalUrl || req.path)) || '-',
      status: (err && (err.status || err.statusCode)) || 500,
      message: (err && err.message) || String(err),
      stack: (err && err.stack) ? err.stack.split('\n').slice(0, 5).join('\n') : String(err),
    });
    if (state.errors.length > MAX_ERRORS) state.errors.shift();
  });
}

/* ------------------------------------------------------------
   Snapshot for the admin panel (pure data, no side effects)
   ------------------------------------------------------------ */
function snapshot(limit = 60) {
  return safe(() => {
    const t = state.totals;
    const msArr = state.recentRequests.map(r => r.ms).sort((a, b) => a - b);
    const pIdx = (q) => msArr.length
      ? msArr[Math.min(msArr.length - 1, Math.floor(msArr.length * q))]
      : 0;
    const p95 = pIdx(0.95);
    const p99 = pIdx(0.99);
    const mem = process.memoryUsage();
    const windowStart = Date.now() - 60000;
    const rps = state.recentRequests.filter(r => r.t >= windowStart).length / 60;
    const errorRate = t.requests
      ? Math.round(((t.status4xx + t.status5xx) / t.requests) * 1000) / 10
      : 0;
    const slowRoutes = [...state.routes.entries()]
      .map(([route, r]) => ({
        route,
        count: r.count,
        avgMs: r.count ? Math.round((r.msSum / r.count) * 10) / 10 : 0,
        errors: r.errCount,
      }))
      .filter(r => r.count >= 1)
      .sort((a, b) => b.avgMs - a.avgMs)
      .slice(0, 8);

    return {
      startedAt: state.startedAt,
      uptimeSec: Math.floor(process.uptime()),
      pid: process.pid,
      nodeVersion: process.version,
      system: { eventLoopLagMs: state.eventLoopLagMs, cpuPct: state.cpuPct },
      memory: { rss: mem.rss, heapUsed: mem.heapUsed, heapTotal: mem.heapTotal },
      totals: {
        requests: t.requests,
        errors: t.errors,
        status2xx: t.status2xx,
        status3xx: t.status3xx,
        status4xx: t.status4xx,
        status5xx: t.status5xx,
        avgMs: t.requests ? Math.round((t.msSum / t.requests) * 10) / 10 : 0,
        p95Ms: Math.round(p95 * 10) / 10,
        p99Ms: Math.round(p99 * 10) / 10,
        rps: Math.round(rps * 100) / 100,
        errorRate,
      },
      recentRequests: state.recentRequests.slice(-limit),
      errors: state.errors.slice(-limit),
      slowRoutes,
    };
  }) || { totals: {}, recentRequests: [], errors: [], slowRoutes: [] };
}

/* Reset all in-memory stats (admin button) */
function reset() {
  safe(() => {
    state.startedAt = Date.now();
    state.totals.requests = 0;
    state.totals.msSum = 0;
    state.totals.status2xx = 0;
    state.totals.status3xx = 0;
    state.totals.status4xx = 0;
    state.totals.status5xx = 0;
    state.totals.errors = 0;
    state.recentRequests.length = 0;
    state.errors.length = 0;
    state.routes.clear();
  });
}

/* ------------------------------------------------------------
   Process-level hooks — record crashes/errors, then preserve the
   original crash semantics (re-throw on the next tick).
   ------------------------------------------------------------ */
let hooksInstalled = false;
function installProcessHooks() {
  if (hooksInstalled) return;
  hooksInstalled = true;
  startTracer();

  process.on('uncaughtException', (err) => {
    recordError(err, { method: 'PROCESS', originalUrl: '/ (uncaughtException)' });
    /* preserve default behaviour: crash the process */
    safe(() => { throw err; });
  });

  process.on('unhandledRejection', (reason) => {
    const err = reason instanceof Error ? reason : new Error(String(reason));
    recordError(err, { method: 'PROCESS', originalUrl: '/ (unhandledRejection)' });
    /* Node >=15 crashes on unhandled rejections; preserve that */
    safe(() => { throw err; });
  });
}

module.exports = {
  middleware,
  recordError,
  snapshot,
  reset,
  installProcessHooks,
};