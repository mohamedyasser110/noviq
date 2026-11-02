/* ============================================================
   NOVIQ — restore from a backup archive
   ------------------------------------------------------------
   Reads an archive written by scripts/backup.js and applies it. Two
   modes, because the risk profile differs completely:

     --dry-run (default)  validate the archive and print the plan.
                         Touches nothing. This is what the admin panel
                         calls before it offers to restore.

     --apply              actually write. Requires --yes, takes a
                         pre-restore safety backup first, and runs inside
                         a single transaction.

   Ordering that matters:
     · sqlite_master / ANALYZE pragmas are not exported, so the target
       schema must already match the manifest's columns; a table that is
       missing is created, a table with a DIFFERENT column set is
       refused rather than silently mangled.
     · sqlite_sequence is internal bookkeeping and is reset, not
       restored, so future inserts cannot collide with restored ids.
     · Deletes run before inserts. A restore is a replacement, not a
       merge — leaving rows that the archive does not contain would make
       the result depend on what happened to be in the target.

   Images are written back at the exact relative path they were captured
   from, so a record pointing at `images/uploads/<name>` resolves again
   with no rewriting and no database edit.

       node scripts/restore.js <archive.zip> [--apply --yes] [--skip-images]
   ============================================================ */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const Database = require('better-sqlite3');

const config = require('../config');
const { quoteIdent } = require('./backup');

/* ---------- minimal zip reader ---------- */
function unzip(buf) {
  /* Find the end-of-central-directory record, scanning back over a
     possible comment. */
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0 && i >= buf.length - 22 - 0xffff; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('not a zip archive (no end-of-central-directory)');

  const count = buf.readUInt16LE(eocd + 10);
  let ptr = buf.readUInt32LE(eocd + 16);
  const out = new Map();

  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(ptr) !== 0x02014b50) throw new Error('corrupt central directory');
    const method = buf.readUInt16LE(ptr + 10);
    const compSize = buf.readUInt32LE(ptr + 20);
    const nameLen = buf.readUInt16LE(ptr + 28);
    const extraLen = buf.readUInt16LE(ptr + 30);
    const commentLen = buf.readUInt16LE(ptr + 32);
    const localOff = buf.readUInt32LE(ptr + 42);
    const name = buf.toString('utf8', ptr + 46, ptr + 46 + nameLen);

    const lNameLen = buf.readUInt16LE(localOff + 26);
    const lExtraLen = buf.readUInt16LE(localOff + 28);
    const dataStart = localOff + 30 + lNameLen + lExtraLen;
    const body = buf.subarray(dataStart, dataStart + compSize);

    out.set(name, method === 8 ? zlib.inflateRawSync(body) : Buffer.from(body));
    ptr += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}

/* ---------- path safety ---------- */
/* An archive is untrusted input: a crafted member name like
   `../../.ssh/authorized_keys` must not escape UPLOADS_DIR. */
function safeJoin(base, rel) {
  const raw = String(rel).replace(/\\/g, '/');
  /* Strip a LEADING slash rather than rejecting it: a zip member name is
     always "/"-separated, and "/etc/passwd" inside an archive means
     "etc/passwd relative to the target" — the same intent as a member
     written without the slash. It is normalised and then containment is
     enforced below, so this cannot escape. */
  const cleaned = raw.replace(/^\/+/, '');
  if (cleaned.includes('..') || /^[A-Za-z]:/.test(cleaned)) {
    throw new Error(`unsafe path in archive: ${rel}`);
  }
  const full = path.resolve(base, cleaned);
  const baseFull = path.resolve(base);
  if (full !== baseFull && !full.startsWith(baseFull + path.sep)) {
    throw new Error(`path escapes the target directory: ${rel}`);
  }
  return full;
}

/* ---------- main ---------- */
/**
 * Read the flags. `argv` may or may not include the node/script pair, so
 * the scan starts at index 0 and skips any leading non-flag token — a
 * programmatic caller passing `['/tmp/a.zip']` gets the same result as the
 * CLI, and passing `[]` simply leaves `file` unset.
 */
