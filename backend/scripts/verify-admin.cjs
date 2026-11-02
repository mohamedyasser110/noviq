/* Admin dashboard smoke test — boots the API, logs in, and exercises the
   endpoints the dashboard needs. Prints the login credentials.
   Run: node scripts/verify-admin.cjs                                                 */
const path = require('path');
process.chdir(path.join(__dirname, '..'));

const app = require('../app');
const config = require('../config');

const PORT = 4399;
const BASE = `http://127.0.0.1:${PORT}/api`;

const server = app.listen(PORT, '127.0.0.1');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let pass = 0, fail = 0;
function check(name, ok, extra = '') {
  if (ok) { pass++; console.log(`  ✅ ${name}${extra ? '  ' + extra : ''}`); }
  else { fail++; console.log(`  ❌ ${name}${extra ? '  ' + extra : ''}`); }
}

async function call(pathname, opts = {}) {
  const res = await fetch(BASE + pathname, {
    method: opts.method || 'GET',
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  let body = null;
  try { body = await res.json(); } catch { /* empty */ }
  return { status: res.status, body };
}

(async () => {
  await sleep(1200);

  console.log('\n══════════════════════════════════════════════');
  console.log(' NOVIQ ADMIN DASHBOARD — SMOKE TEST');
  console.log('══════════════════════════════════════════════');
  console.log(` Dashboard URL : http://127.0.0.1:${PORT}/admin`);
  console.log(` API base      : ${BASE}`);
  console.log(` Username      : admin`);
  console.log(` Password      : ${config.ADMIN_PASSWORD}`);
  console.log(` Email         : ${config.ADMIN_EMAIL || '(empty)'}`);
  console.log('══════════════════════════════════════════════\n');

  console.log('[1] Public health + content');
  const health = await call('/health');
  check('GET /api/health', health.status === 200, `status=${health.status}`);
  const teamPub = await call('/content/team');
  const teamMembers = Array.isArray(teamPub.body?.members) ? teamPub.body.members.length : 0;
  check('GET /api/content/team', teamPub.status === 200, `members=${teamMembers}`);
  const contentAll = await call('/content');
  check('GET /api/content', contentAll.status === 200,
    `keys=${Object.keys(contentAll.body || {}).length}`);

  console.log('\n[2] Admin auth');
  const badLogin = await call('/admin/login', { method: 'POST', body: { username: 'admin', password: 'wrong' } });
  check('rejects wrong password', badLogin.status === 401, `status=${badLogin.status}`);

  const login = await call('/admin/login', { method: 'POST', body: { username: 'admin', password: config.ADMIN_PASSWORD } });
  check('POST /api/admin/login', login.status === 200 && !!login.body?.token, `status=${login.status}`);
  const auth = { Authorization: `Bearer ${login.body?.token}` };
  if (!auth.Authorization.includes('undefined')) {
    const me = await call('/admin/me', { headers: auth });
    check('GET /api/admin/me', me.status === 200);

    console.log('\n[3] Dashboard data endpoints');
    for (const [name, ep] of [
      ['stats', '/admin/stats'],
      ['recent-activity', '/admin/recent-activity'],
      ['system', '/admin/system'],
      ['analytics', '/admin/analytics'],
      ['users', '/admin/users'],
      ['settings', '/admin/settings'],
      ['content/keys', '/admin/content/keys'],
      ['contact list', '/contact?limit=5'],
      ['newsletter list', '/newsletter'],
      ['consultations', '/consultation?limit=5'],
      ['chatbot stats', '/chatbot/stats'],
    ]) {
      const r = await call(ep, { headers: auth });
      const size = Array.isArray(r.body) ? `${r.body.length} rows`
        : r.body && typeof r.body === 'object' ? `${Object.keys(r.body).length} keys` : '';
      check(`GET ${ep}`, r.status === 200, `status=${r.status} ${size}`);
    }

    console.log('\n[4] Admin content:team (the editor the Team page reads)');
    // /admin/content/keys returns a FLAT array of key names (admin.js:492).
    const keys = await call('/admin/content/keys', { headers: auth });
    const list = Array.isArray(keys.body) ? keys.body : (keys.body?.keys || []);
    const keyNames = list.map((k) => (typeof k === 'string' ? k : k?.key));
    check('team key listed in /admin/content/keys', keyNames.includes('team'),
      `${keyNames.length} keys`);
    const teamAdmin = await call('/admin/content/team', { headers: auth });
    check('GET /api/admin/content/team', teamAdmin.status === 200,
      `members=${teamAdmin.body?.value?.members?.length ?? teamAdmin.body?.members?.length ?? '?'}`);
  }

  console.log(`\n──────────────\n  ${pass} passed · ${fail} failed\n──────────────\n`);
  server.close();
  process.exit(fail === 0 ? 0 : 1);
})().catch((e) => {
  console.error('FATAL', e);
  server.close();
  process.exit(1);
});
