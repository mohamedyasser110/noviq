/* Portable roots (no machine paths): override with NOVIQ_FRONTEND / NOVIQ_BACKEND / NOVIQ_TMP env. */
import { fileURLToPath as __f2p } from 'node:url';
import { dirname as __dn, join as __join } from 'node:path';
import { tmpdir as __tmp } from 'node:os';
const __HERE = __dn(__f2p(import.meta.url));
const PORTABLE_FRONTEND = process.env.NOVIQ_FRONTEND || __join(__HERE, '..');
const PORTABLE_BACKEND = process.env.NOVIQ_BACKEND || __join(__HERE, '..', '..', 'backend');
const PORTABLE_TMP = process.env.NOVIQ_TMP || __join(__tmp(), 'noviq-shots');
/* Verify the /team page renders ADMIN DASHBOARD content (not the old
   hardcoded departments) in the prerendered HTML for both locales.
   The page fetches at build time, so a successful run also proves the
   API -> page wiring works.
   Run: node scripts/verify-team.mjs                                                 */
import { readFileSync, existsSync } from 'node:fs';

const NEXT = PORTABLE_FRONTEND + '/.next/server/app';
let pass = 0, fail = 0;
const check = (n, ok, extra = '') => {
  if (ok) { pass++; console.log(`  ✅ ${n}${extra ? '  ' + extra : ''}`); }
  else { fail++; console.log(`  ❌ ${n}${extra ? '  ' + extra : ''}`); }
};

const EXPECT = {
  en: { names: ['sama usama', 'Sara Mahmoud', 'Omar Khaled'], old: 'Digital Transformation Consultants' },
  ar: { names: ['سما اسامه', 'سارة محمود', 'عمر خالد'], old: 'استشاريو تحول رقمي' },
};

for (const locale of ['en', 'ar']) {
  const file = `${NEXT}/${locale}/team.html`;
  console.log(`\n[${locale}] .next/server/app/${locale}/team.html`);
  if (!existsSync(file)) { check('prerendered file exists', false, file); continue; }
  check('prerendered file exists', true);

  const html = readFileSync(file, 'utf8');
  const exp = EXPECT[locale];

  for (const n of exp.names) check(`member "${n}"`, html.includes(n));

  check('NOT the old hardcoded departments', !html.includes(exp.old));
  check('CMS hero title present',
    locale === 'en' ? html.includes('Meet the Minds Behind Noviq') : html.includes('تعرف على عقول نوفيك'));
  check('uploaded photo referenced', /images\/uploads\/[^"]+\.(png|jpg|webp)/.test(html),
    (html.match(/images\/uploads\/[^"]+\.(?:png|jpg|webp)/) || ['none'])[0]);
  check('CV link present', html.includes('View CV') || html.includes('السيرة الذاتية'));
  check('portfolio/social chips', html.includes('noviq-chip'));
  check('eyebrow rendered gold (Qodix layer)', html.includes('class="eyebrow"'));
  check('no leaked "undefined"', !/>\s*undefined\s*</.test(html));
  check('no "[object Object]"', !html.includes('[object Object]'));
}

console.log(`\n──────────────\n  ${pass} passed · ${fail} failed\n──────────────\n`);
process.exit(fail === 0 ? 0 : 1);
