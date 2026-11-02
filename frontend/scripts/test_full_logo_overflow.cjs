const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const w = 1280;
  const page = await browser.newPage({ viewport: { width: w, height: 800 } });
  await page.goto('http://localhost:4321/en', { waitUntil: 'networkidle' });

  // Add items after hydration
  await page.evaluate(() => {
    // Stop any timeouts or transitions
    const fullLogo = document.querySelector('.noviq-logo-desktop-full');
    const iconLogo = document.querySelector('.noviq-logo-desktop-icon');
    if (fullLogo) {
      fullLogo.classList.remove('logo-hidden');
      fullLogo.style.opacity = '1';
      fullLogo.style.display = 'block';
      fullLogo.style.maxWidth = '240px';
      fullLogo.style.width = 'auto';
    }
    if (iconLogo) {
      iconLogo.classList.remove('logo-visible');
      iconLogo.style.opacity = '0';
      iconLogo.style.maxWidth = '0';
    }

    const nav = document.querySelector('.noviq-desktop-nav');
    const moreBtn = document.querySelector('.noviq-more');
    if (!nav || !moreBtn) return;

    const teamLink = document.createElement('a');
    teamLink.className = 'nav-link';
    teamLink.href = '/en/team';
    teamLink.textContent = 'Our Team';
    nav.insertBefore(teamLink, moreBtn);

    const resLink = document.createElement('a');
    resLink.className = 'nav-link noviq-shortcut-link';
    resLink.href = '/en/resources';
    resLink.innerHTML = '<span>Resources</span><span class="noviq-unread-badge" style="display:inline-flex; align-items:center; justify-content:center; background:#ea580c; color:#fff; border-radius:9999px; padding:0 5px; font-size:11px; height:18px; margin-inline-start:4px;">3</span>';
    nav.insertBefore(resLink, moreBtn);
  });

  const outDir = 'C:/Users/LapShop/.gemini/antigravity-ide/brain/574117f2-3a97-4800-8035-7fb04e0d6b39/scratch';
  await page.locator('.noviq-navbar').screenshot({ path: path.join(outDir, 'full_logo_overflow_1280.png') });
  console.log('Saved full_logo_overflow_1280.png');

  const positions = await page.evaluate(() => {
    const items = Array.from(document.querySelectorAll('.noviq-desktop-nav > *')).map(el => {
      const r = el.getBoundingClientRect();
      return { text: el.textContent.slice(0, 15), x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
    });
    return items;
  });
  console.log('Positions:', positions);

  await browser.close();
})();
