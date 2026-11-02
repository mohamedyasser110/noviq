/* ============================================================
   NOVIQ — i18n seed drift guard
   ------------------------------------------------------------
   The API container is built with `context: backend/`, so it cannot read
   frontend/i18n/*.json. It therefore carries a copy in backend/i18n-seed/
   that routes/_shared.js falls back to when seeding the `i18n_<locale>`
   row for the admin Translations editor.

   Two copies of the same dictionary WILL drift. When they do, the admin
   opens the editor showing strings the site is not serving — which reads
   as "the translations editor is broken" rather than "the seed is stale".

   So this asserts byte-equality with the frontend source of truth and
   fails loudly. Regenerate with `npm run sync:i18n-seed`.

   Runs as part of `npm test` (tests/run-all.js) and standalone.
   ============================================================ */
const fs = require('fs');
const path = require('path');

const LOCALES = ['en', 'ar'];
const FRONTEND_I18N = path.join(__dirname, '..', '..', 'frontend', 'i18n');
const SEED_DIR = path.join(__dirname, '..', 'i18n-seed');

let failed = 0;
function check(label, ok, detail) {
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${label}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
}

for (const locale of LOCALES) {
  const src = path.join(FRONTEND_I18N, `${locale}.json`);
  const seed = path.join(SEED_DIR, `${locale}.json`);

  if (!fs.existsSync(src)) {
    check(`${locale}: frontend source exists`, false, src);
    continue;
  }
  if (!fs.existsSync(seed)) {
    check(`${locale}: seed copy exists`, false, `run: npm run sync:i18n-seed`);
    continue;
  }

  const srcRaw = fs.readFileSync(src, 'utf8');
  const seedRaw = fs.readFileSync(seed, 'utf8');

  check(`${locale}: seed matches frontend byte-for-byte`, srcRaw === seedRaw,
    srcRaw === seedRaw ? '' : 'run: npm run sync:i18n-seed');

  /* Also confirm the seed is a dictionary the API would accept: an object
     of sections, not an array or a scalar. */
  let parsed = null;
  let shapeOk = false;
  try {
    parsed = JSON.parse(seedRaw);
    shapeOk = !!parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      && Object.keys(parsed).length > 0;
  } catch { shapeOk = false; }
  check(`${locale}: seed is a non-empty dictionary object`, shapeOk);

  /* The validator in routes/_shared.js caps sections at 40 and depth at 6.
     A seed that violates its own rules could never be saved back. */
  if (shapeOk) {
    const sections = Object.keys(parsed);
    let maxDepth = 0;
    const depth = (node, d) => {
      maxDepth = Math.max(maxDepth, d);
      for (const v of Object.values(node)) if (v && typeof v === 'object') depth(v, d + 1);
    };
    depth(parsed, 1);
    check(`${locale}: within validator limits`, sections.length <= 40 && maxDepth <= 6,
      `${sections.length} sections, depth ${maxDepth}`);
  }
}

console.log(failed ? `\n${failed} i18n seed check(s) FAILED` : '\nall i18n seed checks passed');
process.exit(failed ? 1 : 0);
