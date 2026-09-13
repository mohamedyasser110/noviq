/* ============================================================
   BUILD PRICING — pricing page with tiered packages
   ============================================================ */

function renderPricingPage(param, container) {
  const tiers = [
    { name: t('Starter'), price: '$2,999', period: '/mo', desc: t('Perfect for small teams starting their digital journey.'), features: [t('Up to 10 Users'), t('Core Features'), t('Email Support'), t('Basic Analytics'), t('1 Integration')], cta: t('Get Started'), featured: false },
    { name: t('Growth'), price: '$7,999', period: '/mo', desc: t('For growing businesses needing advanced capabilities.'), features: [t('Up to 50 Users'), t('All Features'), t('Priority Support'), t('Advanced Analytics'), t('5 Integrations'), t('AI Assistant'), t('Custom Reports')], cta: t('Most Popular'), featured: true },
    { name: t('Enterprise'), price: t('Custom'), period: '', desc: t('Full-scale solutions for large organizations.'), features: [t('Unlimited Users'), t('Everything in Growth'), t('Dedicated Support'), t('Custom AI Models'), t('Unlimited Integrations'), t('SLA Guarantee'), t('On-premise Option')], cta: t('Contact Us'), featured: false },
  ];

  container.innerHTML = `
    <div class="noviq-page-hero">
      <div class="noviq-breadcrumb">
        <a href="#/home">${t('Home')}</a> <span>/</span> <span>${t('Pricing')}</span>
      </div>
      <div class="reveal noviq-hero-badge"><i data-lucide="credit-card" style="width:14px;height:14px"></i> ${t('Transparent Pricing')}</div>
      <h1>${t('Plans That Scale With You')}</h1>
      <p>${t('Start small, grow big — no hidden fees, no surprises.')}</p>
    </div>
    <div class="noviq-page-section">
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:24px;max-width:1100px;margin:0 auto" id="pricing-grid"></div>
    </div>
    <div class="noviq-page-section-alt" style="text-align:center">
      <h2>${t('Not Sure Which Plan?')}</h2>
      <button class="noviq-btn-primary" onclick="navigateTo('builder')">${t('Build Your Solution')} <i data-lucide="settings" style="width:16px;height:16px"></i></button>
    </div>`;

  const grid = document.getElementById('pricing-grid');
  if (grid) {
    tiers.forEach((tier, i) => {
      const card = document.createElement('div');
      card.className = `reveal noviq-glass-card ${tier.featured ? 'noviq-glass-pricing' : ''}`;
      card.style.transitionDelay = `${i * 120}ms`;
      if (tier.featured) {
        card.style.border = '1px solid rgba(109,40,255,0.3)';
        card.style.boxShadow = '0 0 40px rgba(109,40,255,0.1)';
      }
      card.style.padding = '32px';
      card.style.display = 'flex';
      card.style.flexDirection = 'column';
      card.innerHTML = `
        ${tier.featured ? '<div style="background:var(--accent);color:#fff;font-size:11px;font-weight:600;padding:4px 12px;border-radius:4px;align-self:flex-start;margin-bottom:12px;text-transform:uppercase;letter-spacing:0.06em">' + t('Popular') + '</div>' : ''}
        <h3 style="font-size:1.2rem">${tier.name}</h3>
        <p style="font-size:13px;color:var(--text-secondary);margin:8px 0 16px">${tier.desc}</p>
        <div style="margin-bottom:24px">
          <span style="font-family:'Space Grotesk';font-size:2.5rem;font-weight:700">${tier.price}</span>
          <span style="color:var(--text-secondary);font-size:14px">${tier.period}</span>
        </div>
        <ul style="list-style:none;padding:0;flex:1">
          ${tier.features.map(f => `
            <li style="display:flex;align-items:center;gap:8px;padding:8px 0;font-size:13px;color:var(--text-secondary)">
              <i data-lucide="check" style="width:15px;height:15px;color:var(--secondary);flex-shrink:0"></i> ${f}
            </li>`).join('')}
        </ul>
        <button class="noviq-btn-${tier.featured ? 'primary' : 'secondary'}" style="width:100%;justify-content:center;margin-top:16px" onclick="navigateTo('contact')">${tier.cta} <i data-lucide="arrow-right" style="width:15px;height:15px"></i></button>`;
      grid.appendChild(card);
    });
  }
}