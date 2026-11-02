/* ============================================================
   Content-health audit
   ------------------------------------------------------------
   The CMS is admin-editable, so corruption arrives as data, not code: in one
   incident every Arabic navigation label decoded as box-drawing glyphs (UTF-8
   bytes read through the wrong codepage), which still *rendered* — as
   unbreakable 900px tokens that pushed every Arabic page 597px past the
   viewport. Static tests cannot see stored rows, so this audits the live
   content instead: mojibake strings, empty Arabic siblings, and image
   references that resolve nowhere.

   Usage:
     node scripts/content-audit.js [baseUrl]
     default baseUrl is the production API. Exit 0 = clean, 1 = findings.
   The pure `auditContent()` is unit-tested offline in tests/content-audit.test.js.
   ============================================================ */

const ARABIC = /[؀-ۿ]/;
const SUSPECT = /[‐-ℿ -ÿ]/g;

/** True when `value` looks like text that lost its encoding.
 *  Same rule as frontend/lib/text-integrity.ts: real Arabic anywhere means it
 *  survived; otherwise 3+ suspect codepoints (box drawing, Greek, Latin-1
 *  supplement — where mis-decoded UTF-8 bytes land) flag it. The threshold is
 *  3, not 1, so "© 2026" never trips it. */
function looksLikeMojibake(value) {
  if (typeof value !== 'string') return false;
  const text = value.trim();
  if (!text) return false;
  if (ARABIC.test(text)) return false;
  const suspect = text.match(SUSPECT);
  return suspect !== null && suspect.length >= 3;
}

const IMG_EXT = /\.(webp|png|jpe?g|gif|svg|avif)(\?.*)?$/i;

/** Walk any CMS value. Returns { bad, missingAr, images, arPairs }. */
function auditContent(all) {
  const bad = [];
  const missingAr = {};
  const images = new Set();
  let arPairs = 0;
  const walk = (v, trail) => {
    if (typeof v === 'string') {
      if (looksLikeMojibake(v)) bad.push({ at: trail, sample: v.slice(0, 60) });
      if (IMG_EXT.test(v) || v.indexOf('images/uploads/') === 0 || v.indexOf('/logo/') === 0 || v.indexOf('/images/') === 0) {
        images.add(v);
      }
      return;
    }
    if (Array.isArray(v)) { v.forEach((x, i) => walk(x, `${trail}[${i}]`)); return; }
    if (v && typeof v === 'object') {
      /* Count each bilingual pair once, from the non-Arabic side. Shapes in
         the wild: `title`+`titleAr`, `labelEn`+`labelAr`, and `{en,ar}` maps. */
      const pair = (enK, arK) => {
        if (typeof v[enK] !== 'string' || !v[enK].trim() || !(arK in v)) return;
        arPairs++;
        if (!String(v[arK] || '').trim()) {
          missingAr[trail] = missingAr[trail] || [];
          missingAr[trail].push(arK);
        }
      };
      for (const k of Object.keys(v)) {
        if (typeof v[k] !== 'string' || !v[k].trim()) continue;
        if (/Ar$/.test(k) || k === 'ar') continue; // counted from the other side
        if (k === 'en') { pair('en', 'ar'); continue; }
        if (k.endsWith('En')) { pair(k, k.slice(0, -2) + 'Ar'); continue; }
        pair(k, `${k}Ar`);
      }
      for (const k of Object.keys(v)) walk(v[k], trail ? `${trail}.${k}` : k);
    }
  };
  walk(all, '');
  return { bad, missingAr, images: [...images], arPairs };
}

async function checkImage(url, bases) {
  const p = url.startsWith('/') ? url : `/${url}`;
  let lastStatus = 'unreachable';
  for (const base of bases) {
    /* Throttling (429) is not absence: back off honoring Retry-After and try
       again. Only a 404 here moves on to the next origin; anything else that
       survives five attempts is reported with its status, not silently. */
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 20000);
        const r = await fetch(base + p, { method: 'HEAD', signal: ctrl.signal });
        clearTimeout(t);
        if (r.ok) return null;
        lastStatus = r.status;
        if (r.status === 404) break; // definitively missing here, try next origin
        const wait = r.status === 429
          ? (parseFloat(r.headers.get('retry-after')) || 3) * 1000
          : 1000 * (attempt + 1);
        await new Promise((r2) => setTimeout(r2, wait));
      } catch {
        lastStatus = 'connection failed';
        await new Promise((r2) => setTimeout(r2, 1000 * (attempt + 1)));
      }
    }
  }
  return `${url} (last: ${lastStatus})`;
}

async function main() {
  const base = (process.argv[2] || 'https://api-production-adb9.up.railway.app').replace(/\/+$/, '');
  /* The web origin is NOT derivable from the API origin by string surgery
     (api-production-adb9 vs web-production-ba81f share nothing but the
     project) — a naive replace once pointed every check at a wildcard host
     that 404s everything, and the audit "failed" 16 healthy images. The
     backend publishes its frontend origin at /api/site-config; read it. */
  let web = base;
  try {
    const cfg = await (await fetch(`${base}/api/site-config`)).json();
    if (cfg && cfg.frontendOrigin) web = String(cfg.frontendOrigin).replace(/\/+$/, '');
  } catch { /* fall back to the API origin itself */ }
  const all = await (await fetch(`${base}/api/content`)).json();
  const { bad, missingAr, images, arPairs } = auditContent(all);
  console.log(`checked ${arPairs} EN/AR pairs, ${images.length} image refs`);
  let failed = false;
  if (bad.length) {
    failed = true;
    console.log(`\nMOJIBAKE (${bad.length}):`);
    bad.forEach((b) => console.log(`  ${b.at} :: ${b.sample}`));
  }
  const mk = Object.keys(missingAr);
  if (mk.length) {
    console.log(`\nEMPTY ARABIC (${mk.length} locations):`);
    mk.forEach((k) => console.log(`  ${k} :: ${missingAr[k].join(', ')}`));
  }
  const broken = [];
  for (const u of images) {
    const miss = await checkImage(u, [web, base]);
    if (miss) broken.push(miss);
    await new Promise((r) => setTimeout(r, 600)); // don't burst the origins
  }
  if (broken.length) {
    failed = true;
    console.log(`\nBROKEN IMAGES (${broken.length}):`);
    broken.forEach((u) => console.log(`  ${u}`));
  }
  console.log(failed ? '\nAUDIT FAILED' : '\nAUDIT CLEAN');
  process.exit(failed ? 1 : 0);
}

if (require.main === module) {
  main().catch((e) => { console.error('audit error: ' + e.message); process.exit(2); });
}

module.exports = { auditContent, looksLikeMojibake };