function parseArgs(argv = []) {
  const out = { file: null, apply: false, yes: false, skipImages: false, quiet: false };
  const tokens = Array.isArray(argv) ? argv : [];
  let seenFlag = false;
  for (const a of tokens) {
    if (typeof a !== 'string') continue;
    if (a === '--apply') { out.apply = true; seenFlag = true; }
    else if (a === '--yes' || a === '-y') { out.yes = true; seenFlag = true; }
    else if (a === '--skip-images') { out.skipImages = true; seenFlag = true; }
    else if (a === '--quiet' || a === '-q') { out.quiet = true; seenFlag = true; }
    else if (a.startsWith('-')) continue;                       /* unknown flag */
    else if (!seenFlag && !out.file) out.file = a;             /* first positional */
  }
  return out;
}

/**
 * Validate (and optionally apply) an archive.
 *
 * `opts.onPlan` / `opts.throwOnError` exist for the admin route: a web
 * request needs the plan as a return value and a thrown error, not a
 * process.exit, because exiting would kill the server mid-request.
 */
function main(argv = process.argv, opts = {}) {
  const args = { ...parseArgs(argv), ...opts };
  const log = args.quiet ? () => {} : (m) => console.log(m);
  /* In-process callers get exceptions; the CLI keeps its terse exits. */
  const fail = (m) => {
    if (opts.throwOnError) throw new Error(m);
    console.error(`[restore] ${m}`);
    process.exit(1);
  };

  if (!args.file) fail('usage: node scripts/restore.js <archive.zip> [--apply --yes] [--skip-images]');
  if (!fs.existsSync(args.file)) fail(`no such file: ${args.file}`);

  const files = unzip(fs.readFileSync(args.file));
  const manifestRaw = files.get('manifest.json');
  if (!manifestRaw) fail('archive has no manifest.json — not a Noviq backup');
  const manifest = JSON.parse(manifestRaw.toString('utf8'));
  if (manifest.format !== 'noviq-backup') fail(`unexpected format: ${manifest.format}`);

  log(`archive    ${path.basename(args.file)}`);
  log(`created    ${manifest.createdAt}`);
  log(`tables     ${Object.keys(manifest.tables || {}).length}`);
  log(`images     ${manifest.images}`);

  /* Every declared table must actually be present in the archive. A
     manifest that lies about its contents is refused. */
  const problems = [];
  for (const [table, meta] of Object.entries(manifest.tables || {})) {
    if (!files.has(`db/tables/${table}.json`)) {
      problems.push(`manifest declares "${table}" but db/tables/${table}.json is missing`);
    }
  }
  if (problems.length) fail(problems.join('\n            '));

  /* ---------- validate against the live schema ---------- */
  const db = new Database(config.DB_PATH);
  db.pragma('foreign_keys = ON');

  const plan = [];
  for (const [table, meta] of Object.entries(manifest.tables || {})) {
    const rows = JSON.parse(files.get(`db/tables/${table}.json`).toString('utf8'));

    const exists = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
      .get(table);

    if (!exists) {
      /* No CREATE TABLE is carried, so a table the target does not have
         cannot be built from the archive alone. */
      plan.push({ table, action: 'SKIP (table not in target schema)', rows: rows.length });
      continue;
    }

    const liveCols = db.prepare(`PRAGMA table_info(${quoteIdent(table)})`).all().map((c) => c.name);
    const missing = meta.columns.filter((c) => !liveCols.includes(c));
    if (missing.length) {
      problems.push(`"${table}" has columns the target lacks: ${missing.join(', ')}`);
      continue;
    }
    plan.push({ table, action: 'replace', rows: rows.length });
  }

  if (problems.length) {
    const detail = 'the archive does not fit this database: ' + problems.join('; ');
    db.close();
    /* Refused BEFORE any write, so a mismatch costs nothing. */
    if (opts.throwOnError) throw new Error(detail);
    console.error(`\n[restore] REFUSING — ${detail}`);
    process.exit(1);
  }

  log('');
  for (const p of plan) log(`  ${p.table.padEnd(20)} ${String(p.rows).padStart(6)} rows  ${p.action}`);

  const replaceable = plan.filter((p) => p.action === 'replace');
  const images = [...files.keys()].filter((n) => n.startsWith('images/uploads/'));
  log(`\nimages to write: ${args.skipImages ? 0 : images.length}${args.skipImages ? '  (--skip-images)' : ''}`);

  if (!args.apply) {
    db.close();
    log('\n[restore] DRY RUN — nothing was written. Re-run with --apply --yes to apply.');
    return { plan, images: images.length, applied: false };
  }
  if (!args.yes) {
    db.close();
    fail('--apply given without --yes. Re-run with --yes once you have read the plan above.');
  }

  /* ---------- safety net: never restore over the only copy ---------- */
  /* Checkpoint FIRST, then copy: a -wal left beside the copy makes the
     safety file disagree with the live database, and a copy taken before
     the checkpoint silently omits every recent WAL-only write.
     `db` is the validation connection opened above, and it is this
     process's own handle — so checkpointing through it is safe. Doing it
     through a SECOND connection would fail with EBUSY on Windows. */
  const safety = path.join(path.dirname(config.DB_PATH), `pre-restore-${Date.now()}.db`);
  try {
    db.pragma('wal_checkpoint(TRUNCATE)');
    db.close();
    fs.copyFileSync(config.DB_PATH, safety);
  } catch (err) {
    /* No safety copy means no restore. Aborting here is the whole point:
       proceeding would leave no way back from a bad archive. */
    if (opts.throwOnError) throw new Error(`safety backup failed, aborting: ${err.message}`);
    console.error(`[restore] safety backup failed, aborting: ${err.message}`);
    process.exit(1);
  }

  /* The -wal / -shm siblings are deliberately NOT deleted.
   *
   * Deleting them would be tidy on a quiet database, but this module also
   * runs INSIDE the API process, where db/init.js still holds the live
   * connection — and unlinking a file another handle has open fails with
   * EBUSY on Windows, and would fail on a volume-backed container the same
   * way. A stale -wal is not a problem: SQLite replays it on the next open,
   * and the restore that follows opens the database fresh and checkpoints
   * it as part of applying. Removing them here bought nothing and cost
   * the whole restore. */
  log(`\n[safety] pre-restore copy: ${safety}`);

  /* ---------- apply ---------- */
  const live = new Database(config.DB_PATH);
  live.pragma('foreign_keys = OFF');

  const applyOne = live.transaction((table, rows, columns) => {
    live.prepare(`DELETE FROM ${quoteIdent(table)}`).run();
    if (!rows.length) return;
    const cols = columns.filter((c) => c in rows[0]);
    const sql = `INSERT INTO ${quoteIdent(table)} (${cols.map(quoteIdent).join(',')})
                 VALUES (${cols.map(() => '?').join(',')})`;
    const stmt = live.prepare(sql);
    for (const row of rows) stmt.run(...cols.map((c) => row[c] ?? null));
  });

  live.exec('BEGIN');
  try {
    for (const p of replaceable) {
      const rows = JSON.parse(files.get(`db/tables/${p.table}.json`).toString('utf8'));
      applyOne(p.table, rows, manifest.tables[p.table].columns);
      log(`  restored ${p.table} (${rows.length})`);
    }
    live.exec('COMMIT');
  } catch (err) {
    live.exec('ROLLBACK');
    live.close();
    if (opts.throwOnError) throw new Error(`rolled back: ${err.message} (database unchanged; safety copy at ${safety})`);
    console.error(`\n[restore] FAILED and rolled back: ${err.message}`);
    console.error(`[restore] the database is unchanged. Safety copy: ${safety}`);
    process.exit(1);
  }
  live.close();

  /* ---------- images ---------- */
  let written = 0;
  if (!args.skipImages) {
    for (const name of images) {
      const rel = name.slice('images/uploads/'.length);
      const dest = safeJoin(config.UPLOADS_DIR, rel);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, files.get(name));
      written++;
    }
    log(`  restored ${written} image(s) into ${config.UPLOADS_DIR}`);
  }

  log('\n[restore] DONE. The running process still holds the old snapshot — restart it.');
  return { plan, images: written, applied: true };
}

if (require.main === module) main();
module.exports = { unzip, safeJoin, main };
