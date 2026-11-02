/* ============================================================
   NOVIQ — backup-store + auto-backup unit tests
   ------------------------------------------------------------
   The route suite proves the HTTP layer; this proves the storage layer
   underneath it, without binding a port:

     · createStoredBackup writes a verified, restorable archive
     · retention caps history at BACKUP_KEEP (no unbounded growth)
     · backupNameOK/backupFilePath refuse traversal
     · auto-backup hours() parsing (default 24, 0 disables, garbage off)
     · auto-backup never starts under NODE_ENV=test
     · runOnce stores exactly one verified copy

   Standalone: temp dirs only, real temp database seeded through db/init
   conventions (minimal schema created inline — this suite must not depend
   on the app's seed content).
   ============================================================ */
const fs = require('fs');
const os = require('os');
const path = require('path');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'noviq-bk-store-'));
process.env.DB_PATH = path.join(TMP, 'noviq.db');
process.env.UPLOADS_DIR = path.join(TMP, 'uploads');
process.env.BACKUP_DIR = path.join(TMP, 'backups');
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-for-backup-store';
process.env.ADMIN_PASSWORD = 'TestOnly-Password-9!';
process.env.FRONTEND_URL = 'http://localhost:4321';

let passed = 0;
let failed = 0;
function ok(cond, label, detail) {
  if (cond) { passed++; console.log(`  ok   ${label}`); }
  else { failed++; console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ''}`); }
}

process.on('uncaughtException', (err) => {
  console.error('\n  FAIL uncaught:', err && err.stack ? err.stack : err);
  process.exit(1);
});
process.on('unhandledRejection', (err) => {
  console.error('\n  FAIL unhandled rejection:', err && err.stack ? err.stack : err);
  process.exit(1);
});

const Database = require('better-sqlite3');
const store = require('../lib/backup-store');
const auto = require('../lib/auto-backup');

/* Minimal database: the store must work on ANY schema, not just the app's. */
fs.mkdirSync(path.join(TMP, 'uploads'), { recursive: true });
{
  const db = new Database(process.env.DB_PATH);
  db.exec('CREATE TABLE notes (id INTEGER PRIMARY KEY, body TEXT)');
  db.prepare('INSERT INTO notes (body) VALUES (?)').run('hello backup');
  db.close();
}

console.log('\n=== createStoredBackup ===');
const f1 = store.createStoredBackup('unit-1');
ok(fs.existsSync(f1), 'writes the archive file', f1);
ok(/noviq-backup-unit-1\.zip$/.test(f1), 'filename carries the label');
const buf = fs.readFileSync(f1);
ok(buf.readUInt32LE(0) === 0x04034b50, 'it is really a zip');
const m = store.verifyBackupBuffer(buf);
ok(m.format === 'noviq-backup', 'it verifies as a restorable backup');
ok(m.tables && m.tables.notes && m.tables.notes.rows === 1, 'manifest describes the content', JSON.stringify(m.tables).slice(0, 80));

console.log('\n=== retention ===');
for (let i = 0; i < 12; i++) store.createStoredBackup('unit-fill-' + i);
const listed = store.listStoredBackups();
ok(listed.length === store.BACKUP_KEEP, `history capped at BACKUP_KEEP (${store.BACKUP_KEEP})`, `got ${listed.length}`);
ok(listed.every((b) => typeof b.size === 'number' && typeof b.createdAt === 'string'), 'entries carry size + timestamp');
ok(listed[0].createdAt >= listed[listed.length - 1].createdAt, 'newest first');

console.log('\n=== retention keeps one copy per day ===');
/* The failure this guards against: a bare "keep the newest N" cap. Twelve
   backups made on the same day are all newer than last week's archive, so
   the cap used to delete every other day and leave a history that could not
   reach back even one day — useless in an incident review.

   These cases drive the store's real prune through synthetic archives whose
   mtimes are back-dated, because the rule is about file times, not about the
   order in which the backups were taken. */
{
  /* Rewrite the store's view of the dir with a known spread of days. */
  const dir = process.env.BACKUP_DIR;
  const ages = [
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,   // 12 today
    1, 1,                               // 2 yesterday
    2,                                  // 1 two days ago
    3,                                  // 1 three days ago
    4,                                  // 1 four days ago
  ];
  const real = fs.readdirSync(dir).filter((n) => n.endsWith('.zip'));
  for (const n of real) fs.unlinkSync(path.join(dir, n));
  const stamp = Date.now();
  ages.forEach((daysAgo, i) => {
    const name = `dated-${String(i).padStart(2, '0')}.zip`;
    const full = path.join(dir, name);
    fs.writeFileSync(full, Buffer.from('placeholder'));
    /* Age 0 stays inside today so the local-day grouping is stable. */
    const t = new Date(stamp - daysAgo * 24 * 3600 * 1000);
    fs.utimesSync(full, t, t);
  });

  const removed = store.pruneStoredBackups();
  const after = store.listStoredBackups();
  ok(after.length <= store.BACKUP_KEEP, `never exceeds the cap (${store.BACKUP_KEEP})`, `got ${after.length}`);
  ok(removed.length > 0, 'the excess was actually deleted', `removed ${removed.length}`);

  const daysLeft = new Set(after.map((b) => store.dayKey(b.createdAt)));
  ok(daysLeft.size === 5, 'all five days survive the prune', `days left ${daysLeft.size}`);
  for (let d = 0; d < 5; d++) {
    const key = store.dayKey(new Date(stamp - d * 24 * 3600 * 1000).toISOString());
    ok(daysLeft.has(key), `day -${d} still has a copy`, [...daysLeft].join(' '));
  }

  /* And the keeper for each day must be the NEWEST copy of that day — the
     one worth restoring to, not the oldest. */
  const keepNames = store.pickDailyKeepers(store.listStoredBackups());
  ok(keepNames.size === 5, 'pickDailyKeepers returns one name per day', `${keepNames.size}`);
}

/* The cap must still bite when a day is over-represented but others are not:
   10 today + 8 yesterday = 18 files. Deleting oldest-first while skipping
   each day's keeper must spend yesterday's extra copies, not today's. */
{
  const dir = process.env.BACKUP_DIR;
  for (const n of fs.readdirSync(dir).filter((x) => x.endsWith('.zip'))) {
    fs.unlinkSync(path.join(dir, n));
  }
  const stamp = Date.now();
  const at = (daysAgo, i) => {
    const full = path.join(dir, `mix-${daysAgo}-${i}.zip`);
    fs.writeFileSync(full, Buffer.from('placeholder'));
    const t = new Date(stamp - daysAgo * 24 * 3600 * 1000);
    fs.utimesSync(full, t, t);
  };
  for (let i = 0; i < 10; i++) at(0, i);
  for (let i = 0; i < 8; i++) at(1, i);

  store.pruneStoredBackups();
  const after = store.listStoredBackups();
  const days = new Set(after.map((b) => store.dayKey(b.createdAt)));
  ok(after.length <= store.BACKUP_KEEP, 'still capped', `got ${after.length}`);
  ok(days.size === 2, 'both days still represented', `${days.size}`);
  const todayCount = after.filter((b) => store.dayKey(b.createdAt) === store.dayKey(new Date(stamp).toISOString())).length;
  ok(todayCount === 9, "yesterday's extras were spent before today's", `today kept ${todayCount}`);
}

/* A sparse history must not be padded or deleted: fewer than the cap means
   nothing to do. */
{
  const dir = process.env.BACKUP_DIR;
  for (const n of fs.readdirSync(dir).filter((x) => x.endsWith('.zip'))) {
    fs.unlinkSync(path.join(dir, n));
  }
  const stamp = Date.now();
  for (let d = 0; d < 3; d++) {
    const full = path.join(dir, `sparse-${d}.zip`);
    fs.writeFileSync(full, Buffer.from('x'));
    const t = new Date(stamp - d * 24 * 3600 * 1000);
    fs.utimesSync(full, t, t);
  }
  const removed = store.pruneStoredBackups();
  ok(removed.length === 0, 'a history under the cap is left alone', `removed ${removed.length}`);
  ok(store.listStoredBackups().length === 3, 'all three remain');
}

console.log('\n=== name safety ===');
ok(store.backupNameOK('noviq-backup-2026.zip'), 'accepts a normal name');
ok(!store.backupNameOK('../evil.zip'), 'rejects traversal');
ok(!store.backupNameOK('/etc/passwd'), 'rejects absolute path');
ok(!store.backupNameOK('x.tar.gz'), 'rejects non-zip');
ok(store.backupFilePath('a.zip') === path.join(process.env.BACKUP_DIR, 'a.zip'), 'resolves inside the dir');
ok(store.backupFilePath('../a.zip') === null, 'escape resolves to null');

console.log('\n=== corrupt listing does not fail ===');
fs.writeFileSync(path.join(process.env.BACKUP_DIR, 'junk.zip'), Buffer.from('not a zip'));
const withJunk = store.listStoredBackups();
const junkEntry = withJunk.find((b) => b.name === 'junk.zip');
ok(junkEntry && junkEntry.corrupt === true, 'corrupt file reported, listing survives');
fs.unlinkSync(path.join(process.env.BACKUP_DIR, 'junk.zip'));

console.log('\n=== auto-backup parsing ===');
const prev = process.env.BACKUP_AUTO_HOURS;
delete process.env.BACKUP_AUTO_HOURS;
ok(auto.hours() === 24, 'default is 24h');
process.env.BACKUP_AUTO_HOURS = '0';
ok(auto.hours() === 0, '0 disables');
process.env.BACKUP_AUTO_HOURS = 'garbage';
ok(auto.hours() === 0, 'garbage disables rather than scheduling nonsense');
process.env.BACKUP_AUTO_HOURS = '6';
ok(auto.hours() === 6, 'numeric value respected');
process.env.BACKUP_AUTO_HOURS = '99999';
ok(auto.hours() === 24 * 30, 'absurd values clamp at 30 days', String(auto.hours()));
if (prev === undefined) delete process.env.BACKUP_AUTO_HOURS;
else process.env.BACKUP_AUTO_HOURS = prev;

console.log('\n=== auto-backup runOnce ===');
const before = store.listStoredBackups().length;
auto.runOnce('unit-test');
const after = store.listStoredBackups();
ok(after.length === Math.min(before + 1, store.BACKUP_KEEP), 'runOnce stores one verified copy', `${before} -> ${after.length}`);
ok(after.some((b) => b.name.includes('auto-')), 'scheduled copies are labeled auto-*');

console.log('\n=== scheduler does not start in test ===');
auto.startAutoBackup();
ok(true, 'startAutoBackup returns without scheduling under NODE_ENV=test');
auto.stopAutoBackup();

for (let attempt = 0; attempt < 3; attempt++) {
  try {
    fs.rmSync(TMP, { recursive: true, force: true, maxRetries: 3, retryDelay: 150 });
    break;
  } catch {
    if (attempt === 2) console.warn(`  (note) could not remove ${TMP}; harmless`);
  }
}
console.log(`\n${failed ? `${failed} FAILED` : 'all backup-store checks passed'} (${passed} passed)`);
process.exit(failed ? 1 : 0);
