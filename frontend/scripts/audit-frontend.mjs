/* Portable roots (no machine paths): override with NOVIQ_FRONTEND / NOVIQ_BACKEND / NOVIQ_TMP env. */
import { fileURLToPath as __f2p } from 'node:url';
import { dirname as __dn, join as __join } from 'node:path';
import { tmpdir as __tmp } from 'node:os';
const __HERE = __dn(__f2p(import.meta.url));
const PORTABLE_FRONTEND = process.env.NOVIQ_FRONTEND || __join(__HERE, '..');
const PORTABLE_BACKEND = process.env.NOVIQ_BACKEND || __join(__HERE, '..', '..', 'backend');
const PORTABLE_TMP = process.env.NOVIQ_TMP || __join(__tmp(), 'noviq-shots');
/* Frontend error audit — catches what `tsc` and `next build` miss:
     1. console errors / pageerrors / failed requests on every prerendered route
     2. broken images (naturalWidth === 0)
     3. horizontal overflow
     4. leaked placeholder text (undefined / NaN / [object Object])
   Run: node scripts/audit-frontend.mjs [en|ar]

   Serves the flattened HTML over HTTP (not file://) and maps /images/* to
   frontend/public/*, so image + asset checks are REAL rather than
   file:// path artifacts.                                                      */
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { extname, join, normalize } from 'node:path';

const ROOT = PORTABLE_FRONTEND;
const SRC = `${ROOT}/.next/server/app`;
const OUT = PORTABLE_TMP;
const PORT = 4477;
mkdirSync(OUT, { recursive: true });

/* boot the API so CMS-driven pages can resolve live content */
const apiServer = spawn(process.execPath, ['-e', `
  process.chdir(PORTABLE_BACKEND);
  require(PORTABLE_BACKEND + '/app').listen(4322,'127.0.0.1',()=>console.log('UP'));
`], { stdio: ['ignore', 'pipe', 'pipe'] });
let apiUp = false;
apiServer.stdout.on('data', (d) => { if (String(d).includes('UP')) apiUp = true; });
await new Promise((r) => setTimeout(r, 2500));
console.log(apiUp ? 'API: up on :4322' : 'API: NOT up (fallback content expected)');

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const f = `${dir}/${e.name}`;
    if (e.isDirectory()) walk(f, out);
    else if (e.name.endsWith('.css')) out.push(f);
  }
  return out;
}
const CSS = walk(`${ROOT}/.next/static`);

function routesFor(locale) {
  const base = `${SRC}/${locale}`;
  if (!existsSync(base)) return [];
  return readdirSync(base)
    .filter((n) => !n.startsWith('_') && n !== 'layout.html')
    .map((n) => {
      const dir = `${base}/${n}`;
      if (n.endsWith('.html')) return { route: '/' + n.replace('.html', ''), file: dir };
      if (existsSync(`${dir}/index.html`)) {
        return { route: '/' + n, file: `${dir}/index.html` };
      }
      return null;
    })
    .filter(Boolean);
}

const MIME = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.svg': 'image/svg+xml', '.gif': 'image/gif',
  '.ico': 'image/x-icon', '.pdf': 'application/pdf', '.woff2': 'font/woff2',
};

/* Flatten every route once, then serve them + public/ over HTTP. */
const LOCALE = process.argv[2] || 'en';
const routes = routesFor(LOCALE);
const FLAT = new Map();
for (const r of routes) {
  let html = readFileSync(r.file, 'utf8');
  for (const css of walk(`${ROOT}/.next/static`)) {
    const rel = '/' + css.replace(`${ROOT}/`, '');
    html = html.replace(new RegExp(`<link[^>]*href="${rel}"[^>]*>`, 'g'), '');
    html = html.replace('</head>', `<style>${readFileSync(css, 'utf8')}</style></head>`);
  }
  html = html.replace(/srcset="[^"]*"/g, '');
  FLAT.set(r.route, html);
}
FLAT.set('/', FLAT.get('/' + LOCALE) || '<!doctype html><body>');

const PUBLIC = normalize(join(ROOT, 'public'));
const STATIC = normalize(join(ROOT, '.next/static'));

const server = createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  const p = decodeURIComponent(url.pathname);

  /* built JS/CSS chunks (real files — hydration must actually run) */
  if (p.startsWith('/_next/static/')) {
    const file = normalize(join(STATIC, p.replace('/_next/static/', '')));
    if (file.startsWith(STATIC) && existsSync(file) && statSync(file).isFile()) {
      const ext = extname(file).toLowerCase();
      res.writeHead(200, {
        'content-type': ext === '.js' ? 'text/javascript' : (MIME[ext] || 'application/octet-stream'),
      });
      return res.end(readFileSync(file));
    }
    res.writeHead(404); return res.end('');
  }

  /* static assets from public/ — serve ANY real file, not an allowlist.
     An allowlist silently 404s whatever it forgot to name (/logo/, /fonts/,
     …), and the image check then reports a "broken image" that is perfectly
     fine in the real build. Resolving by existence cannot drift. */
  {
    const file = normalize(join(PUBLIC, p));
    if (file.startsWith(PUBLIC) && existsSync(file) && statSync(file).isFile()) {
      res.writeHead(200, { 'content-type': MIME[extname(file).toLowerCase()] || 'application/octet-stream' });
      return res.end(readFileSync(file));
    }
  }

  const html = FLAT.get(p) ?? FLAT.get(p.replace(/\/$/, ''));
  if (html) { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); return res.end(html); }
  res.writeHead(404, { 'content-type': 'text/html' });
  res.end('<!doctype html><body>404</body>');
});
await new Promise((r) => server.listen(PORT, '127.0.0.1', r));
console.log(`static server on :${PORT}  (${routes.length} routes + public/)`);
console.log(apiUp ? 'API: up on :4322' : 'API: NOT up (fallback content expected)');

