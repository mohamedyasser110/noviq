/**
 * Verifies the Next.js same-origin contact proxy (app/api/contact/route.ts):
 *   - rejects bad payloads with 400 and never forwards them
 *   - forwards a valid payload to the Express backend and relays its
 *     201 + real SQLite row id (i.e. the lead is really persisted)
 *
 *   BASE_URL=http://localhost:4321 node tests/contact-proxy.test.cjs
 */
const BASE = process.env.BASE_URL || 'http://localhost:4321';

async function post(path, body) {
  const res = await fetch(BASE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  let json = null;
  try { json = await res.json(); } catch {}
  return { status: res.status, json };
}

let pass = 0, fail = 0;
const check = (ok, name, detail) => {
  if (ok) pass++; else fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`);
};

(async () => {
  // ---- validation: 400, and the error envelope must survive the hop ----
  const cases = [
    ['missing message', { name: 'A', email: 'a@b.co' }],
    ['missing name', { email: 'a@b.co', message: 'hi' }],
    ['missing email', { name: 'A', message: 'hi' }],
    ['malformed email', { name: 'A', email: 'not-an-email', message: 'hi' }],
    ['message over 5000', { name: 'A', email: 'a@b.co', message: 'x'.repeat(5001) }],
  ];

  for (const [label, body] of cases) {
    const r = await post('/api/contact', body);
    const envelope = r.json && r.json.error;
    const ok = r.status === 400 && envelope && envelope.code === 'VALIDATION_ERROR';
    check(ok, `rejects: ${label}`, `-> ${r.status} ${JSON.stringify(r.json)}`);
  }

  // ---- non-JSON body ----
  const res = await fetch(BASE + '/api/contact', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: 'this is not json',
  });
  check(res.status === 400, 'rejects: non-JSON body', `-> ${res.status}`);

  // ---- valid payload: must reach the backend and come back 201 with an id ----
  const valid = {
    name: 'Proxy Verification',
    email: 'proxy-verify@test.local',
    company: 'QA',
    message: 'Confirming the Next.js proxy persists this lead to SQLite.',
  };
  const r = await post('/api/contact', valid);
  const hasId = r.json && typeof r.json.id === 'number';
  const hasMsg = r.json && typeof r.json.message === 'string' && r.json.message.length > 0;
  check(r.status === 201, 'valid submission -> 201', `-> ${r.status} ${JSON.stringify(r.json)}`);
  check(hasId, 'response carries a real SQLite row id', `id=${r.json && r.json.id}`);
  check(hasMsg, 'response carries the backend message');

  // ---- the id must be new (proof it was an INSERT, not a cached reply) ----
  const r2 = await post('/api/contact', { ...valid, message: 'Second row, to prove a fresh insert.' });
  check(
    r2.status === 201 && r2.json && typeof r2.json.id === 'number' && r2.json.id > (r.json.id || 0),
    'second submission gets a higher id (genuine INSERT)',
    `id1=${r.json && r.json.id} id2=${r2.json && r2.json.id}`
  );

  // ---- phone is OPTIONAL and must survive the hop ----
  // The proxy used to destructure only {name,email,company,message} and
  // forward exactly those, so a phone typed in the form was dropped here
  // while the 201 still said success. These checks pin that shut.
  const noPhone = await post('/api/contact', { ...valid, message: 'No phone supplied.' });
  check(noPhone.status === 201, 'phone stays optional (201 without it)', `-> ${noPhone.status}`);

  const withPhone = await post('/api/contact', {
    ...valid,
    message: 'Phone supplied.',
    phone: '+1 (415) 555-0182',
  });
  check(withPhone.status === 201, 'submission with a phone -> 201', `-> ${withPhone.status}`);

  // A malformed phone must be sanitised away, NOT rejected. The field is
  // optional, so failing the whole submission over it would throw away a
  // real lead because of a typo — the visitor would just see "failed to
  // send" and their message would be gone. Losing the digits is correct;
  // losing the message is not.
  const badPhone = await post('/api/contact', {
    ...valid,
    message: 'Phone typed as words.',
    phone: 'call me',
  });
  check(
    badPhone.status === 201 && badPhone.json && typeof badPhone.json.id === 'number',
    'malformed phone is dropped, lead is still saved',
    `-> ${badPhone.status} ${JSON.stringify(badPhone.json)}`
  );

  console.log(
    `      (ids: noPhone=${noPhone.json && noPhone.json.id} withPhone=${withPhone.json && withPhone.json.id} badPhone=${badPhone.json && badPhone.json.id})`
  );

  console.log(`\n${fail === 0 ? 'ALL PROXY CHECKS PASSED' : fail + ' FAILED'} (${pass} passed, ${fail} failed)`);
  process.exit(fail === 0 ? 0 : 1);
})();
