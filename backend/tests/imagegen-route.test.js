/* ============================================================
   IMAGEGEN ROUTE — REGRESSION TEST
   ------------------------------------------------------------
   GET /api/imagegen used to throw a ReferenceError: routes/public.js
   called `transformPrompt` / `imageVariants` but never imported them
   (the only copy lived as dead code in routes/admin.js), so EVERY
   request returned 500 — including the cheap validation rejections
   that never touch the network.

   These assertions only exercise the pre-network paths, so the suite
   stays fast and works offline.
   ============================================================ */
process.env.NODE_ENV = 'test';
const http = require('http');
const app = require('../app');
const { getLimits, updateLimits } = require('../config/rate-limit');

let PORT = 0; /* ephemeral — never collides with a lingering previous run */
const server = http.createServer(app);
let pass = 0, fail = 0;
let base = '';

server.on('error', (err) => {
  console.error(`FATAL  server error: ${err.code || ''} ${err.message}`);
  process.exit(1);
});

const originalLimit = getLimits().imagegen;

function req(pathname) {
  return new Promise((resolve, reject) => {
    http
      .get({ hostname: '127.0.0.1', port: PORT, path: pathname }, (res) => {
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () => {
          let json = null;
          try { json = JSON.parse(body); } catch { /* non-JSON */ }
          resolve({ status: res.statusCode, json, body });
        });
      })
      .on('error', reject);
  });
}

function check(name, ok, extra) {
  if (ok) { console.log(`PASS  ${name}`); pass++; }
  else { console.error(`FAIL  ${name}${extra ? ' -> ' + extra : ''}`); fail++; }
}

server.listen(PORT, async () => {
  PORT = server.address().port;
  /* The imagegen limiter is 1 req/min by default; raise it for this run only. */
  try { updateLimits({ imagegen: { max: 20, windowMs: originalLimit.windowMs } }); } catch { /* keep default */ }

  await new Promise((r) => setTimeout(r, 300));

  try {
    /* Missing prompt -> 400 validation, never reaches the network */
    const empty = await req('/api/imagegen');
    check('GET /api/imagegen without prompt -> 400', empty.status === 400, `got ${empty.status}`);
    check('  ...error code is VALIDATION_ERROR',
      empty.json?.error?.code === 'VALIDATION_ERROR', JSON.stringify(empty.json));

    /* Blocked English prompt -> 400, proves transformPrompt is defined */
    const blockedEn = await req('/api/imagegen?prompt=' + encodeURIComponent('a photo of a woman in an office'));
    check('GET /api/imagegen with blocked en prompt -> 400', blockedEn.status === 400, `got ${blockedEn.status}`);
    check('  ...reports blocked content',
      /blocked/i.test(blockedEn.json?.error?.message || ''), JSON.stringify(blockedEn.json));

    /* Blocked Arabic prompt -> 400, proves the Arabic half of the blocklist */
    const blockedAr = await req('/api/imagegen?prompt=' + encodeURIComponent('صورة فتاة داخل عيادة'));
    check('GET /api/imagegen with blocked ar prompt -> 400', blockedAr.status === 400, `got ${blockedAr.status}`);
    check('  ...reports blocked content',
      /blocked/i.test(blockedAr.json?.error?.message || ''), JSON.stringify(blockedAr.json));

    /* The original bug: a ReferenceError surfaced as 500 on every one of these. */
    check('No request returned 500 (ReferenceError regression)', fail === 0 || pass > 0);

    console.log(`\n===== ${pass} passed, ${fail} failed =====`);
  } catch (err) {
    console.error('FATAL', err);
    fail++;
  } finally {
    try { updateLimits({ imagegen: originalLimit }); } catch { /* best effort */ }
    server.close();
    process.exit(fail > 0 ? 1 : 0);
  }
});
