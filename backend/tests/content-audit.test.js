/* Fixture-driven tests for scripts/content-audit.js (offline — no network). */
const { auditContent, looksLikeMojibake } = require('../scripts/content-audit');

let passed = 0;
let failed = 0;
function ok(cond, name, detail) {
  if (cond) { passed++; console.log('  ok   ' + name); }
  else { failed++; console.log('  FAIL ' + name + (detail ? ' — ' + detail : '')); }
}

/* The exact production incident, as measured codepoints: Arabic UTF-8 bytes
   decoded through the wrong codepage. If the detector ever stops catching
   this shape, the audit is decoration. */
const PRODUCTION_BROKEN = [0x256c, 0x00f4, 0x251c, 0x2593, 0x252c, 0x00bc, 0x0393, 0x00f6]
  .map((c) => String.fromCodePoint(c)).join('');

console.log('\n=== detector ===');
ok(looksLikeMojibake(PRODUCTION_BROKEN), 'catches the production corruption shape');
ok(!looksLikeMojibake('الرئيسية'), 'real Arabic passes');
ok(!looksLikeMojibake('© 2026 Noviq Solutions. All rights reserved.'), 'a © line passes (threshold is 3, not 1)');
ok(!looksLikeMojibake(''), 'empty is not corrupt');
ok(!looksLikeMojibake(null), 'null is not corrupt');
ok(!looksLikeMojibake('Pricing plans'), 'plain English passes');

console.log('\n=== auditContent on a fixture CMS ===');
const fixture = {
  pages: {
    home: { labelEn: 'Home', labelAr: 'الرئيسية' },
    about: { labelEn: 'About', labelAr: '' },
    lab: { labelEn: 'Lab', labelAr: 'x', note: 'Closed ' + PRODUCTION_BROKEN + ' retired' },
  },
  projects: [
    { title: 'A', titleAr: '', img: 'images/uploads/a.webp' },
    { title: 'B', titleAr: 'ب', img: '/logo/noviq-icon.webp' },
  ],
};
const r = auditContent(fixture);
ok(r.bad.length === 1 && r.bad[0].at === 'pages.lab.note', 'finds the one mojibake string', JSON.stringify(r.bad.map((b) => b.at)));
ok(r.arPairs === 5, 'counts every EN/AR pair', String(r.arPairs));
ok(Object.keys(r.missingAr).length === 2, 'flags both empty-Arabic locations', JSON.stringify(Object.keys(r.missingAr)));
ok(r.images.length === 2, 'collects image refs', JSON.stringify(r.images));

console.log(failed ? `\n${failed} FAILED (${passed} passed)` : `\nall ${passed} checks passed`);
process.exit(failed ? 1 : 0);
