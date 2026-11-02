/* ============================================================
   SOLUTION BUILDER — interactive 8-step proposal generator
   - Steps and options are managed centrally from the backend admin
   - Result proposal can be saved as an image (PNG)
   ============================================================ */

const SolutionBuilder = {
  state: { step: 1, data: {} },
  steps: [],

  init(container) {
    this.steps = this._loadSteps();
    this.render(container);
  },

  _loadSteps() {
    const base = (window.NOVIQ_CONTENT && NOVIQ_CONTENT.solutionBuilder && NOVIQ_CONTENT.solutionBuilder.steps) || [];
    return base.map(step => JSON.parse(JSON.stringify(step)));
  },

  render(container) {
    container.innerHTML = `
      <div class="noviq-builder">
        <div class="noviq-stepper" id="builder-stepper"></div>
        <div class="noviq-page-body">
          <div class="noviq-page-content" id="builder-content"></div>
          <div class="noviq-builder-summary" id="builder-summary" style="display:none"></div>
        </div>
        <div class="noviq-builder-nav">
          <button class="noviq-btn-secondary" id="builder-prev" style="display:none">
            <i data-lucide="arrow-left" style="width:16px;height:16px"></i> ${t('Previous')}
          </button>
          <div style="flex:1"></div>
          <button class="noviq-btn-primary" id="builder-next">${t('Next')} <i data-lucide="arrow-right" style="width:16px;height:16px"></i></button>
        </div>
      </div>`;
    this.renderStepper();
    this.renderStep();
    this.bindEvents();
  },

  renderStepper() {
    const stepper = document.getElementById('builder-stepper');
    if (!stepper) return;
    stepper.innerHTML = this.steps.map((s, i) => {
      const idx = i + 1;
      const cls = idx === this.state.step ? 'active' : idx < this.state.step ? 'completed' : '';
      return `
        <div class="noviq-step ${cls}">
          <div class="noviq-step-marker">${idx < this.state.step ? '<i data-lucide="check" style="width:16px;height:16px"></i>' : idx}</div>
          <div class="noviq-step-label">${s.label}</div>
        </div>
        ${i < this.steps.length - 1 ? '<div class="noviq-step-line"></div>' : ''}`;
    }).join('');
  },

  renderStep() {
    const content = document.getElementById('builder-content');
    const summary = document.getElementById('builder-summary');
    const prevBtn = document.getElementById('builder-prev');
    const nextBtn = document.getElementById('builder-next');
    if (!content) return;

    const step = this.steps[this.state.step - 1];
    if (!step) { this.showResult(content); return; }

    content.innerHTML = `
      <div class="noviq-builder-step active">
        <h3>${step.title}</h3>
        <p>${step.desc}</p>
        <div class="noviq-builder-cards" id="builder-options"></div>
      </div>`;

    const opts = document.getElementById('builder-options');
    const selected = this.state.data[step.key] || [];
    step.options.forEach((opt, optIdx) => {
      const card = document.createElement('div');
      card.className = `noviq-builder-card ${selected.includes(opt.value) ? 'selected' : ''}`;
      card.innerHTML = `<div class="card-icon">${opt.icon || ''}</div><h4>${opt.label}</h4>`;
      card.addEventListener('click', () => this.toggleOption(step, opt));
      opts.appendChild(card);
    });

    prevBtn.style.display = this.state.step > 1 ? 'flex' : 'none';
    nextBtn.innerHTML = this.state.step < this.steps.length
      ? t('Next') + ' <i data-lucide="arrow-right" style="width:16px;height:16px"></i>'
      : t('Generate Proposal') + ' <i data-lucide="file-text" style="width:16px;height:16px"></i>';

    if (summary) summary.style.display = 'none';
    this.renderStepper();
    if (typeof lucide !== 'undefined') lucide.createIcons();
  },

  toggleOption(step, opt) {
    const key = step.key;
    if (step.multi !== false) {
      const arr = this.state.data[key] || [];
      const idx = arr.indexOf(opt.value);
      if (idx > -1) arr.splice(idx, 1);
      else arr.push(opt.value);
      this.state.data[key] = arr;
    } else {
      this.state.data[key] = [opt.value];
    }
    this.renderStep();
  },

  showResult(container) {
    const d = this.state.data;
    container.innerHTML = `
      <div class="noviq-result-card noviq-proposal-card" id="proposal-card">
        <div class="proposal-header">
          <div>
            <h3>${t('Your Solution Proposal')}</h3>
            <p style="color:var(--text-secondary);font-size:13px">${t('Generated based on your requirements')}</p>
          </div>
          <div class="noviq-price-display">
            <span class="currency">$</span>
            <span id="proposal-price">${this.estimatePrice()}</span>
            <span class="period">${t('/mo')}</span>
          </div>
        </div>
        <div class="proposal-section">
          <h4>${t('Business Type')}</h4>
          <p>${(d.business || [t('Custom')]).join(', ')}</p>
        </div>
        <div class="proposal-section">
          <h4>${t('Scope')}</h4>
          <p>${(d.scope || [t('Standard')]).join(', ')}</p>
        </div>
        <div class="proposal-section">
          <h4>${t('Solutions Included')}</h4>
          <p>${(d.features || [t('Core System')]).join(', ')}</p>
        </div>
        <div class="proposal-section">
          <h4>${t('Estimated Timeline')}</h4>
          <p>${d.timeline?.[0] || t('3-6 months')}</p>
        </div>
        <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap;margin-top:24px">
          <button class="noviq-btn-primary" onclick="navigateTo('contact')">${t('Request Meeting')} <i data-lucide="calendar" style="width:16px;height:16px"></i></button>
          <button class="noviq-btn-secondary" id="proposal-save-img"><i data-lucide="download" style="width:16px;height:16px"></i> ${t('Save as Image')}</button>
          <button class="noviq-btn-secondary" onclick="SolutionBuilder.reset()"><i data-lucide="refresh-cw" style="width:16px;height:16px"></i> ${t('Start Over')}</button>
        </div>
      </div>`;

    const saveBtn = container.querySelector('#proposal-save-img');
    if (saveBtn) saveBtn.addEventListener('click', () => this._saveAsImage());
    if (typeof lucide !== 'undefined') lucide.createIcons();
  },

  /* Render the proposal card to a PNG via an offscreen SVG <foreignObject>.
     Self-contained — no external html2canvas dependency needed. */
  _saveAsImage() {
    const card = document.getElementById('proposal-card');
    if (!card) return;
    const rect = card.getBoundingClientRect();
    const W = Math.ceil(rect.width) + 48;
    const H = Math.ceil(rect.height) + 48;
    const clone = card.cloneNode(true);
    clone.style.margin = '24px';
    clone.style.boxSizing = 'border-box';

    const cs = getComputedStyle(card);
    const data = `
      <foreignObject x="0" y="0" width="${W}" height="${H}">
        <div xmlns="http://www.w3.org/1999/xhtml" style="width:${W}px;height:${H}px;font-family:${cs.fontFamily}">
          <style>
            .noviq-proposal-card{--text:${getComputedStyle(document.documentElement).getPropertyValue('--text')};
              --text-secondary:${getComputedStyle(document.documentElement).getPropertyValue('--text-secondary')};
              --secondary:${getComputedStyle(document.documentElement).getPropertyValue('--secondary')};
              --accent:${getComputedStyle(document.documentElement).getPropertyValue('--accent')};
              --card:${getComputedStyle(document.documentElement).getPropertyValue('--card')};
              --border:${getComputedStyle(document.documentElement).getPropertyValue('--border')};
              --control-border:${getComputedStyle(document.documentElement).getPropertyValue('--control-border')};
              background:${cs.background};color:${cs.color};}
          </style>
          ${clone.outerHTML}
        </div>
      </foreignObject>`;

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${data}</svg>`;
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = W * 2; canvas.height = H * 2;
      const ctx = canvas.getContext('2d');
      ctx.scale(2, 2);
      ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() || '#fff';
      ctx.fillRect(0, 0, W, H);
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      canvas.toBlob((png) => {
        if (!png) return;
        const a = document.createElement('a');
        a.href = URL.createObjectURL(png);
        a.download = 'noviq-solution-proposal.png';
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      }, 'image/png');
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      if (typeof showToast === 'function') showToast(t('Saved as PDF instead'));
      this._printProposal();
    };
    img.src = url;
  },

  _printProposal() {
    const card = document.getElementById('proposal-card');
    if (!card) return;
    const w = window.open('', '_blank');
    if (!w) return;
    const style = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]')).map(n => n.outerHTML).join('');
    w.document.write(`<!doctype html><html><head><title>${t('Solution Proposal')}</title>${style}</head><body style="background:var(--bg)">${card.outerHTML}</body></html>`);
    w.document.close();
    setTimeout(() => { w.focus(); w.print(); }, 300);
  },

  estimatePrice() {
    const counts = Object.values(this.state.data).reduce((s, v) => s + (Array.isArray(v) ? v.length : 1), 0);
    const base = 1499;
    return (base + counts * 350).toLocaleString();
  },

  bindEvents() {
    document.getElementById('builder-next')?.addEventListener('click', () => {
      if (this.state.step < this.steps.length) {
        this.state.step++;
        this.renderStep();
      } else {
        document.getElementById('builder-content').innerHTML = '';
        this.showResult(document.getElementById('builder-content'));
        document.querySelector('.noviq-builder-nav')?.remove();
      }
    });
    document.getElementById('builder-prev')?.addEventListener('click', () => {
      if (this.state.step > 1) {
        this.state.step--;
        this.renderStep();
      }
    });
  },

  reset() {
    this.state = { step: 1, data: {} };
    const container = document.getElementById('builder-content')?.parentElement;
    if (container) this.render(container);
  }
};
