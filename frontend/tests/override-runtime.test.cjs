/**
 * Runtime proof that localStorage content overrides apply without a rebuild.
 *
 * Uses Playwright (already a devDependency) against a running server.
 *   BASE_URL=http://localhost:4321 node tests/override-runtime.test.cjs
 *
 * Steps:
 *   1. load /en/why, capture the <h1 data-content-path="whyHeader.title"> text
 *   2. write a localStorage override BEFORE the app hydrates
 *   3. reload, and assert the rendered text changed
 *   4. clear the override, reload, assert the original text is back
 *
 * That covers the full contract: base render, override applied, override removed.
 */
const { chromium } = require('playwright');

const BASE = process.env.BASE_URL || 'http://localhost:4321';
const URL = BASE + '/en/why';
const PATH = 'whyHeader.title';
const OVERRIDE = 'OVERRIDDEN AT RUNTIME';

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  let pass = 0;
  let fail = 0;
  const check = (ok, name, detail) => {
    if (ok) pass++; else fail++;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`);
  };

  try {
    // 1. baseline
    await page.goto(URL, { waitUntil: 'networkidle' });
    const base = (await page.locator(`[data-content-path="${PATH}"]`).first().innerText()).trim();
    check(base.length > 0, 'baseline <h1> rendered', JSON.stringify(base));
    check(base !== OVERRIDE, 'baseline is not the override value');

    // 2. seed the override for the next load (runs before hydration)
    await page.evaluate(
      ([path, value]) => {
        localStorage.setItem('noviq_content_overrides_v1', JSON.stringify({ [path]: value }));
      },
      [PATH, OVERRIDE]
    );

    // 3. reload -> the bridge should rewrite the node after hydration
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForFunction(
      (sel) => {
        const el = document.querySelector(sel);
        return el && el.textContent.trim().length > 0;
      },
      `[data-content-path="${PATH}"]`,
      { timeout: 15000 }
    );
    // give the post-hydration effect a beat
    await page.waitForTimeout(600);
    const overridden = (await page.locator(`[data-content-path="${PATH}"]`).first().innerText()).trim();
    check(overridden === OVERRIDE, 'override applied at runtime', JSON.stringify(overridden));

    // the untouched sibling must be unchanged
    const desc = (await page.locator('[data-content-path="whyHeader.desc"]').first().innerText()).trim();
    check(desc.length > 0 && desc !== OVERRIDE, 'non-overridden node untouched');

    // 4. clear -> original returns
    await page.evaluate(() => localStorage.removeItem('noviq_content_overrides_v1'));
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(600);
    const restored = (await page.locator(`[data-content-path="${PATH}"]`).first().innerText()).trim();
    check(restored === base, 'clearing the override restores the base copy', JSON.stringify(restored));

    // 5. a corrupt patch must not break the page
    await page.evaluate(() => localStorage.setItem('noviq_content_overrides_v1', '{not json'));
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(400);
    const afterCorrupt = (await page.locator(`[data-content-path="${PATH}"]`).first().innerText()).trim();
    check(afterCorrupt === base, 'corrupt patch is ignored, page still renders', JSON.stringify(afterCorrupt));
    await page.evaluate(() => localStorage.removeItem('noviq_content_overrides_v1'));
  } catch (err) {
    fail++;
    console.log('FAIL  runtime error: ' + err.message);
  } finally {
    await browser.close();
  }

  console.log(`\n${fail === 0 ? 'ALL RUNTIME CHECKS PASSED' : fail + ' FAILED'} (${pass} passed, ${fail} failed)`);
  process.exit(fail === 0 ? 0 : 1);
})();
