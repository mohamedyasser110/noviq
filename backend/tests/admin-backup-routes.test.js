/* ============================================================
   NOVIQ — admin backup/restore route tests
   ------------------------------------------------------------
   The restore path can destroy a live site, so these test the ROUTES, not
   just the helpers: auth, the confirmation gate, archive validation, and
   — most importantly — that a refused restore leaves the data untouched.

   Binds its own port against a temporary database, so it never sees the
   real one.
   ============================================================ */
const fs = require('fs');
const os = require('os');
const path = require('path');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'noviq-bk-routes-'));
process.env.DB_PATH = path.join(TMP, 'noviq.db');
process.env.UPLOADS_DIR = path.join(TMP, 'uploads');
/* History dir: routes read BACKUP_DIR lazily per call (never at require
   time), so pointing it at temp here isolates the suite. */
process.env.BACKUP_DIR = path.join(TMP, 'backups');
process.env.JWT_SECRET = 'test-secret-for-backup-routes';
/* Requiring ../app loads config/index.js, which has a fail-fast production
   guard that process.exit(1)s when the secrets are still the defaults. These
   are set BEFORE the require for exactly that reason — the guard reads
   NODE_ENV === 'production', and backend/.env may set it on this machine. */
process.env.NODE_ENV = 'test';
process.env.ADMIN_PASSWORD = 'TestOnly-Password-9!';
process.env.FRONTEND_URL = 'http://localhost:4321';

const { zip } = require('../scripts/backup');
const app = require('../app');
const Database = require('better-sqlite3');

