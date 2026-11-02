/* Push the local `brand` record to a live deployment so the footer
   social icons have something to render.

   The Footer hides WhatsApp / Facebook / Instagram when the CMS brand
   record has no value for them, which is why a freshly seeded volume
   shows only the email icon. This copies the real values across.

   Usage: node scripts/push-brand.js <api-origin> [source.db] */
const path = require('path');
const Database = require('better-sqlite3');

const API = process.argv[2];
const PW = process.env.ADMIN_PASSWORD || 'NvwrKJDCFxLePD!7';
const SRC = process.argv[3] || path.join(__dirname, '..', 'data', 'noviq.db');

if (!API) {
  console.error('usage: node scripts/push-brand.js <api-origin> [source.db]');
  process.exit(1);
}

const SOCIAL = ['email', 'whatsapp', 'facebook', 'instagram'];

const db = new Database(SRC, { readonly: true });
const row = db.prepare("SELECT value FROM content WHERE key = 'brand'").get();
db.close();

if (!row) { console.error('no `brand` record in ' + SRC); process.exit(1); }
const local = JSON.parse(row.value);

const patch = {};
for (const k of SOCIAL) {
  if (local[k]) patch[k] = local[k];
}
if (!Object.keys(patch).length) { console.error('local brand has no social fields'); process.exit(1); }

(async () => {
  const login = await fetch(`${API}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: PW }),
  });
  if (!login.ok) { console.error('login failed', login.status); process.exit(1); }
  const { token } = await login.json();
  console.log('logged in');

  /* Read what is live and MERGE. The endpoint replaces the whole record
     rather than patching, so sending only the social fields would blank
     out tagline / phone / locations that are already correct there. */
  const current = await (await fetch(`${API}/api/content/brand`)).json();
  const merged = { ...current, ...patch };
  console.log('merging into the existing brand record:');
  for (const k of SOCIAL) {
    console.log(`  ${k.padEnd(10)} ${JSON.stringify(current[k])} -> ${JSON.stringify(merged[k])}`);
  }

  const put = await fetch(`${API}/api/admin/content/brand`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ value: merged }),
  });
  const body = await put.text();
  console.log(`\nPUT /api/admin/content/brand -> ${put.status}`);
  if (!put.ok) { console.error(body.slice(0, 300)); process.exit(1); }

  /* Verify through the PUBLIC endpoint the footer actually reads. */
  await new Promise((r) => setTimeout(r, 1500));
  const pub = await fetch(`${API}/api/content/brand`);
  const now = await pub.json();
  console.log('\npublic /api/content/brand now:');
  for (const k of SOCIAL) console.log(`  ${k.padEnd(10)} = ${JSON.stringify(now[k])}`);
  const missing = SOCIAL.filter((k) => !now[k]);
  if (missing.length) { console.error('\nSTILL MISSING: ' + missing.join(', ')); process.exit(1); }
  console.log('\nall social fields present');
})();
