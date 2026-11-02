/* ============================================================
   NOVIQ — portal demo-seed tests
   ------------------------------------------------------------
   scripts/seed-portal-demo.js is what puts something on the client
   dashboard and in the admin "Client Projects" page on a fresh install.
   It must (a) build the whole fixture from nothing, (b) change nothing
   on a re-run, and (c) refuse to seed into a nonexistent folder rather
   than creating a database in the wrong place.

   Standalone: spawns the script as a child with DB_PATH pointed at a
   temp dir, binds no port.
   ============================================================ */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

let passed = 0;
let failed = 0;
function ok(cond, label, detail) {
  if (cond) { passed++; console.log(`  ok   ${label}`); }
  else { failed++; console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ''}`); }
}

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'noviq-demo-seed-'));
const DB = path.join(TMP, 'noviq.db');
const SCRIPT = path.join(__dirname, '..', 'scripts', 'seed-portal-demo.js');

function run(extraEnv) {
  /* db/init.js prints boot lines ([DB] ...) to stdout on a fresh database,
     so the JSON document is the LAST {...} line, not the whole output. */
  const out = execFileSync(process.execPath, [SCRIPT, '--json'], {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, DB_PATH: DB, ...extraEnv },
    encoding: 'utf8',
  });
  const line = out.split('\n').map((l) => l.trim()).filter((l) => l.startsWith('{')).pop();
  return JSON.parse(line);
}

try {
  console.log('\n=== first run builds the fixture ===');
  const first = run();
  ok(first.user?.email === 'demo@noviq.local', 'demo user created');
  ok(first.project?.name === 'Noviq Corporate Website', 'demo project created');
  ok(first.milestones === 5, '5 delivery steps seeded', `got ${first.milestones}`);
  ok(first.progress === 55, 'headline progress is the plain average (55%)', `got ${first.progress}`);
  ok(first.contract?.reference === 'NOVIQ-2026-001', 'demo contract attached');
  ok(first.notifications === 3, '3 unread notifications queued', `got ${first.notifications}`);
  ok(Object.keys(first.created).length === 7, 'first run reports everything created', JSON.stringify(first.created));
  ok(first.login?.email === 'demo@noviq.local' && typeof first.login?.password === 'string', 'login credentials reported');
  ok(first.thread === 2, 'starter thread seeded (client Q + team A)', `got ${first.thread}`);
  ok(first.threadUnreadForAdmin === 1, 'client question waits unread for the team');
  ok(first.request?.status === 'new', 'demo activation request starts as new', JSON.stringify(first.request));

  console.log('\n=== second run changes nothing ===');
  const second = run();
  ok(Object.keys(second.created).length === 0, 're-run creates nothing', JSON.stringify(second.created));
  ok(second.milestones === 5 && second.notifications === 3, 'counts identical after re-run');

  console.log('\n=== real database file ===');
  const Database = require('better-sqlite3');
  const db = new Database(DB, { readonly: true });
  try {
    const u = db.prepare('SELECT email FROM users WHERE email = ?').get('demo@noviq.local');
    ok(!!u, 'demo user row exists in SQLite');
    const ms = db.prepare('SELECT title, progress, status FROM milestones ORDER BY position').all();
    ok(ms.length === 5 && ms[0].status === 'done' && ms[4].status === 'pending', 'steps ordered with mixed states');
    const c = db.prepare('SELECT value_cents, currency, status FROM contracts WHERE reference = ?').get('NOVIQ-2026-001');
    ok(c && c.value_cents === 480000 && c.currency === 'USD' && c.status === 'active', 'contract value exact in cents');
    const unread = db.prepare(
      `SELECT count(*) AS n FROM notifications nt WHERE nt.user_id = ? AND NOT EXISTS
       (SELECT 1 FROM notification_reads nr WHERE nr.notification_id = nt.id AND nr.user_id = ?)`
    ).get(second.user.id, second.user.id).n;
    ok(unread === 3, 'all 3 notifications start unread (dashboard badge demo)', `got ${unread}`);
  } finally {
    db.close();
  }

  console.log('\n=== refuses a nonexistent folder ===');
  let refused = false;
  try {
    execFileSync(process.execPath, [SCRIPT], {
      cwd: path.join(__dirname, '..'),
      env: { ...process.env, DB_PATH: path.join(TMP, 'no-such-dir', 'x.db') },
      encoding: 'utf8', stdio: ['ignore', 'ignore', 'pipe'],
    });
  } catch { refused = true; }
  ok(refused, 'exits nonzero instead of seeding the wrong place');
} catch (err) {
  failed++;
  console.error('\n  FAIL threw:', err.stack);
}

for (let i = 0; i < 3; i++) {
  try { fs.rmSync(TMP, { recursive: true, force: true, maxRetries: 3, retryDelay: 150 }); break; }
  catch { if (i === 2) console.warn(`  (note) left ${TMP}`); }
}
console.log(`\n${failed ? `${failed} FAILED` : 'all demo-seed checks passed'} (${passed} passed)`);
process.exit(failed ? 1 : 0);
