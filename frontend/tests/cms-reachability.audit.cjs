/* ============================================================
   CMS REACHABILITY AUDIT  (permanent)
   ------------------------------------------------------------
   Answers, with evidence, the only question that matters about the
   admin dashboard: "if I change this, will the site change?"

   For every content key that has a page it:
     1. writes a unique marker through the REAL admin API
     2. fetches the page(s) that should display it
     3. asserts the marker is present in the rendered HTML
     4. restores the key and re-checks that the marker is gone

   Everything is snapshotted before the first write, and the run fails
   if any marker survives or any touched key drifts from its snapshot.

   Keys with no public page (admin-only tools) are listed explicitly so
   a dead key can never be mistaken for a working one.

   This is server-rendered HTML only. The two client-rendered keys
   (solutionBuilder, costEstimator on /builder) are covered by
   builder-cms-reachability.test.cjs, which drives a real browser.

     BASE_URL=http://localhost:4321 API_URL=http://localhost:4322 \
       node tests/cms-reachability.audit.cjs
   ============================================================ */
const API = process.env.API_URL || 'http://127.0.0.1:4322';
const SITE = process.env.BASE_URL || 'http://127.0.0.1:4321';
const USER = process.env.ADMIN_USER || 'admin';
const PASS = process.env.ADMIN_PASS || 'noviq2026';

const MAP = {
  brand: ['/'], hero: ['/'], servicesHeader: ['/'], services: ['/'],
  industriesHeader: ['/'], industries: ['/'], processHeader: ['/'], process: ['/'],
  testimonialsHeader: ['/'], testimonials: ['/'], clients: ['/'],
  clientsHeader: ['/'], typewriter: ['/'], contact: ['/'],
  whyHeader: ['/why'], why: ['/why'],
  portfolioHeader: ['/portfolio'], projects: ['/portfolio'],
  team: ['/team'], resources: ['/resources'], pricing: ['/pricing'],
  faq: ['/faq'], careers: ['/careers'], about: ['/about'], solutions: ['/solutions'],
  stackHeader: ['/toolkit'], stack: ['/toolkit'],
  solutionBuilder: ['/builder'], costEstimator: ['/builder'],
};
const ADMIN_ONLY = ['promptBuilder', 'assessment', 'aiConsultant', 'nav', 'pages'];

/* Kept in the CMS and still editable, but the band was removed from the
   homepage, so nothing renders it. Listed here so the audit never claims
   this key is visible — a dead key must not read as a working one. */
const NO_PUBLIC_PAGE = ['stats'];

/* Rendered on the CLIENT, so a server-HTML fetch can never see them. Proved by
   builder-cms-reachability.test.cjs, which drives a real browser. */
const CLIENT_RENDERED = new Set(['solutionBuilder', 'costEstimator']);

const PREFERRED = ['title', 'label', 'desc', 'description', 'quote', 'name', 'text', 'body', 'excerpt', 'value', 'answer', 'question'];
const SKIP = new Set(['icon', 'key', 'id', 'suffix', 'to', 'img', 'image', 'photo', 'link', 'url', 'email']);

const MARK = (k) => 'ZZMARK' + k.toUpperCase() + 'ZZ';

function markLeaf(node, marker) {
  if (typeof node === 'string') return { ok: true };
  if (Array.isArray(node)) {
    for (const want of [true, false]) {
      for (let i = 0; i < node.length; i++) {
        if (typeof node[i] === 'string') {
          if ((PREFERRED.includes(node[i].toLowerCase()) || node[i].length < 3) !== want) continue;
          node[i] = marker; return { ok: true, at: '[' + i + ']' };
        }
        if (node[i] && typeof node[i] === 'object') {
          if (typeof node[i].en === 'string') {
            const b = String(node[i].en).toLowerCase();
            if ((PREFERRED.includes(b) && want) || (!PREFERRED.includes(b) && !SKIP.has(b) && want === false)) {
              node[i].en = marker; return { ok: true, at: '[' + i + '].en' };
            }
          }
          const r = markLeaf(node[i], marker);
          if (r.ok) return { ok: true, at: '[' + i + ']' + (r.at || '') };
        }
      }
    }
    return { ok: false };
  }
  if (node && typeof node === 'object') {
    const entries = Object.entries(node);
    for (const want of [true, false]) {
      for (const [k, v] of entries) {
        if (typeof v === 'string') {
          if ((PREFERRED.includes(k.toLowerCase()) && want) || (!PREFERRED.includes(k) && !SKIP.has(k.toLowerCase()) && want === false)) {
            node[k] = marker; return { ok: true, at: k };
          }
        }
        if (v && typeof v === 'object') {
          if (typeof v.en === 'string') {
            const b = String(v.en).toLowerCase();
            if ((PREFERRED.includes(b) && want) || (!PREFERRED.includes(b) && !SKIP.has(b) && want === false)) {
              v.en = marker; return { ok: true, at: k + '.en' };
            }
          }
          const r = markLeaf(v, marker);
          if (r.ok) return { ok: true, at: k + (r.at || '') };
        }
      }
    }
  }
  return { ok: false };
}

