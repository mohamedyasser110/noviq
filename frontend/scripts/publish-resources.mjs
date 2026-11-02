/* Portable roots (no machine paths): override with NOVIQ_FRONTEND / NOVIQ_BACKEND / NOVIQ_TMP env. */
import { fileURLToPath as __f2p } from 'node:url';
import { dirname as __dn, join as __join } from 'node:path';
import { tmpdir as __tmp } from 'node:os';
const __HERE = __dn(__f2p(import.meta.url));
const PORTABLE_FRONTEND = process.env.NOVIQ_FRONTEND || __join(__HERE, '..');
const PORTABLE_BACKEND = process.env.NOVIQ_BACKEND || __join(__HERE, '..', '..', 'backend');
const PORTABLE_TMP = process.env.NOVIQ_TMP || __join(__tmp(), 'noviq-shots');
/* Validate the resources seed against the REAL backend validator, then push
   it into the running CMS through the admin API — the same path a human uses
   in the dashboard. Proves the schema round-trips and that the admin editor
   can actually save this document.

   Run: node scripts/publish-resources.mjs                                          */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ROOT = PORTABLE_BACKEND;
const { validateResources } = require(`${ROOT}/routes/_shared.js`);

/* 1. Pull the resources document straight out of the seed file. */
const seedSrc = readFileSync(`${ROOT}/db/init.js`, 'utf8');
const anchor = seedSrc.indexOf('resources: JSON.stringify(');
if (anchor === -1) { console.error('resources seed not found'); process.exit(1); }
const start = seedSrc.indexOf('{', anchor);
/* balance braces from the opening brace to find the end of the literal */
let depth = 0, end = -1;
for (let i = start; i < seedSrc.length; i++) {
  const ch = seedSrc[i];
  if (ch === '{') depth++;
  else if (ch === '}') { depth--; if (depth === 0) { end = i; break; } }
}
const literal = seedSrc.slice(start, end + 1);
/* The seed is a JS object literal (unquoted keys), not JSON, so it cannot
   be JSON.parse'd. Evaluating it is safe here: the text comes from this
   repository's own db/init.js, and it is the exact document the admin
   editor will be asked to accept. */
const doc = new Function(`"use strict"; return (${literal});`)();
console.log(`seed: ${doc.tabs.length} tabs, ` +
  `${Object.values(doc.items).reduce((n, a) => n + a.length, 0)} items`);

/* 2. Run the production validator. */
const res = validateResources(doc);
if (res.error) { console.error('VALIDATOR REJECTED:', res.error); process.exit(1); }
console.log('validateResources: OK');

/* 3. Every item must have a title in at least one language. */
let bad = 0;
for (const [tab, items] of Object.entries(res.value.items)) {
  for (const it of items) {
    if (!it.title.en.trim() && !it.title.ar.trim()) { console.error('no title:', tab, it.id); bad++; }
  }
}
if (bad) process.exit(1);

/* 4. Push it into the live CMS through the admin API. */
const BASE = process.env.API_URL || 'http://127.0.0.1:4322';
const USER = process.env.ADMIN_USER || 'admin';
const PASS = process.env.ADMIN_PASS || 'noviq2026';

const login = await fetch(`${BASE}/api/admin/login`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ username: USER, password: PASS }),
});
if (!login.ok) { console.error('login failed', login.status, await login.text()); process.exit(1); }
const { token } = await login.json();
console.log('admin login: OK as', USER);

const put = await fetch(`${BASE}/api/admin/content/resources`, {
  method: 'PUT',
  headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
  /* The admin endpoint takes { value: <document> }, not the bare document. */
  body: JSON.stringify({ value: res.value }),
});
if (!put.ok) { console.error('save failed', put.status, await put.text()); process.exit(1); }
console.log('admin saved content/resources: OK');

/* 5. Read it back through the PUBLIC endpoint the page will use. */
const pub = await fetch(`${BASE}/api/content/resources`);
if (!pub.ok) { console.error('public read failed', pub.status, await pub.text()); process.exit(1); }
const back = await pub.json();
const tabs = Object.entries(back.items || {}).map(([k, v]) => `${k}:${v.length}`).join(' ');
console.log('GET /api/content/resources: OK', '|', tabs);

let pass = 0, fail = 0;
const check = (n, ok, extra = '') => { if (ok) { pass++; console.log(`  PASS  ${n}`); } else { fail++; console.log(`  FAIL  ${n}  ${extra}`); } };
console.log('');
check('seed validates against the production validator', true);
check('admin can save the document', true);
check('public endpoint returns the same tabs', (back.tabs || []).length === doc.tabs.length);
check('public endpoint returns the items', JSON.stringify(back.items).length > 100);
check('all four tabs have items', Object.values(back.items || {}).every((a) => Array.isArray(a) && a.length > 0));
console.log(`\n${pass} passed / ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
