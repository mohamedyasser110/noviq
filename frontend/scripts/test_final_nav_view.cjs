const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1536, height: 800 } });
  await page.goto('http://localhost:4321/en', { waitUntil: 'networkidle' });

  // Add items after hydration
  await page.evaluate(() => {
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

    // Apply the styles
    const style = document.createElement('style');
    style.textContent = `
      .noviq-navbar-container {
        max-width: min(1440px, calc(100vw - 2rem)) !important;
        gap: clamp(0.75rem, 1.2vw, 1.5rem) !important;
      }
      .noviq-desktop-nav {
        gap: clamp(0.25rem, 0.45vw, 0.625rem) !important;
      }
      .noviq-desktop-nav .nav-link {
        padding-inline: clamp(0.4rem, 0.6vw, 0.75rem) !important;
        font-size: 14px !important;
      }
      .noviq-header-search {
        width: clamp(140px, 11vw, 170px) !important;
      }
    `;
    document.head.appendChild(style);
  });

  // Make sure full logo is showing
  await page.evaluate(() => {
    const full = document.querySelector('.noviq-logo-desktop-full');
    const icon = document.querySelector('.noviq-logo-desktop-icon');
    if (full) {
      full.className = 'noviq-logo-desktop-full drop-shadow-sm';
      full.style.opacity = '1';
      full.style.maxWidth = '240px';
      full.style.display = 'block';
    }
    if (icon) {
      icon.className = 'noviq-logo-desktop-icon drop-shadow-sm';
      icon.style.opacity = '0';
      icon.style.maxWidth = '0';
    }
  });

  await page.waitForTimeout(300);

  const outDir = 'C:/Users/LapShop/.gemini/antigravity-ide/brain/574117f2-3a97-4800-8035-7fb04e0d6b39/scratch';
  await page.locator('.noviq-navbar').screenshot({ path: path.join(outDir, 'full_logo_fixed_navbar_1536.png') });
  console.log('Saved full_logo_fixed_navbar_1536.png');

  await browser.close();
})();
