/* Portable roots (no machine paths): override with NOVIQ_FRONTEND / NOVIQ_BACKEND / NOVIQ_TMP env. */
import { fileURLToPath as __f2p } from 'node:url';
import { dirname as __dn, join as __join } from 'node:path';
import { tmpdir as __tmp } from 'node:os';
const __HERE = __dn(__f2p(import.meta.url));
const PORTABLE_FRONTEND = process.env.NOVIQ_FRONTEND || __join(__HERE, '..');
const PORTABLE_BACKEND = process.env.NOVIQ_BACKEND || __join(__HERE, '..', '..', 'backend');
const PORTABLE_TMP = process.env.NOVIQ_TMP || __join(__tmp(), 'noviq-shots');
/* Verifies the hero black hole, which now fills the card itself.

   The static hero image was removed so the render could be seen head-on
   rather than leaking around an opaque card, so these checks are about the
   card: that the image is really gone, that the canvas fills that space,
   that the shader renders warm, and — the one that matters — that hiding
   the canvas visibly changes the card, i.e. the black hole is what a viewer
   actually sees and not something buried behind it.

   Two lessons are baked in:
     · No --use-gl=swiftshader. Forcing the software rasteriser makes this
       shader fail outright (GL_INVALID_OPERATION, black framebuffer) and
       says nothing about real hardware.
     · readPixels after compositing returns zeros because the drawing buffer
       is cleared, so the read happens inside a rAF callback that runs after
       the component's own render in the same frame.

   Run: node scripts/verify-blackhole.mjs                                             */
import { chromium } from 'playwright';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { join, normalize, extname } from 'node:path';

