/* Portable roots (no machine paths): override with NOVIQ_FRONTEND / NOVIQ_BACKEND / NOVIQ_TMP env. */
import { fileURLToPath as __f2p } from 'node:url';
import { dirname as __dn, join as __join } from 'node:path';
import { tmpdir as __tmp } from 'node:os';
const __HERE = __dn(__f2p(import.meta.url));
const PORTABLE_FRONTEND = process.env.NOVIQ_FRONTEND || __join(__HERE, '..');
const PORTABLE_BACKEND = process.env.NOVIQ_BACKEND || __join(__HERE, '..', '..', 'backend');
const PORTABLE_TMP = process.env.NOVIQ_TMP || __join(__tmp(), 'noviq-shots');
/* ============================================================
   DIMENSION / LAYOUT AUDIT
   ------------------------------------------------------------
   Catches the sizing defects that tsc, next build and a plain
   scrollWidth check all miss. Notably: `position: fixed` elements
   that hang off-screen create NO scrollbar, so a naive overflow
   test reports "clean" while ~50px of the header is invisible.

   Checks, per route, per locale, at 7 breakpoints:
     1  clipped      element extends past the viewport (not scrollable)
     2  tapTarget    interactive control < 44px on touch widths
     3  imgNoDims    <img> without width/height (layout shift)
     4  imgNoAlt     <img> without alt text
     5  tinyText     rendered font-size < 11px
     6  emptyBlock   visible container with a heading but no text
     7  dupIds       duplicate element ids (broken aria refs)
     8  overflowX    real page-level horizontal scroll
   Run: node scripts/audit-dimensions.mjs [en|ar] [route-filter]
   ============================================================ */
import { chromium } from 'playwright';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { join, normalize, extname } from 'node:path';

const ROOT = PORTABLE_FRONTEND;
const SRC = `${ROOT}/.next/server/app`;
const PORT = 4481;
const MIME = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.svg': 'image/svg+xml', '.gif': 'image/gif',
  '.ico': 'image/x-icon', '.pdf': 'application/pdf', '.woff2': 'font/woff2',
};
const WIDTHS = [360, 390, 430, 768, 1024, 1280, 1440];
const TOUCH = new Set([360, 390, 430]);
const LOCALE = process.argv[2] || 'en';
const FILTER = process.argv[3] || '';

function walk(d, out = []) {
  if (!existsSync(d)) return out;
  for (const e of readdirSync(d, { withFileTypes: true })) {
    const f = `${d}/${e.name}`;
    if (e.isDirectory()) walk(f, out);
    else if (e.name.endsWith('.css')) out.push(f);
  }
  return out;
}
const CSS = walk(`${ROOT}/.next/static`);
const STATIC = normalize(join(ROOT, '.next/static'));
const PUBLIC = normalize(join(ROOT, 'public'));

function routesFor(locale) {
  const base = `${SRC}/${locale}`;
  if (!existsSync(base)) return [];
  const out = [];
  const home = `${base}.html`;
  if (existsSync(home)) out.push({ route: `/${locale}`, file: home });
  for (const n of readdirSync(base)) {
    /* Next 15 writes FLAT html next to .meta/.rsc siblings
       (en/about.html), but keep the nested form working too. */
    if (n.endsWith('.html')) {
      const slug = n.replace(/\.html$/, '');
      if (slug === 'index' || slug.startsWith('_') || slug === 'layout') continue;
      out.push({ route: `/${locale}/${slug}`, file: `${base}/${n}` });
      continue;
    }
    if (n.startsWith('_') || n.endsWith('.meta') || n.endsWith('.rsc')) continue;
    const dir = `${base}/${n}`;
    if (!existsSync(dir) || !statSync(dir).isDirectory()) continue;
    if (existsSync(`${dir}/index.html`)) out.push({ route: `/${locale}/${n}`, file: `${dir}/index.html` });
  }
  return out.filter((r) => !FILTER || r.route.includes(FILTER));
}

