/* ============================================================
   NOVIQ — client portal tests
   ------------------------------------------------------------
   The portal's contract with a signed-in user is that they see their own
   data and nothing else. Everything below exists to hold that line, plus
   the arithmetic and lifecycle rules the UI depends on.

   Binds its own port against a temp database.
   ============================================================ */
const fs = require('fs');
const os = require('os');
const path = require('path');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'noviq-portal-'));
process.env.DB_PATH = path.join(TMP, 'noviq.db');
process.env.UPLOADS_DIR = path.join(TMP, 'uploads');
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'portal-test-secret';
process.env.ADMIN_PASSWORD = 'PortalTest-Pass-9!';

let passed = 0;
let failed = 0;
const ok = (c, label, detail) => {
  if (c) { passed++; console.log(`  ok   ${label}`); }
  else { failed++; console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ''}`); }
};

const app = require('../app');
const db = require('../db/init');
const { generateToken, hashPassword, ensureAdminUser } = require('../middleware/auth');

ensureAdminUser();

/* Two clients, so cross-user leakage is actually testable. */
function makeUser(email, first) {
  const r = db
    .prepare('INSERT INTO users (first_name, last_name, email, password) VALUES (?,?,?,?)')
    .run(first, 'Tester', email, hashPassword('Password123!'));
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(r.lastInsertRowid);
  return { row, token: generateToken({ id: row.id, email: row.email, role: row.role, tokenType: 'user' }) };
}

const alice = makeUser('alice.portal@test.local', 'Alice');
const bob = makeUser('bob.portal@test.local', 'Bob');

/* adminAuthMiddleware requires a REAL row in admin_sessions, not just a
   validly-signed JWT — that session table is what makes admin logout work.
   Minting the token alone is not enough, so the row is inserted here
   explicitly. Using the /api/admin/login route instead would consume the
   admin-login rate limit (2/min), which makes the suite order-dependent. */
const adminRow = db.prepare("SELECT id FROM admin_users WHERE username = 'admin'").get();
const adminToken = generateToken({ id: adminRow.id, username: 'admin', role: 'admin', tokenType: 'admin' });
db.prepare('INSERT INTO admin_sessions (admin_id, token, ip) VALUES (?, ?, ?)').run(adminRow.id, adminToken, '127.0.0.1');

const uAuth = (t) => ({ Authorization: `Bearer ${t}` });
const aAuth = { Authorization: `Bearer ${adminToken}` };
const JSONH = { 'Content-Type': 'application/json' };

const server = app.listen(0, async () => {
  const base = `http://127.0.0.1:${server.address().port}`;
  const get = async (p, headers) => {
    const r = await fetch(`${base}${p}`, { headers });
    return { status: r.status, body: await r.json().catch(() => null) };
  };
  const post = async (p, body, headers) => {
    const r = await fetch(`${base}${p}`, {
      method: 'POST', headers: { ...JSONH, ...headers }, body: JSON.stringify(body),
    });
    return { status: r.status, body: await r.json().catch(() => null) };
  };
  const put = async (p, body, headers) => {
    const r = await fetch(`${base}${p}`, {
      method: 'PUT', headers: { ...JSONH, ...headers }, body: JSON.stringify(body),
    });
    return { status: r.status, body: await r.json().catch(() => null) };
  };

  try {
    /* ---------- auth gate ---------- */
    console.log('\n=== auth ===');
    ok((await get('/api/portal/projects')).status === 401, 'no token -> 401');
    ok((await get('/api/portal/projects', uAuth('garbage'))).status === 401, 'bad token -> 401');
    /* An ADMIN token must not pass the CLIENT gate, and the 403 must say so
       — a 401 here would bounce the admin to the wrong login page. */
    const adminAtClient = await get('/api/portal/projects', aAuth);
    ok(adminAtClient.status === 403, 'admin token at the client gate -> 403', `got ${adminAtClient.status}`);
    /* And a client token must not open admin routes. */
    ok((await get('/api/admin/portal/projects', uAuth(alice.token))).status === 403, 'client token at admin routes -> 403');

    console.log('\n=== /portal/me ===');
    const me = await get('/api/portal/me', uAuth(alice.token));
    ok(me.status === 200 && me.body.user.email === 'alice.portal@test.local', 'returns the caller identity');
    ok(typeof me.body.unread === 'number', 'includes an unread count');

    console.log('\n=== projects: admin creates, client reads ----------');
    const created = await post('/api/admin/portal/projects',
      { name: 'Rebuild Platform', summary: 'Phase one', userEmail: 'alice.portal@test.local', status: 'active' },
      aAuth);
    ok(created.status === 201, 'admin creates a project', `got ${created.status} ${JSON.stringify(created.body)}`);
    const projectId = created.body?.project?.id;

    const unknownUser = await post('/api/admin/portal/projects',
      { name: 'Orphan', userEmail: 'nobody@test.local' }, aAuth);
    ok(unknownUser.status === 404, 'creating for an unknown email -> 404');

    const noName = await post('/api/admin/portal/projects', { userEmail: 'alice.portal@test.local' }, aAuth);
    ok(noName.status === 400, 'missing name -> 400');

    console.log('\n=== milestones drive project progress ----------');
    /* Weighted: 3 x weight 1 @100, 1 x weight 3 @0  =>  300/6 = 50% */
    for (const [title, progress, weight] of [
      ['Discovery', 100, 1], ['Design', 100, 1], ['Build', 100, 1], ['Hardening', 0, 3],
    ]) {
      const r = await post(`/api/admin/portal/projects/${projectId}/milestones`,
        { title, progress, weight }, aAuth);
      ok(r.status === 201, `milestone "${title}" created`);
    }
    const afterMs = await get('/api/portal/projects', uAuth(alice.token));
    ok(afterMs.body.projects[0].progress === 50, 'weighted rollup = 50%', `got ${afterMs.body.projects[0].progress}`);

    /* Nudge one milestone and confirm the rollup moves. */
    const hardId = afterMs.body.projects[0].milestones.find((m) => m.title === 'Hardening').id;
    const bumped = await put(`/api/admin/portal/milestones/${hardId}`, { progress: 50 }, aAuth);
    ok(bumped.body.projectProgress === 75, '50% on the weight-3 item -> 75%', `got ${bumped.body.projectProgress}`);

    /* progress:100 with no explicit status must derive status=done. */
    const doneId = afterMs.body.projects[0].milestones.find((m) => m.title === 'Design').id;
    const done = await put(`/api/admin/portal/milestones/${doneId}`, { progress: 100 }, aAuth);
    ok(done.body.status === 'done', 'progress 100 derives status "done"', done.body.status);
    /* An explicit status must win over the derived one. */
    const blocked = await put(`/api/admin/portal/milestones/${doneId}`, { progress: 100, status: 'blocked' }, aAuth);
    ok(blocked.body.status === 'blocked', 'an explicit status overrides the derived one');

    console.log('\n=== values are clamped, not trusted ----------');
    await put(`/api/admin/portal/milestones/${hardId}`, { progress: 9999 }, aAuth);
    const clamped = await get('/api/portal/projects', uAuth(alice.token));
    ok(clamped.body.projects[0].milestones.find((m) => m.title === 'Hardening').progress === 100,
      'progress 9999 clamps to 100');
    await put(`/api/admin/portal/milestones/${hardId}`, { progress: -50 }, aAuth);
    const clampedLow = await get('/api/portal/projects', uAuth(alice.token));
    ok(clampedLow.body.projects[0].milestones.find((m) => m.title === 'Hardening').progress === 0,
      'negative progress clamps to 0');

    console.log('\n=== progress 0 after deleting every milestone ----------');
    const before = (await get('/api/portal/projects', uAuth(alice.token))).body.projects[0];
    for (const m of before.milestones) {
      await fetch(`${base}/api/admin/portal/milestones/${m.id}`, { method: 'DELETE', headers: aAuth });
    }
    const emptied = await get('/api/portal/projects', uAuth(alice.token));
    ok(emptied.body.projects[0].progress === 0, 'no milestones -> 0%, not NaN or stale', `got ${emptied.body.projects[0].progress}`);

    console.log('\n=== OWNERSHIP: the rule that matters ----------');
    const all = await get('/api/portal/projects', uAuth(bob.token));
    ok(all.body.projects.length === 0, 'Bob sees none of Alice\'s projects', `got ${all.body.projects.length}`);
    const cross = await get(`/api/portal/projects/${projectId}`, uAuth(bob.token));
    /* 404 not 403: a 403 would confirm the project exists. */
    ok(cross.status === 404, 'Bob asking for Alice\'s project -> 404 (not 403)', `got ${cross.status}`);
    ok((await get('/api/admin/portal/projects', uAuth(bob.token))).status === 403, 'Bob cannot list all projects');

    console.log('\n=== contracts ----------');
    const c = await post('/api/admin/portal/contracts',
      { projectId, title: 'Master Services Agreement', value: 12500.50, currency: 'USD', status: 'signed' }, aAuth);
    ok(c.status === 201, 'admin attaches a contract');
    const aliceContracts = await get('/api/portal/contracts', uAuth(alice.token));
    ok(aliceContracts.body.contracts.length === 1, 'Alice sees her contract');
    /* cents -> decimal string, so the client never does float math */
    ok(aliceContracts.body.contracts[0].value === '12500.50', 'value is exact (12500.50, not 12500.499999)',
      aliceContracts.body.contracts[0].value);
    const bobContracts = await get('/api/portal/contracts', uAuth(bob.token));
    ok(bobContracts.body.contracts.length === 0, 'Bob sees none of Alice\'s contracts');

    console.log('\n=== notifications: broadcast + personal + read state ----------');
    const broadcast = await post('/api/admin/portal/notifications',
      { title: 'We are live', body: 'The new platform shipped.', type: 'news' }, aAuth);
    ok(broadcast.status === 201 && broadcast.body.broadcast === true, 'admin broadcasts a notification');

    const personal = await post('/api/admin/portal/notifications',
      { title: 'Only for Alice', userId: alice.row.id, type: 'message' }, aAuth);
    ok(personal.status === 201 && personal.body.broadcast === false, 'admin targets one user');

    /* Count from a BASELINE rather than asserting an absolute number. The
       project creation and the contract above each emitted their own
       notification for this same user, so the feed legitimately holds more
       than the two created here. An absolute count here made the suite fail
       for the right behaviour arriving from an unrelated route. */
    const feedBefore = await get('/api/portal/notifications', uAuth(alice.token));
    const baseCount = feedBefore.body.notifications.length;
    const baseUnread = feedBefore.body.unread;
    ok(baseCount >= 2, 'Alice sees broadcast + personal', `got ${baseCount}`);
    ok(baseUnread >= 2, 'both unread', `got ${baseUnread}`);
    ok(feedBefore.body.notifications.some((n) => n.scope === 'broadcast'), 'broadcast is labelled');
    ok(feedBefore.body.notifications.some((n) => n.title === 'Only for Alice'), 'her personal note is there');

    const bobFeed = await get('/api/portal/notifications', uAuth(bob.token));
    ok(bobFeed.body.notifications.length === 1, 'Bob sees only the broadcast', `got ${bobFeed.body.notifications.length}`);
    ok(bobFeed.body.notifications[0].title === 'We are live', 'and it is the right one');

    /* Marking one read must not affect the other reader of the same row. */
    const firstId = feedBefore.body.notifications[0].id;
    ok((await post(`/api/portal/notifications/${firstId}/read`, {}, uAuth(alice.token))).status === 200, 'Alice marks it read');
    const afterRead = await get('/api/portal/notifications', uAuth(alice.token));
    ok(afterRead.body.unread === baseUnread - 1, 'unread drops by exactly one for Alice', `got ${afterRead.body.unread}, expected ${baseUnread - 1}`);
    const bobAfter = await get('/api/portal/notifications', uAuth(bob.token));
    ok(bobAfter.body.unread === 1, 'Bob is unaffected by Alice reading it', `got ${bobAfter.body.unread}`);

    console.log('\n=== contact from the dashboard ----------');
    const contact = await post('/api/portal/contact', { message: 'Question about phase two.' }, uAuth(alice.token));
    ok(contact.status === 201, 'message accepted');
    const saved = db.prepare("SELECT email, message FROM contacts WHERE email = ? ORDER BY id DESC LIMIT 1").get(alice.row.email);
    ok(saved && saved.message === 'Question about phase two.', 'persisted to the shared contacts inbox');
    const empty = await post('/api/portal/contact', { message: '   ' }, uAuth(alice.token));
    ok(empty.status === 400, 'blank message -> 400');

    console.log('\n=== status changes notify the owner ----------');
    const before2 = (await get('/api/portal/notifications', uAuth(alice.token))).body.notifications.length;
    await put(`/api/admin/portal/projects/${projectId}`, { status: 'on-hold' }, aAuth);
    const after2 = await get('/api/portal/notifications', uAuth(alice.token));
    ok(after2.body.notifications.length === before2 + 1, 'status change adds a notification');
    ok(after2.body.notifications[0].title.includes('on-hold'), 'and it names the new status', after2.body.notifications[0].title);
  } catch (err) {
    failed++;
    console.error('\n  FAIL threw:', err.stack);
  }

  server.close();
  for (let i = 0; i < 3; i++) {
    try { fs.rmSync(TMP, { recursive: true, force: true, maxRetries: 3, retryDelay: 150 }); break; }
    catch { if (i === 2) console.warn(`  (note) left ${TMP}`); }
  }
  console.log(`\n${failed ? `${failed} FAILED` : 'all portal checks passed'} (${passed} passed)`);
  process.exit(failed ? 1 : 0);
});
