/* Screenshot the site footer (scrolled into view) in both locales. */
import { chromium } from 'playwright';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { join, normalize, extname } from 'node:path';

const ROOT = 'C:/Downloads/Noviq - final/frontend';
const SRC = `${ROOT}/.next/server/app`;
const OUT = 'C:/Users/LapShop/AppData/Local/Temp/opencode/shots';
const PORT = 4489;
const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml' };

function walk(d, out = []) {
  if (!existsSync(d)) return out;
  for (const e of readdirSync(d, { withFileTypes: true })) {
    const f = `${d}/${e.name}`;
    if (e.isDirectory()) walk(f, out); else if (e.name.endsWith('.css')) out.push(f);
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
  FLAT.set(`/${loc}`, html
    .replace(/srcset="[^"]*"/g, '')
    .replace(/\/_next\/image\?url=([^&"']+)[^"']*/g, (_, u) => decodeURIComponent(u)));
}
const STATIC = normalize(join(ROOT, '.next/static'));
const PUBLIC = normalize(join(ROOT, 'public'));
const server = createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.startsWith('/_next/static/')) {
    const f = normalize(join(STATIC, p.replace('/_next/static/', '')));
    if (f.startsWith(STATIC) && existsSync(f) && statSync(f).isFile()) {
      const ext = extname(f).toLowerCase();
      res.writeHead(200, { 'content-type': ext === '.js' ? 'text/javascript' : (MIME[ext] || 'text/css') });
      return res.end(readFileSync(f));
    }
    res.writeHead(404); return res.end('');
  }
  {
    const f = normalize(join(PUBLIC, p));
    if (f.startsWith(PUBLIC) && existsSync(f) && statSync(f).isFile()) {
      res.writeHead(200, { 'content-type': MIME[extname(f).toLowerCase()] || 'application/octet-stream' });
      return res.end(readFileSync(f));
    }
  }
  const html = FLAT.get(p);
  if (html) { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); return res.end(html); }
  res.writeHead(404, { 'content-type': 'text/html' }); res.end('404');
});
await new Promise((r) => server.listen(PORT, '127.0.0.1', r));

const browser = await chromium.launch();
for (const loc of ['en', 'ar']) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 820 } });
  await page.goto(`http://127.0.0.1:${PORT}/${loc}`, { waitUntil: 'load', timeout: 45_000 });
  await page.waitForTimeout(2000);
  /* scrollIntoView on a fixed-height page lands mid-document; go to the
     actual bottom so the footer is framed, not whatever section precedes it */
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForTimeout(400);
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/footer-fixed-${loc}.png` });
  console.log(`wrote footer-fixed-${loc}.png`);
  await page.close();
}
await browser.close();
server.close();
