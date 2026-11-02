/* ============================================================
   NOVIQ — scheduled automatic backups
   ------------------------------------------------------------
   A backup system that only runs when the operator remembers to click
   is a backup system that is empty when it matters. This schedules the
   same verified write the download route uses, on an interval:

     BACKUP_AUTO_HOURS=24   every 24h (default)
     BACKUP_AUTO_HOURS=0    disabled

   Design notes that matter:

   · First run is delayed 2 minutes after boot, not immediate: the
     server should be serving traffic before it starts a disk-heavy
     job, and on Railway every redeploy reboots — an immediate run
     would write a backup per deploy.
   · The timer is unref'd: it must never keep the process alive on its
     own (tests, one-shot scripts, graceful shutdown).
   · Never runs under NODE_ENV=test: suites must not sprinkle archives
     into temp dirs on a timer.
   · Failures only log. A failed scheduled backup must never crash the
     server or spam — the history table shows the gap honestly.
   · Retention is enforced by createStoredBackup, so scheduled and manual
     copies share one cap and one history.
   ============================================================ */
const { createStoredBackup } = require('./backup-store');

let timer = null;

function hours() {
  const raw = process.env.BACKUP_AUTO_HOURS;
  if (raw === undefined || raw === '') return 24;
  const n = parseFloat(raw);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(n, 24 * 30);
}

function runOnce(reason) {
  try {
    const stamp = 'auto-' + new Date().toISOString().replace(/[:.]/g, '-');
    const file = createStoredBackup(stamp);
    console.log(`[backup] scheduled copy stored (${reason}): ${file}`);
  } catch (err) {
    console.error('[backup] scheduled copy failed:', err.message);
  }
}

function startAutoBackup() {
  if (timer) return;
  if (process.env.NODE_ENV === 'test') return;
  const h = hours();
  if (!h) {
    console.log('[backup] scheduled copies disabled (BACKUP_AUTO_HOURS=0)');
    return;
  }
  console.log(`[backup] scheduled copies every ${h}h (BACKUP_AUTO_HOURS)`);
  /* First run delayed past boot; interval unref'd so it never holds the
     event loop open by itself. */
  timer = setTimeout(function tick() {
    runOnce('interval');
    timer = setInterval(() => runOnce('interval'), h * 3600 * 1000);
    if (timer.unref) timer.unref();
  }, 2 * 60 * 1000);
  if (timer.unref) timer.unref();
}

function stopAutoBackup() {
  if (timer) {
    clearTimeout(timer);
    clearInterval(timer);
    timer = null;
  }
}

module.exports = { startAutoBackup, stopAutoBackup, runOnce, hours };
