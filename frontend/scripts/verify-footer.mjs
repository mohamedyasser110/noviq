/* Verifies the site footer actually renders its link columns.

   This exists because of a real bug: COMPANY_HREFS / SERVICES_HREFS entries
   already start with "/", and the lookup built `/${href}` -> "//about", which
   matched nothing. Both columns rendered their heading and an EMPTY list —
   visible only by reading the markup, since the headings still looked fine.

   Asserts every column has a link for every href it is supposed to show, in
   both locales, and that the links are locale-prefixed.

   Run: node scripts/verify-footer.mjs                                               */
import { readFileSync } from 'node:fs';

const SRC = 'C:/Downloads/Noviq - final/frontend/.next/server/app';

/* Column heading -> the hrefs it must contain. Keyed by every label the
   footer can render, so the Arabic page is asserted rather than skipped. */
const EXPECTED = {
  Company: ['/about', '/careers', '/contact', '/why'],
  Services: ['/services', '/solutions', '/industries', '/portfolio'],
  'الشركة': ['/about', '/careers', '/contact', '/why'],
  'الخدمات': ['/services', '/solutions', '/industries', '/portfolio'],
};

let pass = 0, fail = 0;
const check = (n, ok, extra = '') => {
  if (ok) { pass++; console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${n}${extra ? '  ' + extra : ''}`); }
  else { fail++; console.log(`  FAIL  ${n}${extra ? '  ' + extra : ''}`); }
};

for (const loc of ['en', 'ar']) {
  console.log(`\n[${loc}] footer`);
  const file = `${SRC}/${loc}.html`;
  let html;
  try { html = readFileSync(file, 'utf8'); }
  catch { console.log(`  FAIL  ${loc}.html not built — run the build first`); fail++; continue; }

  /* The first <footer> in the document belongs to a testimonial card, so
     anchor on the real footer's root class instead. */
  const anchor = html.indexOf('noviq-footer');
  if (anchor === -1) { console.log('  FAIL  site footer not found in prerendered HTML'); fail++; continue; }
  const foot = html
    .slice(html.lastIndexOf('<footer', anchor), html.indexOf('</footer>', anchor) + 9)
    .replace(/<script[\s\S]*?<\/script>/g, '');

  check('newsletter form present', /type="email"/.test(foot));
  check('copyright present', /©/.test(foot));

  const navs = foot.split('<nav').slice(1);
  check('two nav columns rendered', navs.length === 2, `${navs.length} columns`);

  for (const chunk of navs) {
    const heading = (chunk.match(/<h3[^>]*>([\s\S]*?)<\/h3>/) || [, ''])[1].replace(/<[^>]+>/g, '').trim();
    const hrefs = [...chunk.matchAll(/<a[^>]*href="([^"]*)"/g)].map((m) => m[1]);
    const want = EXPECTED[heading];
    if (!want) { console.log(`     · unexpected column "${heading}" (${hrefs.length} links)`); continue; }
    check(`"${heading}" column has all ${want.length} links`, hrefs.length === want.length,
      `got ${hrefs.length}: ${hrefs.join(', ')}`);

    for (const w of want) {
      const full = `/${loc}${w}`;
      check(`  ${heading} -> ${w}`, hrefs.includes(full), hrefs.includes(full) ? '' : `missing ${full}`);
    }
  }
}

console.log(`\n--------------\n  ${pass} passed / ${fail} failed\n--------------\n`);
process.exit(fail === 0 ? 0 : 1);
