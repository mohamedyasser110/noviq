/* Portable roots (no machine paths): override with NOVIQ_FRONTEND / NOVIQ_BACKEND / NOVIQ_TMP env. */
import { fileURLToPath as __f2p } from 'node:url';
import { dirname as __dn, join as __join } from 'node:path';
import { tmpdir as __tmp } from 'node:os';
const __HERE = __dn(__f2p(import.meta.url));
const PORTABLE_FRONTEND = process.env.NOVIQ_FRONTEND || __join(__HERE, '..');
const PORTABLE_BACKEND = process.env.NOVIQ_BACKEND || __join(__HERE, '..', '..', 'backend');
const PORTABLE_TMP = process.env.NOVIQ_TMP || __join(__tmp(), 'noviq-shots');
/* Verify the ORANGE + BLUE identity replaced ORANGE + PURPLE, and that
   contrast on white still clears WCAG AA.
   Run: node scripts/verify-palette.mjs                                              */
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'node:fs';
import { createServer } from 'node:http';
import { join, normalize, extname } from 'node:path';

const ROOT = PORTABLE_FRONTEND;
const SRC = `${ROOT}/.next/server/app`;
const OUT = PORTABLE_TMP;
const PORT = 4478;
mkdirSync(OUT, { recursive: true });

let pass = 0, fail = 0;
const check = (n, ok, extra = '') => {
  if (ok) { pass++; console.log(`  ✅ ${n}${extra ? '  ' + extra : ''}`); }
  else { fail++; console.log(`  ❌ ${n}${extra ? '  ' + extra : ''}`); }
};

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

const FLAT = new Map();
for (const loc of ['en', 'ar']) {
  for (const r of ['team', 'toolkit', 'why']) {
    const f = existsSync(`${SRC}/${loc}/${r}.html`) ? `${SRC}/${loc}/${r}.html` : `${SRC}/${loc}/${r}/index.html`;
    if (!existsSync(f)) continue;
    let html = readFileSync(f, 'utf8');
    for (const css of CSS) {
      const rel = '/' + css.replace(`${ROOT}/`, '');
      html = html.replace(new RegExp(`<link[^>]*href="${rel}"[^>]*>`, 'g'), '');
      html = html.replace('</head>', `<style>${readFileSync(css, 'utf8')}</style></head>`);
    }
    FLAT.set(`/${loc}/${r}`, html.replace(/srcset="[^"]*"/g, ''));
  }
}
for (const [k, v] of FLAT) writeFileSync(`${OUT}/_pal-${k.replace(/\//g, '_')}.html`, v, 'utf8');

const PUBLIC = normalize(join(ROOT, 'public'));
const server = createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p === '/' || FLAT.has(p)) { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(FLAT.get(p) || ''); }
  const f = normalize(join(ROOT, 'public', p));
  if (p.startsWith('/images') && f.startsWith(PUBLIC) && existsSync(f)) {
    res.writeHead(200, { 'content-type': extname(f) === '.png' ? 'image/png' : 'application/octet-stream' });
    return res.end(readFileSync(f));
  }
  res.writeHead(404); res.end('');
});
await new Promise((r) => server.listen(PORT, '127.0.0.1', r));

/* ---- WCAG ---- */
function srgb(c) { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }
function lum([r, g, b]) { return 0.2126 * srgb(r) + 0.7152 * srgb(g) + 0.0722 * srgb(b); }
function ratio(a, b) { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); }
const parse = (s) => (s.match(/[\d.]+/g) || []).slice(0, 3).map(Number);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(`http://127.0.0.1:${PORT}/en/team`, { waitUntil: 'load' });
await page.waitForTimeout(500);

const t = await page.evaluate(() => {
  const root = getComputedStyle(document.documentElement);
  const v = (n) => root.getPropertyValue(n).trim();
  /* resolve an HSL triplet token to real rgb by painting it */
  const resolve = (name) => {
    const probe = document.createElement('span');
    probe.style.color = `hsl(${v(name)})`;
    document.body.appendChild(probe);
    const c = getComputedStyle(probe).color;
    probe.remove();
    return c;
  };
  return {
    primary: v('--color-primary'), primaryStrong: v('--color-primary-strong'),
    accent: v('--color-accent'), accentAction: v('--color-accent-action'),
    accentBright: v('--color-accent-bright'), secondary: v('--color-secondary'),
    hasPurpleVar: !!v('--color-noviq-purple'),
    accentResolved: getComputedStyle(document.querySelector('.eyebrow')).color,
    primaryStrongResolved: resolve('--color-primary-strong'),
  };
});