let passed = 0;
let failed = 0;
function ok(cond, label, detail) {
  if (cond) { passed++; console.log(`  ok   ${label}`); }
  else { failed++; console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ''}`); }
}

/* Bound here so the suite reports rather than exiting silently: a node
   process killed by an uncaught throw writes no output, which is how an
   earlier run of this file came back with nothing at all. */
process.on('uncaughtException', (err) => {
  console.error('\n  FAIL uncaught:', err && err.stack ? err.stack : err);
  process.exit(1);
});
process.on('unhandledRejection', (err) => {
  console.error('\n  FAIL unhandled rejection:', err && err.stack ? err.stack : err);
  process.exit(1);
});

const server = app.listen(0, async () => {
  const base = `http://127.0.0.1:${server.address().port}`;
  const db = new Database(process.env.DB_PATH);

  /* Seed a contact so we can prove a refused restore changed nothing. */
  db.prepare('INSERT INTO contacts (name, email, message, created_at) VALUES (?,?,?,?)')
    .run('Keeper', 'keeper@example.com', 'must survive', new Date().toISOString());

  const login = await fetch(`${base}/api/admin/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: process.env.ADMIN_PASSWORD || 'noviq2026' }),
  }).catch(() => null);

  /* In test mode the admin password env may not be set; mint a token
     directly through the same helper the route uses instead. */
  let token = null;
  if (login && login.ok) token = (await login.json()).token;
  if (!token) {
    /* Login can be refused by the admin-login rate limiter (2/min) when
       suites run back to back. Mint a token through the same helper the
       route uses rather than failing on an unrelated limit. */
    const { generateToken, ensureAdminUser } = require('../middleware/auth');
    ensureAdminUser();
    token = generateToken({ id: 1, username: 'admin', role: 'admin' });
  }
  if (!token) { console.error('  FAIL could not obtain an admin token'); process.exit(1); }
  const auth = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  /* A valid archive of the CURRENT database. */
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all();
  const manifest = { format: 'noviq-backup', version: 1, createdAt: new Date().toISOString(), tables: {}, images: 0 };
  const entries = [];
  for (const t of tables) {
    /* Identifier quoted with DOUBLE quotes, as SQL requires. JSON.stringify
       produces `"contacts"` which is not valid SQL — it looks right and is
       the difference between a query and a syntax error. */
    const id = `"${t.name.replace(/"/g, '""')}"`;
    const columns = db.prepare(`PRAGMA table_info(${id})`).all().map((c) => c.name);
    const rows = db.prepare(`SELECT * FROM ${id}`).all();
    manifest.tables[t.name] = { columns, rows: rows.length };
    entries.push({ name: `db/tables/${t.name}.json`, data: Buffer.from(JSON.stringify(rows)) });
  }
  const archive = zip([...entries, { name: 'manifest.json', data: Buffer.from(JSON.stringify(manifest)) }]);
  const dataUrl = `data:application/zip;base64,${archive.toString('base64')}`;
  db.close();

  console.log('\n=== auth ===');
  for (const [method, url] of [['GET', '/backup'], ['POST', '/backup/inspect'], ['POST', '/backup/restore']]) {
    const r = await fetch(`${base}/api/admin${url}`, {
      method, headers: { 'Content-Type': 'application/json' },
      body: method === 'GET' ? undefined : JSON.stringify({ data: dataUrl }),
    });
    ok(r.status === 401, `${method} ${url} without a token -> 401`, `got ${r.status}`);
  }

  console.log('\n=== confirmation gate ===');
  const noConfirm = await fetch(`${base}/api/admin/backup/restore`, {
    method: 'POST', headers: auth, body: JSON.stringify({ data: dataUrl }),
  });
  ok(noConfirm.status === 400, 'restore without confirm -> 400', `got ${noConfirm.status}`);
  const code = (await noConfirm.json())?.error?.code;
  ok(code === 'CONFIRMATION_REQUIRED', 'and says why', code);

  console.log('\n=== validation ===');
  const junk = await fetch(`${base}/api/admin/backup/inspect`, {
    method: 'POST', headers: auth,
    body: JSON.stringify({ data: `data:application/zip;base64,${Buffer.from('not a zip').toString('base64')}` }),
  });
  ok(junk.status === 400, 'a corrupt archive -> 400', `got ${junk.status}`);

  const emptyZip = zip([{ name: 'readme.txt', data: Buffer.from('hello') }]);
  const noManifest = await fetch(`${base}/api/admin/backup/inspect`, {
    method: 'POST', headers: auth,
    body: JSON.stringify({ data: `data:application/zip;base64,${emptyZip.toString('base64')}` }),
  });
  ok(noManifest.status === 400, 'a zip with no manifest -> 400', `got ${noManifest.status}`);
  ok((await noManifest.json())?.error?.code === 'INVALID_ARCHIVE', 'reported as INVALID_ARCHIVE');

  const inspect = await fetch(`${base}/api/admin/backup/inspect`, {
    method: 'POST', headers: auth, body: JSON.stringify({ data: dataUrl }),
  });
  const info = await inspect.json();
  ok(inspect.status === 200, 'a valid archive inspects cleanly', `got ${inspect.status}`);
  ok(info.restorable === true, 'and is reported restorable');
  ok(info.destructive === true, 'and flagged as destructive (it replaces)');

  /* Every probe below opens its own handle and CLOSES it: better-sqlite3
     keeps a lock per open handle, and on Windows an unclosed handle makes
     the final rmSync fail with EBUSY — leaving temp dirs behind and burying
     real results under a cleanup crash. */
  const countContacts = () => {
    const h = new Database(process.env.DB_PATH, { readonly: true });
    try { return h.prepare('SELECT count(*) AS n FROM contacts').get().n; }
    finally { h.close(); }
  };
  const keeperEmail = () => {
    const h = new Database(process.env.DB_PATH, { readonly: true });
    try {
      return h.prepare("SELECT email FROM contacts WHERE name='Keeper'").get()?.email;
    } finally { h.close(); }
  };

  console.log('\n=== a refused restore must change nothing ===');
  const before = countContacts();
  const badManifest = { format: 'noviq-backup', version: 1, createdAt: 'x', images: 0,
    tables: { contacts: { columns: ['id', 'name', 'email', 'message', 'created_at', 'ghost_col'], rows: 1 } } };
  const badZip = zip([
    { name: 'db/tables/contacts.json', data: Buffer.from('[]') },
    { name: 'manifest.json', data: Buffer.from(JSON.stringify(badManifest)) },
  ]);
  const refused = await fetch(`${base}/api/admin/backup/restore`, {
    method: 'POST', headers: auth,
    body: JSON.stringify({ data: `data:application/zip;base64,${badZip.toString('base64')}`, confirm: 'REPLACE' }),
  });
  ok(refused.status >= 400, 'incompatible archive is refused', `got ${refused.status}`);
  const after = countContacts();
  ok(after === before, 'the contacts table is untouched', `${before} -> ${after}`);
  ok(keeperEmail() === 'keeper@example.com', 'the specific row survived');

  console.log('\n=== a real restore round-trips ===');
  const applied = await fetch(`${base}/api/admin/backup/restore`, {
    method: 'POST', headers: auth, body: JSON.stringify({ data: dataUrl, confirm: 'REPLACE' }),
  });
  const out = await applied.json();
  ok(applied.status === 200, 'restore succeeds', `got ${applied.status} ${JSON.stringify(out).slice(0, 120)}`);
  ok(Array.isArray(out.restoredTables) && out.restoredTables.includes('contacts'), 'contacts restored', JSON.stringify(out.restoredTables));
  ok(typeof out.safetyCopy === 'string' && out.safetyCopy.startsWith('noviq.db.pre-restore-'),
    'a safety copy is reported', out.safetyCopy);
  ok(/restart/i.test(out.notice || ''), 'told to restart the API', out.notice);
  ok(keeperEmail() === 'keeper@example.com', 'data is correct after restore');

  console.log('\n=== backup download ===');
  const dl = await fetch(`${base}/api/admin/backup`, { headers: { Authorization: `Bearer ${token}` } });
  ok(dl.ok, 'GET /admin/backup -> 200', `got ${dl.status}`);
  const ct = dl.headers.get('content-type') || '';
  const cd = dl.headers.get('content-disposition') || '';
  ok(ct.includes('zip'), 'served as a zip', ct);
  ok(/attachment/.test(cd) && /noviq-backup-.*\.zip/.test(cd), 'sent as an attachment with a name', cd);
  const dlBuf = Buffer.from(await dl.arrayBuffer());
  ok(dlBuf.readUInt32LE(0) === 0x04034b50, 'body really is a zip archive');
  ok(dlBuf.length > 0, 'not empty', `${dlBuf.length} bytes`);

  console.log('\n=== backup history (the download above must have stored a copy) ===');
  const noAuthList = await fetch(`${base}/api/admin/backups`);
  ok(noAuthList.status === 401, 'history without a token -> 401', `got ${noAuthList.status}`);

  const listRes = await fetch(`${base}/api/admin/backups`, { headers: auth });
  const list = await listRes.json();
  ok(listRes.status === 200, 'history lists -> 200', `got ${listRes.status}`);
  ok(Array.isArray(list.backups) && list.backups.length >= 1, 'the download left a stored copy', `got ${list.backups?.length}`);
  const entry = list.backups[0] || {};
  ok(typeof entry.name === 'string' && entry.name.endsWith('.zip'), 'entry has a zip name', entry.name);
  ok(typeof entry.size === 'number' && entry.size > 0, 'entry has a byte size', String(entry.size));
  ok(typeof entry.createdAt === 'string', 'entry has a timestamp', entry.createdAt);
  ok(typeof entry.tables === 'number', 'entry carries its manifest summary', JSON.stringify(entry).slice(0, 80));

  /* The retention rule is served, not just implemented: the panel states it
     from these fields, so they must survive the API boundary. */
  ok(list.keep === 10, 'the cap is reported', String(list.keep));
  ok(list.keepDays === 5, 'the daily guarantee is reported', String(list.keepDays));
  ok(Array.isArray(list.days) && list.days.length >= 1, 'day coverage is reported', JSON.stringify(list.days));
  ok(list.days.length <= list.keepDays, 'day coverage never exceeds the window', JSON.stringify(list.days));
  ok(list.days.every((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)), 'day keys are calendar dates', JSON.stringify(list.days));

  const storedName = entry.name;
  const byName = await fetch(`${base}/api/admin/backups/${encodeURIComponent(storedName)}`, { headers: auth });
  const byNameBuf = Buffer.from(await byName.arrayBuffer());
  ok(byName.status === 200, 'download by name -> 200', `got ${byName.status}`);
  ok(byNameBuf.readUInt32LE(0) === 0x04034b50, 'download by name is a zip');

  const traversal = await fetch(`${base}/api/admin/backups/${encodeURIComponent('../evil.zip')}`, { headers: auth });
  ok(traversal.status === 400 || traversal.status === 404, 'traversal name is refused', `got ${traversal.status}`);

  const missing = await fetch(`${base}/api/admin/backups/nope.zip`, { headers: auth });
  ok(missing.status === 404, 'unknown name -> 404', `got ${missing.status}`);

  const delMissing = await fetch(`${base}/api/admin/backups/nope.zip`, { method: 'DELETE', headers: auth });
  ok(delMissing.status === 404, 'delete unknown -> 404', `got ${delMissing.status}`);

  const del = await fetch(`${base}/api/admin/backups/${encodeURIComponent(storedName)}`, { method: 'DELETE', headers: auth });
  ok(del.status === 200, 'delete stored copy -> 200', `got ${del.status}`);
  const listAfter = await (await fetch(`${base}/api/admin/backups`, { headers: auth })).json();
  ok(!listAfter.backups.some((b) => b.name === storedName), 'deleted copy is gone from history');

  server.close();
  for (let i = 0; i < 3; i++) {
    try { fs.rmSync(TMP, { recursive: true, force: true, maxRetries: 3, retryDelay: 150 }); break; }
    catch { if (i === 2) console.warn(`  (note) left ${TMP}`); }
  }
  console.log(`\n${failed ? `${failed} FAILED` : 'all admin backup/restore checks passed'} (${passed} passed)`);
  process.exit(failed ? 1 : 0);
});
