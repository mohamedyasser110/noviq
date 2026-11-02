/* ============================================================
   NOVIQ — backup history store (server-side copies)
   ------------------------------------------------------------
   Downloading alone left "the backup system empty": every archive went
   straight to the operator's disk and the server kept nothing, so there
   was no list, nothing to restore from, and no evidence any backup ever
   ran. This module owns the stored-copy side: where copies live, how
   many are kept, and how their summaries are read back.

   Used by routes/admin.js (download persists a copy; list/download/
   delete serve the history) and lib/auto-backup.js (scheduled copies).
   One module so the retention rule and the safety checks cannot drift
   apart between the two writers.
   ============================================================ */
const fs = require('fs');
const path = require('path');

const config = require('../config');
const backup = require('../scripts/backup');
const restore = require('../scripts/restore');

/* Under the database directory, so it rides the same Railway volume as
   the data it protects. Overridable per environment (tests point it at a
   temp dir). Read lazily — not at module load — so tests and hosting can
   set BACKUP_DIR after require. */
function backupDir() {
  return process.env.BACKUP_DIR || path.join(path.dirname(config.DB_PATH), 'backups');
}

/* How many server copies to keep. The 11th backup deletes the oldest;
   without a cap an unattended server fills its volume one click at a time. */
const BACKUP_KEEP = 10;

/* …but a bare "keep the newest 10" cap is a trap. Ten backups taken on the
   same day (a busy scheduler, or an operator snapshotting before each risky
   change) all look "newer" than a week-old archive, so the cap would delete
   every older day and leave a history that cannot reach back even one day.
   That is exactly the history an incident review needs.

   So the newest copy of each of the last BACKUP_DAYS days that has any copy
   at all is protected from the cap. Ten files is a ceiling, not a quota:
   when coverage needs fewer, fewer are kept. */
const BACKUP_DAYS = 5;

/* Local calendar day of an ISO timestamp — the operator thinks in calendar
   days, and the server's timezone is what the timestamps were written in. */
function dayKey(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'invalid';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/* Names that must survive the cap: the most recent copy of each of the last
   BACKUP_DAYS distinct days, scanning newest first. Days with no backup at
   all cannot be protected — nothing to keep — so the window is "the last 5
   days that actually have a copy". */
function pickDailyKeepers(items, days = BACKUP_DAYS) {
  const keep = new Set();
  const seen = new Set();
  for (const item of items) {
    const key = dayKey(item.createdAt);
    if (seen.has(key)) continue;
    seen.add(key);
    keep.add(item.name);
    if (seen.size >= days) break;
  }
  return keep;
}

function backupNameOK(name) {
  return typeof name === 'string'
    && /^[A-Za-z0-9][A-Za-z0-9._-]*\.zip$/.test(name)
    && !name.includes('..');
}

/* Resolve a history name to a path, or null when it escapes the dir.
   The regex above already rejects traversal, this is the second lock. */
function backupFilePath(name) {
  const base = path.resolve(backupDir());
  const full = path.resolve(base, name);
  if (full !== base && !full.startsWith(base + path.sep)) return null;
  return full;
}

/* Re-read a freshly built archive and prove it is a restorable backup:
   valid zip, manifest present, format tag right, every declared table file
   present. Returns the manifest. Throws otherwise. */
function verifyBackupBuffer(buf) {
  const files = restore.unzip(buf);
  const raw = files.get('manifest.json');
  if (!raw) throw new Error('archive has no manifest.json');
  const m = JSON.parse(raw.toString('utf8'));
  if (m.format !== 'noviq-backup') throw new Error(`unexpected format: ${m.format}`);
  const missing = Object.keys(m.tables || {}).filter((t) => !files.has(`db/tables/${t}.json`));
  if (missing.length) throw new Error(`archive is missing table data: ${missing.join(', ')}`);
  return m;
}

/* Manifest summary without extracting images: manifests are kilobytes,
   the images are not read at all. A corrupt zip reports corrupt:true
   instead of failing the whole listing. */
function readBackupSummary(file) {
  try {
    const files = restore.unzip(fs.readFileSync(file));
    const raw = files.get('manifest.json');
    if (!raw) return { corrupt: true };
    const m = JSON.parse(raw.toString('utf8'));
    if (m.format !== 'noviq-backup') return { corrupt: true };
    let rows = 0;
    for (const t of Object.values(m.tables || {})) rows += t.rows || 0;
    return {
      tables: Object.keys(m.tables || {}).length,
      rows,
      images: m.images || 0,
      manifestCreatedAt: m.createdAt || null,
    };
  } catch {
    return { corrupt: true };
  }
}

function listStoredBackups() {
  const dir = backupDir();
  let names;
  try {
    names = fs.readdirSync(dir).filter((n) => n.endsWith('.zip'));
  } catch {
    return [];
  }
  return names
    .map((name) => {
      const full = path.join(dir, name);
      let stat = null;
      try { stat = fs.statSync(full); } catch { return null; }
      if (!stat.isFile()) return null;
      return {
        name,
        size: stat.size,
        createdAt: stat.mtime.toISOString(),
        ...readBackupSummary(full),
      };
    })
    .filter(Boolean)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

/* Apply both retention rules: never exceed BACKUP_KEEP, and never let the
   cap erase a day. Walks oldest-first and skips the protected daily keeper,
   so intra-day copies are spent before a day's last representative is.
   Returns what it deleted, so callers can log it and tests can assert it.
   Best-effort: a failed unlink must not fail the backup that just succeeded. */
function pruneStoredBackups() {
  const removed = [];
  try {
    const items = listStoredBackups(); // newest first
    if (items.length <= BACKUP_KEEP) return removed;
    const keepNames = pickDailyKeepers(items);
    let remaining = items.length;
    for (let i = items.length - 1; i >= 0 && remaining > BACKUP_KEEP; i--) {
      const item = items[i];
      if (keepNames.has(item.name)) continue;
      const full = backupFilePath(item.name);
      if (full && fs.existsSync(full)) {
        try {
          fs.unlinkSync(full);
          remaining--;
          removed.push(item.name);
        } catch (err) {
          /* Leave it on disk and carry on with the next one; a locked file
             must not stop the rest of the cleanup. */
          console.error('[backup] could not delete ' + item.name + ': ' + err.message);
        }
      } else {
        remaining--;
      }
    }
    if (removed.length) {
      console.log(`[backup] retention: deleted ${removed.length} old backup(s), ${remaining} kept`);
    }
  } catch (err) {
    console.error('[backup] prune failed:', err.message);
  }
  return removed;
}

/* Build one verified archive into the history dir and return its path.
   Throws on any failure; writes nothing partial (a failed verify deletes
   the file). This is the single writer both the download route and the
   scheduler go through. */
function createStoredBackup(label) {
  const dir = backupDir();
  fs.mkdirSync(dir, { recursive: true });
  const file = backup.main([], { dir, label, quiet: true });
  try {
    verifyBackupBuffer(fs.readFileSync(file));
  } catch (err) {
    try { fs.unlinkSync(file); } catch {}
    throw new Error('built archive failed verification and was discarded: ' + err.message);
  }
  pruneStoredBackups();
  return file;
}

module.exports = {
  backupDir,
  BACKUP_KEEP,
  BACKUP_DAYS,
  dayKey,
  pickDailyKeepers,
  backupNameOK,
  backupFilePath,
  verifyBackupBuffer,
  readBackupSummary,
  listStoredBackups,
  pruneStoredBackups,
  createStoredBackup,
};