const ROOT = PORTABLE_FRONTEND;
const SRC = `${ROOT}/.next/server/app`;
const OUT = PORTABLE_TMP;
const PORT = 4484;
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
  /* No image optimizer in this harness: unwrap /_next/image?url=X back to X
     so any surviving <Image> still resolves against public/. */
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
  if (ok) { pass++; console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${n}${extra ? '  ' + extra : ''}`); }
  else { fail++; console.log(`  FAIL  ${n}${extra ? '  ' + extra : ''}`); }
};

/* Mean colour of the card, from a full-page screenshot. */
const cardMean = async (page) => {
  const buf = await page.screenshot();
  return page.evaluate(async (data) => {
    const img = new Image();
    img.src = 'data:image/png;base64,' + data;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0);
    const r0 = document.querySelector('.shadow-2xl').getBoundingClientRect();
    const d = g.getImageData(0, 0, c.width, c.height).data;
    let n = 0, r = 0, gg = 0, b = 0;
    /* sample the middle band of the card, clear of the two HUD badges */
    for (let y = Math.round(r0.top + r0.height * 0.32); y < r0.top + r0.height * 0.68; y += 3) {
      for (let x = Math.round(r0.left + r0.width * 0.12); x < r0.left + r0.width * 0.88; x += 3) {
        const i = (y * c.width + x) * 4;
        r += d[i]; gg += d[i + 1]; b += d[i + 2]; n++;
      }
    }
    return n ? { n, mean: [r / n, gg / n, b / n] } : { n: 0, mean: [0, 0, 0] };
  }, buf.toString('base64'));
};

const browser = await chromium.launch();

for (const loc of ['en', 'ar']) {
  console.log(`\n[${loc}] hero black hole`);
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message.slice(0, 100)));
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 100)); });

  await page.goto(`http://127.0.0.1:${PORT}/${loc}`, { waitUntil: 'load', timeout: 45_000 });
  /* Wait for the CANVAS, not for a stopwatch. BlackHoleHeroSection is a
     dynamic() import and its fragment shader is compiled on first use, so
     on a cold production server the card is routinely absent 5s after
     `load` — the old fixed wait made every assertion below report "missing"
     and then throw in cardMean. Waiting on the element the checks actually
     query turns a race into a condition. */
  await page.waitForSelector('.shadow-2xl canvas', { timeout: 30_000 });
  /* One more beat so the first frames are composited before any readPixels. */
  await page.waitForTimeout(4000);

  const r = await page.evaluate(() => {
    const card = document.querySelector('.shadow-2xl');
    const canvas = document.querySelector('.shadow-2xl canvas');
    const cb = card?.getBoundingClientRect();
    const nb = canvas?.getBoundingClientRect();
    const host = canvas?.parentElement;
    return {
      hasCard: !!card,
      hasCanvas: !!canvas,
      /* the old flat gradient glow, and the static hero photograph */
      oldGlow: !!document.querySelector('[style*="linear-gradient(135deg, #FF6A00"]'),
      oldPhoto: [...document.querySelectorAll('img')].some((i) => /hero-ai-ecosystem/.test(i.currentSrc || i.src || '')),
      canvasCount: document.querySelectorAll('canvas').length,
      card: cb ? { w: Math.round(cb.width), h: Math.round(cb.height) } : null,
      canvasBox: nb ? { w: Math.round(nb.width), h: Math.round(nb.height) } : null,
      blend: host ? getComputedStyle(host).mixBlendMode : null,
      canvasBlend: canvas ? getComputedStyle(canvas).mixBlendMode : null,
      bleed: (() => {
        const el = document.querySelector('.noviq-blackhole');
        return el ? getComputedStyle(el).backgroundImage.slice(0, 30) : null;
      })(),
    };
  });

  check('hero card present', r.hasCard, r.card ? `${r.card.w}x${r.card.h}` : 'missing');
  check('static hero photograph is GONE', !r.oldPhoto);
  check('old flat gradient glow is GONE', !r.oldGlow);
  check('black hole canvas is inside the card', r.hasCanvas);
  check('exactly one WebGL canvas on the page', r.canvasCount === 1, `${r.canvasCount}`);
  check('canvas fills the card',
    !!r.card && !!r.canvasBox &&
    Math.abs(r.card.w - r.canvasBox.w) <= 2 && Math.abs(r.card.h - r.canvasBox.h) <= 2,
    r.canvasBox ? `card ${r.card.w}x${r.card.h} vs canvas ${r.canvasBox.w}x${r.canvasBox.h}` : '');
  /* screen is lighten-only: screening orange over a near-white page returns
     white, so a blend mode here would erase the colour it is meant to add. */
  check('no lighten-only blend on the render', r.blend === 'normal' && r.canvasBlend === 'normal',
    `host=${r.blend} canvas=${r.canvasBlend}`);
  check('ambient bleed present', /radial-gradient/.test(r.bleed || ''), r.bleed || 'none');

  const fb = await page.evaluate(() => new Promise((resolve) => {
    requestAnimationFrame(() => {
      const c = document.querySelector('.shadow-2xl canvas');
      if (!c) return resolve({ err: 'no canvas' });
      const gl = c.getContext('webgl2') || c.getContext('webgl');
      if (!gl) return resolve({ err: 'no gl handle' });
      const px = new Uint8Array(c.width * c.height * 4);
      gl.readPixels(0, 0, c.width, c.height, gl.RGBA, gl.UNSIGNED_BYTE, px);
      let n = 0, lit = 0, warm = 0, maxL = 0, mean = 0;
      for (let i = 0; i < px.length; i += 4) {
        const l = (px[i] + px[i + 1] + px[i + 2]) / 3;
        n++; mean += l; if (l > 8) lit++; if (l > maxL) maxL = l;
        if (px[i] > px[i + 2] + 8) warm++;
      }
      resolve({
        size: `${c.width}x${c.height}`, glError: gl.getError(),
        meanLuma: Math.round(mean / n),
        pctLit: +((lit / n) * 100).toFixed(1),
        pctWarm: +((warm / n) * 100).toFixed(1),
        maxLuma: Math.round(maxL),
      });
    });
  }));

  check('WebGL context healthy', fb.glError === 0, `glError=${fb.glError} ${fb.size || ''}`);
  check('shader renders, not a black frame', fb.pctLit > 15,
    `${fb.pctLit}% lit, mean=${fb.meanLuma}, max=${fb.maxLuma}`);
  check('render is warm, not grey', fb.pctWarm > 8, `${fb.pctWarm}% warm pixels`);

  /* The check that matters: hide the canvas and the card must change. If it
     does not, the render is buried behind something and the whole change is
     cosmetic. */
  const on = await cardMean(page);
  await page.evaluate(() => { document.querySelector('.shadow-2xl canvas').style.visibility = 'hidden'; });
  await page.waitForTimeout(400);
  const off = await cardMean(page);
  await page.evaluate(() => { document.querySelector('.shadow-2xl canvas').style.visibility = ''; });
  await page.waitForTimeout(300);

  const delta = on.mean.map((v, i) => +(v - off.mean[i]).toFixed(1));
  const moved = Math.max(...delta.map(Math.abs));
  check('the black hole is what the card actually shows', on.n > 500 && moved > 8,
    `delta ${delta.join(', ')} over ${on.n}px`);

  /* CORS rejections are an artifact of THIS harness, not a site bug: the page
     is served from an ad-hoc port (e.g. 4484) that the backend's origin
     allowlist does not include, so the Footer's client-side fetch to the API
     is blocked. In production the UI is served from an allowed origin. The
     RSC / resource-load patterns are pre-existing prerender noise. */
  const real = errs.filter(
    (e) => !/RSC|_rsc|Failed to load resource|blocked by CORS policy|CORS policy/i.test(e),
  );
  check('no JS errors', real.length === 0, real.slice(0, 2).join(' | '));

  await page.screenshot({ path: `${OUT}/blackhole-${loc}.png` });
  await page.close();
}

await browser.close();
server.close();
console.log(`\n--------------\n  ${pass} passed / ${fail} failed\n--------------\n`);
process.exit(fail === 0 ? 0 : 1);
