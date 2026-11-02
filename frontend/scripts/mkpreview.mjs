/* Portable roots (no machine paths): override with NOVIQ_FRONTEND / NOVIQ_BACKEND / NOVIQ_TMP env. */
import { fileURLToPath as __f2p } from 'node:url';
import { dirname as __dn, join as __join } from 'node:path';
import { tmpdir as __tmp } from 'node:os';
const __HERE = __dn(__f2p(import.meta.url));
const PORTABLE_FRONTEND = process.env.NOVIQ_FRONTEND || __join(__HERE, '..');
const PORTABLE_BACKEND = process.env.NOVIQ_BACKEND || __join(__HERE, '..', '..', 'backend');
const PORTABLE_TMP = process.env.NOVIQ_TMP || __join(__tmp(), 'noviq-shots');
/* Turn the prerendered App Router HTML (.next/server/app/<locale>.html) into
   standalone single-file pages with the compiled CSS inlined, so they can be
   screenshotted from file:// with no server involved.

   Run: node scripts/mkpreview.mjs                                                  */
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';

const ROOT = PORTABLE_FRONTEND;
const OUT = PORTABLE_TMP;
mkdirSync(OUT, { recursive: true });

function cssFiles() {
  const dir = `${ROOT}/.next/static/css`;
  if (!existsSync(dir)) return [];
  // discover via manifest-less heuristic: all .css under .next/static
  const out = [];
  const walk = (p) => {
    for (const e of readdirSync(p, { withFileTypes: true })) {
      const full = `${p}/${e.name}`;
      if (e.isDirectory()) walk(full);
      else if (e.name.endsWith('.css')) out.push(full);
    }
  };
  walk(`${ROOT}/.next/static`);
  return out;
}

let made = 0;
for (const locale of ['en', 'ar']) {
  const src = `${ROOT}/.next/server/app/${locale}.html`;
  if (!existsSync(src)) { console.log('MISSING', src); continue; }
  let html = readFileSync(src, 'utf8');

  for (const f of cssFiles()) {
    const css = readFileSync(f, 'utf8');
    const rel = '/' + f.slice(`${ROOT}/`.length).replace(/\\/g, '/');
    html = html.replace(new RegExp(`<link[^>]*href="${rel}"[^>]*>`, 'g'), '');
    html = html.replace('</head>', `<style data-src="${rel}">${css}</style></head>`);
  }

  // Kill optimizer URLs (no server available) and any absolute /_next asset src.
  html = html.replace(/src="\/_next\/image\?url=[^"]*"/g, 'src=""');
  html = html.replace(/srcset="[^"]*"/g, '');

  const dest = `${OUT}/${locale}.html`;
  writeFileSync(dest, html, 'utf8');
  console.log('wrote', dest, html.length, 'bytes');
  made++;
}
console.log(made === 2 ? 'DONE' : 'PARTIAL');
