/* ============================================================
   NOVIQ — Railway boot rehearsal
   ------------------------------------------------------------
   Simulates what the API container does on its FIRST deploy:
   production env, real secrets, and an EMPTY storage directory,
   so `db/init` has to create and seed a brand-new SQLite file
   exactly as it will on a fresh Railway volume.

     node scripts/verify-railway-boot.js

   Exits non-zero on the first failure, so it is usable as a gate.
   ============================================================ */
const fs = require('fs');
const os = require('os');
const path = require('path');

const storage = fs.mkdtempSync(path.join(os.tmpdir(), 'noviq-sim-'));
process.env.NODE_ENV = 'production';
process.env.PORT = process.env.PORT || '4322';
process.env.STORAGE_DIR = storage;
process.env.DB_PATH = path.join(storage, 'noviq.db');
process.env.UPLOADS_DIR = path.join(storage, 'uploads');
process.env.JWT_SECRET =
  process.env.JWT_SECRET || 'f58001d6948f910483cf0292bcf078a5a2b0d5b4a37209f28fb035f4e83a3bc3';
process.env.ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'NvwrKJDCFxLePD!7';
process.env.FRONTEND_URL = process.env.FRONTEND_URL || 'https://noviq-web.up.railway.app';
process.env.FRONTEND_REVALIDATE_URL = process.env.FRONTEND_REVALIDATE_URL || 'https://noviq-web.up.railway.app';
process.env.REVALIDATE_SECRET =
  process.env.REVALIDATE_SECRET || '64aca333dd1744ccd169c22a00a2b795aed0a433c6766ab5';

let step = 0;
function ok(msg) { step++; console.log(`  ok ${step}  ${msg}`); }

console.log(`storage: ${storage}\n`);

/* 1. The module graph must load. This is the check that catches the
      .agent-system ignore bug: app.js requires the agent bus at the
      top level, so a stripped build dies right here. */
let app;
try {
  app = require('../app');
  ok('app.js loaded (incl. .agent-system/message-bus)');
} catch (err) {
  console.error('  FAIL app.js threw:', err.message);
  process.exit(1);
}

/* 2. A fresh database must have been created and seeded. */
if (!fs.existsSync(process.env.DB_PATH)) {
  console.error('  FAIL no database at', process.env.DB_PATH);
  process.exit(1);
}
ok(`database created (${(fs.statSync(process.env.DB_PATH).size / 1024).toFixed(0)} KB)`);

const Database = require('better-sqlite3');
const db = new Database(process.env.DB_PATH, { readonly: true });
const tables = db
  .prepare("SELECT count(*) AS n FROM sqlite_master WHERE type = 'table'")
  .get().n;
if (tables < 5) {
  console.error(`  FAIL only ${tables} tables — seed did not run`);
  process.exit(1);
}
ok(`seeded ${tables} tables`);

/* 3. The admin account must exist, or /admin is a dead door.
      It lives in `admin_users` (separate from the public `users` table). */
try {
  const admins = db
    .prepare("SELECT count(*) AS n FROM admin_users WHERE username = 'admin'")
    .get().n;
  if (admins < 1) throw new Error('no admin row in admin_users');
  ok(`admin user present in admin_users (${admins})`);
} catch (err) {
  console.error('  FAIL admin user:', err.message);
  process.exit(1);
}
db.close();

/* 4. Listen for real and hit /api/health + /admin through HTTP, so the
      CORS allowlist, helmet and the health path are all exercised.
      Port 0 = "pick a free one". Hard-coding 4322 is a trap: the
      developer's own backend already holds that port, so a rehearsal that
      silently answers from the wrong process "passes" while testing
      nothing at all. */
const server = app.listen(0, async () => {
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const health = await fetch(`${base}/api/health`);
    if (!health.ok) throw new Error(`status ${health.status}`);
    const body = await health.json();
    ok(`/api/health -> ${health.status} ${JSON.stringify(body).slice(0, 60)}`);

    const admin = await fetch(`${base}/admin`, { redirect: 'manual' });
    if (admin.status >= 400) throw new Error(`status ${admin.status}`);
    ok(`/admin -> ${admin.status}`);

    const cors = await fetch(`${base}/api/content/pages`, {
      headers: { Origin: 'https://noviq-web.up.railway.app' },
    });
    const allow = cors.headers.get('access-control-allow-origin');
    if (allow !== 'https://noviq-web.up.railway.app') {
      throw new Error(`CORS did not allow the web origin (got ${allow})`);
    }
    ok('CORS allows the configured FRONTEND_URL');

    const bad = await fetch(`${base}/api/content/pages`, {
      headers: { Origin: 'https://evil.example' },
    });
    if (bad.headers.get('access-control-allow-origin')) {
      throw new Error('CORS leaked to an unknown origin');
    }
    ok('CORS rejects an unknown origin');

    /* 5. The database must NOT be reachable over HTTP. On a single
          Docker volume the DB and the uploads folder share a parent, and
          the /images static mount used to publish that parent verbatim —
          which served the whole SQLite file (plus -wal and -shm) to
          anyone. Regression guard. */
    const leaks = [];
    for (const p of ['/images/noviq.db', '/images/noviq.db-wal', '/images/noviq.db-shm']) {
      const r = await fetch(`${base}${p}`);
      if (r.status === 200) leaks.push(p);
    }
    if (leaks.length) {
      throw new Error(`database is publicly downloadable at ${leaks.join(', ')}`);
    }
    ok('database is NOT served over HTTP');

    /* 6. Uploads must still resolve at the exact path the CMS emits. */
    fs.mkdirSync(process.env.UPLOADS_DIR, { recursive: true });
    fs.writeFileSync(path.join(process.env.UPLOADS_DIR, 'probe.txt'), 'ok');
    const up = await fetch(`${base}/images/uploads/probe.txt`);
    if (!up.ok) throw new Error(`uploads 404 (${up.status}) — /images serving broke`);
    ok('uploads reachable at /images/uploads/<file>');
  } catch (err) {
    console.error('  FAIL http:', err.message);
    server.close();
    process.exit(1);
  }

  server.close();
  fs.rmSync(storage, { recursive: true, force: true });
  console.log('\nRAILWAY BOOT REHEARSAL PASSED');
  process.exit(0);
});
