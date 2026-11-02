/**
 * Confirms the "Start Your Project" CTA is gone from the header,
 * while the rest of the nav is intact.
 *
 *   BASE_URL=http://localhost:4321 node tests/navbar-cta-removed.test.cjs
 */
const { chromium } = require('playwright');

const BASE = process.env.BASE_URL || 'http://localhost:4321';
const LABEL = process.env.CTA_LABEL || 'Start Your Project';

let pass = 0, fail = 0;
const check = (ok, name, detail) => {
  if (ok) pass++; else fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`);
};

(async () => {
  const browser = await chromium.launch();

  try {
    for (const [locale, label] of [['en', LABEL], ['ar', 'ابدأ مشروعك']]) {
      /* ---- desktop viewport ---- */
      const desk = await browser.newPage({ viewport: { width: 1280, height: 900 } });
      // domcontentloaded, not networkidle: the page keeps a connection open
      // (analytics / streaming), so networkidle never settles.
      await desk.goto(`${BASE}/${locale}`, { waitUntil: 'domcontentloaded' });
      await desk.locator('#navbar').waitFor({ state: 'attached', timeout: 30000 });
      const nav = desk.locator('#navbar');

      const cta = await nav.locator('.noviq-nav-cta').count();
      const mobileCta = await nav.locator('.novis-mobile-cta').count();
      const labelHits = await nav.getByText(label, { exact: false }).count();

      check(cta === 0, `[${locale}/desktop] CTA removed`, `.noviq-nav-cta count=${cta}`);
      check(mobileCta === 0, `[${locale}/desktop] mobile CTA removed`, `.novis-mobile-cta count=${mobileCta}`);
      check(labelHits === 0, `[${locale}/desktop] no "${label}" text in #navbar`, `hits=${labelHits}`);

      const navText = (await nav.innerText()).replace(/\s+/g, ' ').trim();
      check(navText.length > 0, `[${locale}/desktop] header still renders`, `"${navText.slice(0, 70)}..."`);
      check(await nav.locator('.noviq-logo').count() === 1, `[${locale}/desktop] logo intact`);
      for (const c of ['#theme-toggle', '#language-toggle', '#header-search-input']) {
        check(await nav.locator(c).count() === 1, `[${locale}/desktop] ${c} intact`);
      }
      await desk.close();

      /* ---- mobile viewport: open the hamburger menu and re-check ---- */
      const mob = await browser.newPage({ viewport: { width: 390, height: 844 } });
      await mob.goto(`${BASE}/${locale}`, { waitUntil: 'domcontentloaded' });
      const mnav = mob.locator('#navbar');
      await mnav.locator('#mobile-toggle').waitFor({ state: 'visible', timeout: 30000 });
      await mob.waitForTimeout(600);
      await mnav.locator('#mobile-toggle').click();
      await mob.waitForTimeout(400);

      const menu = mob.locator('#mobile-menu');
      const open = await menu.isVisible().catch(() => false);
      check(open, `[${locale}/mobile] hamburger menu opens`);
      if (open) {
        const inMenu = await menu.getByText(label, { exact: false }).count();
        const menuCta = await menu.locator('.novis-mobile-cta').count();
        check(inMenu === 0, `[${locale}/mobile] menu has no "${label}"`, `hits=${inMenu}`);
        check(menuCta === 0, `[${locale}/mobile] no CTA button in menu`, `count=${menuCta}`);
        const links = await menu.locator('a').count();
        check(links > 0, `[${locale}/mobile] menu still lists nav links`, `links=${links}`);
      }
      await mob.close();
    }
  } catch (err) {
    fail++;
    console.log('FAIL  runtime error: ' + err.message);
  } finally {
    await browser.close();
  }

  console.log(`\n${fail === 0 ? 'ALL NAVBAR CHECKS PASSED' : fail + ' FAILED'} (${pass} passed, ${fail} failed)`);
  process.exit(fail === 0 ? 0 : 1);
})();
