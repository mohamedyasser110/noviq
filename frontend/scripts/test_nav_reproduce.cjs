const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: true });
  // Test viewport where user is experiencing it (e.g. 1280, 1366, or 1536 as in metadata: Viewport: 1536x742)
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  await page.goto('http://localhost:4321/en', { waitUntil: 'networkidle' });

  const outDir = 'C:/Users/LapShop/.gemini/antigravity-ide/brain/574117f2-3a97-4800-8035-7fb04e0d6b39/scratch';

  // Inject the extra nav items: Our Team and Resources with badge 3
  await page.evaluate(() => {
    const nav = document.querySelector('.noviq-desktop-nav');
    const moreBtn = document.querySelector('.noviq-more');
    if (!nav || !moreBtn) return;

    // Keep full logo visible
    const fullLogo = document.querySelector('.noviq-logo-desktop-full');
    if (fullLogo) {
      fullLogo.classList.remove('logo-hidden');
    }
    const iconLogo = document.querySelector('.noviq-logo-desktop-icon');
    if (iconLogo) {
      iconLogo.classList.remove('logo-visible');
    }

    // Add Our Team link
    const teamLink = document.createElement('a');
    teamLink.className = 'nav-link';
    teamLink.href = '/en/team';
    teamLink.textContent = 'Our Team';
    nav.insertBefore(teamLink, moreBtn);

    // Add Resources with badge 3
    const resLink = document.createElement('a');
    resLink.className = 'nav-link noviq-shortcut-link';
    resLink.href = '/en/resources';
    resLink.innerHTML = '<span>Resources</span><span class="noviq-unread-badge" style="display:inline-flex; align-items:center; justify-content:center; background:#ea580c; color:#fff; border-radius:9999px; padding:0 5px; font-size:11px; height:18px; margin-inline-start:4px;">3</span>';
    nav.insertBefore(resLink, moreBtn);
  });

  // Check positions of all nav links and more button
  const rects = await page.evaluate(() => {
    const nav = document.querySelector('.noviq-desktop-nav');
    const items = Array.from(nav.children).map(el => {
      const r = el.getBoundingClientRect();
      return { tag: el.tagName, text: el.textContent.trim(), x: r.x, y: r.y, w: r.width, h: r.height };
    });
    const container = document.querySelector('.noviq-navbar-container').getBoundingClientRect();
    const logo = document.querySelector('.noviq-logo').getBoundingClientRect();
    const actions = document.querySelector('.noviq-nav-actions').getBoundingClientRect();
    return { items, container, logo, actions };
  });

  console.log('Nav Elements Layout:', JSON.stringify(rects, null, 2));

  const navbar = await page.$('.noviq-navbar');
  await navbar.screenshot({ path: path.join(outDir, 'nav_overflow_test_1366.png') });
  console.log('Saved nav_overflow_test_1366.png');

  // Also test at 1280px
  await page.setViewportSize({ width: 1280, height: 768 });
  await page.waitForTimeout(200);
  await navbar.screenshot({ path: path.join(outDir, 'nav_overflow_test_1280.png') });
  console.log('Saved nav_overflow_test_1280.png');

  // Also test at 1536px (user metadata viewport!)
  await page.setViewportSize({ width: 1536, height: 768 });
  await page.waitForTimeout(200);
  await navbar.screenshot({ path: path.join(outDir, 'nav_overflow_test_1536.png') });
  console.log('Saved nav_overflow_test_1536.png');

  await browser.close();
})();
