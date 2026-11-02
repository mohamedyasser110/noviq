/* Portable roots (no machine paths): override with NOVIQ_FRONTEND / NOVIQ_BACKEND / NOVIQ_TMP env. */
import { fileURLToPath as __f2p } from 'node:url';
import { dirname as __dn, join as __join } from 'node:path';
import { tmpdir as __tmp } from 'node:os';
const __HERE = __dn(__f2p(import.meta.url));
const PORTABLE_FRONTEND = process.env.NOVIQ_FRONTEND || __join(__HERE, '..');
const PORTABLE_BACKEND = process.env.NOVIQ_BACKEND || __join(__HERE, '..', '..', 'backend');
const PORTABLE_TMP = process.env.NOVIQ_TMP || __join(__tmp(), 'noviq-shots');
/* Targeted check: is the AR mobile navbar really overflowing, or is it a
   file:// harness artifact? Serves real CSS/JS over HTTP.
   Run: node scripts/check-mobile-nav.mjs                                             */
import { chromium } from 'playwright';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { join, normalize, extname } from 'node:path';

const ROOT = PORTABLE_FRONTEND;
const SRC = `${ROOT}/.next/server/app`;
const PORT = 4479;
const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.pdf': 'application/pdf' };

function walk(d, out = []) {
  if (!existsSync(d)) return out;
  for (const e of readdirSync(d, { withFileTypes: true })) {
    const f = `${d}/${e.name}`;
    if (e.isDirectory()) walk(f, out);
    else if (e.name.endsWith('.css')) out.push(f);
  }
  return out;
}
const FLAT = new Map();
for (const loc of ['en', 'ar']) {
  const f = `${SRC}/${loc}.html`;
  if (!existsSync(f)) continue;
  let html = readFileSync(f, 'utf8');
  for (const css of walk(`${ROOT}/.next/static`)) {
    const rel = '/' + css.replace(`${ROOT}/`, '');
    html = html.replace(new RegExp(`<link[^>]*href="${rel}"[^>]*>`, 'g'), '');
    html = html.replace('</head>', `<style>${readFileSync(css, 'utf8')}</style></head>`);
  }
  FLAT.set(`/${loc}`, html.replace(/srcset="[^"]*"/g, ''));
}
FLAT.set('/', FLAT.get('/en') || '');

const PUBLIC = normalize(join(ROOT, 'public'));
const STATIC = normalize(join(ROOT, '.next/static'));
const server = createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.startsWith('/_next/static/')) {
    const f = normalize(join(STATIC, p.replace('/_next/static/', '')));
    if (f.startsWith(STATIC) && existsSync(f)) {
      const ext = extname(f).toLowerCase();
      res.writeHead(200, { 'content-type': ext === '.js' ? 'text/javascript' : (MIME[ext] || 'text/css') });
      return res.end(readFileSync(f));
    }
    res.writeHead(404); return res.end('');
  }
  if (p.startsWith('/images') || p === '/favicon.svg') {
    const f = normalize(join(ROOT, 'public', p));
    if (f.startsWith(PUBLIC) && existsSync(f)) { res.writeHead(200, { 'content-type': MIME[extname(f)] || 'application/octet-stream' }); return res.end(readFileSync(f)); }
    res.writeHead(404); return res.end('');
  }
  const html = FLAT.get(p);
  if (html) { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); return res.end(html); }
  res.writeHead(404, { 'content-type': 'text/html' }); res.end('404');
});
await new Promise((r) => server.listen(PORT, '127.0.0.1', r));

const browser = await chromium.launch();
for (const loc of ['en', 'ar']) {
  for (const w of [360, 390, 430, 768]) {
    const page = await browser.newPage({ viewport: { width: w, height: 900 } });
    await page.goto(`http://127.0.0.1:${PORT}/${loc}`, { waitUntil: 'load', timeout: 45_000 });
    await page.waitForTimeout(700);
    const r = await page.evaluate(() => {
      const de = document.documentElement;
      const acts = document.querySelector('.noviq-nav-actions');
      const cont = document.querySelector('.noviq-navbar-container');
      const box = (el) => el ? (({ left, right, width }) => ({ left: Math.round(left), right: Math.round(right), width: Math.round(width) }))(el.getBoundingClientRect()) : null;
      /* can the user actually scroll sideways? */
      const canScroll = de.scrollWidth > de.clientWidth;
      return {
        scrollW: de.scrollWidth, clientW: de.clientWidth, canScroll,
        actions: box(acts), container: box(cont),
        actionsPos: acts ? getComputedStyle(acts).position : null,
        navPos: cont ? getComputedStyle(cont.parentElement).position : null,
      };
    });
    const bad = r.canScroll;
    console.log(`  ${bad ? '❌' : '✅'} ${loc} @${w}  scrollW=${r.scrollW}/${r.clientW} canScrollX=${r.canScroll}  actions=${JSON.stringify(r.actions)} navPos=${r.navPos}`);
    await page.close();
  }
}
await browser.close();
server.close();
