/* ============================================================
   NOVIQ — portal avatar + project activation requests
   ------------------------------------------------------------
   The client uploads a profile photo (magic-byte verified, 2MB, own
   row only) and files structured project requests the admin triages.
   Same harness as the other portal suites: temp database, ephemeral
   port, two clients so leakage is testable.
   ============================================================ */
const fs = require('fs');
const os = require('os');
const path = require('path');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'noviq-portal-avreq-'));
process.env.DB_PATH = path.join(TMP, 'noviq.db');
process.env.UPLOADS_DIR = path.join(TMP, 'uploads');
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'portal-avreq-test-secret';
process.env.ADMIN_PASSWORD = 'PortalAvreq-Pass-9!';

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

const alice = makeUser('alice.avreq@test.local', 'Alice');
const bob = makeUser('bob.avreq@test.local', 'Bob');

const adminRow = db.prepare("SELECT id FROM admin_users WHERE username = 'admin'").get();
const adminToken = generateToken({ id: adminRow.id, username: 'admin', role: 'admin', tokenType: 'admin' });
db.prepare('INSERT INTO admin_sessions (admin_id, token, ip) VALUES (?, ?, ?)').run(adminRow.id, adminToken, '127.0.0.1');

const uAuth = (t) => ({ Authorization: `Bearer ${t}` });
const aAuth = { Authorization: `Bearer ${adminToken}` };
const JSONH = { 'Content-Type': 'application/json' };

