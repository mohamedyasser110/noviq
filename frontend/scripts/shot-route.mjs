/* Portable roots (no machine paths): override with NOVIQ_FRONTEND / NOVIQ_BACKEND / NOVIQ_TMP env. */
import { fileURLToPath as __f2p } from 'node:url';
import { dirname as __dn, join as __join } from 'node:path';
import { tmpdir as __tmp } from 'node:os';
const __HERE = __dn(__f2p(import.meta.url));
const PORTABLE_FRONTEND = process.env.NOVIQ_FRONTEND || __join(__HERE, '..');
const PORTABLE_BACKEND = process.env.NOVIQ_BACKEND || __join(__HERE, '..', '..', 'backend');
const PORTABLE_TMP = process.env.NOVIQ_TMP || __join(__tmp(), 'noviq-shots');
/* Screenshot ANY prerendered route from file:// (no server needed).
   Usage: node scripts/shot-route.mjs <route> [locale] [width]
          node scripts/shot-route.mjs team en 1440                                        */
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'node:fs';

const route = process.argv[2] || 'team';
const locale = process.argv[3] || 'en';
const width = Number(process.argv[4] || 1440);

const ROOT = PORTABLE_FRONTEND;
const SRC = `${ROOT}/.next/server/app`;
const STATIC = `${ROOT}/.next/static`;
const OUT = PORTABLE_TMP;
mkdirSync(OUT, { recursive: true });

function walk(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const f = `${dir}/${e.name}`;
    if (e.isDirectory()) walk(f, out);
    else if (e.name.endsWith('.css')) out.push(f);
  }
  return out;
}

const candidates = [`${SRC}/${locale}/${route}.html`, `${SRC}/${locale}/${route}/index.html`];
const htmlPath = candidates.find((p) => existsSync(p));
if (!htmlPath) {
  console.log('NO SUCH ROUTE. available under', `${SRC}/${locale}:`);
  console.log(readdirSync(`${SRC}/${locale}`).join(', '));
  process.exit(1);
}

let html = readFileSync(htmlPath, 'utf8');
for (const css of walk(STATIC)) {
  const rel = '/' + css.replace(`${ROOT}/`, '');
  html = html.replace(new RegExp(`<link[^>]*href="${rel}"[^>]*>`, 'g'), '');
  html = html.replace('</head>', `<style>${readFileSync(css, 'utf8')}</style></head>`);
}
html = html.replace(/srcset="[^"]*"/g, '');

const flat = `${OUT}/${route}-${locale}-${width}.html`;
writeFileSync(flat, html, 'utf8');

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width, height: 900 } });
await page.goto(`file:///${flat}`, { waitUntil: 'load', timeout: 60_000 });
await page.waitForTimeout(800);
const png = `${OUT}/${route}-${locale}-${width}.png`;
await page.screenshot({ path: png, fullPage: true });
console.log('saved', png);
await browser.close();
