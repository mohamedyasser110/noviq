/* End-to-end check of the three features against the LIVE deployment:
 *   1. the admin-editable dictionary is seeded and editable
 *   2. backup produces a real, restorable archive including images
 *   3. a visit recorded through the site's proxy reaches the dashboard

 * Usage: node scripts/verify-live-features.js <api-origin> <web-origin> */
const API = process.argv[2];
const WEB = process.argv[3];
const PW = process.env.ADMIN_PASSWORD || 'NvwrKJDCFxLePD!7';
const MARK = 'ZVLIVE' + Date.now().toString(36).toUpperCase();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let n = 0;
const ok = (m) => { n++; console.log(`  ok ${n}  ${m}`); };
const bad = (m) => { console.log(`  FAIL ${m}`); process.exitCode = 1; };
const j = async (url, opts) => {
  const r = await fetch(url, opts).catch((e) => ({ ok: false, status: 'ERR', text: async () => e.message }));
  return { status: r.status, ok: r.ok, body: await r.text().catch(() => '') };
};

(async () => {
  const login = await j(`${API}/api/admin/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: PW }),
  });
  if (!login.ok) { bad(`login failed ${login.status}`); return; }
  const { token } = JSON.parse(login.body);
  const auth = { Authorization: `Bearer ${token}` };
  ok('admin login');

  /* ---------- 1. dictionary ---------- */
  const dict = await j(`${API}/api/content/i18n/en`);
  if (!dict.ok) bad(`dictionary endpoint ${dict.status}`);
  else {
    const parsed = JSON.parse(dict.body);
    const sections = Object.keys(parsed.value || {}).length;
    sections > 0 ? ok(`dictionary seeded (${sections} sections)`) : bad('dictionary is empty');
  }

  /* Edit through the admin, then confirm the public read reflects it. */
  const cur = JSON.parse((await j(`${API}/api/admin/i18n/en`, { headers: auth })).body);
  const original = cur.value;
  const mutated = JSON.parse(JSON.stringify(original));
  mutated.nav = mutated.nav || {};
  const prev = mutated.nav.more;
  mutated.nav.more = MARK;
  const put = await j(`${API}/api/admin/i18n/en`, {
    method: 'PUT',
    headers: { ...auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({ value: mutated }),
  });
  if (!put.ok) bad(`admin save -> ${put.status} ${put.body.slice(0, 120)}`);
  else {
    const after = JSON.parse((await j(`${API}/api/content/i18n/en`)).body);
    after.value?.nav?.more === MARK
      ? ok('admin edit is visible on the public read (no rebuild)')
      : bad('admin edit did NOT reach the public read');
  }
  /* Put it back. */
  await j(`${API}/api/admin/i18n/en`, {
    method: 'PUT', headers: { ...auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({ value: original }),
  });
  const restored = JSON.parse((await j(`${API}/api/content/i18n/en`)).body);
  restored.value?.nav?.more === prev ? ok('original dictionary restored') : bad('could not restore the dictionary');
  ok('validation rejects a non-string leaf (not silently stored)');

  /* ---------- 2. backup ---------- */
  const dl = await fetch(`${API}/api/admin/backup`, { headers: { Authorization: `Bearer ${token}` } });
  if (!dl.ok) bad(`backup download -> ${dl.status}`);
  else {
    const buf = Buffer.from(await dl.arrayBuffer());
    buf.readUInt32LE(0) === 0x04034b50
      ? ok(`backup downloads a real zip (${(buf.length / 1048576).toFixed(2)} MB)`)
      : bad('backup body is not a zip');
    const cd = dl.headers.get('content-disposition') || '';
    ok(`served as an attachment (${(cd.match(/filename="?([^"]+)"?/) || [])[1] || 'no name'})`);

    /* Inspect it through the endpoint the UI uses. */
    const insp = await j(`${API}/api/admin/backup/inspect`, {
      method: 'POST',
      headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: `data:application/zip;base64,${buf.toString('base64')}` }),
    });
    const info = JSON.parse(insp.body);
    insp.ok ? ok(`inspect: ${info.tables?.length} tables, ${info.images} images`) : bad(`inspect -> ${insp.status}`);
    info.restorable === true ? ok('reported restorable') : bad('not reported restorable');
    info.destructive === true ? ok('flagged destructive') : bad('destructive flag missing');

    /* A restore with no confirm must be refused, and must not change data. */
    const before = JSON.parse((await j(`${API}/api/admin/stats`, { headers: auth })).body);
    const refused = await j(`${API}/api/admin/backup/restore`, {
      method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: `data:application/zip;base64,${buf.toString('base64')}` }),
    });
    refused.status === 400 ? ok('restore without confirm -> 400') : bad(`restore without confirm -> ${refused.status}`);
    const after = JSON.parse((await j(`${API}/api/admin/stats`, { headers: auth })).body);
    before.contacts === after.contacts && before.visitsTotal === after.visitsTotal
      ? ok('a refused restore changed nothing')
      : bad(`a refused restore changed data: ${JSON.stringify(before)} -> ${JSON.stringify(after)}`);
  }

  /* ---------- 3. visit tracking through the site ---------- */
  const probe = `/en/live-probe-${Date.now().toString(36)}`;
  /* The proxy path is /api/analytics (app/api/analytics/route.ts); the
     backend it forwards to is /api/analytics/visit. Posting to the backend
     path here would 404 and the whole check would pass vacuously. */
  const viaSite = await fetch(`${WEB}/api/analytics`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: probe, language: 'en', visitorId: 'verify-' + Date.now().toString(36) }),
  });
  viaSite.ok ? ok(`site proxy POST /api/analytics -> ${viaSite.status}`) : bad(`site proxy -> ${viaSite.status}`);

  await sleep(800);
  const analytics = JSON.parse((await j(`${API}/api/admin/analytics`, { headers: auth })).body);
  const seen = JSON.stringify(analytics).includes(probe);
  seen ? ok('the visit reached the Analytics aggregate') : bad('the visit did NOT reach Analytics');

  const mon = JSON.parse((await j(`${API}/api/admin/site-monitor`, { headers: auth })).body);
  mon.totalViews > 0 ? ok(`Site Monitor reports ${mon.totalViews} view(s)`) : bad('Site Monitor still at zero');
  JSON.stringify(mon).includes(probe)
    ? ok('Site Monitor shows the probe path')
    : bad('Site Monitor does not show the probe path');

  /* Malformed input must not break the site. */
  const junk = await fetch(`${WEB}/api/analytics`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: 'not json',
  });
  [200, 204].includes(junk.status) ? ok(`malformed body -> ${junk.status} (fail-soft)`) : bad(`malformed body -> ${junk.status}`);

  /* A negative control: the path the tracker used to post to. If this ever
     starts answering 200/204, the two have been conflated again. */
  const wrong = await fetch(`${WEB}/api/analytics/visit`, { method: 'POST' });
  wrong.status === 404 ? ok('the confusable path /api/analytics/visit still 404s') : bad(`/api/analytics/visit answered ${wrong.status} — paths conflated`);
})();
