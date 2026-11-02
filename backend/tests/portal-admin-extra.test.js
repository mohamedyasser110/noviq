/* ============================================================
   NOVIQ — portal admin extras (contract update + project delete)
   ------------------------------------------------------------
   routes/portal.js grew two admin endpoints the dashboard's "Client
   Projects" page needs: PUT /api/admin/portal/contracts/:id (status flow
   without re-attaching) and DELETE /api/admin/portal/projects/:id
   (full cascade). Same harness as portal.test.js: temp database,
   ephemeral port, two clients so leakage is testable.
   ============================================================ */
const fs = require('fs');
const os = require('os');
const path = require('path');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'noviq-portal-extra-'));
process.env.DB_PATH = path.join(TMP, 'noviq.db');
process.env.UPLOADS_DIR = path.join(TMP, 'uploads');
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'portal-extra-test-secret';
process.env.ADMIN_PASSWORD = 'PortalExtra-Pass-9!';

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

function makeUser(email, first) {
  const r = db
    .prepare('INSERT INTO users (first_name, last_name, email, password) VALUES (?,?,?,?)')
    .run(first, 'Tester', email, hashPassword('Password123!'));
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(r.lastInsertRowid);
  return { row, token: generateToken({ id: row.id, email: row.email, role: row.role, tokenType: 'user' }) };
}

