/* Throwaway verification for the CLIENT VOICES admin round-trip.
   Exercises the SAME code path the dashboard uses:
     PUT /admin/content/:key/array   ->  arr.push(item) + rebuildConfigFile()
     GET  /api/content/home          ->  getPublicContent().testimonials
   Run:  node scripts/_verify-voices.js          (from backend/)            */

const assert = require('assert');
const db = require('../db/init');
const { getPublicContent } = require('../routes/_shared');
const { rebuildConfigFile } = require('../services/content-store');

const key = 'testimonials';
const read = () => JSON.parse(db.prepare('SELECT value FROM content WHERE key = ?').get(key).value);
const before = read();

console.log('1. idempotency — re-running the migration changed nothing');
require('../db/init');
const after = require('../db/init');
const afterList = JSON.parse(after.prepare('SELECT value FROM content WHERE key = ?').get(key).value);
assert.strictEqual(afterList.length, before.length, 'migration re-ran and changed the list length');
console.log(`   OK — still ${afterList.length} voices, no duplicates appended`);

console.log('\n2. every seeded voice is renderable');
for (const t of afterList) {
  assert.ok(t.quote && t.name && t.role, `incomplete record: ${JSON.stringify(t)}`);
  assert.ok('img' in t, `missing img key on "${t.name}" (admin upload widget needs it)`);
}
console.log(`   OK — ${afterList.length} voices, all with quote/name/role + an img key`);

console.log('\n3. admin "Add Item" — the exact push the dashboard performs');
const newVoice = {
  quote: 'Verification voice: added through the admin array endpoint.',
  quoteAr: 'صوت تحقق: أُضيف عبر نقطة نهاية مصفوفة الأدمن.',
  name: 'Round Trip Test',
  nameAr: 'اختبار الذهاب والإياب',
  role: 'QA, Noviq',
  roleAr: 'ضمان الجودة، نوفيك',
  img: 'images/uploads/1700000000000-round-trip.png',
};
const arr = read();
arr.push(newVoice);
db.prepare('UPDATE content SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?')
  .run(JSON.stringify(arr), key);
const sync = rebuildConfigFile();
console.log(`   file sync: written=${sync.fileWritten} keys=${sync.keys}`);

console.log('\n4. it reaches GET /api/content/home');
const served = getPublicContent().testimonials;
const found = served.find((t) => t.name === 'Round Trip Test');
assert.ok(found, 'new voice did NOT appear in the public bundle');
assert.strictEqual(found.quote, newVoice.quote);
assert.strictEqual(found.img, newVoice.img, 'the photo path must survive untouched');
console.log(`   OK — ${served.length} voices served, new one found with img="${found.img}"`);

console.log('\n5. cleanup — restore the seeded list');
db.prepare('UPDATE content SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?')
  .run(JSON.stringify(before), key);
rebuildConfigFile();
assert.strictEqual(read().length, before.length, 'cleanup failed');
console.log(`   OK — back to ${before.length} voices`);
console.log('\nALL CHECKS PASSED');