/* 1x1 transparent PNG (magic bytes 89 50 4E 47 …). */
const PNG_B64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const pngUrl = `data:image/png;base64,${PNG_B64}`;
const jpgUrl = `data:image/jpeg;base64,${Buffer.from([0xFF, 0xD8, 0xFF, 0x00]).toString('base64')}`;

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
    console.log('\n=== avatar: upload validation ===');
    ok((await post('/api/portal/profile/avatar', {}, uAuth(alice.token))).status === 400, 'missing data -> 400');
    ok((await post('/api/portal/profile/avatar', { data: 'data:image/png;base64,!!!' }, uAuth(alice.token))).status === 400, 'malformed data URL -> 400');
    ok((await post('/api/portal/profile/avatar', { data: 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=' }, uAuth(alice.token))).status === 400, 'SVG rejected (not an allowed raster type)');
    /* Declared PNG but JPEG bytes: magic check must catch the lie. */
    const lying = `data:image/png;base64,${Buffer.from([0xFF, 0xD8, 0xFF, 0x00]).toString('base64')}`;
    ok((await post('/api/portal/profile/avatar', { data: lying }, uAuth(alice.token))).status === 400, 'content/type mismatch -> 400');
    /* 3MB of valid PNG header + padding: over the 2MB cap. */
    const big = Buffer.concat([Buffer.from(PNG_B64, 'base64'), Buffer.alloc(3 * 1024 * 1024)]);
    ok((await post('/api/portal/profile/avatar', { data: `data:image/png;base64,${big.toString('base64')}` }, uAuth(alice.token))).status === 400, 'oversize -> 400');

    console.log('\n=== avatar: round-trip ===');
    const up = await post('/api/portal/profile/avatar', { data: pngUrl, filename: 'me.png' }, uAuth(alice.token));
    ok(up.status === 200 && /^images\/uploads\/avatar-\d+-\d+\.png$/.test(up.body.avatar), 'upload stored uploads-relative', up.body.avatar);
    const me = await get('/api/portal/me', uAuth(alice.token));
    ok(me.body.user.avatar === up.body.avatar, '/me carries the avatar');
    const before = db.prepare('SELECT avatar FROM users WHERE email = ?').get('alice.avreq@test.local').avatar;
    const up2 = await post('/api/portal/profile/avatar', { data: jpgUrl, filename: 'me2.jpg' }, uAuth(alice.token));
    ok(up2.status === 200 && up2.body.avatar.endsWith('.jpg'), 're-upload replaces');
    const files = fs.readdirSync(process.env.UPLOADS_DIR);
    ok(!files.includes(before.split('/').pop()), 'previous file deleted (no accumulation)', files.join(','));
    const gone = await del('/api/portal/profile/avatar', uAuth(alice.token));
    ok(gone.status === 200 && gone.body.avatar === '', 'delete clears the field');
    const me2 = await get('/api/portal/me', uAuth(alice.token));
    ok(me2.body.user.avatar === '', 'cleared avatar reads back empty');
    ok((await post('/api/portal/profile/avatar', { data: pngUrl })).status === 401, 'no token -> 401');

    console.log('\n=== requests: client writes, admin triages ===');
    const empty = await get('/api/portal/requests', uAuth(alice.token));
    ok(empty.status === 200 && empty.body.requests.length === 0, 'request list starts empty');
    ok((await post('/api/portal/requests', { category: 'website' }, uAuth(alice.token))).status === 400, 'missing title -> 400');
    const created = await post('/api/portal/requests', {
      title: 'Field sales app', category: 'mobile-app', budget: '$5k–$10k', timeline: '3–6 months', description: 'Offline-first Android app.',
    }, uAuth(alice.token));
    ok(created.status === 201 && created.body.ok === true, 'structured request accepted');
    const weird = await post('/api/portal/requests', { title: 'X', category: 'spaceship' }, uAuth(alice.token));
    ok(weird.status === 201, 'unknown category coerced (accepted, stored as other)');
    const mine = await get('/api/portal/requests', uAuth(alice.token));
    ok(mine.body.requests.length === 2, 'client reads her own requests');
    ok(mine.body.requests.every((r) => r.status === 'new'), 'fresh requests start as new');
    ok(mine.body.requests[0].category === 'other', 'bad category stored as other', mine.body.requests[0].category);

    const all = await get('/api/admin/portal/requests', aAuth);
    ok(all.status === 200 && all.body.requests.length === 2, 'admin lists every request');
    ok(all.body.requests[0].user.email === 'alice.avreq@test.local', 'request carries the client identity');
    const onlyNew = await get('/api/admin/portal/requests?status=new', aAuth);
    ok(onlyNew.body.requests.length === 2, 'status filter works');
    ok((await get('/api/admin/portal/requests', uAuth(alice.token))).status === 403, 'client token cannot list requests');

    const reqId = mine.body.requests.find((r) => r.title === 'Field sales app').id;
    const reviewed = await put(`/api/admin/portal/requests/${reqId}`, { status: 'reviewed' }, aAuth);
    ok(reviewed.status === 200 && reviewed.body.status === 'reviewed', 'admin moves new -> reviewed');
    const feedAfterReview = await get('/api/portal/notifications', uAuth(alice.token));
    const notesBefore = feedAfterReview.body.notifications.length;
    const approved = await put(`/api/admin/portal/requests/${reqId}`, { status: 'approved', adminNote: 'Kickoff next week.' }, aAuth);
    ok(approved.status === 200, 'admin approves with a note');
    const feedAfter = await get('/api/portal/notifications', uAuth(alice.token));
    ok(feedAfter.body.notifications.length === notesBefore + 1, 'approval notifies the client');
    ok(feedAfter.body.notifications[0].title.includes('approved'), 'notification names the decision');
    const mine2 = await get('/api/portal/requests', uAuth(alice.token));
    const done = mine2.body.requests.find((r) => r.id === reqId);
    ok(done.status === 'approved' && done.adminNote === 'Kickoff next week.', 'client sees status + note');
    ok((await put('/api/admin/portal/requests/999999', { status: 'approved' }, aAuth)).status === 404, 'unknown request -> 404');
    const badStatus = await put(`/api/admin/portal/requests/${reqId}`, { status: 'flying' }, aAuth);
    ok(badStatus.status === 200 && badStatus.body.status === 'approved', 'unknown status keeps the old one');

    /* Removing a request. The queue could be approved and rejected but never
       deleted, which left a duplicate or a probe permanently in the admin's
       face with no way out of it short of direct database access. */
    console.log('\n=== deleting a request ===');
    ok((await del(`/api/admin/portal/requests/${reqId}`, uAuth(alice.token))).status === 403,
      'a client cannot delete their own request');
    ok((await del('/api/admin/portal/requests/999999', aAuth)).status === 404,
      'deleting an unknown request -> 404');
    /* parseInt('abc') is NaN and parseInt('5abc') is 5. The first is merely
       unhelpful; the second deletes or updates a row the caller never named,
       which for a DELETE is unrecoverable. So a malformed path id is a 400,
       never a silent hit on the numbered prefix. */
    ok((await del('/api/admin/portal/requests/abc', aAuth)).status === 400,
      'a non-numeric id is rejected, not coerced');
    ok((await put(`/api/admin/portal/requests/${reqId}abc`, { status: 'rejected' }, aAuth)).status === 400,
      'PUT refuses 5abc-style ids rather than acting on the 5');

    /* The hazard pinned directly: an id carrying a real row's number must
       not touch that row. Request 1 exists in this fixture. */
    const victim = mine.body.requests[0].id;
    const before1 = await get('/api/admin/portal/requests', aAuth);
    const statusBefore = before1.body.requests.find((r) => r.id === victim).status;
    await put(`/api/admin/portal/requests/${victim}xyz`, { status: 'rejected' }, aAuth);
    await del(`/api/admin/portal/requests/${victim}000`, aAuth);
    const after1 = await get('/api/admin/portal/requests', aAuth);
    const rowAfter = after1.body.requests.find((r) => r.id === victim);
    ok(rowAfter, 'the suffixed id did not delete the row it resembled');
    ok(rowAfter.status === statusBefore, 'the suffixed id did not change that row either', rowAfter.status);

    /* Same rule on every other id-addressed portal route, because they all
       pick rows by path id and all had the same parseInt. */
    for (const [method, path, label] of [
      ['put', '/api/admin/portal/projects/7abc', 'projects'],
      ['delete', '/api/admin/portal/projects/7abc', 'projects'],
      ['put', '/api/admin/portal/milestones/7abc', 'milestones'],
      ['delete', '/api/admin/portal/milestones/7abc', 'milestones'],
      ['put', '/api/admin/portal/contracts/7abc', 'contracts'],
      ['get', '/api/admin/portal/messages/7abc', 'messages'],
    ]) {
      const r = method === 'get'
        ? await get(path, aAuth)
        : method === 'delete'
          ? await del(path, aAuth)
          : await put(path, { title: 'x' }, aAuth);
      ok(r.status === 400, `${label}: "${path}" -> 400, not a silent row hit`, 'got ' + r.status);
    }
    /* The client routes need a client token — an admin token is refused by
       the auth layer first, which would mask the id check behind a 403. */
    for (const [path, label] of [
      ['/api/portal/projects/7abc', 'client projects'],
    ]) {
      const r = await get(path, uAuth(alice.token));
      ok(r.status === 400, `${label}: "${path}" -> 400, not a silent row hit`, 'got ' + r.status);
    }
    const readRes = await post('/api/portal/notifications/7abc/read', {}, uAuth(alice.token));
    ok(readRes.status === 400, 'notification read: malformed id -> 400', 'got ' + readRes.status);

    const feedBeforeDelete = await get('/api/portal/notifications', uAuth(alice.token));
    const removed = await del(`/api/admin/portal/requests/${reqId}`, aAuth);
    ok(removed.status === 200 && removed.body.ok === true, 'admin removes a request', 'status ' + removed.status);
    const afterDelete = await get('/api/admin/portal/requests', aAuth);
    ok(!afterDelete.body.requests.some((r) => r.id === reqId), 'the request is gone from the queue');
    const feedAfterDelete = await get('/api/portal/notifications', uAuth(alice.token));
    ok(feedAfterDelete.body.notifications.length === feedBeforeDelete.body.notifications.length + 1,
      'the client is told their request was removed');
    ok(/removed/i.test(feedAfterDelete.body.notifications[0].title),
      'the notice says what happened', feedAfterDelete.body.notifications[0].title);
    const mine3 = await get('/api/portal/requests', uAuth(alice.token));
    ok(!mine3.body.requests.some((r) => r.id === reqId), 'it is gone from the client view too');

    console.log('\n=== isolation ===');
    const bobList = await get('/api/portal/requests', uAuth(bob.token));
    ok(bobList.body.requests.length === 0, 'Bob sees none of Alice\u2019s requests');
  } catch (err) {
    failed++;
    console.error('\n  FAIL threw:', err.stack);
  }

  server.close();
  for (let i = 0; i < 3; i++) {
    try { fs.rmSync(TMP, { recursive: true, force: true, maxRetries: 3, retryDelay: 150 }); break; }
    catch { if (i === 2) console.warn(`  (note) left ${TMP}`); }
  }
  console.log(`\n${failed ? `${failed} FAILED` : 'all portal-avatar-requests checks passed'} (${passed} passed)`);
  process.exit(failed ? 1 : 0);
});