const alice = makeUser('alice.extra@test.local', 'Alice');
const bob = makeUser('bob.extra@test.local', 'Bob');

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
  const del = async (p, headers) => {
    const r = await fetch(`${base}${p}`, { method: 'DELETE', headers });
    return { status: r.status, body: await r.json().catch(() => null) };
  };

  try {
    console.log('\n=== fixture: project + milestones + contract ===');
    const created = await post('/api/admin/portal/projects',
      { name: 'Extra Platform', summary: 'delete-me', userEmail: 'alice.extra@test.local', status: 'active' }, aAuth);
    ok(created.status === 201, 'admin creates a project', `got ${created.status}`);
    const projectId = created.body?.project?.id;
    for (const t of ['Step one', 'Step two']) {
      const r = await post(`/api/admin/portal/projects/${projectId}/milestones`, { title: t, progress: 50 }, aAuth);
      ok(r.status === 201, `milestone "${t}" created`);
    }
    const cc = await post('/api/admin/portal/contracts',
      { projectId, title: 'Extra Agreement', value: 5000, currency: 'USD', status: 'draft' }, aAuth);
    ok(cc.status === 201, 'admin attaches a contract');
    const contractId = cc.body.id;

    console.log('\n=== PUT /api/admin/portal/contracts/:id ===');
    const upd = await put(`/api/admin/portal/contracts/${contractId}`, { status: 'sent' }, aAuth);
    ok(upd.status === 200 && upd.body.status === 'sent', 'status moves draft -> sent', JSON.stringify(upd.body));
    const mine = await get('/api/portal/contracts', uAuth(alice.token));
    ok(mine.body.contracts[0].status === 'sent', 'client reads the new status');
    ok(mine.body.contracts[0].value === '5000.00', 'value untouched by a status-only edit', mine.body.contracts[0].value);
    /* A status change must notify the owner (the dashboard badge depends on it). */
    const feed = await get('/api/portal/notifications', uAuth(alice.token));
    ok(feed.body.notifications.some((n) => n.title.includes('sent')), 'status change emits a notification');

    /* Notes-only edit: no new notification for a typo fix. */
    const nBefore = feed.body.notifications.length;
    const typo = await put(`/api/admin/portal/contracts/${contractId}`, { notes: 'typo fix' }, aAuth);
    ok(typo.status === 200, 'notes edit accepted');
    const nAfter = await get('/api/portal/notifications', uAuth(alice.token));
    ok(nAfter.body.notifications.length === nBefore, 'no notification for a non-status edit',
      `${nBefore} -> ${nAfter.body.notifications.length}`);

    /* Garbage status is ignored, not stored. */
    const bad = await put(`/api/admin/portal/contracts/${contractId}`, { status: 'flying' }, aAuth);
    ok(bad.status === 200 && bad.body.status === 'sent', 'unknown status keeps the old one', JSON.stringify(bad.body));
    ok((await put('/api/admin/portal/contracts/999999', { status: 'sent' }, aAuth)).status === 404, 'unknown contract -> 404');
    ok((await put(`/api/admin/portal/contracts/${contractId}`, { status: 'sent' }, uAuth(alice.token))).status === 403,
      'client token cannot update contracts');

    console.log('\n=== contract file attachment ===');
    const withFile = await post('/api/admin/portal/contracts',
      { projectId, title: 'Scanned Copy', file: 'images/uploads/1719-contract.pdf' }, aAuth);
    ok(withFile.status === 201, 'attach with an uploads file path');
    const listed = await get(`/api/admin/portal/contracts?projectId=${projectId}`, aAuth);
    const scanned = listed.body.contracts.find((c) => c.title === 'Scanned Copy');
    ok(scanned && scanned.file === 'images/uploads/1719-contract.pdf', 'file round-trips in the list', scanned?.file);
    const aliceFile = await get('/api/portal/contracts', uAuth(alice.token));
    ok(aliceFile.body.contracts.some((c) => c.file === 'images/uploads/1719-contract.pdf'), 'client reads the file path too');
    for (const bad of ['https://evil.test/x.pdf', '/etc/passwd', '../secret.pdf', 'images/uploads/x.exe', 'images/uploads/.pdf']) {
      const r = await post('/api/admin/portal/contracts', { projectId, title: 'Bad', file: bad }, aAuth);
      ok(r.status === 400, `absolute/traversal/wrong-ext rejected: ${bad}`, `got ${r.status}`);
    }
    const badPut = await put(`/api/admin/portal/contracts/${contractId}`, { file: 'https://evil.test/x.pdf' }, aAuth);
    ok(badPut.status === 400, 'PUT rejects an external file URL');
    const clearFile = await put(`/api/admin/portal/contracts/${contractId}`, { file: '' }, aAuth);
    ok(clearFile.status === 200, 'file can be cleared with an empty string');
    const fileImg = await put(`/api/admin/portal/contracts/${contractId}`, { file: 'images/uploads/scan-1.PNG' }, aAuth);
    ok(fileImg.status === 200, 'image extensions accepted (case-insensitive)');
    const allC = await get('/api/admin/portal/contracts', aAuth);
    ok(allC.status === 200 && allC.body.contracts.length === 2, 'admin lists every contract', `got ${allC.body.contracts.length}`);
    ok(allC.body.contracts.some((c) => c.value === '5000.00'), 'value exact in the admin list too');
    const byProject = await get(`/api/admin/portal/contracts?projectId=${projectId}`, aAuth);
    ok(byProject.body.contracts.length === 2, 'filter by project works');
    const byNobody = await get('/api/admin/portal/contracts?projectId=999999', aAuth);
    ok(byNobody.body.contracts.length === 0, 'unknown project filter -> empty, not 404');
    ok((await get('/api/admin/portal/contracts', uAuth(alice.token))).status === 403, 'client token cannot list contracts');

    console.log('\n=== POST /api/admin/portal/seed-demo ===');
    const seed = await post('/api/admin/portal/seed-demo', {}, aAuth);
    ok(seed.status === 200 && seed.body.ok === true, 'admin seeds the demo fixture');
    ok(seed.body.user?.email === 'demo@noviq.local', 'demo user present', JSON.stringify(seed.body.user));
    ok(seed.body.milestones === 5 && seed.body.progress === 55, 'demo project complete with rollup', `${seed.body.milestones} steps, ${seed.body.progress}%`);
    ok(seed.body.contract?.reference === 'NOVIQ-2026-001', 'demo contract present');
    ok(!('password' in (seed.body.login || {})) || seed.body.login.password === undefined, 'no password in the response');
    const seed2 = await post('/api/admin/portal/seed-demo', {}, aAuth);
    ok(Object.keys(seed2.body.created || {}).length === 0, 'second call creates nothing (idempotent)');
    ok((await post('/api/admin/portal/seed-demo', {}, uAuth(alice.token))).status === 403, 'client token cannot seed');

    console.log('\n=== DELETE /api/admin/portal/projects/:id ===');
    ok((await del('/api/admin/portal/projects/999999', aAuth)).status === 404, 'unknown project -> 404');
    ok((await del(`/api/admin/portal/projects/${projectId}`, uAuth(alice.token))).status === 403,
      'client token cannot delete projects');
    const gone = await del(`/api/admin/portal/projects/${projectId}`, aAuth);
    ok(gone.status === 200 && gone.body.ok === true, 'admin deletes the project');
    const aliceProjects = await get('/api/portal/projects', uAuth(alice.token));
    ok(aliceProjects.body.projects.length === 0, 'project gone from the client dashboard');
    const aliceContracts = await get('/api/portal/contracts', uAuth(alice.token));
    ok(aliceContracts.body.contracts.length === 0, 'its contract cascaded too');
    const leftovers = db.prepare('SELECT count(*) AS n FROM milestones WHERE project_id = ?').get(projectId).n;
    ok(leftovers === 0, 'its milestones cascaded too', `got ${leftovers}`);
    /* Bob's empty dashboard is untouched and no cross-user leak occurred. */
    const bobProjects = await get('/api/portal/projects', uAuth(bob.token));
    ok(bobProjects.body.projects.length === 0, 'other clients unaffected');
    const note = await get('/api/portal/notifications', uAuth(alice.token));
    ok(note.body.notifications.some((n) => n.title.includes('Project removed')), 'owner is told about the removal');
  } catch (err) {
    failed++;
    console.error('\n  FAIL threw:', err.stack);
  }

  server.close();
  for (let i = 0; i < 3; i++) {
    try { fs.rmSync(TMP, { recursive: true, force: true, maxRetries: 3, retryDelay: 150 }); break; }
    catch { if (i === 2) console.warn(`  (note) left ${TMP}`); }
  }
  console.log(`\n${failed ? `${failed} FAILED` : 'all portal-extra checks passed'} (${passed} passed)`);
  process.exit(failed ? 1 : 0);
});
