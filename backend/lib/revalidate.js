/* ============================================================
   NOVIQ — on-demand cache purge for the Next.js frontend
   ------------------------------------------------------------
   The frontend is statically generated with a 120s ISR window as a
   SAFETY NET, but Next serves a stale page first and regenerates it
   in the background. An admin who saves copy and refreshes would
   therefore still see the old text once — the edit only appeared on
   a second refresh.

   `purgeFrontendCache()` is called after every successful content
   save. It drops the frontend's CMS cache tag so the next visitor
   gets the new copy on their FIRST request.

   DESIGN RULES (why it is safe to call from a request handler):
   - Fire-and-forget: the admin's save NEVER waits for, or fails
     because of, the frontend. The result is a promise nobody awaits.
   - Short timeout: a hung Next server cannot hold a request open.
   - Fails soft: a missing secret, a frontend that is not running, or
     a non-2xx answer are all logged at most once per interval and
     otherwise ignored. The ISR window still publishes the edit.
   - No secrets in logs: only the HTTP status is recorded.

   Cost is one small POST per admin SAVE — never per visitor.
   ============================================================ */

const config = require('../config');

/* Pure function so the throttle is testable without timers or network. */
function shouldPurge(state, now, intervalMs) {
  if (!state.last) return true;
  return now - state.last >= intervalMs;
}

/* Process-wide: one purge per interval even if five saves land at once. */
const state = { last: 0 };
const PURGE_INTERVAL_MS = 2000;

async function purgeFrontendCache(reason) {
  const { FRONTEND_REVALIDATE_URL, REVALIDATE_SECRET } = config;
  if (!REVALIDATE_SECRET) return { skipped: 'no-secret' };
  if (!FRONTEND_REVALIDATE_URL) return { skipped: 'no-url' };

  const now = Date.now();
  if (!shouldPurge(state, now, PURGE_INTERVAL_MS)) return { skipped: 'throttled' };
  state.last = now;

  /* AbortSignal.timeout keeps a wedged frontend from stalling the
     event loop; 3s is generous for a cache purge. */
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 3000);
  try {
    const res = await fetch(`${FRONTEND_REVALIDATE_URL}/api/revalidate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-revalidate-secret': REVALIDATE_SECRET,
      },
      body: JSON.stringify({ reason: String(reason || 'content-save').slice(0, 120) }),
      signal: ac.signal,
    });
    if (!res.ok) {
      console.warn(`[revalidate] frontend answered ${res.status} for ${FRONTEND_REVALIDATE_URL} — the ISR window will publish the edit instead.`);
      return { purged: false, status: res.status };
    }
    return { purged: true, status: res.status };
  } catch (err) {
    /* Offline frontend, wrong URL, timeout, abort — all non-fatal. */
    console.warn(`[revalidate] could not reach ${FRONTEND_REVALIDATE_URL} (${err.name}) — the ISR window will publish the edit instead.`);
    return { purged: false, error: err.name };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Schedule a cache purge. Never await this.
 * @param {string} reason short label for the frontend's log line
 * @returns {Promise<{purged?: boolean, skipped?: string}>} the same promise
 *   the handler ignores, exposed only so tests can await it
 */
function purgeFrontendCacheAsync(reason) {
  /* A rejected promise nobody awaits would be an unhandledRejection and
     could take the process down, so the result is normalised to null. */
  return purgeFrontendCache(reason).catch(() => ({ purged: false, error: 'unexpected' }));
}

module.exports = { purgeFrontendCache, purgeFrontendCacheAsync, shouldPurge, PURGE_INTERVAL_MS };
