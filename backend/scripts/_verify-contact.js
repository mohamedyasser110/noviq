/* ============================================================
   CONTACT — proof that a submitted message actually reaches the admin.

   The chain the user asked about, end to end:
     1. the browser path:  POST /api/contact on the Next.js server
        (app/api/contact/route.ts) — NOT the backend directly, because
        the proxy is where a field can be silently dropped while still
        answering 201.
     2. the row lands in SQLite with the phone.
     3. the AUTHENTICATED admin endpoint returns it, so it appears under
        Contacts in the dashboard.
     4. the admin page template actually renders the phone.
     5. the test row is removed again.

   Admin credentials default to the project's documented dev values
   (.env.example) and can be overridden with ADMIN_USERNAME/ADMIN_PASSWORD.

   Run:  node scripts/_verify-contact.js     (from backend/)
   Needs: API on :4322 and the site on :4321.
   ============================================================ */
const assert = require('assert');
const db = require('../db/init');

const API = process.env.API_URL || 'http://127.0.0.1:4322';
const SITE = process.env.SITE_URL || 'http://127.0.0.1:4321';
const USER = process.env.ADMIN_USERNAME || 'admin';
const PASS = process.env.ADMIN_PASSWORD || 'noviq2026';

const stamp = Date.now();
const PHONE = '+1 (415) 555-0182';
const NAME = `Contact Verify ${stamp}`;

async function main() {
  /* ---- 1. submit through the Next.js proxy, exactly like the form ---- */
  const res = await fetch(`${SITE}/api/contact`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      name: NAME,
      email: `verify-${stamp}@test.local`,
      phone: PHONE,
      company: 'QA Harness',
      message: 'Verifying that a submitted message reaches the admin inbox.',
    }),
  });
  const body = await res.json();
  assert.strictEqual(res.status, 201, `proxy did not accept the lead: ${res.status} ${JSON.stringify(body)}`);
  assert.ok(body.id, 'no row id in the response');
  const id = body.id;
  console.log(`1. proxy accepted the lead            OK  (id=${id})`);

  /* ---- 2. the row, with the phone, in SQLite ---- */
  const row = db.prepare('SELECT * FROM contacts WHERE id = ?').get(id);
  assert.ok(row, 'no row in contacts');
  assert.strictEqual(row.phone, PHONE, `phone not stored verbatim: ${JSON.stringify(row.phone)}`);
  assert.strictEqual(row.status, 'new', 'a fresh lead must land as "new" so the sidebar badge counts it');
  console.log(`2. row stored with phone             OK  (${row.phone})`);

  /* ---- 3. the AUTHENTICATED admin endpoint serves it ---- */
  const login = await fetch(`${API}/api/admin/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: USER, password: PASS }),
  });
  if (!login.ok) {
    throw new Error(
      `admin login failed (${login.status}). Set ADMIN_USERNAME / ADMIN_PASSWORD to the dashboard account.`,
    );
  }
  const { token } = await login.json();
  const list = await (
    await fetch(`${API}/api/contact?limit=50`, { headers: { authorization: `Bearer ${token}` } })
  ).json();
  const seen = list.find((c) => c.id === id);
  assert.ok(seen, 'the admin contacts list did not return the new lead');
  assert.strictEqual(seen.phone, PHONE, 'admin list lost the phone');
  console.log(`3. admin API returns it               OK  (${seen.name} / ${seen.phone})`);

  /* ---- 4. the admin page template renders the phone ---- */
  const html = require('fs').readFileSync(require.resolve('../admin/index.html'), 'utf8');
  assert.ok(html.includes('<th>Phone</th>'), 'admin table has no Phone column');
  assert.ok(html.includes('tel:${esc(String(c.phone)'), 'admin table has no clickable tel: link');
  assert.ok(/detail-label">Phone/.test(html), 'admin detail modal has no Phone row');
  assert.ok(html.includes('Not provided'), 'admin modal has no empty-state for a missing phone');
  console.log('4. admin UI renders the phone         OK  (column + tel: link + modal row)');

  /* ---- 5. sanitising: markup and letters are stripped, digits survive ---- */
  const dirty = await fetch(`${SITE}/api/contact`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      name: NAME,
      email: `verify-dirty-${stamp}@test.local`,
      phone: '‎+1 <script>alert(1)</script>415-555 0182 ext.',
      message: 'Sanitising probe.',
    }),
  });
  assert.strictEqual(dirty.status, 201, 'sanitising probe rejected');
  const dirtyId = (await dirty.json()).id;
  const dirtyRow = db.prepare('SELECT phone FROM contacts WHERE id = ?').get(dirtyId);
  assert.ok(!/[<>a-z]/i.test(dirtyRow.phone.replace(/^[\d+\-(). ]+$/, '')), `unexpected chars survived: ${dirtyRow.phone}`);
  assert.ok(/\d{3}/.test(dirtyRow.phone), 'sanitising destroyed the digits');
  console.log(`5. phone is sanitised, digits kept    OK  (${JSON.stringify(dirtyRow.phone)})`);

  /* ---- cleanup ---- */
  db.prepare('DELETE FROM contacts WHERE id IN (?, ?)').run(id, dirtyId);
  assert.strictEqual(db.prepare('SELECT COUNT(*) c FROM contacts WHERE id = ?').get(id).c, 0, 'cleanup failed');
  console.log(`\ncleaned up test rows ${id}, ${dirtyId}`);
  console.log('ALL CONTACT CHECKS PASSED');
}

main().catch((e) => {
  console.error('\nFAILED:', e.message);
  process.exit(1);
});
