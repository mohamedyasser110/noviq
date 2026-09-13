/* ============================================================
   BUILD SOLUTIONS — ready-made solution packages
   ============================================================ */

function renderSolutionsPage(param, container) {
  container.innerHTML = `
    <div class="noviq-page-hero">
      <div class="noviq-breadcrumb">
        <a href="#/home">${t('Home')}</a> <span>/</span> <span>${t('Solutions')}</span>
      </div>
      <div class="reveal noviq-hero-badge"><i data-lucide="package" style="width:14px;height:14px"></i> ${t('Ready-Made Solutions')}</div>
      <h1>${t('Proven Solutions, Ready to Deploy')}</h1>
      <p>${t('Pre-engineered packages tailored to your industry, backed by years of delivery expertise.')}</p>
    </div>
    <div class="noviq-page-section">
      <div class="noviq-solutions-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:20px" id="solutions-full-grid"></div>
    </div>`;

  const grid = document.getElementById('solutions-full-grid');
  if (grid) {
    const solutions = NOVIQ_CONTENT.solutions || [
      { title: 'Clinic Management', desc: 'Complete practice management with appointments, EHR, billing, and lab integration.', icon: 'stethoscope', price: '$299/mo' },
      { title: 'School ERP', desc: 'Student records, attendance, grades, scheduling, and parent communication.', icon: 'graduation-cap', price: '$399/mo' },
      { title: 'HR & Payroll', desc: 'Employee database, payroll processing, leave management, and performance tracking.', icon: 'users', price: '$249/mo' },
      { title: 'Inventory System', desc: 'Real-time stock tracking, purchase orders, warehousing, and supplier management.', icon: 'package', price: '$199/mo' },
      { title: 'POS System', desc: 'Point of sale with order management, payments, receipts, and sales analytics.', icon: 'shopping-cart', price: '$149/mo' },
      { title: 'Fleet Management', desc: 'Vehicle tracking, fuel management, maintenance scheduling, and driver logs.', icon: 'truck', price: '$349/mo' },
    ];
    solutions.forEach((s, i) => {
      const card = document.createElement('div');
      card.className = `reveal noviq-glass-card noviq-service-card`;
      card.setAttribute('data-tilt', '');
      card.style.transitionDelay = `${(i % 3) * 90}ms`;
      card.innerHTML = `
        <div class="noviq-icon-badge">${createIcon(s.icon, 22).outerHTML}</div>
        <h3>${localized(s,'title') || s.title}</h3>
        <p>${localized(s,'desc') || s.desc}</p>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:16px;padding-top:16px;border-top:1px solid rgba(255,255,255,0.06)">
          <span style="font-family:'Space Grotesk';font-size:1.1rem;font-weight:600;color:var(--accent)">${s.price}</span>
          <span style="font-size:13px;color:var(--secondary);cursor:pointer">${t('Learn More')} →</span>
        </div>`;
      card.addEventListener('click', () => navigateTo(`solution/${s.title.toLowerCase().replace(/\s+/g, '-')}`));
      grid.appendChild(card);
    });
  }
}

function renderSolutionDetailPage(param, container) {
  const solutions = NOVIQ_CONTENT.solutions || [];
  const sol = solutions.find(s => s.title.toLowerCase().replace(/\s+/g, '-') === param);
  if (!sol) { renderSolutionsPage(param, container); return; }

  container.innerHTML = `
    <div class="noviq-page-hero">
      <div class="noviq-breadcrumb">
        <a href="#/home">${t('Home')}</a> <span>/</span> <a href="#/solutions">${t('Solutions')}</a> <span>/</span> <span>${sol.title}</span>
      </div>
      <div class="noviq-icon-badge" style="margin-bottom:16px">${createIcon(sol.icon, 28).outerHTML}</div>
      <h1>${localized(sol,'title') || sol.title}</h1>
      <p>${localized(sol,'desc') || sol.desc}</p>
    </div>
    <div class="noviq-page-section">
      <div style="display:grid;grid-template-columns:2fr 1fr;gap:40px;align-items:start">
        <div>
          <h3>${t('Key Features')}</h3>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:20px">
            ${[t('Dashboard & Reports'), t('User Management'), t('Role-based Access'), t('Audit Logging'), t('Email Notifications'), t('API Integration'), t('Data Export'), t('Mobile Access')].map(f => `
              <div class="reveal noviq-glass-card" style="padding:14px;display:flex;align-items:center;gap:10px;font-size:13px" data-tilt="">
                <span style="color:var(--secondary)"><i data-lucide="check-circle-2" style="width:16px;height:16px"></i></span> ${f}
              </div>`).join('')}
          </div>
        </div>
        <div>
          <div class="noviq-glass-card" style="padding:28px;position:sticky;top:100px">
            <h4 style="font-size:13px;color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.06em">${t('Starting From')}</h4>
            <div style="font-family:'Space Grotesk';font-size:2.5rem;font-weight:700;color:var(--accent);margin:8px 0">${sol.price}</div>
            <button class="noviq-btn-primary" style="width:100%;justify-content:center;margin-top:16px" onclick="navigateTo('contact')">${t('Get This Solution')} <i data-lucide="arrow-right" style="width:16px;height:16px"></i></button>
            <button class="noviq-btn-secondary" style="width:100%;justify-content:center;margin-top:8px" onclick="navigateTo('builder')">${t('Build Custom')} <i data-lucide="settings" style="width:16px;height:16px"></i></button>
          </div>
        </div>
      </div>
    </div>`;
}