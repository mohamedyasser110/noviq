/* ============================================================
   BUILD CONTACT — enhanced contact page
   ============================================================ */

function renderContactPage(param, container) {
  container.innerHTML = `
    <div class="noviq-page-hero">
      <div class="noviq-breadcrumb"><a href="#/home">${t('Home')}</a> <span>/</span> <span>${t('Contact')}</span></div>
      <div class="reveal noviq-hero-badge"><i data-lucide="mail" style="width:14px;height:14px"></i> ${t('Get In Touch')}</div>
      <h1>${t("Let's Build Something Exceptional")}</h1>
      <p>${t("Tell us about your project and we'll get back to you within one business day.")}</p>
    </div>
    <div class="noviq-page-section">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:48px;max-width:1000px;margin:0 auto">
        <div>
          <h3>${t('Send Us a Message')}</h3>
          <div class="noviq-glass-card" style="padding:28px;margin-top:16px">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
              <input class="noviq-input" placeholder="${t('Full name')}" id="c-name" aria-label="${t('Full name')}">
              <input class="noviq-input" type="email" placeholder="${t('Work email')}" id="c-email" aria-label="${t('Work email')}">
            </div>
            <input class="noviq-input" placeholder="${t('Company')}" style="margin-top:12px" id="c-company" aria-label="${t('Company')}">
            <select class="noviq-select" style="margin-top:12px" id="c-department" aria-label="${t('Select Department')}">
              <option>${t('Select Department')}</option>
              <option>${t('Sales')}</option>
              <option>${t('Support')}</option>
              <option>${t('Partnerships')}</option>
              <option>${t('General Inquiry')}</option>
            </select>
            <textarea class="noviq-input" placeholder="${t('Tell us about your project')}" rows="5" style="margin-top:12px;resize:vertical" id="c-message" aria-label="${t('Tell us about your project')}"></textarea>
            <button class="noviq-btn-primary" style="width:100%;justify-content:center;margin-top:16px" id="c-submit">${t('Send Message')} <i data-lucide="send" style="width:15px;height:15px"></i></button>
          </div>
        </div>
        <div>
          <h3>${t('Contact Information')}</h3>
          <div style="display:flex;flex-direction:column;gap:16px;margin-top:16px">
            ${[
              { icon: 'mail', label: t('Email'), val: NOVIQ_CONTENT.brand.email },
              { icon: 'phone', label: t('Phone'), val: NOVIQ_CONTENT.brand.phone },
              { icon: 'map-pin', label: t('Offices'), val: NOVIQ_CONTENT.brand.locations },
            ].map(c => `
              <div class="noviq-glass-card" style="padding:20px;display:flex;align-items:center;gap:14px">
                <div class="noviq-icon-badge">${createIcon(c.icon, 20).outerHTML}</div>
                <div>
                  <div style="font-size:12px;color:var(--text-secondary)">${c.label}</div>
                  <div style="font-size:14px;color:var(--text)">${c.val}</div>
                </div>
              </div>`).join('')}
          </div>
          <div style="margin-top:24px">
            <h4 style="font-size:13px;margin-bottom:12px">${t('Follow Us')}</h4>
            <div style="display:flex;gap:8px">
              ${['LinkedIn', 'X', 'GitHub', 'YouTube'].map(p => `
                <div class="noviq-glass-card" style="padding:12px;cursor:pointer;font-size:13px;color:var(--text-secondary);text-align:center;flex:1" data-tilt="">
                  ${p}
                </div>`).join('')}
            </div>
          </div>
        </div>
      </div>
    </div>`;

  container.querySelector('#c-submit')?.addEventListener('click', () => {
    const btn = container.querySelector('#c-submit');
    btn.textContent = t('Message Sent!') + ' ✓';
    btn.style.background = '#22C55E';
    setTimeout(() => {
      btn.innerHTML = t('Send Message') + ' <i data-lucide="send" style="width:15px;height:15px"></i>';
      btn.style.background = '';
      if (typeof lucide !== 'undefined') lucide.createIcons();
    }, 3000);
  });
}