const FLAT = new Map();
for (const r of routesFor(LOCALE)) {
  let html = readFileSync(r.file, 'utf8');
  for (const css of CSS) {
    const rel = '/' + css.replace(`${ROOT}/`, '');
    html = html.replace(new RegExp(`<link[^>]*href="${rel}"[^>]*>`, 'g'), '');
    html = html.replace('</head>', `<style>${readFileSync(css, 'utf8')}</style></head>`);
  }
  html = html.replace(/srcset="[^"]*"/g, '');
  /* NOTE: do NOT stub /_next/static/* — the server below serves the real
     chunks. Rewriting src to "#" makes the browser parse the page HTML as
     JavaScript and floods the report with bogus "Unexpected token '<'". */
  FLAT.set(r.route, html);
}

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
  if (p.startsWith('/images') || p.startsWith('/icons') || p === '/favicon.svg') {
    const f = normalize(join(ROOT, 'public', p));
    if (f.startsWith(PUBLIC) && existsSync(f) && statSync(f).isFile()) {
      res.writeHead(200, { 'content-type': MIME[extname(f).toLowerCase()] || 'application/octet-stream' });
      return res.end(readFileSync(f));
    }
    res.writeHead(404); return res.end('');
  }
  const html = FLAT.get(p);
  if (html) { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); return res.end(html); }
  res.writeHead(404, { 'content-type': 'text/html' }); res.end('<!doctype html><body>404</body>');
});
await new Promise((r) => server.listen(PORT, '127.0.0.1', r));

const findings = [];
const add = (route, w, kind, detail) => findings.push({ route, w, kind, detail });

const browser = await chromium.launch();
const routes = [...FLAT.keys()];

console.log(`\nDIMENSION AUDIT — /${LOCALE} — ${FLAT.size} routes × ${WIDTHS.length} breakpoints`);
console.log('═'.repeat(78));

