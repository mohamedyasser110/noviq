const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: true });

  const viewports = [1280, 1366, 1440, 1536];

  for (const w of viewports) {
    const page = await browser.newPage({ viewport: { width: w, height: 800 } });
    await page.goto('http://localhost:4321/en', { waitUntil: 'networkidle' });

    // Set up the full logo state + Our Team + Resources3 + More
    await page.evaluate(() => {
      const fullLogo = document.querySelector('.noviq-logo-desktop-full');
      const iconLogo = document.querySelector('.noviq-logo-desktop-icon');
      if (fullLogo) {
        fullLogo.classList.remove('logo-hidden');
        fullLogo.style.opacity = '1';
        fullLogo.style.display = 'block';
        fullLogo.style.maxWidth = '240px';
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

    // Apply the proposed dynamic styling for the full-logo state
    await page.evaluate(() => {
      const style = document.createElement('style');
      style.id = 'test-dynamic-dimensions';
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

    await page.waitForTimeout(200);

    const positions = await page.evaluate(() => {
      const nav = document.querySelector('.noviq-desktop-nav');
      const more = document.querySelector('.noviq-more')?.getBoundingClientRect();
      const actions = document.querySelector('.noviq-nav-actions')?.getBoundingClientRect();
      const res = document.querySelector('.noviq-shortcut-link')?.getBoundingClientRect();
      return {
        moreRight: Math.round(more.right),
        actionsLeft: Math.round(actions.left),
        overlap: Math.round(more.right - actions.left),
        resRight: Math.round(res.right),
        moreLeft: Math.round(more.left),
        gapBetweenResAndMore: Math.round(more.left - res.right)
      };
    });

    console.log(`Viewport ${w}px results:`, positions);

    const outDir = 'C:/Users/LapShop/.gemini/antigravity-ide/brain/574117f2-3a97-4800-8035-7fb04e0d6b39/scratch';
    const navbar = await page.$('.noviq-navbar');
    await navbar.screenshot({ path: path.join(outDir, `fixed_layout_${w}.png`) });

    await page.close();
  }

  await browser.close();
})();
