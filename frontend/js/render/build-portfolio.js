/* ============================================================
   BUILD PORTFOLIO — project showcase + case studies
   ============================================================ */

function renderPortfolioPage(param, container) {
  const isAr = document.documentElement.lang === 'ar';
  const projects = Array.isArray(NOVIQ_CONTENT.projects) ? NOVIQ_CONTENT.projects : [];

  container.innerHTML = `
    <div class="noviq-page-hero">
      <div class="noviq-breadcrumb">
        <a href="#/home">${t('Home')}</a> <span>/</span> <span>${t('Portfolio')}</span>
      </div>
      <div class="reveal noviq-hero-badge"><i data-lucide="briefcase" style="width:14px;height:14px"></i> ${t('Featured Work')}</div>
      <h1>${t('Case Studies From the Field')}</h1>
      <p>${t("Real projects, real results — see how we've helped businesses transform.")}</p>
    </div>
    <div class="noviq-page-section">
      <div class="noviq-projects-grid" id="portfolio-full-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:24px"></div>
    </div>`;

  const grid = document.getElementById('portfolio-full-grid');
  if (grid) {
    projects.forEach((p, i) => {
      const card = document.createElement('div');
      card.className = `reveal noviq-project-card`;
      card.style.transitionDelay = `${(i % 2) * 100}ms`;
      const projectImage = safeProjectAsset(p.img);
      const imgBg = projectImage ? `background-image:url('${projectImage}');background-size:cover;background-position:center;` : '';
      const projectLink = safeProjectUrl(p.link);
      const linkRow = projectLink
        ? `<div style="display:flex;justify-content:space-between;align-items:center;margin-top:16px;padding-top:16px;border-top:1px solid var(--control-border)">
            <a href="${portfolioEscape(projectLink)}" target="_blank" rel="noopener" class="link" style="cursor:pointer;text-decoration:none">${t('Visit Project')} <i data-lucide="external-link" style="width:15px;height:15px;display:inline;vertical-align:middle"></i></a>
          </div>` : '';
      const pTag = localized(p,'tag') || p.tag || '';
      const pTitle = localized(p,'title') || p.title || '';
      const pDesc = localized(p,'desc') || p.desc || '';
      card.innerHTML = `
        <div class="noviq-project-image" style="${imgBg}height:200px;border-radius:12px 12px 0 0;position:relative">
          <div class="noviq-project-overlay"></div>
        </div>
        <div class="noviq-project-body">
          <span class="tag">${portfolioEscape(pTag)}</span>
          <h3>${portfolioEscape(pTitle)}</h3>
          <p>${portfolioEscape(pDesc)}</p>
          <a class="link" onclick="navigateTo('case-study/${i}')" style="cursor:pointer">${t('View Case Study')} <i data-lucide="arrow-up-right" style="width:15px;height:15px;display:inline;vertical-align:middle"></i></a>
          ${linkRow}
        </div>`;
      grid.appendChild(card);
    });
  }
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function renderCaseStudyPage(param, container) {
  const idx = parseInt(param);
  const projects = Array.isArray(NOVIQ_CONTENT.projects) ? NOVIQ_CONTENT.projects : [];
  const p = projects[idx];
  if (!p || isNaN(idx)) { renderPortfolioPage(param, container); return; }

  const csTag = localized(p,'tag') || p.tag || '';
  const csTitle = localized(p,'title') || p.title || '';
  const csDesc = localized(p,'desc') || p.desc || '';
  const csChallenge = localized(p,'challenge') || p.challenge || '';
  const csSolution = localized(p,'solution') || p.solution || '';
  const csResults = localized(p,'results') || p.results || '';
  container.innerHTML = `
    <div class="noviq-page-hero">
      <div class="noviq-breadcrumb">
        <a href="#/home">${t('Home')}</a> <span>/</span> <a href="#/portfolio">${t('Portfolio')}</a> <span>/</span> <span>${portfolioEscape(csTitle)}</span>
      </div>
      <span class="noviq-badge" style="background:rgba(109,40,255,0.15);color:var(--secondary);padding:4px 12px;border-radius:6px;font-size:12px;margin-bottom:16px;display:inline-block">${portfolioEscape(csTag)}</span>
      <h1>${portfolioEscape(csTitle)}</h1>
      <p>${portfolioEscape(csDesc)}</p>
    </div>
    <div class="noviq-page-section">
      <div style="max-width:800px">
        <div class="noviq-page-body" style="flex-direction:column;gap:32px">
          <div>
            <h3>${t('The Challenge')}</h3>
            <p class="noviq-subtitle">${portfolioEscape(csChallenge || t('Our client needed a solution that could scale with rapid growth while maintaining performance and reliability across multiple regions.'))}</p>
          </div>
          <div>
            <h3>${t('Our Solution')}</h3>
            <p class="noviq-subtitle">${portfolioEscape(csSolution || t('We designed and built a modern, cloud-native platform leveraging AI and real-time data processing to deliver measurable outcomes.'))}</p>
          </div>
          <div>
            <h3>${t('Key Results')}</h3>
            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-top:16px">
              ${portfolioResults(p.results).map(r => `
                <div class="reveal noviq-glass-card" style="padding:20px;text-align:center" data-tilt="">
                  <div style="font-family:'Space Grotesk';font-size:1.5rem;font-weight:700;color:var(--accent)">${portfolioEscape(r)}</div>
                </div>`).join('')}
            </div>
          </div>
          <div style="text-align:center;padding:32px 0">
            ${safeProjectUrl(p.link) ? `<a class="noviq-btn-secondary" href="${portfolioEscape(safeProjectUrl(p.link))}" target="_blank" rel="noopener" style="margin-inline-end:10px;text-decoration:none">${t('Visit Project')} <i data-lucide="external-link" style="width:16px;height:16px"></i></a>` : ''}
            <button class="noviq-btn-primary" onclick="navigateTo('contact')">${t('Start a Similar Project')} <i data-lucide="arrow-right" style="width:16px;height:16px"></i></button>
          </div>
        </div>
      </div>
    </div>`;
}

function portfolioEscape(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, function (char) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char];
  });
}

function safeProjectUrl(value) {
  const url = String(value || '').trim();
  return /^(?:https?:\/\/|mailto:|tel:)/i.test(url) ? url : '';
}

function safeProjectAsset(value) {
  const url = String(value || '').trim();
  if (/(?:^|\/)\.\.(?:\/|$)/.test(url)) return '';
  if (/^https?:\/\/[^\s"'()<>]+$/i.test(url)) return url;
  return /^\/?(?:images|assets)\/[A-Za-z0-9_./-]+$/.test(url) ? url : '';
}

function portfolioResults(value) {
  const results = String(value || '').split(/\r?\n|\s*;\s*/).map(function (item) { return item.trim(); }).filter(Boolean).slice(0, 6);
  return results.length ? results : [t('40% Efficiency Gain'), t('99.9% Uptime'), t('3x ROI')];
}
