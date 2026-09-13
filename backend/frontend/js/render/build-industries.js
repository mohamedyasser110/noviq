/* ============================================================
   BUILD INDUSTRIES — full-page industry listing + detail
   ============================================================ */

function renderIndustriesPage(param, container) {
  container.innerHTML = `
    <div class="noviq-page-hero">
      <div class="noviq-breadcrumb">
        <a href="#/home">${t('Home')}</a> <span>/</span> <span>${t('Industries')}</span>
      </div>
      <div class="reveal noviq-hero-badge"><i data-lucide="building-2" style="width:14px;height:14px"></i> ${t('Who We Serve')}</div>
      <h1>${t('Trusted Across Every Major Industry')}</h1>
      <p>${t('We deliver tailored solutions for healthcare, finance, manufacturing, and more.')}</p>
    </div>
    <div class="noviq-page-section">
      <div class="noviq-industries-grid" id="industries-full-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:16px"></div>
    </div>`;

  const grid = document.getElementById('industries-full-grid');
  if (grid) {
    NOVIQ_CONTENT.industries.forEach((ind, i) => {
      const card = document.createElement('div');
      card.className = `reveal noviq-glass-card noviq-industry-card`;
      card.setAttribute('data-tilt', '');
      card.style.transitionDelay = `${(i % 4) * 80}ms`;
      const icon = createIcon(ind.icon, 26);
      icon.style.color = 'var(--secondary)';
      card.appendChild(icon);
      card.appendChild(createEl('span', null, localized(ind,'title') || ind.title));
      card.addEventListener('click', () => navigateTo(`industry/${ind.title.toLowerCase()}`));
      grid.appendChild(card);
    });
  }
}

function renderIndustryDetailPage(param, container) {
  const ind = NOVIQ_CONTENT.industries.find(i => (localized(i,'title')||i.title).toLowerCase() === param);
  if (!ind) { renderIndustriesPage(param, container); return; }

  container.innerHTML = `
    <div class="noviq-page-hero">
      <div class="noviq-breadcrumb">
        <a href="#/home">${t('Home')}</a> <span>/</span> <a href="#/industries">${t('Industries')}</a> <span>/</span> <span>${localized(ind,'title') || ind.title}</span>
      </div>
      <div class="noviq-icon-badge" style="margin-bottom:16px">${createIcon(ind.icon, 28).outerHTML}</div>
      <h1>${localized(ind,'title') || ind.title}</h1>
    </div>
    <div class="noviq-page-section">
      <div style="max-width:800px">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:32px">
          <div>
            <h3>${t('Industry Challenges')}</h3>
            <ul style="list-style:none;padding:0;margin-top:16px">
              ${[t('Digital transformation lag'), t('Legacy system integration'), t('Data security & compliance'), t('Operational inefficiency')].map(c => `
                <li style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.04);font-size:14px;color:var(--text-secondary)">
                  <span style="color:var(--accent)">●</span> ${c}
                </li>`).join('')}
            </ul>
          </div>
          <div>
            <h3>${t('Our Solutions')}</h3>
            <ul style="list-style:none;padding:0;margin-top:16px">
              ${[t('Custom Software Development'), t('AI & Automation'), t('Cloud Migration'), t('Data Analytics')].map(s => `
                <li style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.04);font-size:14px;color:var(--text-secondary)">
                  <span style="color:var(--secondary)">→</span> ${s}
                </li>`).join('')}
            </ul>
          </div>
        </div>
      </div>
    </div>
    <div class="noviq-page-section-alt" style="text-align:center">
      <h2>${t('Schedule a Consultation')}</h2>
      <button class="noviq-btn-primary" style="margin-top:20px" onclick="navigateTo('contact')">${t('Schedule a Consultation')} <i data-lucide="calendar" style="width:16px;height:16px"></i></button>
    </div>`;
}