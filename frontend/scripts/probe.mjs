/* Portable roots (no machine paths): override with NOVIQ_FRONTEND / NOVIQ_BACKEND / NOVIQ_TMP env. */
import { fileURLToPath as __f2p } from 'node:url';
import { dirname as __dn, join as __join } from 'node:path';
import { tmpdir as __tmp } from 'node:os';
const __HERE = __dn(__f2p(import.meta.url));
const PORTABLE_FRONTEND = process.env.NOVIQ_FRONTEND || __join(__HERE, '..');
const PORTABLE_BACKEND = process.env.NOVIQ_BACKEND || __join(__HERE, '..', '..', 'backend');
const PORTABLE_TMP = process.env.NOVIQ_TMP || __join(__tmp(), 'noviq-shots');
/* Probe computed styles on the standalone preview (file://) — no server needed.
   Run: node scripts/probe.mjs                                                     */
import { chromium } from 'playwright';

const OUT = PORTABLE_TMP;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(`file:///${OUT}/en.html`, { waitUntil: 'load' });
await page.waitForTimeout(600);

const report = await page.evaluate(() => {
  const pick = (sel, props) => {
    const el = document.querySelector(sel);
    if (!el) return { sel, missing: true };
    const cs = getComputedStyle(el);
    const out = { sel };
    for (const p of props) out[p] = cs.getPropertyValue(p);
    return out;
  };
  const root = getComputedStyle(document.documentElement);
  return {
    vars: {
      '--slate-900': root.getPropertyValue('--slate-900') || 'UNDEFINED',
      '--slate-600': root.getPropertyValue('--slate-600') || 'UNDEFINED',
      '--slate-50': root.getPropertyValue('--slate-50') || 'UNDEFINED',
      '--slate-200': root.getPropertyValue('--slate-200') || 'UNDEFINED',
      '--color-text': root.getPropertyValue('--color-text') || 'UNDEFINED',
      '--primary': root.getPropertyValue('--primary') || 'UNDEFINED',
      '--color-primary': root.getPropertyValue('--color-primary') || 'UNDEFINED',
    },
    body: pick('body', ['color', 'background-color', 'font-family']),
    heroH1: pick('#hero-title', ['color', 'font-size', 'font-weight', 'line-height']),
    heroLead: pick('.noviq-lead', ['color', 'font-size']),
    statNum: pick('.noviq-stat-value', ['color', 'font-size', 'font-weight']),
    contactH2: pick('#contact-heading', ['color', 'font-size', 'font-weight']),
    svcCard: pick('.noviq-svc-card', ['border-color', 'border-radius', 'background-color']),
    eyebrow: pick('.eyebrow', ['color', 'font-size', 'letter-spacing', 'text-transform']),
    ctaPrimary: pick('.noviq-cta-primary', ['background-color', 'color', 'border-radius', 'text-transform']),
    navCta: pick('.noviq-nav-cta', ['background-color', 'color', 'font-size']),
    navLink: pick('.noviq-desktop-nav .nav-link', ['color', 'font-size']),
    formInput: pick('#name', ['border-color', 'border-radius', 'background-color']),
    footer: pick('footer', ['background-color', 'border-top-color', 'border-top-width']),
    statsSection: pick('.noviq-stat', ['color']),
  };
});
console.log(JSON.stringify(report, null, 2));
await browser.close();
