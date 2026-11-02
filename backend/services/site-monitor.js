/* ============================================================
   NOVIQ — SITE TRAFFIC MONITOR (real-time, in-memory)
   ------------------------------------------------------------
   Lightweight live visitor tracker for the PUBLIC site. No DB
   writes, no new dependencies, no persistence. Complements the
   request-level monitor.js with a visitor/pageview view.

   - "Active visitor" = a visitorId (from client localStorage)
     seen within ACTIVE_WINDOW_MS. The public page re-pings on
     every route change (heartbeat), so active visitors are the
     distinct IDs present in the last ~1 minute.
   - Everything is wrapped in safe(); a bug here can never break
     a request or crash the server.
   - Buffers are capped so memory stays bounded.
   ============================================================ */

const MAX_VIEWS = 2000;         /* keep last N pageview observations */
const ACTIVE_WINDOW_MS = 60 * 1000; /* a visitor is live within 1 min  */
const MINUTE_BUCKETS = 60;      /* per-minute view history (60 min)   */

const state = {
  totalViews: 0,
  startedAt: Date.now(),
  recentViews: [],              /* { t, path, language } most recent */
  pageCounts: new Map(),        /* path -> view count (rolling)       */
  active: new Map(),            /* visitorId -> lastSeen (ms)         */
  perMinute: new Array(MINUTE_BUCKETS).fill(0), /* rolling buckets    */
};

/* run `fn` and swallow any failure */
function safe(fn) {
  try { return fn(); } catch (e) { /* best-effort only */ }
}

/* ---- rolling per-minute view counters ---- */
function rollMinute() {
  const idx = Math.floor((Date.now() - state.startedAt) / 60000) % MINUTE_BUCKETS;
  if (state.perMinute._idx === undefined) state.perMinute._idx = idx;
  if (state.perMinute._idx !== idx) {
    /* advance any skipped buckets to 0 */
    let i = state.perMinute._idx;
    while (i !== idx) {
      i = (i + 1) % MINUTE_BUCKETS;
      state.perMinute[i] = 0;
    }
    state.perMinute._idx = idx;
  }
  state.perMinute[idx]++;
}

/* expiring fields are stored on the array as non-index props */
function initPerMinute() {
  if (state.perMinute._idx === undefined) state.perMinute._idx = Math.floor((Date.now() - state.startedAt) / 60000) % MINUTE_BUCKETS;
}
initPerMinute();

/* Record a pageview + visitor heartbeat. Returns nothing. */
function recordVisit(visitorId, path, language) {
  safe(() => {
    const t = Date.now();
    state.totalViews++;

    /* route counter (rolling, trimmed to last MINUTE_BUCKETS minutes) */
    state.recentViews.push({ t, path: String(path || '/').slice(0, 120), language: String(language || 'en').slice(0, 5) });
    if (state.recentViews.length > MAX_VIEWS) state.recentViews.shift();

    const p = (state.pageCounts.get(path) || 0) + 1;
    state.pageCounts.set(path, p);

    /* visitor heartbeat for "active" count */
    const id = String(visitorId || 'anon');
    if (id !== 'anon') state.active.set(id, t);

    rollMinute();
  });
}

/* Prune stale active visitors and rebuild top pages (call on read) */
function prunedView() {
  const cutoff = Date.now() - ACTIVE_WINDOW_MS;
  for (const [id, seen] of state.active) {
    if (seen < cutoff) state.active.delete(id);
  }

  /* rebuild top pages from recentViews (rolling window) */
  const counts = new Map();
  const windowStart = Date.now() - MINUTE_BUCKETS * 60000;
  for (const v of state.recentViews) {
    if (v.t < windowStart) continue;
    counts.set(v.path, (counts.get(v.path) || 0) + 1);
  }

  const topPages = [...counts.entries()]
    .map(([path, views]) => ({ path, views }))
    .sort((a, b) => b.views - a.views)
    .slice(0, 10);

  return { active: state.active.size, topPages };
}

/* Pure data snapshot for the public /api/analytics/live endpoint */
function snapshotPublic() {
  return safe(() => {
    const v = prunedView();
    const windowStart = Date.now() - 60000;
    const recent = state.recentViews
      .filter(r => r.t >= windowStart)
      .map(r => ({ path: r.path, at: r.t }))
      .slice(-30);

    return {
      activeVisitors: v.active,
      totalViews: state.totalViews,
      recent,
      topPages: v.topPages,
      perMinute: state.perMinute.filter(n => typeof n === 'number'),
    };
  }) || { activeVisitors: 0, totalViews: 0, recent: [], topPages: [], perMinute: [] };
}

/* Richer snapshot for the admin panel */
function snapshotAdmin() {
  return safe(() => {
    const v = prunedView();
    const lang = new Map();
    const windowStart = Date.now() - MINUTE_BUCKETS * 60000;
    for (const r of state.recentViews) {
      if (r.t < windowStart) continue;
      lang.set(r.language, (lang.get(r.language) || 0) + 1);
    }
    const byLanguage = [...lang.entries()].map(([language, views]) => ({ language, views }));
    return {
      activeVisitors: v.active,
      totalViews: state.totalViews,
      topPages: v.topPages,
      byLanguage,
      perMinute: state.perMinute.filter(n => typeof n === 'number'),
    };
  }) || { activeVisitors: 0, totalViews: 0, topPages: [], byLanguage: [], perMinute: [] };
}

module.exports = { recordVisit, snapshotPublic, snapshotAdmin };