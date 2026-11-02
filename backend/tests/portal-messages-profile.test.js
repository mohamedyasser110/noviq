/* ============================================================
   NOVIQ — portal two-way messages + client profile
   ------------------------------------------------------------
   routes/portal.js added a real conversation (client_messages, per-side
   read state) and an editable profile (name + phone, email immutable).
   Same harness as the other portal suites: temp database, ephemeral
   port, two clients so leakage is testable.
   ============================================================ */
const fs = require('fs');
const os = require('os');
const path = require('path');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'noviq-portal-msg-'));
process.env.DB_PATH = path.join(TMP, 'noviq.db');
process.env.UPLOADS_DIR = path.join(TMP, 'uploads');
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'portal-msg-test-secret';
process.env.ADMIN_PASSWORD = 'PortalMsg-Pass-9!';

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

const alice = makeUser('alice.msg@test.local', 'Alice');
const bob = makeUser('bob.msg@test.local', 'Bob');

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
    console.log('\n=== migration: phone + client_messages exist ===');
    const cols = db.prepare('PRAGMA table_info(users)').all().map((c) => c.name);
    ok(cols.includes('phone'), 'users.phone column migrated');
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map((t) => t.name);
    ok(tables.includes('client_messages'), 'client_messages table created');

    console.log('\n=== profile: read + edit ===');
    const prof = await get('/api/portal/profile', uAuth(alice.token));
    ok(prof.status === 200 && prof.body.user.email === 'alice.msg@test.local', 'profile reads own data');
    ok(prof.body.user.phone === '', 'phone starts empty');
    const upd = await put('/api/portal/profile', { firstName: 'Alicia', phone: '+201062339274' }, uAuth(alice.token));
    ok(upd.status === 200, 'profile update accepted');
    ok(upd.body.user.firstName === 'Alicia' && upd.body.user.phone === '+201062339274', 'name + phone persisted', JSON.stringify(upd.body.user));
    ok(upd.body.user.email === 'alice.msg@test.local', 'email untouched (identity is immutable)');
    /* An email field smuggled in the body must not move the login. */
    const evil = await put('/api/portal/profile', { firstName: 'Alicia', email: 'bob.msg@test.local' }, uAuth(alice.token));
    ok(evil.status === 200 && evil.body.user.email === 'alice.msg@test.local', 'email in body is ignored, not applied');
    ok((await put('/api/portal/profile', { firstName: '   ' }, uAuth(alice.token))).status === 400, 'blank first name -> 400');
    ok((await get('/api/portal/profile')).status === 401, 'no token -> 401');
    const me = await get('/api/portal/me', uAuth(alice.token));
    ok(me.body.user.phone === '+201062339274', '/me carries the phone (dashboard shows it)');

    console.log('\n=== client thread: write + read ===');
    const empty = await get('/api/portal/messages', uAuth(alice.token));
    ok(empty.status === 200 && empty.body.messages.length === 0, 'thread starts empty');
    ok((await post('/api/portal/messages', { message: '   ' }, uAuth(alice.token))).status === 400, 'blank message -> 400');
    const sent = await post('/api/portal/messages', { message: 'Is the homepage copy final?' }, uAuth(alice.token));
    ok(sent.status === 201 && sent.body.ok === true, 'client message accepted');
    const thread = await get('/api/portal/messages', uAuth(alice.token));
    ok(thread.body.messages.length === 1 && thread.body.messages[0].sender === 'client', 'thread holds her row');

    console.log('\n=== admin inbox: list + open + reply ===');
    const convs = await get('/api/admin/portal/messages', aAuth);
    ok(convs.status === 200 && convs.body.conversations.length === 1, 'one conversation listed');
    const conv = convs.body.conversations[0];
    ok(conv.unread === 1 && conv.lastSender === 'client', 'unread counts her waiting row', JSON.stringify(conv));
    ok(conv.name === 'Alicia Tester' && conv.email === 'alice.msg@test.local', 'client identity attached', JSON.stringify({ name: conv.name }));
    ok(conv.phone === '+201062339274', 'admin sees the client phone', conv.phone);
    const opened = await get(`/api/admin/portal/messages/${alice.row.id}`, aAuth);
    ok(opened.status === 200 && opened.body.messages.length === 1, 'admin opens the thread');
    const afterOpen = await get('/api/admin/portal/messages', aAuth);
    ok(afterOpen.body.conversations[0].unread === 0, 'opening marks her rows read');
    ok((await get('/api/admin/portal/messages/999999', aAuth)).status === 404, 'unknown client -> 404');

    const reply = await post('/api/admin/portal/messages', { userId: alice.row.id, body: 'Almost — Figma link today.' }, aAuth);
    ok(reply.status === 201, 'admin reply accepted');
    ok((await post('/api/admin/portal/messages', { body: 'no target' }, aAuth)).status === 400, 'reply without userId -> 400 (never broadcast)');
    ok((await post('/api/admin/portal/messages', { userId: 999999, body: 'x' }, aAuth)).status === 404, 'reply to unknown client -> 404');
    ok((await post('/api/admin/portal/messages', { userId: alice.row.id, body: '  ' }, aAuth)).status === 400, 'blank reply -> 400');

    console.log('\n=== reply surfaces on the client side ===');
    const me2 = await get('/api/portal/me', uAuth(alice.token));
    ok(me2.body.unreadMessages === 1, 'unreadMessages counts the team reply', `got ${me2.body.unreadMessages}`);
    ok(me2.body.unread >= 1, 'the headline badge includes it');
    const thread2 = await get('/api/portal/messages', uAuth(alice.token));
    ok(thread2.body.messages.length === 2, 'thread has both sides in order');
    ok(thread2.body.messages[1].sender === 'admin' && thread2.body.messages[1].read === true,
      'opening marks the team rows read');
    const me3 = await get('/api/portal/me', uAuth(alice.token));
    ok(me3.body.unreadMessages === 0, 'badge clears after opening');
    const feed = await get('/api/portal/notifications', uAuth(alice.token));
    ok(feed.body.notifications.some((n) => n.title === 'New message from the team'), 'reply also pings the update feed');

    console.log('\n=== isolation + gates ===');
    const bobThread = await get('/api/portal/messages', uAuth(bob.token));
    ok(bobThread.body.messages.length === 0, 'Bob sees none of Alice\u2019s thread');
    ok((await get('/api/admin/portal/messages', uAuth(alice.token))).status === 403, 'client token cannot list threads');
    ok((await get(`/api/admin/portal/messages/${alice.row.id}`, uAuth(bob.token))).status === 403, 'client token cannot open threads');
    ok((await post('/api/admin/portal/messages', { userId: alice.row.id, body: 'x' }, uAuth(bob.token))).status === 403, 'client token cannot reply');
    ok((await get('/api/admin/portal/messages')).status === 401, 'no token -> 401');

    console.log('\n=== read-all clears the feed badge ===');
    const unreadBefore = (await get('/api/portal/me', uAuth(alice.token))).body.unread;
    ok(unreadBefore >= 1, 'badge nonzero before read-all', `got ${unreadBefore}`);
    const all = await post('/api/portal/notifications/read-all', {}, uAuth(alice.token));
    ok(all.status === 200 && all.body.ok === true, 'read-all accepted');
    ok(all.body.marked === unreadBefore, 'reports exactly the flipped count', `marked ${all.body.marked}, badge was ${unreadBefore}`);
    const meAfter = await get('/api/portal/me', uAuth(alice.token));
    ok(meAfter.body.unread === 0, 'headline badge is zero (chat already read above)', `got ${meAfter.body.unread}`);
    const again = await post('/api/portal/notifications/read-all', {}, uAuth(alice.token));
    ok(again.body.marked === 0, 'second call flips nothing (idempotent)');
    ok((await post('/api/portal/notifications/read-all', {})).status === 401, 'no token -> 401');
  } catch (err) {
    failed++;
    console.error('\n  FAIL threw:', err.stack);
  }

  server.close();
  for (let i = 0; i < 3; i++) {
    try { fs.rmSync(TMP, { recursive: true, force: true, maxRetries: 3, retryDelay: 150 }); break; }
    catch { if (i === 2) console.warn(`  (note) left ${TMP}`); }
  }
  console.log(`\n${failed ? `${failed} FAILED` : 'all portal-messages checks passed'} (${passed} passed)`);
  process.exit(failed ? 1 : 0);
});
