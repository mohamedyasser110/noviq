/* Portable roots (no machine paths): override with NOVIQ_FRONTEND / NOVIQ_BACKEND / NOVIQ_TMP env. */
import { fileURLToPath as __f2p } from 'node:url';
import { dirname as __dn, join as __join } from 'node:path';
import { tmpdir as __tmp } from 'node:os';
const __HERE = __dn(__f2p(import.meta.url));
const PORTABLE_FRONTEND = process.env.NOVIQ_FRONTEND || __join(__HERE, '..');
const PORTABLE_BACKEND = process.env.NOVIQ_BACKEND || __join(__HERE, '..', '..', 'backend');
const PORTABLE_TMP = process.env.NOVIQ_TMP || __join(__tmp(), 'noviq-shots');
/* Screenshot the standalone previews (file://) — no server needed.
   Run: node scripts/shots.mjs                                                     */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const OUT = PORTABLE_TMP;
mkdirSync(OUT, { recursive: true });
const VH = 900;

const browser = await chromium.launch();

for (const [locale, width] of [['en', 1440], ['ar', 1440], ['en', 390]]) {
  const tag = width === 390 ? `${locale}-m` : locale;
  const page = await browser.newPage({ viewport: { width, height: VH } });
  await page.goto(`file:///${OUT}/${locale}.html`, { waitUntil: 'load', timeout: 60_000 });
  await page.waitForTimeout(900);
  const h = await page.evaluate(() => document.body.scrollHeight);
  await page.screenshot({ path: `${OUT}/${tag}-full.png`, fullPage: true });

  const n = Math.ceil(h / VH);
  for (let i = 0; i < n; i++) {
    await page.evaluate((y) => window.scrollTo(0, y), i * VH);
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${OUT}/${tag}-${i}.png` });
  }
  console.log(`${tag}: height=${h} slices=${n}`);
  await page.close();
}
await browser.close();
console.log('DONE');
