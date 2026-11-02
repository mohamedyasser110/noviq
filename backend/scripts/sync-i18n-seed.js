/* ============================================================
   NOVIQ — copy the bundled dictionaries into the backend image
   ------------------------------------------------------------
   WHY THIS EXISTS

   routes/_shared.js seeds the `i18n_<locale>` row on first read from
   `<FRONTEND_DIR>/i18n/<locale>.json`. That works in the repo and on
   shared hosting, where the frontend checkout sits next to the backend.

   It does NOT work in the API container. That image is built with
   `context: backend/`, so /app has no sibling `frontend/` directory and
   FRONTEND_DIR points at a path that was never copied. The result is
   silent and total:

     · getDictionary() finds nothing to seed from and returns null
     · GET /api/content/i18n/:locale answers 404 "No dictionary stored"
     · the admin Translations editor loads EMPTY — there is nothing to
       edit, so the feature looks broken rather than unseeded
     · the site keeps serving frontend/i18n/*.json, so an admin edit can
       never be confirmed on the site

   Shipping the two dictionaries inside the backend image fixes the seed
   without changing how the API is built or deployed (the build context
   stays `backend/`, so the Railway setup is untouched).

   This is a COPY, so it can drift. `backend/tests/i18n-seed.test.js`
   asserts byte-equality with frontend/i18n/*.json and fails the suite if
   they diverge, and `npm run sync:i18n-seed` regenerates them.
   ============================================================ */
const fs = require('fs');
const path = require('path');

const FRONTEND_I18N = path.join(__dirname, '..', '..', 'frontend', 'i18n');
const TARGET = path.join(__dirname, '..', 'i18n-seed');
const LOCALES = ['en', 'ar'];

fs.mkdirSync(TARGET, { recursive: true });

let copied = 0;
for (const locale of LOCALES) {
  const src = path.join(FRONTEND_I18N, `${locale}.json`);
  if (!fs.existsSync(src)) {
    console.error(`[sync:i18n-seed] missing ${src}`);
    process.exit(1);
  }
  const raw = fs.readFileSync(src, 'utf8');
  try {
    JSON.parse(raw);
  } catch (err) {
    console.error(`[sync:i18n-seed] ${src} is not valid JSON: ${err.message}`);
    process.exit(1);
  }
  fs.writeFileSync(path.join(TARGET, `${locale}.json`), raw, 'utf8');
  copied++;
  console.log(`[sync:i18n-seed] ${locale}.json  ${(raw.length / 1024).toFixed(1)} KB`);
}
console.log(`[sync:i18n-seed] wrote ${copied} file(s) to backend/i18n-seed`);
