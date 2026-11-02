/**
 * REGRESSION GUARD — the canopy logo marquee must behave IDENTICALLY in EN and AR.
 *
 * The bug it protects against: the loop is a translate(0 -> -50%) over two
 * identical groups, which only closes when the groups sit side by side in the
 * same order. Under dir="rtl" the browser mirrors flex layout, putting group 2
 * to the LEFT of group 1, so the translate scrolls the row into empty space and
 * the marquee visibly breaks apart in Arabic.
 *
 * globals.css now pins .flowing-logos-canopy-track / .flowing-logos-group to
 * direction: ltr so the page direction cannot reach the mechanism. If someone
 * removes that pin, or reintroduces an RTL animation-direction override, this
 * test fails.
 *
 * Widths are only compared when the copy matches: a client with an Arabic
 * nameAr legitimately renders a different width, and that is content, not a
 * mechanism difference.
 *
 *   BASE_URL=http://localhost:4321 node tests/marquee-rtl-parity.test.cjs
 */
/* Measures the canopy marquee in both locales with a real browser: the loop is
   only seamless when the two groups are identical and adjacent in the same
   order, so we compare group widths, the track total, and the computed
   animation-direction / direction for EN vs AR. */
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const results = {};

  for (const [loc, url] of [['en', 'http://127.0.0.1:4321/en'], ['ar', 'http://127.0.0.1:4321/ar']]) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.flowing-logos-canopy', { timeout: 20000 });
    /* Fonts must be ready before measuring: a fallback face is a different
       width, which would look like a locale difference when it is only FOUT. */
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(1200);

    results[loc] = await page.evaluate(() => {
      const tracks = [...document.querySelectorAll('.flowing-logos-canopy-track')];
      const first = tracks[0];
      const groups = [...first.querySelectorAll('.flowing-logos-group')];
      const cs = getComputedStyle(first);
      const g0 = groups[0].getBoundingClientRect();
      const g1 = groups[1].getBoundingClientRect();
      const cells = [...groups[0].querySelectorAll('.flowing-wordmark')];
      return {
        dir: document.documentElement.getAttribute('dir'),
        trackDirection: cs.direction,
        animationDirection: cs.animationDirection,
        animationName: cs.animationName,
        duration: cs.animationDuration,
        trackWidth: Math.round(first.getBoundingClientRect().width),
        groupWidths: groups.map((g) => Math.round(g.getBoundingClientRect().width)),
        groupCount: groups.length,
        /* g1 must sit immediately to the RIGHT of g0 by exactly one group
           width for the -50% translate to land on its start. */
        gapBetween: Math.round(g1.left - g0.right),
        g0Left: Math.round(g0.left),
        g1Left: Math.round(g1.left),
        wordmarkCount: first.querySelectorAll('.flowing-wordmark').length,
        firstWordmark: first.querySelector('.flowing-wordmark')?.textContent,
        /* The resolved face + tracking of each cell: proves whether a width
           difference comes from typography or from the loop mechanism. */
        cellMetrics: cells.slice(0, 5).map((c) => {
          const s = getComputedStyle(c);
          return {
            name: c.textContent,
            font: s.fontFamily.split(',')[0].replace(/["']/g, ''),
            tracking: s.letterSpacing,
            size: s.fontSize,
          };
        }),
      };
    });
    await page.close();
  }

  await browser.close();

  for (const loc of ['en', 'ar']) {
    const r = results[loc];
    console.log('--- ' + loc.toUpperCase() + ' ---');
    console.log('  html dir              : ' + r.dir);
    console.log('  track direction       : ' + r.trackDirection);
    console.log('  animation-direction   : ' + r.animationDirection);
    console.log('  animation             : ' + r.animationName + ' ' + r.duration);
    console.log('  groups                : ' + r.groupCount + '  widths=' + r.groupWidths.join(' / '));
    console.log('  track width           : ' + r.trackWidth);
    console.log('  gap between groups    : ' + r.gapBetween + 'px');
    console.log('  g0.left / g1.left     : ' + r.g0Left + ' / ' + r.g1Left);
    console.log('  wordmarks             : ' + r.wordmarkCount + '  first="' + r.firstWordmark + '"');
    for (const c of r.cellMetrics) {
      console.log('      "' + c.name + '"  font=' + c.font + '  size=' + c.size + '  tracking=' + c.tracking);
    }
  }

  const en = results.en, ar = results.ar;
  /* Width parity is only expected when the COPY is the same. A client that has
     an Arabic name (nameAr) renders shorter/longer than its English one, so a
     width delta is content, not a mechanism difference. Compare the names and
     only demand equal widths when they match. */
  const namesDiffer = en.cellMetrics.some((c, i) => c.name !== ar.cellMetrics[i].name);
  console.log('\n=== content vs mechanism ===');
  console.log('  cell names identical across locales: ' + !namesDiffer);
  for (let i = 0; i < en.cellMetrics.length; i++) {
    if (en.cellMetrics[i].name !== ar.cellMetrics[i].name) {
      console.log('    differs: "' + en.cellMetrics[i].name + '"  vs  "' + ar.cellMetrics[i].name + '"');
    }
  }

  const checks = [
    ['same group count', en.groupCount === ar.groupCount],
    ['same wordmark count', en.wordmarkCount === ar.wordmarkCount],
    ['identical track direction (loop pinned to LTR)', en.trackDirection === ar.trackDirection && en.trackDirection === 'ltr'],
    ['identical animation-direction (same travel)', en.animationDirection === ar.animationDirection],
    ['identical duration', en.duration === ar.duration],
    ['identical group widths when the copy matches', namesDiffer || JSON.stringify(en.groupWidths) === JSON.stringify(ar.groupWidths)],
    ['both groups identical in size (seamless loop)', en.groupWidths[0] === en.groupWidths[1] && ar.groupWidths[0] === ar.groupWidths[1]],
    ['Arabic cells get neutral tracking (no sheared script)', ar.cellMetrics.every((c) => c.tracking === 'normal' || c.tracking === '0px')],
  ];
  console.log('\n=== parity ===');
  let fail = 0;
  for (const [name, ok] of checks) {
    if (!ok) fail++;
    console.log((ok ? 'PASS  ' : 'FAIL  ') + name);
  }
  console.log('\n' + (checks.length - fail) + '/' + checks.length + ' parity checks passed');
  process.exit(fail === 0 ? 0 : 1);
})();

