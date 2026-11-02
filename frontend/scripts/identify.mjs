/* Portable roots (no machine paths): override with NOVIQ_FRONTEND / NOVIQ_BACKEND / NOVIQ_TMP env. */
import { fileURLToPath as __f2p } from 'node:url';
import { dirname as __dn, join as __join } from 'node:path';
import { tmpdir as __tmp } from 'node:os';
const __HERE = __dn(__f2p(import.meta.url));
const PORTABLE_FRONTEND = process.env.NOVIQ_FRONTEND || __join(__HERE, '..');
const PORTABLE_BACKEND = process.env.NOVIQ_BACKEND || __join(__HERE, '..', '..', 'backend');
const PORTABLE_TMP = process.env.NOVIQ_TMP || __join(__tmp(), 'noviq-shots');
/* Identify exactly which elements the dimension audit flags, with their
   full class list + parent chain + a text snippet.
   Usage: node scripts/identify.mjs <locale> <route> [width]                     */
import { chromium } from 'playwright';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { join, normalize, extname } from 'node:path';

const ROOT = PORTABLE_FRONTEND;
const SRC = `${ROOT}/.next/server/app`;
const PORT = 4482;
const LOCALE = process.argv[2] || 'en';
const ROUTE = process.argv[3] || `/${LOCALE}`;
const W = Number(process.argv[4] || 360);
const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml' };

function walk(d, out = []) {
  if (!existsSync(d)) return out;
  for (const e of readdirSync(d, { withFileTypes: true })) {
    const f = `${d}/${e.name}`;
    if (e.isDirectory()) walk(f, out); else if (e.name.endsWith('.css')) out.push(f);
  }
  return out;
}
function findHtml(route) {
  const base = `${SRC}/${LOCALE}`;
  const slug = route.replace(`/${LOCALE}`, '').replace(/^\//, '');
  if (!slug) return `${base}.html`;
  if (existsSync(`${base}/${slug}.html`)) return `${base}/${slug}.html`;
  if (existsSync(`${base}/${slug}/index.html`)) return `${base}/${slug}/index.html`;
  return null;
}
const file = findHtml(ROUTE);
if (!file) { console.log('route not found:', ROUTE); process.exit(1); }

let html = readFileSync(file, 'utf8');
for (const css of walk(`${ROOT}/.next/static`)) {
  const rel = '/' + css.replace(`${ROOT}/`, '');
  html = html.replace(new RegExp(`<link[^>]*href="${rel}"[^>]*>`, 'g'), '');
  html = html.replace('</head>', `<style>${readFileSync(css, 'utf8')}</style></head>`);
}
html = html.replace(/srcset="[^"]*"/g, '');

const STATIC = normalize(join(ROOT, '.next/static'));
const PUBLIC = normalize(join(ROOT, 'public'));
const server = createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.startsWith('/_next/static/')) {
    const f = normalize(join(STATIC, p.replace('/_next/static/', '')));
    if (f.startsWith(STATIC) && existsSync(f) && statSync(f).isFile()) { res.writeHead(200, { 'content-type': extname(f) === '.js' ? 'text/javascript' : 'text/css' }); return res.end(readFileSync(f)); }
    res.writeHead(404); return res.end('');
  }
  if (p.startsWith('/images') || p.startsWith('/icons') || p === '/favicon.svg') {
    const f = normalize(join(ROOT, 'public', p));
    if (f.startsWith(PUBLIC) && existsSync(f)) { res.writeHead(200, { 'content-type': MIME[extname(f)] || 'application/octet-stream' }); return res.end(readFileSync(f)); }
    res.writeHead(404); return res.end('');
  }
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); res.end(html);
});
await new Promise((r) => server.listen(PORT, '127.0.0.1', r));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: W, height: 900 } });
await page.goto(`http://127.0.0.1:${PORT}${ROUTE}`, { waitUntil: 'load' });
await page.waitForTimeout(500);

const items = await page.evaluate(() => {
  const out = [];
  for (const el of document.querySelectorAll('a,button')) {
    if (el.closest('a,button') !== el) continue;
    if (el.closest('p,li,dd,label,address,figcaption')) continue;
    if (el.classList.contains('sr-only')) continue;
    const b = el.getBoundingClientRect();
    if (b.width === 0 || b.height === 0) continue;
    if (b.height >= 44 && b.width >= 44) continue;
    const chain = [];
    let p = el.parentElement;
    for (let i = 0; i < 3 && p; i++) {
      chain.push(`${p.tagName.toLowerCase()}.${String(p.className || '').trim().split(/\s+/).slice(0, 2).join('.')}`);
      p = p.parentElement;
    }
    out.push({
      tag: el.tagName.toLowerCase(),
      id: el.id || '',
      cls: String(el.className || '').trim(),
      size: `${Math.round(b.width)}×${Math.round(b.height)}`,
      text: (el.textContent || '').trim().slice(0, 34),
      href: (el.getAttribute('href') || '').slice(0, 40),
      parents: chain,
    });
  }
  return out;
});

console.log(`\n${LOCALE}${ROUTE.replace(`/${LOCALE}`, '') || '/'} @${W}px — ${items.length} sub-44px control(s)\n` + '─'.repeat(70));
for (const i of items) {
  console.log(`  ${i.size.padEnd(9)} <${i.tag}${i.id ? '#' + i.id : ''}>`);
  console.log(`     class : ${i.cls.slice(0, 96)}`);
  console.log(`     text  : ${JSON.stringify(i.text)}${i.href ? '  href=' + i.href : ''}`);
  console.log(`     in    : ${i.parents.join('  <  ')}`);
}
await browser.close();
server.close();