const problems = [];
const note = (route, msg) => { problems.push(`${route}  →  ${msg}`); };

const browser = await chromium.launch();
console.log(`\nAuditing ${routes.length} routes for /${LOCALE}\n${'─'.repeat(60)}`);

for (const { route } of routes) {
  const errors = [], failed = [];
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('pageerror', (e) => errors.push(String(e.message).slice(0, 120)));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const t = m.text();
    /* RSC prefetch 404s are a limitation of this static harness, not a bug. */
    if (/Failed to load resource/.test(t) && rscFails > 0) return;
    errors.push(t.slice(0, 120));
  });
  let rscFails = 0;
  page.on('requestfailed', (r) => {
    const u = r.url();
    if (u.includes('_rsc=')) { rscFails++; return; }
    if (u.startsWith(`http://127.0.0.1:${PORT}`)) failed.push(`NET ${u.slice(0, 90)}`);
  });
  page.on('response', (r) => {
    if (r.status() < 400) return;
    if (r.url().includes('_rsc=')) { rscFails++; return; }
    if (r.url().startsWith(`http://127.0.0.1:${PORT}`)) {
      failed.push(`${r.status()} ${r.url().slice(0, 90)}`);
    }
  });

  try {
    await page.goto(`http://127.0.0.1:${PORT}${route}`, { waitUntil: 'load', timeout: 45_000 });
    await page.waitForTimeout(500);
  } catch (e) { note(route, `load failed: ${e.message.slice(0, 80)}`); await page.close(); continue; }

  const dom = await page.evaluate(() => {
    /* Only FIRST-PARTY broken images count — external CDNs may be blocked in
       this sandbox and that is not a code defect. */
    const broken = [...document.querySelectorAll('img')]
      .filter((i) => i.getAttribute('src')?.startsWith('/'))
      .filter((i) => !i.complete || i.naturalWidth === 0)
      .map((i) => i.getAttribute('src'));
    const de = document.documentElement;
    const over = [];
    const clipped = (el) => {
      for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
        if (/hidden|clip|auto|scroll/.test(getComputedStyle(p).overflowX)) return true;
      }
      return false;
    };
    for (const el of document.querySelectorAll('body *')) {
      const b = el.getBoundingClientRect();
      if (b.width === 0 || clipped(el)) continue;
      if (b.right > de.clientWidth + 1.5 || b.left < -1.5) {
        over.push(`<${el.tagName.toLowerCase()} class="${String(el.className).slice(0, 50)}">`);
      }
    }
    return {
      broken,
      overflow: de.scrollWidth > de.clientWidth + 1,
      overEls: over.slice(0, 3),
      text: document.body.innerText,
      h1: document.querySelector('h1')?.textContent.trim() || null,
    };
  });

  const bad = [];
  if (errors.length) bad.push(`console: ${[...new Set(errors)].slice(0, 2).join(' | ')}`);
  if (failed.length) bad.push(`request: ${[...new Set(failed)].slice(0, 2).join(' | ')}`);
  if (dom.broken.length) bad.push(`broken img: ${[...new Set(dom.broken)].slice(0, 2).join(', ')}`);
  if (dom.overflow) bad.push(`h-overflow (${dom.overEls.join(' ')})`);
  if (/undefined|NaN|\[object Object\]/.test(dom.text)) {
    const m = dom.text.match(/.{0,30}(undefined|NaN|\[object Object\]).{0,30}/);
    bad.push(`bad text: "${m?.[0].trim()}"`);
  }
  if (!dom.h1) bad.push('no <h1>');

  if (bad.length) { bad.forEach((b) => note(route, b)); }
  console.log(`  ${bad.length ? '❌' : '✅'} ${route}${bad.length ? '  ' + bad[0] : ''}`);
  await page.close();
}

await browser.close();
server.close();
try { apiServer.kill('SIGKILL'); } catch {}

console.log(`\n${'═'.repeat(60)}`);
if (problems.length === 0) console.log('NO PROBLEMS FOUND');
else { console.log(`${problems.length} PROBLEM(S):`); problems.forEach((p) => console.log('  • ' + p)); }
process.exit(problems.length ? 1 : 0);
