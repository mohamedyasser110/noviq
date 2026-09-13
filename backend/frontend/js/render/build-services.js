/* ============================================================
   BUILD SERVICES — full-page service listing + detail
   ============================================================ */

function renderServicesPage(param, container) {
  container.innerHTML = `
    <div class="noviq-page-hero">
      <div class="noviq-breadcrumb">
        <a href="#/home">${t('Home')}</a> <span>/</span> <span>${t('Services')}</span>
      </div>
      <div class="reveal noviq-hero-badge"><i data-lucide="sparkles" style="width:14px;height:14px"></i> ${t('What We Build')}</div>
      <h1>${t('Full-Spectrum Software & AI Solutions')}</h1>
      <p>${t('From intelligent automation to enterprise-grade platforms, engineered end to end.')}</p>
    </div>
    <div class="noviq-page-section">
      <div class="noviq-services-grid" id="services-full-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px"></div>
    </div>`;

  const grid = document.getElementById('services-full-grid');
  if (grid) {
    NOVIQ_CONTENT.services.forEach((s, i) => {
      const card = document.createElement('div');
      card.className = `reveal noviq-glass-card noviq-trace noviq-service-card`;
      card.setAttribute('data-tilt', '');
      card.style.transitionDelay = `${(i % 3) * 90}ms`;
      card.innerHTML = `
        <div class="noviq-icon-badge">${createIcon(s.icon, 22).outerHTML}</div>
        <h3>${localized(s,'title') || s.title}</h3>
        <p>${localized(s,'desc') || s.desc}</p>`;
      card.addEventListener('click', () => navigateTo(`service/${s.title.toLowerCase().replace(/\s+/g, '-')}`));
      grid.appendChild(card);
    });
  }
}

function renderServiceDetailPage(param, container) {
  const svc = NOVIQ_CONTENT.services.find(s => s.title.toLowerCase().replace(/\s+/g, '-') === param);
  if (!svc) { renderServicesPage(param, container); return; }

  container.innerHTML = `
    <div class="noviq-page-hero">
      <div class="noviq-breadcrumb">
        <a href="#/home">${t('Home')}</a> <span>/</span> <a href="#/services">${t('Services')}</a> <span>/</span> <span>${svc.title}</span>
      </div>
      <div class="noviq-icon-badge" style="margin-bottom:16px">${createIcon(svc.icon, 28).outerHTML}</div>
      <h1>${localized(svc,'title') || svc.title}</h1>
      <p>${localized(svc,'desc') || svc.desc}</p>
    </div>
    <div class="noviq-page-section">
      <div style="max-width:800px">
        <h2>${t('Our Approach')}</h2>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:16px;margin-top:32px">
          ${[t('Requirements Analysis'), t('Architecture Design'), t('Agile Development'), t('Quality Assurance'), t('Deployment'), t('Ongoing Support')].map((step, i) => `
            <div class="reveal noviq-glass-card" style="padding:20px;text-align:center" data-tilt="">
              <div style="font-family:'Space Grotesk';font-size:2rem;font-weight:700;color:var(--accent);margin-bottom:8px">${String(i + 1).padStart(2, '0')}</div>
              <h4 style="font-size:14px">${step}</h4>
            </div>`).join('')}
        </div>
      </div>
    </div>
    <div class="noviq-page-section-alt" style="text-align:center">
      <h2>${t('Ready to Get Started?')}</h2>
      <button class="noviq-btn-primary" onclick="navigateTo('contact')">${t('Start Your Project')} <i data-lucide="arrow-right" style="width:16px;height:16px"></i></button>
    </div>`;
}