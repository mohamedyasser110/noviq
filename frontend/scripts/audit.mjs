/* Portable roots (no machine paths): override with NOVIQ_FRONTEND / NOVIQ_BACKEND / NOVIQ_TMP env. */
import { fileURLToPath as __f2p } from 'node:url';
import { dirname as __dn, join as __join } from 'node:path';
import { tmpdir as __tmp } from 'node:os';
const __HERE = __dn(__f2p(import.meta.url));
const PORTABLE_FRONTEND = process.env.NOVIQ_FRONTEND || __join(__HERE, '..');
const PORTABLE_BACKEND = process.env.NOVIQ_BACKEND || __join(__HERE, '..', '..', 'backend');
const PORTABLE_TMP = process.env.NOVIQ_TMP || __join(__tmp(), 'noviq-shots');
/* Automated layout audit on the standalone preview (no server needed).
   Reports horizontal overflow + a few geometry facts at 3 breakpoints.
   Run: node scripts/audit.mjs                                                      */
import { chromium } from 'playwright';

const OUT = PORTABLE_TMP;
const WIDTHS = [390, 768, 1440];
const browser = await chromium.launch();
let fail = 0;

for (const locale of ['en', 'ar']) {
  for (const w of WIDTHS) {
    const page = await browser.newPage({ viewport: { width: w, height: 900 } });
    await page.goto(`file:///${OUT}/${locale}.html`, { waitUntil: 'load' });
    await page.waitForTimeout(500);

    const r = await page.evaluate(() => {
      const de = document.documentElement;
      const clipped = (el) => {
        for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
          const o = getComputedStyle(p);
          if (/hidden|clip|auto|scroll/.test(o.overflowX)) return true;
        }
        return false;
      };
      const over = [];
      for (const el of document.querySelectorAll('body *')) {
        const b = el.getBoundingClientRect();
        if (b.width === 0) continue;
        if (clipped(el)) continue; // hidden by a scroll/clip container (e.g. carousels)
        if (b.right > de.clientWidth + 1.5 || b.left < -1.5) {
          over.push({
            tag: el.tagName.toLowerCase(),
            cls: (el.className || '').toString().slice(0, 70),
            left: Math.round(b.left), right: Math.round(b.right),
          });
        }
      }
      const nav = document.querySelector('.noviq-navbar-container');
      const cta = document.querySelector('.noviq-nav-cta');
      return {
        scrollW: de.scrollWidth, clientW: de.clientWidth,
        navRight: nav ? Math.round(nav.getBoundingClientRect().right) : null,
        ctaVisible: cta ? getComputedStyle(cta).display !== 'none' : false,
        overflowing: over.slice(0, 6), overflowCount: over.length,
      };
    });

    const bad = r.scrollW > r.clientW + 1 || r.overflowCount > 0;
    if (bad) fail++;
    console.log(
      `${locale} @${w}px  scrollW=${r.scrollW} clientW=${r.clientW}  ` +
      `overflowEls=${r.overflowCount}  navRight=${r.navRight}  cta=${r.ctaVisible ? 'shown' : 'hidden'}  ` +
      (bad ? '❌' : '✅'),
    );
    for (const o of r.overflowing) console.log(`    ↳ <${o.tag} class="${o.cls}"> ${o.left}..${o.right}`);
    await page.close();
  }
}
await browser.close();
console.log(fail === 0 ? 'ALL CLEAN' : `PROBLEMS IN ${fail} VIEWPORTS`);
