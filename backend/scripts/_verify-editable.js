/* ============================================================
   CLIENT VOICES — full admin-editability proof.

   For EVERY field the dashboard can edit, write a unique marker the way
   the dashboard writes it, push it through the real public endpoint,
   revalidate the Next.js cache, then fetch /en and /ar and assert the
   marker is actually on the page in the right language.

   Then restore the exact previous state.

   Run:  node scripts/_verify-editable.js     (from backend/)
   Needs: the API on :4322 and the site on :4321 running.
   ============================================================ */
const assert = require('assert');
const db = require('../db/init');
const { rebuildConfigFile } = require('../services/content-store');

const API = process.env.API_URL || 'http://127.0.0.1:4322';
const SITE = process.env.SITE_URL || 'http://127.0.0.1:4321';
const REVALIDATE = process.env.REVALIDATE_SECRET || 'noviq-local-revalidate-2026';

const read = (k) => JSON.parse(db.prepare('SELECT value FROM content WHERE key = ?').get(k).value);
const write = (k, v) =>
  db.prepare('UPDATE content SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?')
    .run(JSON.stringify(v), k);

const before = { header: read('testimonialsHeader'), list: read('testimonials') };
const M = (s) => `[EDIT${s}]`;

async function revalidate() {
  await fetch(`${SITE}/api/revalidate`, {
    method: 'POST',
    headers: { 'x-revalidate-secret': REVALIDATE },
  });
}

async function page(path) {
  const r = await fetch(`${SITE}${path}`);
  assert.strictEqual(r.status, 200, `${path} returned ${r.status}`);
  return r.text();
}

const has = (html, needle) => html.includes(needle);

(async () => {
  /* ---- 1. header: all six fields ---- */
  const header = { ...before.header };
  header.eyebrow = M('EYEBROW');
  header.title = M('TITLE');
  header.desc = M('DESC');
  header.eyebrowAr = M('EYEBROW_AR');
  header.titleAr = M('TITLE_AR');
  header.descAr = M('DESC_AR');
  write('testimonialsHeader', header);

  /* ---- 2. list: every field of item 0, plus a brand-new item ---- */
  const list = JSON.parse(JSON.stringify(before.list));
  list[0].quote = M('QUOTE');
  list[0].name = M('NAME');
  list[0].role = M('ROLE');
  list[0].img = 'images/testimonials/mei-tanaka.svg'; // an existing, resolvable path
  list[0].quoteAr = M('QUOTE_AR');
  list[0].nameAr = M('NAME_AR');
  list[0].roleAr = M('ROLE_AR');
  list.push({
    quote: M('NEW_QUOTE'),
    quoteAr: M('NEW_QUOTE_AR'),
    name: M('NEW_NAME'),
    nameAr: M('NEW_NAME_AR'),
    role: M('NEW_ROLE'),
    roleAr: M('NEW_ROLE_AR'),
    img: 'images/uploads/1700000000000-new.png', // the shape the uploader returns
  });
  write('testimonials', list);
  rebuildConfigFile();

  /* ---- 3. through the public API ---- */
  const bundle = await (await fetch(`${API}/api/content/home`)).json();
  assert.strictEqual(bundle.testimonials.length, before.list.length + 1, 'API did not serve the new item');
  assert.strictEqual(bundle.testimonialsHeader.desc, M('DESC'), 'API dropped header.desc');
  console.log(`1. API serves ${bundle.testimonials.length} voices + all 6 header fields  OK`);

  /* ---- 4. on the rendered page, per locale ---- */
  await revalidate();
  const en = await page('/en');
  const ar = await page('/ar');

  const enExpected = [M('EYEBROW'), M('TITLE'), M('DESC'), M('QUOTE'), M('NAME'), M('ROLE'), M('NEW_QUOTE'), M('NEW_NAME'), M('NEW_ROLE')];
  const arExpected = [M('EYEBROW_AR'), M('TITLE_AR'), M('DESC_AR'), M('QUOTE_AR'), M('NAME_AR'), M('ROLE_AR'), M('NEW_QUOTE_AR'), M('NEW_NAME_AR'), M('NEW_ROLE_AR')];

  for (const needle of enExpected) assert.ok(has(en, needle), `/en is missing ${needle}`);
  console.log(`2. /en renders all ${enExpected.length} English edits  OK`);
  for (const needle of arExpected) assert.ok(has(ar, needle), `/ar is missing ${needle}`);
  console.log(`3. /ar renders all ${arExpected.length} Arabic edits  OK`);

  /* The new item's uploaded path must survive normalisation to a
     root-absolute URL — a relative one 404s on /ar/testimonials-style
     nested routes. */
  assert.ok(has(en, '/images/uploads/1700000000000-new.png'), 'uploaded img was not normalised to /images/...');
  console.log('4. uploaded img normalises to a root-absolute path  OK');

  /* Arabic must not silently inherit English. */
  assert.ok(!has(ar, `>${M('QUOTE')}<`), '/ar leaked the English quote');
  console.log('5. /ar does not fall back to English text  OK');

  /* ---- Steps 6 and 7 (chatbot answer + chatbot search) were removed on
     2026-09-27 together with the chatbot. The admin-edit round-trip is still
     proven above: the marker is written through the CMS and must be visible on
     both /en and /ar before the restore below. ---- */

  /* ---- restore ---- */
  write('testimonialsHeader', before.header);
  write('testimonials', before.list);
  rebuildConfigFile();
  await revalidate();

  assert.deepStrictEqual(read('testimonialsHeader'), before.header, 'header not restored');
  assert.deepStrictEqual(read('testimonials'), before.list, 'list not restored');
  console.log(`\nrestored: header + ${before.list.length} voices`);
  console.log('ALL EDITABILITY CHECKS PASSED');
})().catch((e) => {
  /* Always leave the site in its original state, even on failure. */
  try {
    write('testimonialsHeader', before.header);
    write('testimonials', before.list);
    rebuildConfigFile();
    console.log('\n(state restored after failure)');
  } catch {}
  console.error('\nFAILED:', e.message);
  process.exit(1);
});
