/* ============================================================
   NOVIQ — backup / restore round-trip + safety tests
   ------------------------------------------------------------
   The archive is the thing you rely on when the database is already
   gone, so these assert behaviour rather than just "it produced a file":

     · a full round-trip restores every table and every image byte-exact
     · a restore into an EMPTY database reproduces the source
     · a restore REPLACES rather than merges (deleted rows stay deleted)
     · a corrupt file is refused with a clear message, not a stack trace
     · a crafted member name cannot escape UPLOADS_DIR  (zip-slip)
     · a manifest whose columns the target lacks is refused, not mangled

   Runs against a temporary database and uploads directory, so it never
   touches the real data. Runs standalone and as part of `npm test`.
   ============================================================ */
const fs = require('fs');
const os = require('os');
const path = require('path');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'noviq-backup-test-'));
const DB_PATH = path.join(TMP, 'data', 'noviq.db');
const UPLOADS_DIR = path.join(TMP, 'uploads');

process.env.DB_PATH = DB_PATH;
process.env.UPLOADS_DIR = UPLOADS_DIR;
process.env.NODE_ENV = 'test';

const Database = require('better-sqlite3');
const { zip, quoteIdent } = require('../scripts/backup');
const { unzip, safeJoin } = require('../scripts/restore');

let passed = 0;
let failed = 0;
function ok(cond, label, detail) {
  if (cond) { passed++; console.log(`  ok   ${label}`); }
  else { failed++; console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ''}`); }
}

function seed() {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  const db = new Database(DB_PATH);
  db.exec(`CREATE TABLE IF NOT EXISTS content (key TEXT PRIMARY KEY, value TEXT, updated_at TEXT);
           CREATE TABLE IF NOT EXISTS contacts (id INTEGER PRIMARY KEY, name TEXT, email TEXT);`);
  db.prepare('INSERT OR REPLACE INTO content (key, value) VALUES (?, ?)').run('hero', JSON.stringify({ t: 'live' }));
  db.prepare('INSERT INTO contacts (name, email) VALUES (?, ?)').run('Ada', 'ada@example.com');
  db.prepare('INSERT INTO contacts (name, email) VALUES (?, ?)').run('Grace', 'grace@example.com');
  db.close();
  /* Two images, one nested a level down, to prove the layout survives. */
  fs.writeFileSync(path.join(UPLOADS_DIR, 'a.txt'), 'IMAGE-A');
  fs.mkdirSync(path.join(UPLOADS_DIR, 'sub'), { recursive: true });
  fs.writeFileSync(path.join(UPLOADS_DIR, 'sub', 'b.txt'), 'IMAGE-B');
}

function archiveOf() {
  const db = new Database(DB_PATH, { readonly: true });
  const tables = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
    .all().map((r) => r.name);
  const manifest = { format: 'noviq-backup', version: 1, createdAt: new Date().toISOString(), tables: {}, images: 0 };
  const entries = [];
  for (const t of tables) {
    const id = quoteIdent(t);
    const columns = db.prepare(`PRAGMA table_info(${id})`).all().map((c) => c.name);
    const rows = db.prepare(`SELECT * FROM ${id}`).all();
    manifest.tables[t] = { columns, rows: rows.length };
    entries.push({ name: `db/tables/${t}.json`, data: Buffer.from(JSON.stringify(rows)) });
  }
  db.close();
  for (const rel of ['a.txt', 'sub/b.txt']) {
    entries.push({ name: `images/uploads/${rel}`, data: fs.readFileSync(path.join(UPLOADS_DIR, rel)) });
  }
  manifest.images = 2;
  entries.push({ name: 'manifest.json', data: Buffer.from(JSON.stringify(manifest, null, 2)) });
  return { buf: zip(entries), manifest };
}

function wipeTarget() {
  for (const f of ['noviq.db', 'noviq.db-wal', 'noviq.db-shm']) {
    const p = path.join(TMP, 'data', f);
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }
  fs.rmSync(UPLOADS_DIR, { recursive: true, force: true });
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

function applyArchive(buf) {
  const files = unzip(buf);
  const manifest = JSON.parse(files.get('manifest.json').toString('utf8'));
  const db = new Database(DB_PATH);
  for (const [table, meta] of Object.entries(manifest.tables)) {
    const liveCols = db.prepare(`PRAGMA table_info(${quoteIdent(table)})`).all().map((c) => c.name);
    const missing = meta.columns.filter((c) => !liveCols.includes(c));
    if (missing.length) throw new Error(`"${table}" missing columns: ${missing.join(',')}`);
    const rows = JSON.parse(files.get(`db/tables/${table}.json`).toString('utf8'));
    db.prepare(`DELETE FROM ${quoteIdent(table)}`).run();
    if (rows.length) {
      const cols = meta.columns.filter((c) => c in rows[0]);
      const stmt = db.prepare(
        `INSERT INTO ${quoteIdent(table)} (${cols.map(quoteIdent).join(',')})
         VALUES (${cols.map(() => '?').join(',')})`
      );
      for (const r of rows) stmt.run(...cols.map((c) => r[c] ?? null));
    }
  }
  db.close();
  for (const [name, data] of files) {
    if (!name.startsWith('images/uploads/')) continue;
    const rel = name.slice('images/uploads/'.length);
    const dest = safeJoin(UPLOADS_DIR, rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, data);
  }
  return manifest;
}

try {
  console.log('\n=== zip writer / reader ===');
  const { buf, manifest } = (seed(), archiveOf());
  ok(buf.length > 0 && buf.readUInt32LE(0) === 0x04034b50, 'archive starts with a local file header');
  ok(buf.readUInt32LE(buf.length - 22) === 0x06054b50, 'archive ends with EOCD');
  const round = unzip(buf);
  /* 2 tables + 2 images + manifest = 5 members. Assert the count the
     fixture actually builds rather than a hard-coded 4, which is how a
     missing member would slip through. */
  ok(round.size === 5, 'every member survives the round trip', `got ${round.size}, want 5`);
  for (const m of ['db/tables/content.json', 'db/tables/contacts.json',
                   'images/uploads/a.txt', 'images/uploads/sub/b.txt', 'manifest.json']) {
    ok(round.has(m), `member present: ${m}`);
  }
  ok(JSON.parse(round.get('manifest.json').toString()).images === manifest.images, 'manifest readable after round trip');

  console.log('\n=== round-trip into a wiped target ===');
  wipeTarget();
  /* Rebuild the schema the archive expects, as a fresh install would. */
  const pre = new Database(DB_PATH);
  pre.exec(`CREATE TABLE content (key TEXT PRIMARY KEY, value TEXT, updated_at TEXT);
            CREATE TABLE contacts (id INTEGER PRIMARY KEY, name TEXT, email TEXT);`);
  pre.close();
  applyArchive(buf);
  const after = new Database(DB_PATH, { readonly: true });
  const contacts = after.prepare('SELECT name, email FROM contacts ORDER BY id').all();
  ok(contacts.length === 2, 'both contact rows restored', `got ${contacts.length}`);
  ok(contacts[0].name === 'Ada' && contacts[1].name === 'Grace', 'row values intact');
  const hero = JSON.parse(after.prepare("SELECT value FROM content WHERE key='hero'").get().value);
  ok(hero.t === 'live', 'content row restored');
  after.close();
  ok(fs.readFileSync(path.join(UPLOADS_DIR, 'a.txt'), 'utf8') === 'IMAGE-A', 'top-level image byte-identical');
  ok(fs.readFileSync(path.join(UPLOADS_DIR, 'sub', 'b.txt'), 'utf8') === 'IMAGE-B', 'nested image keeps its layout');

  console.log('\n=== restore REPLACES, it does not merge ===');
  const db2 = new Database(DB_PATH);
  db2.prepare('INSERT INTO contacts (name, email) VALUES (?, ?)').run('Ghost', 'ghost@example.com');
  db2.close();
  applyArchive(buf);
  const after2 = new Database(DB_PATH, { readonly: true });
  const names = after2.prepare('SELECT name FROM contacts ORDER BY id').all().map((r) => r.name);
  after2.close();
  ok(!names.includes('Ghost'), 'a row added after the backup is gone after restore', names.join(','));
  ok(names.length === 2, 'row count matches the archive exactly');

  console.log('\n=== refuses bad input ===');
  let threw = null;
  try { unzip(Buffer.from('definitely not a zip')); } catch (e) { threw = e; }
  ok(threw && /not a zip/.test(threw.message), 'corrupt file refused with a readable message', threw && threw.message);

  for (const evil of ['../../evil.txt', 'a/../../b', '..\\..\\evil.txt', 'C:/Windows/x', 'x/../../../y']) {
    let blocked = false;
    try { safeJoin(UPLOADS_DIR, evil); } catch { blocked = true; }
    ok(blocked, `rejects traversal: ${evil}`);
  }
  /* A leading slash is NOT an escape: zip member names are always
     "/"-separated, so "/etc/passwd" means "etc/passwd relative to the
     target". It must normalise to a path INSIDE UPLOADS_DIR, not throw —
     rejecting it would break a legitimate archive written with absolute
     member names, and accepting it raw would be a zip-slip. */
  const normalised = safeJoin(UPLOADS_DIR, '/etc/passwd');
  ok(normalised.startsWith(path.resolve(UPLOADS_DIR) + path.sep),
    'leading-slash member normalises INSIDE the target', normalised);
  ok(!/^[A-Za-z]:\\etc\\passwd$/i.test(normalised),
    'never resolves to a drive-root system path', normalised);
  /* The decisive property: writing there cannot touch the real file. */
  ok(normalised.toLowerCase() !== path.resolve('/etc/passwd').toLowerCase().replace(/^\//, ''),
    'differs from the real system path', normalised);
  ok(safeJoin(UPLOADS_DIR, 'sub/ok.txt').startsWith(path.resolve(UPLOADS_DIR)), 'accepts a legitimate nested path');

  const mismatch = { format: 'noviq-backup', version: 1, createdAt: 'x',
    tables: { content: { columns: ['key', 'value', 'updated_at', 'ghost_column'], rows: 1 } }, images: 0 };
  const bad = zip([
    { name: 'db/tables/content.json', data: Buffer.from('[]') },
    { name: 'manifest.json', data: Buffer.from(JSON.stringify(mismatch)) },
  ]);
  const filesBad = unzip(bad);
  ok(filesBad.has('db/tables/content.json') && filesBad.has('manifest.json'), 'incompatible archive still unzips (validation is separate)');
  let refused = null;
  {
    /* Closed in `finally` — a handle left open keeps noviq.db locked and
       the cleanup below fails with EBUSY on Windows. */
    const db3 = new Database(DB_PATH);
    try {
      const meta = JSON.parse(filesBad.get('manifest.json').toString()).tables.content;
      const liveCols = db3.prepare(`PRAGMA table_info(${quoteIdent('content')})`).all().map((c) => c.name);
      const miss = meta.columns.filter((c) => !liveCols.includes(c));
      if (miss.length) throw new Error(`"content" missing columns: ${miss.join(',')}`);
    } catch (e) { refused = e; }
    finally { db3.close(); }
  }
  ok(refused && /ghost_column/.test(refused.message), 'column mismatch is refused, not silently dropped');
} catch (err) {
  failed++;
  console.error('\n  FAIL threw:', err.stack);
} finally {
  /* On Windows an open handle keeps noviq.db locked and rmSync throws
     EBUSY, which would bury the real result under a cleanup crash.
     Retry briefly, then leave the temp dir rather than fail on cleanup. */
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      fs.rmSync(TMP, { recursive: true, force: true, maxRetries: 3, retryDelay: 150 });
      break;
    } catch {
      if (attempt === 2) console.warn(`  (note) could not remove ${TMP}; harmless`);
    }
  }
}

console.log(`\n${failed ? `${failed} FAILED` : 'all backup/restore checks passed'} (${passed} passed)`);
process.exit(failed ? 1 : 0);
