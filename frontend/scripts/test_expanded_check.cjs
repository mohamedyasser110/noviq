const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  await page.goto('http://localhost:4321/en', { waitUntil: 'networkidle' });

  // Add Our Team + Resources3 to nav
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

    const style = document.createElement('style');
    style.textContent = `
      @media (min-width: 1024px) {
        .noviq-navbar.logo-expanded .noviq-navbar-container {
          max-width: min(1440px, calc(100vw - 2rem));
          gap: clamp(0.6rem, 1vw, 1.25rem);
        }
        .noviq-navbar.logo-expanded .noviq-desktop-nav {
          gap: clamp(0.2rem, 0.4vw, 0.5rem);
        }
        .noviq-navbar.logo-expanded .noviq-desktop-nav .nav-link {
          padding-inline: clamp(0.35rem, 0.55vw, 0.65rem);
          font-size: 13.5px;
        }
        .noviq-navbar.logo-expanded .noviq-header-search {
          width: clamp(130px, 10vw, 160px);
        }
      }
    `;
    document.head.appendChild(style);
  });

  // Verify at t=0s (logo-expanded)
  await page.evaluate(() => {
    document.querySelector('.noviq-navbar').classList.add('logo-expanded');
    document.querySelector('.noviq-navbar').classList.remove('logo-collapsed');
    const full = document.querySelector('.noviq-logo-desktop-full');
    if (full) { full.classList.remove('logo-hidden'); full.style.opacity = '1'; }
    const icon = document.querySelector('.noviq-logo-desktop-icon');
    if (icon) { icon.classList.remove('logo-visible'); icon.style.opacity = '0'; }
  });

  await page.waitForTimeout(200);

  const outDir = 'C:/Users/LapShop/.gemini/antigravity-ide/brain/574117f2-3a97-4800-8035-7fb04e0d6b39/scratch';
  await page.locator('.noviq-navbar').screenshot({ path: path.join(outDir, 'verify_full_logo_expanded.png') });
  console.log('Saved verify_full_logo_expanded.png');

  const check = await page.evaluate(() => {
    const more = document.querySelector('.noviq-more').getBoundingClientRect();
    const res = document.querySelector('.noviq-shortcut-link').getBoundingClientRect();
    const actions = document.querySelector('.noviq-nav-actions').getBoundingClientRect();
    return {
      resRight: res.right,
      moreLeft: more.left,
      moreRight: more.right,
      actionsLeft: actions.left,
      overlapWithActions: more.right - actions.left,
      isMoreBelowRes: more.top > res.top + 10
    };
  });
  console.log('Check at 1366px:', check);

  await browser.close();
})();
