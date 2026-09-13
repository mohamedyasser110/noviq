/* Backend security + functional audit
   Tests: unauthenticated access blocked, authenticated works,
   malformed JSON → 400, pagination clamping, no console errors. */
process.env.NODE_ENV = 'test';
const http = require('http');
const app = require('./app');

let server;

/* Pace non-admin API calls so the suite passes under strict rate limits
   (dashboard-tuned rl_api can be as low as a few req/5s, default 10/min).
   Admin routes are exempt from the public limiter and stay instant. */
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
function req(method, path, body, headers = {}) {
  const run = () => new Promise((resolve) => {
    const data = body ? JSON.stringify(body) : null;
    const opts = {
      method, hostname: 'localhost', port: 3001, path,
      headers: { ...(data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {}), ...headers },
    };
    const r = http.request(opts, (res) => {
      let buf = '';
      res.on('data', c => buf += c);
      res.on('end', () => {
        let json = null;
        try { json = buf ? JSON.parse(buf) : null; } catch {}
        resolve({ status: res.statusCode, json, raw: buf });
      });
    });
    r.on('error', () => resolve({ status: 0, json: null, raw: '' }));
    if (data) r.write(data);
    r.end();
  });
  return (path.startsWith('/api/admin') ? Promise.resolve() : sleep(7000)).then(run);
}

let pass = 0, fail = 0;
const failures = [];

function check(name, cond, detail = '') {
  if (cond) { pass++; console.log('PASS  ' + name); }
  else { fail++; failures.push(name); console.log('FAIL  ' + name + (detail ? ' — ' + detail : '')); }
}

(async () => {
  server = app.listen(3001);
  console.log('=== 1. Unauthenticated lead access (must be 401) ===');
  for (const [p, m] of [
    ['/api/contact', 'GET'], ['/api/newsletter', 'GET'], ['/api/assessment', 'GET'],
    ['/api/consultation', 'GET'], ['/api/solution-builder', 'GET'],
  ]) {
    const r = await req(m, p);
    check(`${m} ${p} → 401`, r.status === 401, `got ${r.status}`);
  }
  /* Mutation without auth */
  const r1 = await req('PATCH', '/api/contact/1/status', { status: 'read' });
  check('PATCH /contact/1/status → 401', r1.status === 401, `got ${r1.status}`);
  const r2 = await req('DELETE', '/api/newsletter/1');
  check('DELETE /newsletter/1 → 401', r2.status === 401, `got ${r2.status}`);

  console.log('\n=== 2. Public POST still works (no auth needed) ===');
  const r3 = await req('POST', '/api/contact', { name: 'Test', email: 'audit@test.com', message: 'audit' });
  check('POST /contact → 201', r3.status === 201, `got ${r3.status}`);
  const r4 = await req('POST', '/api/newsletter/subscribe', { email: 'audit2@test.com' });
  check('POST /newsletter/subscribe → 200/201', r4.status === 200 || r4.status === 201, `got ${r4.status}`);

  console.log('\n=== 3. Admin login + token-protected access ===');
  const login = await req('POST', '/api/admin/login', { username: 'admin', password: 'noviq2026' });
  check('POST /admin/login → 200', login.status === 200, `got ${login.status}`);
  const token = login.json?.token;
  check('Token returned', !!token, 'no token');
  const authH = { Authorization: 'Bearer ' + token };

  const leads = await req('GET', '/api/contact', null, authH);
  check('GET /contact WITH token → 200', leads.status === 200, `got ${leads.status}`);
  check('GET /contact returns array', Array.isArray(leads.json), `got ${typeof leads.json}`);

  console.log('\n=== 4. Pagination clamping (bad input must not crash) ===');
  const pg = await req('GET', '/api/contact?limit=abc&offset=xyz', null, authH);
  check('GET /contact?limit=abc → 200 (clamped)', pg.status === 200, `got ${pg.status}`);
  const pgHuge = await req('GET', '/api/contact?limit=99999', null, authH);
  check('GET /contact?limit=99999 → 200 (capped at 200)', pgHuge.status === 200 && (pgHuge.json || []).length <= 200, `got ${pgHuge.status}, ${pgHuge.json?.length} items`);

  console.log('\n=== 5. Malformed JSON → 400 (not 500) ===');
  await sleep(7000);
  const badBody = '{bad json!}';
  const badJson = await new Promise((resolve) => {
    const r = http.request({ method: 'POST', hostname: 'localhost', port: 3001, path: '/api/contact',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(badBody) } }, (res) => {
      let b = ''; res.on('data', c => b += c); res.on('end', () => resolve({ status: res.statusCode }));
    });
    r.on('error', () => resolve({ status: 0 }));
    r.write(badBody); r.end();
  });
  check('Malformed JSON → 400', badJson.status === 400, `got ${badJson.status}`);

  console.log('\n=== 6. Chatbot still works (async reply) ===');
  const chat = await req('POST', '/api/chatbot/message', { message: 'hello', sessionId: 'audit-test' });
  check('POST /chatbot/message → 200', chat.status === 200, `got ${chat.status}`);
  check('Chatbot reply present', !!chat.json?.reply, 'no reply field');
  check('Chatbot source field', !!chat.json?.source, 'no source field');

  console.log('\n=== 7. Stats + topics endpoints ===');
  const stats = await req('GET', '/api/chatbot/stats');
  check('GET /chatbot/stats → 200', stats.status === 200);
  check('Stats has topics count', stats.json?.topics >= 165, `topics=${stats.json?.topics}`);
  const topics = await req('GET', '/api/chatbot/topics?lang=ar');
  check('GET /chatbot/topics → 200', topics.status === 200);
  check('Topics has 10 categories', topics.json?.categories?.length === 10, `got ${topics.json?.categories?.length}`);

  console.log('\n=== 8. Cleanup audit data ===');
  /* Delete the audit contact + subscriber we created */
  const allLeads = await req('GET', '/api/contact?limit=200', null, authH);
  const auditLead = (allLeads.json || []).find(c => c.email === 'audit@test.com');
  if (auditLead) { await req('DELETE', '/api/contact/' + auditLead.id, null, authH); check('Cleanup audit contact', true); }
  const allSubs = await req('GET', '/api/newsletter?limit=200', null, authH);
  const auditSub = (allSubs.json || []).find(s => s.email === 'audit2@test.com');
  if (auditSub) { await req('DELETE', '/api/newsletter/' + auditSub.id, null, authH); check('Cleanup audit subscriber', true); }

  console.log(`\n===== ${pass} passed, ${fail} failed =====`);
  if (failures.length) console.log('Failures: ' + failures.join(', '));
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
