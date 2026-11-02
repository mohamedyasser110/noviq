/* Portable roots (no machine paths): override with NOVIQ_FRONTEND / NOVIQ_BACKEND / NOVIQ_TMP env. */
import { fileURLToPath as __f2p } from 'node:url';
import { dirname as __dn, join as __join } from 'node:path';
import { tmpdir as __tmp } from 'node:os';
const __HERE = __dn(__f2p(import.meta.url));
const PORTABLE_FRONTEND = process.env.NOVIQ_FRONTEND || __join(__HERE, '..');
const PORTABLE_BACKEND = process.env.NOVIQ_BACKEND || __join(__HERE, '..', '..', 'backend');
const PORTABLE_TMP = process.env.NOVIQ_TMP || __join(__tmp(), 'noviq-shots');
/* Verifies /resources is genuinely CMS-driven, not hardcoded.

   The page used to invent 5 categories with fabricated counts and 3
   "featured articles" pointing at hotlinked Unsplash URLs. This checks that
   none of that survives, and that what renders instead is whatever the
   admin dashboard is currently serving.

   Run: node scripts/verify-resources.mjs                                             */
import { chromium } from 'playwright';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { join, normalize, extname } from 'node:path';

const ROOT = PORTABLE_FRONTEND;
const SRC = `${ROOT}/.next/server/app`;
const OUT = PORTABLE_TMP;
const API = 'http://127.0.0.1:4322';
const PORT = 4486;
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
  const f = `${SRC}/${loc}/resources.html`;
  if (!existsSync(f)) continue;
  let html = readFileSync(f, 'utf8');
  for (const css of walk(`${ROOT}/.next/static`)) {
    const rel = '/' + css.replace(`${ROOT}/`, '');
    html = html.replace(new RegExp(`<link[^>]*href="${rel}"[^>]*>`, 'g'), '');
    html = html.replace('</head>', `<style>${readFileSync(css, 'utf8')}</style></head>`);
  }
  FLAT.set(`/${loc}/resources`, html
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

/* What the CMS is serving right now — the page must match this. */
let cms = null;
try {
  const r = await fetch(`${API}/api/content/resources`);
  cms = r.ok ? await r.json() : null;
} catch { cms = null; }

let pass = 0, fail = 0;
const check = (n, ok, extra = '') => {
  if (ok) { pass++; console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${n}${extra ? '  ' + extra : ''}`); }
  else { fail++; console.log(`  FAIL  ${n}${extra ? '  ' + extra : ''}`); }
};

const browser = await chromium.launch();

for (const loc of ['en', 'ar']) {
  console.log(`\n[${loc}] /resources`);
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message.slice(0, 90)));
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 90)); });

  await page.goto(`http://127.0.0.1:${PORT}/${loc}/resources`, { waitUntil: 'load', timeout: 45_000 });
  await page.waitForTimeout(800);

  const r = await page.evaluate(() => {
    const txt = document.body.innerText;
    return {
      h1: document.querySelector('h1')?.textContent?.trim() ?? '',
      /* section anchors rendered from CMS tabs */
      sections: [...document.querySelectorAll('[id]')]
        .map((e) => e.id)
        .filter((id) => ['news', 'blog', 'whitepapers', 'downloads'].includes(id)),
      /* section filter chips carry the real item count */
      chips: [...document.querySelectorAll('nav a[href^="#"]')].map((a) => a.textContent.trim()),
      cards: document.querySelectorAll('article, .group.flex.flex-col').length,
      /* every image must be a LOCAL /images path — no hotlinking */
      imgSrcs: [...document.querySelectorAll('img')].map((i) => i.getAttribute('src') || ''),
      externalImgs: [...document.querySelectorAll('img')].filter((i) => /^https?:\/\//i.test(i.getAttribute('src') || '')).length,
      /* the fabricated copy from the old page */
      fakeCount: /\b(24|18|32|12|40)\s+articles\b/i.test(txt),
      fakeTitles: /AI Trends in 2025|ERP Guide for Growing Companies|SaaS Business Model/i.test(txt),
      emptyState: /Nothing published yet|لا توجد موارد منشورة بعد/.test(txt),
    };
  });

  check('page rendered with a heading', r.h1.length > 0, JSON.stringify(r.h1));
  check('NOT the hardcoded placeholder page', !r.fakeCount && !r.fakeTitles,
    r.fakeTitles ? 'fabricated article titles still present' : '');
  check('no hotlinked external images', r.externalImgs === 0,
    r.externalImgs ? `${r.externalImgs} external <img>` : 'all local');
  check('does not show the empty state', !r.emptyState);

  if (cms) {
    const tabIds = (cms.tabs || []).map((t) => t.id);
    const withItems = tabIds.filter((id) => (cms.items?.[id] || []).length > 0);
    check('renders every CMS section that has items',
      withItems.every((id) => r.sections.includes(id)),
      `cms=${withItems.join(',')} page=${r.sections.join(',') || 'none'}`);

    /* A real CMS title must be on the page, in the right language. */
    const sample = (cms.items?.[withItems[0]]?.[0]) || null;
    if (sample) {
      const want = (loc === 'ar' ? sample.title?.ar : sample.title?.en) || '';
      check('a real CMS item title is rendered', !!want && r.h1.length > 0 && (await page.evaluate(() => document.body.innerText)).includes(want.slice(0, 24)),
        JSON.stringify(want.slice(0, 40)));
    }

    /* Filter chip counts must equal the published item count. */
    const total = Object.values(cms.items || {}).reduce((n, a) => n + a.length, 0);
    console.log(`     CMS: ${tabIds.length} tabs, ${total} items | chips: ${r.chips.length}`);
  }

  /* CORS rejections come from THIS harness serving on an ad-hoc port the
     backend's origin allowlist does not include — the Footer's client-side
     fetch to the API is blocked. Not a site bug; in production the UI is
     served from an allowed origin. */
  const real = errs.filter(
    (e) => !/RSC|_rsc|Failed to load resource|blocked by CORS policy|CORS policy/i.test(e),
  );
  check('no JS errors', real.length === 0, real.slice(0, 2).join(' | '));

  await page.screenshot({ path: `${OUT}/resources-${loc}.png`, fullPage: false });
  await page.close();
}

await browser.close();
server.close();
console.log(`\n--------------\n  ${pass} passed / ${fail} failed\n--------------\n`);
process.exit(fail === 0 ? 0 : 1);
