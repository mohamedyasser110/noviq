/* ============================================================
   BUILD CONTACT — enhanced contact page
   ============================================================ */

function renderContactPage(param, container) {
  /* NOTE: unique cp-* IDs — the home section already owns c-name/c-email/
     c-company/c-message + #contact-submit (bound once by initContact in
     contact-form.js). Reusing those IDs here would duplicate them in the
     DOM and getElementById would resolve to the hidden home inputs. */
  const brand = (typeof NOVIQ_CONTENT !== 'undefined' && NOVIQ_CONTENT && NOVIQ_CONTENT.brand) || {};
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
              <input class="noviq-input" placeholder="${t('Full name')}" id="cp-name" aria-label="${t('Full name')}">
              <input class="noviq-input" type="email" placeholder="${t('Work email')}" id="cp-email" aria-label="${t('Work email')}">
            </div>
            <input class="noviq-input" placeholder="${t('Company')}" style="margin-top:12px" id="cp-company" aria-label="${t('Company')}">
            <select class="noviq-select" style="margin-top:12px" id="cp-department" aria-label="${t('Select Department')}">
              <option value="" disabled selected>${t('Select Department')}</option>
              <option>${t('Sales')}</option>
              <option>${t('Support')}</option>
              <option>${t('Partnerships')}</option>
              <option>${t('General Inquiry')}</option>
            </select>
            <textarea class="noviq-input" placeholder="${t('Tell us about your project')}" rows="5" style="margin-top:12px;resize:vertical" id="cp-message" aria-label="${t('Tell us about your project')}"></textarea>
            <button class="noviq-btn-primary" style="width:100%;justify-content:center;margin-top:16px" id="cp-submit">${t('Send Message')} <i data-lucide="send" style="width:15px;height:15px"></i></button>
          </div>
        </div>
        <div>
          <h3>${t('Contact Information')}</h3>
          <div style="display:flex;flex-direction:column;gap:16px;margin-top:16px">
            ${[
              { icon: 'mail', label: t('Email'), val: brand.email || '' },
              { icon: 'phone', label: t('Phone'), val: brand.phone || '' },
              { icon: 'map-pin', label: t('Offices'), val: brand.locations || '' },
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

  if (typeof lucide !== 'undefined') lucide.createIcons();
  if (typeof observeReveal === 'function') {
    container.querySelectorAll('.reveal, .reveal-left, .reveal-right, .reveal-scale').forEach(function (el) { observeReveal(el); });
  }

  /* Real submit states (mirrors contact-form.js): validate → sending
     spinner → success/error toast + restore. Guards keep it silent-safe
     when the API layer is absent. */
  const btn = container.querySelector('#cp-submit');
  const ctaLabel = t('Send Message');
  function cpVal(id) {
    const el = container.querySelector('#' + id);
    return el ? el.value.trim() : '';
  }
  function cpMark(id, bad) {
    const el = container.querySelector('#' + id);
    if (el) el.classList.toggle('error', !!bad);
  }
  if (btn) {
    btn.addEventListener('click', () => {
      const name = cpVal('cp-name');
      const email = cpVal('cp-email');
      const msg = cpVal('cp-message');
      let valid = true;
      cpMark('cp-name', !name); if (!name) valid = false;
      cpMark('cp-email', !email || email.indexOf('@') < 0); if (!email || email.indexOf('@') < 0) valid = false;
      cpMark('cp-message', !msg); if (!msg) valid = false;
      if (!valid) {
        btn.classList.add('noviq-shake');
        setTimeout(() => btn.classList.remove('noviq-shake'), 500);
        return;
      }
      btn.disabled = true;
      btn.textContent = '';
      const spinner = document.createElement('span');
      spinner.className = 'noviq-spinner';
      btn.appendChild(spinner);
      btn.appendChild(document.createTextNode(' ' + t('Sending...')));
      let url = null;
      try { url = (typeof NoviqAPI !== 'undefined' && NoviqAPI) ? NoviqAPI.url('/contact') : null; } catch (e) { url = null; }
      const done = (ok, toastMsg) => {
        if (ok) {
          btn.textContent = '';
          btn.appendChild(document.createTextNode(t('Message Sent') + ' '));
          const check = document.createElement('span');
          check.style.fontSize = '16px';
          check.textContent = '✓';
          btn.appendChild(check);
          btn.style.background = 'var(--success)';
          ['cp-name', 'cp-email', 'cp-company', 'cp-message'].forEach(id => {
            const el = container.querySelector('#' + id);
            if (el) { el.value = ''; el.classList.remove('error'); }
          });
        } else {
          btn.textContent = ctaLabel;
        }
        if (toastMsg && typeof showToast === 'function') showToast(toastMsg);
        setTimeout(() => {
          btn.innerHTML = ctaLabel + ' <i data-lucide="send" style="width:15px;height:15px"></i>';
          btn.disabled = false;
          btn.style.background = '';
          if (typeof lucide !== 'undefined') lucide.createIcons();
        }, 2800);
      };
      if (!url) {
        done(false, t('Failed to send. Please try again.'));
        return;
      }
      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, company: cpVal('cp-company'), department: cpVal('cp-department'), message: msg }),
      })
        .then(r => r.json())
        .then(data => {
          if (data && data.error) { done(false, data.error); return; }
          done(true, t('Message Sent!'));
        })
        .catch(() => done(false, t('Failed to send. Please try again.')));
    });
    ['cp-name', 'cp-email', 'cp-message'].forEach(id => {
      const el = container.querySelector('#' + id);
      if (el) {
        el.addEventListener('input', () => el.classList.remove('error'));
        el.addEventListener('keydown', e => { if (e.key === 'Enter' && id !== 'cp-message') btn.click(); });
      }
    });
  }
}