(async () => {
  const login = await (
    await fetch(API + '/api/admin/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: USER, password: PASS }),
    })
  ).json();
  const H = { Authorization: 'Bearer ' + login.token, 'Content-Type': 'application/json' };
  const snapshot = await (await fetch(API + '/api/admin/content', { headers: H })).json();

  const touched = [];
  const results = [];
  let pass = 0, fail = 0;

  for (const [key, pages] of Object.entries(MAP)) {
    if (!(key in snapshot)) { results.push([key, 'SKIP', 'not in the database']); continue; }
    /* Still written and restored (so the DB round-trip is proven), but the
       visibility assertion is delegated to the browser test. */
    const deferred = CLIENT_RENDERED.has(key);
    const draft = JSON.parse(JSON.stringify(snapshot[key]));
    const leaf = markLeaf(draft, MARK(key));
    if (!leaf.ok) { results.push([key, 'SKIP', 'no displayable text field']); continue; }
    const put = await fetch(API + '/api/admin/content/' + key, { method: 'PUT', headers: H, body: JSON.stringify({ value: draft }) });
    if (!put.ok) { const b = await put.json(); results.push([key, 'FAIL', 'API rejected: ' + (b.error && b.error.message)]); fail++; continue; }
    touched.push(key);
    if (deferred) { results.push([key, 'BROWSER', 'client-rendered — asserted by builder-cms-reachability.test.cjs']); continue; }
    await new Promise((r) => setTimeout(r, 2200));
    let seen = false, where = '';
    for (const p of pages) {
      const html = await (await fetch(SITE + p)).text();
      if (html.includes(MARK(key))) { seen = true; where = p; break; }
    }
    if (seen) { pass++; results.push([key, 'PASS', 'on ' + where + ' (' + leaf.at + ')']); }
    else { fail++; results.push([key, 'FAIL', 'absent from ' + pages.join(',') + ' (' + leaf.at + ')']); }
  }

  for (const key of touched) {
    await fetch(API + '/api/admin/content/' + key, { method: 'PUT', headers: H, body: JSON.stringify({ value: snapshot[key] }) });
  }
  await new Promise((r) => setTimeout(r, 2500));

  const leftovers = [];
  for (const p of [...new Set(Object.values(MAP).flat())]) {
    const html = await (await fetch(SITE + p)).text();
    const m = html.match(/ZZMARK[A-Z_]+ZZ/g);
    if (m) leftovers.push(p + '->' + [...new Set(m)].join(','));
  }
  const after = await (await fetch(API + '/api/admin/content', { headers: H })).json();
  const drift = touched.filter((k) => JSON.stringify(after[k]) !== JSON.stringify(snapshot[k]));

  console.log('key'.padEnd(20) + 'result'.padEnd(8) + 'detail');
  console.log('-'.repeat(94));
  for (const [k, r, d] of results) console.log(k.padEnd(20) + r.padEnd(8) + d);
  console.log('\nno public page (admin-only by design): ' + ADMIN_ONLY.join(', '));
  console.log('no public page (section removed, key still editable): ' + NO_PUBLIC_PAGE.join(', '));
  console.log('client-rendered (see builder-cms-reachability.test.cjs): ' + [...CLIENT_RENDERED].join(', '));
  console.log('\nrestoration: markers left=' + (leftovers.length ? leftovers.join('|') : 'none') + '  drift=' + (drift.length ? drift.join(',') : 'none'));
  console.log(pass + ' passed, ' + fail + ' failed');
  process.exit(fail === 0 && !leftovers.length && !drift.length ? 0 : 1);
})();
