/* ============================================================
   BUILD ABOUT — about page with team & company history
   ============================================================ */

function renderAboutPage(param, container) {
  container.innerHTML = `
    <div class="noviq-page-hero">
      <div class="noviq-breadcrumb"><a href="#/home">${t('Home')}</a> <span>/</span> <span>${t('About')}</span></div>
      <div class="reveal noviq-hero-badge"><i data-lucide="info" style="width:14px;height:14px"></i> ${t('Who We Are')}</div>
      <h1>${t('Engineering the Future Through Technology')}</h1>
      <p>${t("We're a global team of engineers, designers, and strategists committed to building software that matters.")}</p>
    </div>
    <div class="noviq-page-section">
      <div style="max-width:800px">
        <h2>${t('Our Story')}</h2>
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-top:40px">
          ${[
            { n: '2014', label: t('Founded') },
            { n: '480+', label: t('Projects') },
            { n: '140+', label: t('Clients') },
            { n: '32', label: t('Countries') },
          ].map(s => `
            <div class="reveal noviq-glass-card" style="padding:20px;text-align:center" data-tilt="">
              <div style="font-family:'Space Grotesk';font-size:2rem;font-weight:700;color:var(--accent)">${s.n}</div>
              <div style="font-size:13px;color:var(--text-secondary);margin-top:4px">${s.label}</div>
            </div>`).join('')}
        </div>
      </div>
    </div>
    <div class="noviq-page-section-alt">
      <h2 style="text-align:center;margin-bottom:40px">${t('Our Values')}</h2>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:16px;max-width:900px;margin:0 auto">
        ${[
          { icon: 'sparkles', title: t('Innovation First'), desc: t("We push boundaries and explore what's possible.") },
          { icon: 'shield-check', title: t('Quality Obsession'), desc: t('Every line of code is engineered to the highest standard.') },
          { icon: 'users', title: t('People-Centric'), desc: t('Technology serves people, not the other way around.') },
          { icon: 'globe', title: t('Global Mindset'), desc: t('Diverse perspectives create better solutions.') },
        ].map(v => `
          <div class="reveal noviq-glass-card" style="padding:24px;text-align:center" data-tilt="">
            <div class="noviq-icon-badge" style="margin:0 auto 12px">${createIcon(v.icon, 24).outerHTML}</div>
            <h4 style="font-size:14px">${v.title}</h4>
            <p style="font-size:13px;color:var(--text-secondary);margin-top:6px">${v.desc}</p>
          </div>`).join('')}
      </div>
    </div>
    <div class="noviq-page-section" style="text-align:center">
      <h2>${t('Want to Join Our Team?')}</h2>
      <button class="noviq-btn-primary" onclick="navigateTo('careers')">${t('View Open Positions')} <i data-lucide="arrow-right" style="width:16px;height:16px"></i></button>
    </div>`;
}

/* ============================================================
   WHY NOVIQ — dedicated page (moved out of home to reduce cards)
   Reuses NOVIQ_CONTENT.why + whyHeader so Admin edits still apply.
   Route: #/why — linked from More > Company > Why Noviq
   ============================================================ */
function renderWhyPage(param, container) {
  const C = (typeof NOVIQ_CONTENT !== 'undefined') ? NOVIQ_CONTENT : { why: [], whyHeader: {} };
  const header = C.whyHeader || {};
  const eyebrow = (typeof localized === 'function' ? localized(header, 'eyebrow') : null) || header.eyebrow || 'Why Noviq';
  const title = (typeof localized === 'function' ? localized(header, 'title') : null) || header.title || 'Built Different, Built to Last';
  const items = Array.isArray(C.why) ? C.why : [];
  const dirs = ['reveal-left', 'reveal', 'reveal-right', 'reveal-scale'];

  container.innerHTML = `
    <div class="noviq-page-hero">
      <div class="noviq-breadcrumb"><a href="#/home">${t('Home')}</a> <span>/</span> <span>${t('Why Noviq')}</span></div>
      <div class="reveal noviq-hero-badge"><i data-lucide="award" style="width:14px;height:14px"></i> ${eyebrow}</div>
      <h1>${title}</h1>
      <p>${t('Eight reasons ambitious teams choose Noviq — engineered for outcomes, not just output.')}</p>
    </div>
    <div class="noviq-page-section">
      <div class="noviq-why-grid" id="why-full-grid">
        ${items.map((w, i) => `
          <div class="${dirs[i % 4]} noviq-glass-card noviq-why-card" data-tilt="" style="transition-delay:${(i % 4) * 80 + 30}ms">
            <div style="color:var(--accent);margin-bottom:12px">${createIcon(w.icon || 'sparkles', 24).outerHTML}</div>
            <h4>${(typeof localized === 'function' ? localized(w, 'title') : null) || w.title || ''}</h4>
            <p>${(typeof localized === 'function' ? localized(w, 'desc') : null) || w.desc || ''}</p>
          </div>`).join('')}
      </div>
    </div>
    <div class="noviq-page-section-alt" style="text-align:center">
      <h2>${t('Ready to Build Different?')}</h2>
      <button class="noviq-btn-primary" onclick="navigateTo('contact')">${t('Start Your Project')} <i data-lucide="arrow-right" style="width:16px;height:16px"></i></button>
    </div>`;
}

/* ============================================================
   OUR TOOLKIT — dedicated page (moved out of home to reduce cards)
   Reuses NOVIQ_CONTENT.stack + stackHeader so Admin edits still apply.
   Route: #/toolkit (alias #/stack) — linked from More > Company
   ============================================================ */
function renderToolkitPage(param, container) {
  const C = (typeof NOVIQ_CONTENT !== 'undefined') ? NOVIQ_CONTENT : { stack: [], stackHeader: {} };
  const header = C.stackHeader || {};
  const eyebrow = (typeof localized === 'function' ? localized(header, 'eyebrow') : null) || header.eyebrow || 'Our Toolkit';
  const title = (typeof localized === 'function' ? localized(header, 'title') : null) || header.title || 'Technology We Trust';
  const items = Array.isArray(C.stack) ? C.stack : [];

  container.innerHTML = `
    <div class="noviq-page-hero">
      <div class="noviq-breadcrumb"><a href="#/home">${t('Home')}</a> <span>/</span> <span>${t('Our Toolkit')}</span></div>
      <div class="reveal noviq-hero-badge"><i data-lucide="layers" style="width:14px;height:14px"></i> ${eyebrow}</div>
      <h1>${title}</h1>
      <p>${t('The proven stack behind our 480+ projects — picked for performance, security and scale.')}</p>
    </div>
    <div class="noviq-page-section">
      <div class="noviq-stack-grid" id="toolkit-full-grid" data-no-translate="true">
        ${items.map((tech, i) => `<div class="reveal noviq-stack-chip" style="animation-delay:${(i % 6) * 0.4}s">${tech}</div>`).join('')}
      </div>
    </div>
    <div class="noviq-page-section-alt" style="text-align:center">
      <h2>${t('Have a stack in mind?')}</h2>
      <button class="noviq-btn-primary" onclick="navigateTo('contact')">${t('Start Your Project')} <i data-lucide="arrow-right" style="width:16px;height:16px"></i></button>
    </div>`;
}