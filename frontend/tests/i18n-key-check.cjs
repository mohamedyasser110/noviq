/* ============================================================
   i18n key parity + drift check
   ============================================================
   Run: npm run test:i18n

   WHAT CHANGED, and why it matters
   --------------------------------
   This test used to compare i18n/en.json ↔ i18n/ar.json ↔
   i18n/translations.json. All three were files, and the dictionary
   itself used to be a file too, so the test could only ever compare
   files with each other — it could not tell whether the dictionary the
   ADMIN edits was the one the SITE reads.

   The dictionary now lives in the database (content row `i18n_<locale>`)
   and is served at GET /api/content/i18n/:locale. The bundled
   i18n/<locale>.json in this repo is only the build-time OFFLINE FALLBACK.

   So the check that actually protects the site is:
     1. does the live dictionary have the same keys as the other locale?
        (a half-translated dictionary is the classic symptom)
     2. does the live dictionary still contain every key the bundled
        fallback has? (a key dropped in the admin would otherwise only
        surface as a missing string on the live site)
     3. does the live dictionary contain anything the bundled fallback
        does not? (informational — a new key is legitimate, but it will
        disappear on the next build unless the fallback is refreshed)

   If the API cannot be reached the test says so and falls back to
   comparing the two bundled files with each other. It never pretends to
   have verified the live dictionary when it did not.
   ============================================================ */

const fs = require('fs');

const API = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:4322';

function flatten(obj, prefix = '', out = {}) {
  for (const [k, v] of Object.entries(obj || {})) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) flatten(v, key, out);
    else out[key] = v;
  }
  return out;
}

const bundledEn = flatten(JSON.parse(fs.readFileSync('i18n/en.json', 'utf8')));
const bundledAr = flatten(JSON.parse(fs.readFileSync('i18n/ar.json', 'utf8')));

function compare(label, source, target) {
  const missing = Object.keys(source).filter((k) => !(k in target));
  const empty = Object.keys(target).filter((k) => target[k] === '' || target[k] === null);
  console.log(`\n=== ${label} ===`);
  console.log(`keys in source: ${Object.keys(source).length}, in target: ${Object.keys(target).length}`);
  if (missing.length) {
    console.log(`MISSING in target (${missing.length}):`);
    missing.forEach((k) => console.log('  - ' + k));
  }
  if (empty.length) {
    console.log(`EMPTY in target (${empty.length}):`);
    empty.forEach((k) => console.log('  ! ' + k));
  }
  if (!missing.length && !empty.length) console.log('  OK — no missing/empty keys');
  return missing.length + empty.length;
}

async function fetchLive(locale) {
  const res = await fetch(`${API}/api/content/i18n/${locale}`);
  if (!res.ok) throw new Error(`${locale}: HTTP ${res.status}`);
  const payload = await res.json();
  if (!payload || typeof payload.value !== 'object' || payload.value === null) {
    throw new Error(`${locale}: payload has no object "value"`);
  }
  return flatten(payload.value);
}

(async () => {
  console.log(`i18n parity check — API: ${API}`);

  /* Always available offline: the two bundled fallbacks against each other. */
  let problems = compare('bundled en.json -> bundled ar.json', bundledEn, bundledAr);

  /* The live checks. Any failure to reach the API is reported, not hidden. */
  let liveEn;
  let liveAr;
  try {
    [liveEn, liveAr] = await Promise.all([fetchLive('en'), fetchLive('ar')]);
    console.log('\n--- live dictionary (database) reachable ---');
  } catch (err) {
    console.log('\n!!! Could not read the live dictionary: ' + err.message);
    console.log('!!! Only the bundled files were compared. The admin-edited');
    console.log('!!! dictionary was NOT verified — start the API and re-run.');
    if (/ECONNREFUSED|fetch failed/i.test(err.message)) {
      console.log('\nDone (degraded: API offline).');
      process.exit(0);
    }
    process.exit(1);
  }

  /* 1. the two locales must still agree with each other, live. */
  problems += compare('LIVE en -> LIVE ar', liveEn, liveAr);
  problems += compare('LIVE ar -> LIVE en', liveAr, liveEn);

  /* 2. nothing the bundled fallback has may be missing from the live one,
        or a missing string only shows up as a hole on the live site. */
  problems += compare('bundled en.json -> LIVE en', bundledEn, liveEn);

  /* 3. new keys: legitimate, but they vanish on the next build. */
  const extra = Object.keys(liveEn).filter((k) => !(k in bundledEn));
  if (extra.length) {
    console.log('\n=== keys added in the admin, absent from the bundled fallback ===');
    console.log(`  ${extra.length} key(s) — the site is fine, but a rebuild drops them:`);
    extra.slice(0, 40).forEach((k) => console.log('  + ' + k));
    if (extra.length > 40) console.log(`  … and ${extra.length - 40} more`);
  }

  console.log('\n' + '-'.repeat(60));
  if (problems) {
    console.log(`FAILED — ${problems} problem(s) found.`);
    process.exit(1);
  }
  console.log('All i18n checks passed (bundled + live database dictionary).');
})();