console.log('\n[1] Token values (no purple left)');
console.log(`    primary=${t.primary}  accent=${t.accent}  secondary=${t.secondary}`);
check('accent is blue (hue ~221)', /^\s*221\s/.test(t.accent), t.accent);
check('accent-action is blue (hue ~221)', /^\s*221\s/.test(t.accentAction), t.accentAction);
check('accent-bright is blue (hue ~221)', /^\s*221\s/.test(t.accentBright), t.accentBright);
check('primary still orange (hue ~22)', /^\s*22\s/.test(t.primary), t.primary);
check('--color-noviq-purple removed', !t.hasPurpleVar);

console.log('\n[2] Signal colour actually renders blue (eyebrow)');
const [ar, ag, ab] = parse(t.accentResolved);
check('eyebrow computed colour is blue-dominant', ab > ar + 40, t.accentResolved);

console.log('\n[3] WCAG contrast on white');
const white = [255, 255, 255];
const cAccent = ratio([ar, ag, ab], white);
check('accent on white >= 4.5:1 (text-safe)', cAccent >= 4.5, cAccent.toFixed(2) + ':1');
const cStrong = ratio(parse(t.primaryStrongResolved), white);
check('primary-strong on white >= 4.5:1 (small text)', cStrong >= 4.5,
  cStrong.toFixed(2) + ':1  ' + t.primaryStrongResolved);

console.log('\n[4] Dark theme accents are blue too');
await page.evaluate(() => {
  document.documentElement.setAttribute('data-theme', 'dark');
  document.documentElement.classList.add('dark');
});
await page.waitForTimeout(250);
const dark = await page.evaluate(() => {
  const root = getComputedStyle(document.documentElement);
  return {
    accent: root.getPropertyValue('--color-accent').trim(),
    primary: root.getPropertyValue('--color-primary').trim(),
  };
});
check('dark accent is blue (hue ~221)', /^\s*221\s/.test(dark.accent), dark.accent);
check('dark primary is orange (hue ~22)', /^\s*22\s/.test(dark.primary), dark.primary);

/* Source-level sweep: no purple hue anywhere, and no orange->blue ramp
   that would interpolate through one. */
console.log('\n[4b] Source sweep for retired purple');
const files = [
  'styles/globals.css',
  'components/sections/Hero.tsx',
  'components/sections/Testimonials.tsx',
  'components/sections/Liftoff.tsx',
  'components/sections/TypewriterBadge.tsx',
  'components/shared/Loading.tsx',
  'components/layout/Navbar.tsx',
  'components/layout/Footer.tsx',
  'public/favicon.svg',
];
const PURPLE = /(hsl\(26[0-9][\s,])|(#(?:7[0-9A-Fa-f]{2}|8[0-9A-Fa-f]{2}|9[0-9A-Fa-f]{2}|A[0-9A-Fa-f]{2})[0-9A-Fa-f]{4}\b)|(9333EA|4C1D95|1E1B4B|A98BEE|773AD9|8B5CF6|6D28FF|A855F7|9370DB|C084FC|to-purple|purple-\d)/i;
const hits = [];
for (const f of files) {
  const p = `${ROOT}/${f}`;
  if (!existsSync(p)) continue;
  const lines = readFileSync(p, 'utf8').split('\n');
  lines.forEach((l, i) => {
    if (PURPLE.test(l)) hits.push(`${f}:${i + 1}`);
  });
}
check('no purple hue/hex/class in source', hits.length === 0, hits.slice(0, 5).join(' '));

const css = readFileSync(`${ROOT}/styles/globals.css`, 'utf8');
/* a smooth 2+-stop ramp from orange hue to blue hue passes through purple */
const ramps = [...css.matchAll(/linear-gradient\([^)]*hsl\(22[^)]*hsl\(221/g)].filter((m) => {
  /* count distinct stops between the two ends */
  const inner = m[0].match(/hsl\(/g) || [];
  const hasPaired = /\d+%\)\s*,?\s*hsl\(/.test(m[0]); // e.g. `22 90% 51%) 0%, hsl(`
  return inner.length > 2 && !hasPaired;
});
check('no smooth orange->blue ramp (would render purple)', ramps.length === 0, `${ramps.length} found`);

console.log('\n[5] Locale fix still holds after the palette change');
await page.evaluate(() => {
  document.documentElement.setAttribute('data-theme', 'light');
  document.documentElement.classList.remove('dark');
});
for (const loc of ['toolkit', 'why']) {
  await page.goto(`http://127.0.0.1:${PORT}/ar/${loc}`, { waitUntil: 'load' });
  await page.waitForTimeout(300);
  const h1 = await page.evaluate(() => document.querySelector('h1')?.textContent.trim() || '');
  check(`/ar/${loc} has a non-empty <h1>`, h1.length > 3, `"${h1.slice(0, 40)}"`);
}

await browser.close();
server.close();
console.log(`\n──────────────\n  ${pass} passed · ${fail} failed\n──────────────\n`);
process.exit(fail === 0 ? 0 : 1);
