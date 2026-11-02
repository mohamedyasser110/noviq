/* ============================================================
   Bundled -> LIVE dictionary sync
   ------------------------------------------------------------
   The dictionary is DATABASE-backed (content.i18n_en / i18n_ar) and
   the site merges the live copy over the bundled one. A key added to
   frontend/i18n/<locale>.json alone therefore never reaches the live
   dictionary, and the parity gate flags it. This copies across ONLY
   the keys that are missing on the live side — it never overwrites a
   value an admin has already customised.

   Run it after adding dictionary keys to the bundled files.
   ============================================================ */
const fs = require('fs');
const API = process.env.API_URL || 'http://127.0.0.1:4322';
const FE = 'C:/Downloads/Noviq - final/frontend/i18n';

const get = (o, p) => p.split('.').reduce((n, k) => (n == null ? n : n[k]), o);

(async () => {
  const login = await (await fetch(API + '/api/admin/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'noviq2026' }),
  })).json();
  const H = { Authorization: 'Bearer ' + login.token, 'Content-Type': 'application/json' };

  let totalAdded = 0;
  for (const locale of ['en', 'ar']) {
    const bundled = JSON.parse(fs.readFileSync(FE + '/' + locale + '.json', 'utf8'));
    const liveRes = await (await fetch(API + '/api/admin/i18n/' + locale, { headers: H })).json();
    const live = liveRes.value;
    if (!live || typeof live !== 'object') { console.log(locale + ': live dictionary unreadable, skipped'); continue; }

    const added = [];
    (function walk(src, prefix) {
      for (const [k, v] of Object.entries(src)) {
        const p = prefix ? prefix + '.' + k : k;
        if (v && typeof v === 'object' && !Array.isArray(v)) { walk(v, p); continue; }
        if (get(live, p) === undefined || get(live, p) === '') added.push([p, v]);
      }
    })(bundled, '');

    if (!added.length) { console.log(locale + ': already in sync (' + Object.keys(live).length + ' top-level groups)'); continue; }
    for (const [p, v] of added) {
      const segs = p.split('.');
      let node = live;
      for (let i = 0; i < segs.length - 1; i += 1) {
        if (typeof node[segs[i]] !== 'object' || node[segs[i]] === null) node[segs[i]] = {};
        node = node[segs[i]];
      }
      node[segs[segs.length - 1]] = v;
    }
    const res = await fetch(API + '/api/admin/i18n/' + locale, { method: 'PUT', headers: H, body: JSON.stringify({ value: live }) });
    totalAdded += added.length;
    console.log(locale + ': added ' + added.length + ' key(s) -> ' + added.map(([p]) => p).join(', ') + '  (PUT ' + res.status + ')');
  }
  console.log(totalAdded ? 'total added: ' + totalAdded : 'nothing to sync');
})();
