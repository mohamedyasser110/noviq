/* Diagnose the visit-analytics surfaces: site monitor (in-memory), the
   persistent visits aggregate, and the admin views built on them.

   Usage: node scripts/diagnose-visits.js <api-origin> */
const API = process.argv[2];
const PW = process.env.ADMIN_PASSWORD || 'NvwrKJDCFxLePD!7';

const j = async (url, opts) => {
  try {
    const r = await fetch(url, opts);
    const t = await r.text();
    let body; try { body = JSON.parse(t); } catch { body = t.slice(0, 120); }
    return { status: r.status, body };
  } catch (e) { return { status: 'ERR', body: e.message }; }
};

(async () => {
  const login = await j(`${API}/api/admin/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: PW }),
  });
  const token = login.body?.token;
  console.log(`login            -> ${login.status}`);
  const auth = { Authorization: `Bearer ${token}` };

  /* 1. Public live traffic. */
  const live = await j(`${API}/api/analytics/live`);
  console.log(`\nGET /api/analytics/live     -> ${live.status}`);
  console.log('  ' + JSON.stringify(live.body).slice(0, 420));

  /* 2. Record a visit, then immediately re-read the monitor. If the
        counter does not move, the monitor is not reading what it writes. */
  const vid = 'probe-' + Date.now().toString(36);
  const rec = await j(`${API}/api/analytics/visit`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: '/en/diagnostic-probe', language: 'en', visitorId: vid }),
  });
  console.log(`\nPOST /api/analytics/visit   -> ${rec.status}`);

  const mon = await j(`${API}/api/admin/site-monitor`, { headers: auth });
  console.log(`\nGET /api/admin/site-monitor -> ${mon.status}`);
  const m = mon.body || {};
  console.log(`  keys: ${Object.keys(m).join(', ')}`);
  console.log(`  online/active: ${JSON.stringify(m.online ?? m.active ?? m.current ?? null)}`);
  console.log(`  totals: ${JSON.stringify(m.totals ?? m.stats ?? null)}`);
  console.log(`  topPages: ${JSON.stringify(m.topPages ?? m.pages ?? null)?.slice(0, 200)}`);
  console.log(`  recent: ${JSON.stringify(m.recent ?? m.events ?? null)?.slice(0, 220)}`);
  const sawProbe = JSON.stringify(m).includes('diagnostic-probe');
  console.log(`\n  probe visit visible in monitor? ${sawProbe ? 'YES' : 'NO  <-- monitor is not reflecting writes'}`);

  /* 3. The persistent aggregate behind Analytics. */
  const stats = await j(`${API}/api/admin/stats`, { headers: auth });
  console.log(`\nGET /api/admin/stats        -> ${stats.status}`);
  console.log('  ' + JSON.stringify(stats.body).slice(0, 300));

  const logs = await j(`${API}/api/admin/logs`, { headers: auth });
  console.log(`\nGET /api/admin/logs         -> ${logs.status}`);
  console.log('  ' + JSON.stringify(logs.body).slice(0, 200));
})();
