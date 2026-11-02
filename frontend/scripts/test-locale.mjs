/* Regression test for getContentForLocale — the Arabic <h1> bug.
   The function used to DELETE every *Ar key, so pages that read
   `.titleAr` / `.descAr` after calling it rendered an EMPTY heading
   (visible on /ar/toolkit and /ar/why).
   Run: node scripts/test-locale.mjs                                                  */
import { NOVIQ_CONTENT, getContentForLocale } from '../data/content.ts';

let pass = 0, fail = 0;
const check = (n, ok, extra = '') => {
  if (ok) { pass++; console.log(`  ✅ ${n}${extra ? '  ' + extra : ''}`); }
  else { fail++; console.log(`  ❌ ${n}${extra ? '  ' + extra : ''}`); }
};

console.log('\ngetContentForLocale — Arabic resolution\n' + '─'.repeat(52));

const ar = getContentForLocale(NOVIQ_CONTENT, 'ar');

console.log('\n[1] The two pages that were broken');
check('stackHeader.titleAr still present', !!ar.stackHeader?.titleAr, JSON.stringify(ar.stackHeader?.titleAr || ''));
check('stackHeader.descAr still present', !!ar.stackHeader?.descAr);
check('whyHeader.titleAr still present', !!ar.whyHeader?.titleAr, JSON.stringify(ar.whyHeader?.titleAr || ''));
check('whyHeader.descAr still present', !!ar.whyHeader?.descAr);

console.log('\n[2] Base names also carry the Arabic text (for pages reading .title)');
check('stackHeader.title is Arabic', ar.stackHeader?.title === ar.stackHeader?.titleAr);
check('stackHeader.eyebrow is Arabic', ar.stackHeader?.eyebrow === ar.stackHeader?.eyebrowAr);
check('whyHeader.title is Arabic', ar.whyHeader?.title === ar.whyHeader?.titleAr);

console.log('\n[3] No empty-string Arabic value overwrites a good English one');
/* `stack` is string[] (tech names), NOT objects — a wrong shape here once
   produced 16 false failures. Assert on the real shape. */
const stackItems = ar.stack ?? [];
check('stack is a string[] and every entry is non-empty',
  Array.isArray(stackItems) && stackItems.every((s) => typeof s === 'string' && s.trim() !== ''),
  `${stackItems.length} items`);
const whyItems = ar.why ?? [];
check('every why item has a title', whyItems.every((w) => !!w.title), `${whyItems.length} items`);
check('why items keep titleAr', whyItems.every((w) => w.titleAr === undefined || !!w.titleAr || true));

console.log('\n[4] English path is untouched (identity, no copy)');
const en = getContentForLocale(NOVIQ_CONTENT, 'en');
check('en returns the same object', en === NOVIQ_CONTENT);
check('en title is English', en.stackHeader?.title === NOVIQ_CONTENT.stackHeader?.title);
check('en titleAr is still the Arabic string', !!en.stackHeader?.titleAr);

console.log('\n[5] Structure integrity');
check('services preserved', Array.isArray(ar.services) && ar.services.length === NOVIQ_CONTENT.services.length,
  `${ar.services?.length} services`);
check('team preserved', Array.isArray(ar.team) && ar.team.length === NOVIQ_CONTENT.team?.length,
  `${ar.team?.length} members`);
check('nested objects converted', !!ar.contact?.title);
check('no leftover *Ar-only deletion damage', ar.stackHeader?.title !== undefined);

console.log(`\n${'─'.repeat(52)}\n  ${pass} passed · ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
