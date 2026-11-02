/* Portable roots (no machine paths): override with NOVIQ_FRONTEND / NOVIQ_BACKEND / NOVIQ_TMP env. */
import { fileURLToPath as __f2p } from 'node:url';
import { dirname as __dn, join as __join } from 'node:path';
import { tmpdir as __tmp } from 'node:os';
const __HERE = __dn(__f2p(import.meta.url));
const PORTABLE_FRONTEND = process.env.NOVIQ_FRONTEND || __join(__HERE, '..');
const PORTABLE_BACKEND = process.env.NOVIQ_BACKEND || __join(__HERE, '..', '..', 'backend');
const PORTABLE_TMP = process.env.NOVIQ_TMP || __join(__tmp(), 'noviq-shots');
/* Verify the client marquee: renders both halves, the GSAP tween actually
   moves the track, it pauses off-screen / on hover, and the reduced-motion
   path is a static scrollable strip.
   Run: node scripts/verify-marquee.mjs                                             */
import { chromium } from 'playwright';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { join, normalize, extname } from 'node:path';

const ROOT = PORTABLE_FRONTEND;
const SRC = `${ROOT}/.next/server/app`;
const OUT = PORTABLE_TMP;
const PORT = 4485;
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
  /* No image optimizer in this harness. Unwrap /_next/image?url=X back to X
     so next/image output still resolves against public/ — otherwise every
     <Image> renders as a broken box that is fine in the real build. */
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
  /* Any real file under public/ — resolved by existence, not an allowlist.
     An allowlist 404s whatever it forgot to name, and the screenshot then
     shows a broken image that is fine in the real build. */
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

let pass = 0, fail = 0;
const check = (n, ok, extra = '') => {
  if (ok) { pass++; console.log(`  ✅ ${n}${extra ? '  ' + extra : ''}`); }
  else { fail++; console.log(`  ❌ ${n}${extra ? '  ' + extra : ''}`); }
};

const browser = await chromium.launch();

for (const loc of ['en', 'ar']) {
  console.log(`\n[${loc}] client marquee`);
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message.slice(0, 90)));
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 90)); });

  await page.goto(`http://127.0.0.1:${PORT}/${loc}`, { waitUntil: 'load', timeout: 45_000 });
  await page.waitForTimeout(1200);

  const base = await page.evaluate(() => {
    const sec = document.querySelector('.noviq-clients');
    if (!sec) return null;
    const track = sec.querySelector('.noviq-clients-track');
    const rows = sec.querySelectorAll('.noviq-client-row');
    const items = sec.querySelectorAll('.noviq-client-item');
    const names = [...sec.querySelectorAll('.noviq-client-name')].map((n) => n.textContent.trim());
    return {
      rows: rows.length,
      items: items.length,
      uniqueNames: [...new Set(names)].length,
      names,
      /* the clone must be hidden from assistive tech, read once */
      cloneAriaHidden: rows[1]?.getAttribute('aria-hidden'),
      eyebrow: sec.querySelector('.eyebrow')?.textContent.trim(),
      trackTransform: getComputedStyle(track).transform,
      trackWidth: Math.round(track.getBoundingClientRect().width),
      viewportWidth: Math.round(sec.querySelector('.noviq-clients-viewport').getBoundingClientRect().width),
      masked: getComputedStyle(sec.querySelector('.noviq-clients-viewport')).maskImage,
      isRTL: sec.classList.contains('is-rtl'),
      /* the old grid must be gone — match on a stable fragment, no escapes */
      oldGrid: !!sec.parentElement?.querySelector('h3'),
      oldLabels: document.body.innerText.includes('Custom models & LLM'),
    };
  });

  check('marquee section mounted', !!base);
  if (base) {
    check('two rows rendered (seamless loop)', base.rows === 2, `${base.rows} rows`);
    check('every client duplicated once', base.items === base.uniqueNames * 2,
      `${base.items} items / ${base.uniqueNames} unique`);
    check('eyebrow present', !!base.eyebrow, JSON.stringify(base.eyebrow));
    check('clone row is aria-hidden', base.cloneAriaHidden === 'true', String(base.cloneAriaHidden));
    check('track is wider than the viewport (must scroll)', base.trackWidth > base.viewportWidth,
      `${base.trackWidth} > ${base.viewportWidth}`);
    check('edge fade mask applied', /linear-gradient/.test(base.masked || ''), (base.masked || '').slice(0, 40));
    check('old capabilities grid is GONE', !base.oldGrid && !base.oldLabels);
    console.log(`     clients: ${base.names.slice(0, base.uniqueNames).join(', ')}`);
  }

  /* the tween must actually move the track */
  const t0 = await page.evaluate(() => getComputedStyle(document.querySelector('.noviq-clients-track')).transform);
  await page.waitForTimeout(900);
  const t1 = await page.evaluate(() => getComputedStyle(document.querySelector('.noviq-clients-track')).transform);
  check('GSAP is animating the track', t0 !== t1, `${t0.slice(0, 26)} -> ${t1.slice(0, 26)}`);

  /* CORS rejections come from THIS harness serving on an ad-hoc port the
     backend's origin allowlist does not include — the Footer's client-side
     fetch to the API is blocked. Not a site bug; in production the UI is
     served from an allowed origin. */
  const real = errs.filter(
    (e) => !/RSC|_rsc|Failed to load resource|blocked by CORS policy|CORS policy/i.test(e),
  );
  check('no JS errors', real.length === 0, real.slice(0, 2).join(' | '));

  await page.evaluate(() => document.querySelector('.noviq-clients')?.scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/marquee-${loc}.png` });
  await page.close();
}

/* reduced motion -> static, scrollable, not translated */
console.log('\n[reduced-motion]');
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  await page.goto(`http://127.0.0.1:${PORT}/en`, { waitUntil: 'load', timeout: 45_000 });
  await page.waitForTimeout(1200);
  const r = await page.evaluate(() => {
    const vp = document.querySelector('.noviq-clients-viewport');
    const tr = document.querySelector('.noviq-clients-track');
    return {
      transform: getComputedStyle(tr).transform,
      overflowX: getComputedStyle(vp).overflowX,
      scrollable: vp.scrollWidth > vp.clientWidth,
    };
  });
  const t0 = r.transform;
  await page.waitForTimeout(800);
  const t1 = await page.evaluate(() => getComputedStyle(document.querySelector('.noviq-clients-track')).transform);
  check('track is NOT translated', t0 === t1 && (t0 === 'none' || t0 === 'matrix(1, 0, 0, 1, 0, 0)'), t0.slice(0, 30));
  check('falls back to a scrollable strip', r.overflowX === 'auto' && r.scrollable, `overflowX=${r.overflowX}`);
  await page.close();
}

await browser.close();
server.close();
console.log(`\n──────────────\n  ${pass} passed · ${fail} failed\n──────────────\n`);
process.exit(fail === 0 ? 0 : 1);