for (const route of routes) {
  const row = [];
  for (const w of WIDTHS) {
    const page = await browser.newPage({ viewport: { width: w, height: 900 } });
    const errs = [];
    page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 90)));
    try {
      await page.goto(`http://127.0.0.1:${PORT}${route}`, { waitUntil: 'load', timeout: 45_000 });
      await page.waitForTimeout(350);
    } catch (e) {
      add(route, w, 'load', e.message.slice(0, 70));
      await page.close();
      continue;
    }

    const d = await page.evaluate((isTouch) => {
      const vw = document.documentElement.clientWidth;
      const out = { clipped: [], tap: [], noDims: [], noAlt: [], tiny: [], empty: [], dupIds: [], scrollX: false };

      out.scrollX = document.documentElement.scrollWidth > vw + 1;

      /* is this element inside a clipping ancestor? */
      const clippedBy = (el) => {
        for (let p = el.parentElement; p && p !== document.documentElement; p = p.parentElement) {
          const o = getComputedStyle(p);
          if (/hidden|clip|auto|scroll/.test(o.overflowX) || /hidden|clip|auto|scroll/.test(o.overflowY)) return true;
        }
        return false;
      };
      const label = (el) =>
        `<${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}` +
        `${el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : ''}>`;

      for (const el of document.querySelectorAll('body *')) {
        const b = el.getBoundingClientRect();
        if (b.width === 0 && b.height === 0) continue;
        const cs = getComputedStyle(el);
        if (cs.visibility === 'hidden' || cs.opacity === '0' || cs.display === 'none') continue;

        /* 1. clipped by the viewport (and not intentionally scrolled) */
        if ((b.right > vw + 1 || b.left < -1) && !clippedBy(el)) {
          out.clipped.push(`${label(el)} ${Math.round(b.left)}..${Math.round(b.right)}`);
        }

        /* 2. tap target — WCAG 2.5.8 (AA) floor is 24x24 CSS px; 44x44 is
           the preferred size (2.5.5 / Apple HIG). Report both tiers. */
        if (isTouch && (el.tagName === 'BUTTON' || el.tagName === 'A')) {
          if (el.closest('a,button') !== el) continue;
          if (el.closest('p,li,dd,label,address,figcaption')) continue;
          if (el.classList.contains('sr-only') || cs.clip === 'rect(0px, 0px, 0px, 0px)') continue;
          if (el.getAttribute('aria-hidden') === 'true') continue;
          if (parseFloat(cs.opacity) <= 0.05) continue;
          const w = Math.round(b.width), h = Math.round(b.height);
          if (w < 24 || h < 24) {
            out.tap.push(`${label(el)} ${w}×${h}  AA-FAIL`);
          } else if (w < 44 || h < 44) {
            /* Below the 44px preference. A text link whose WIDTH is set by
               its label (e.g. "Home") cannot reach 44 without distorting
               the type, and WCAG exempts inline-in-text targets — so only
               flag the height here. */
            if (h < 44) out.tap.push(`${label(el)} ${w}×${h}  below-44`);
          }
        }

        /* 4. img alt */
        if (el.tagName === 'IMG' && !el.hasAttribute('alt')) out.noAlt.push(label(el));

        /* 5. tiny text */
        if (el.children.length === 0 && el.textContent.trim()) {
          const fs = parseFloat(cs.fontSize);
          if (fs && fs < 11) out.tiny.push(`${label(el)} ${fs}px`);
        }
      }

      /* 3. img without dimensions */
      for (const i of document.querySelectorAll('img')) {
        if (!i.getAttribute('width') || !i.getAttribute('height')) {
          const cs = getComputedStyle(i);
          if (cs.position === 'absolute' || cs.position === 'fixed') continue; // next/image fill is fine
          out.noDims.push(label(i));
        }
      }

      /* 6. heading present but container visually empty */
      for (const h of document.querySelectorAll('section, article')) {
        const hb = h.getBoundingClientRect();
        if (hb.height < 20) continue;
        const hasHeading = !!h.querySelector('h1,h2,h3');
        if (!hasHeading) continue;
        const clone = h.cloneNode(true);
        clone.querySelectorAll('svg,img,path,script,style').forEach((n) => n.remove());
        if (clone.textContent.trim().length < 3) out.empty.push(label(h));
      }

      /* 7. duplicate ids */
      const seen = new Map();
      for (const el of document.querySelectorAll('[id]')) {
        seen.set(el.id, (seen.get(el.id) || 0) + 1);
      }
      out.dupIds = [...seen.entries()].filter(([, n]) => n > 1).map(([k, n]) => `${k}×${n}`);

      return out;
    }, TOUCH.has(w));

    for (const e of errs) add(route, w, 'js', e);
    if (d.scrollX) add(route, w, 'overflowX', `scrollW>clientW`);
    for (const c of [...new Set(d.clipped)].slice(0, 4)) add(route, w, 'clipped', c);
    for (const t of [...new Set(d.tap)].slice(0, 3)) add(route, w, 'tapTarget', t);
    for (const i of [...new Set(d.noDims)].slice(0, 3)) add(route, w, 'imgNoDims', i);
    for (const a of [...new Set(d.noAlt)].slice(0, 3)) add(route, w, 'imgNoAlt', a);
    for (const t of [...new Set(d.tiny)].slice(0, 3)) add(route, w, 'tinyText', t);
    for (const e of [...new Set(d.empty)].slice(0, 2)) add(route, w, 'emptyBlock', e);
    for (const i of [...new Set(d.dupIds)].slice(0, 3)) add(route, w, 'dupId', i);

    row.push(w);
    await page.close();
  }
  process.stdout.write(`  ✓ ${route}\n`);
}

await browser.close();
server.close();

/* ---- report ---- */
console.log('\n' + '═'.repeat(78));
if (!findings.length) {
  console.log('NO DIMENSION PROBLEMS');
} else {
  const byKind = new Map();
  for (const f of findings) {
    if (!byKind.has(f.kind)) byKind.set(f.kind, []);
    byKind.get(f.kind).push(f);
  }
  console.log(`${findings.length} FINDING(S) across ${byKind.size} kinds\n`);
  for (const [kind, list] of [...byKind.entries()].sort((a, b) => b[1].length - a[1].length)) {
    console.log(`── ${kind} (${list.length} hits)`);
    /* collapse to unique selectors, with how many routes they hit */
    const uniq = new Map();
    for (const f of list) {
      if (!uniq.has(f.detail)) uniq.set(f.detail, { n: 0, routes: new Set() });
      const u = uniq.get(f.detail);
      u.n++;
      u.routes.add(f.route);
    }
    for (const [detail, u] of uniq) {
      const r = [...u.routes].slice(0, 4).join(' ');
      console.log(`   ${detail}   ×${u.n} on ${u.routes.size} route(s): ${r}${u.routes.size > 4 ? ' …' : ''}`);
    }
  }
}
process.exit(findings.length ? 1 : 0);
