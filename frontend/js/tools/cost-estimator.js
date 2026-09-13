/* ============================================================
   COST ESTIMATOR — interactive feature-based pricing
   ============================================================ */

const CostEstimator = {
  features: [],
  state: {},

  init(container) {
    this.features = NOVIQ_CONTENT.costEstimator?.features || [];
    this.state = {};
    this.features.forEach(f => { this.state[f.key] = false; });
    this.render(container);
  },

  render(container) {
    container.innerHTML = `
      <div class="noviq-estimator">
        <div>
          <h3 style="margin-bottom:20px;font-size:1.1rem">${t('Select Features')}</h3>
          <div class="noviq-estimator-features" id="estimator-features"></div>
        </div>
        <div>
          <div class="noviq-estimator-summary" id="estimator-summary">
            <h4 style="font-size:13px;color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.06em">${t('Estimated Budget')}</h4>
            <div class="noviq-estimator-total" id="estimator-total">$0</div>
            <div class="noviq-estimator-chart" id="estimator-chart"></div>
            <p style="font-size:13px;color:var(--text-secondary)">${t('Estimated Timeline')}: <strong id="estimator-timeline" style="color:var(--text)">${t('2-3 months')}</strong></p>
            <button class="noviq-btn-primary" style="width:100%;justify-content:center;margin-top:16px" onclick="navigateTo('contact')">${t('Request Detailed Quote')}</button>
          </div>
        </div>
      </div>`;
    this.renderFeatures();
    this.updateSummary();
  },

  renderFeatures() {
    const list = document.getElementById('estimator-features');
    if (!list) return;
    list.innerHTML = this.features.map(f => `
      <div class="noviq-estimator-feature ${this.state[f.key] ? 'active' : ''}" data-key="${f.key}">
        <label class="noviq-toggle">
          <input type="checkbox" ${this.state[f.key] ? 'checked' : ''} />
          <div class="noviq-toggle-track"></div>
          <span class="noviq-toggle-label">${f.label}</span>
        </label>
        <span class="feature-cost">$${f.cost.toLocaleString()}</span>
      </div>`).join('');

    list.querySelectorAll('.noviq-toggle input').forEach((input, i) => {
      if (this.features[i]) {
        input.addEventListener('change', () => {
          this.state[this.features[i].key] = input.checked;
          this.updateSummary();
          input.closest('.noviq-estimator-feature')?.classList.toggle('active', input.checked);
        });
      }
    });
  },

  updateSummary() {
    const totalEl = document.getElementById('estimator-total');
    const chartEl = document.getElementById('estimator-chart');
    const timelineEl = document.getElementById('estimator-timeline');
    if (!totalEl) return;

    let total = 0;
    let count = 0;
    this.features.forEach(f => {
      if (this.state[f.key]) { total += f.cost; count++; }
    });
    totalEl.textContent = `$${total.toLocaleString()}`;

    if (chartEl) {
      chartEl.innerHTML = this.features.map(f => {
        const active = this.state[f.key];
        return `<div class="noviq-estimator-bar ${active ? 'active' : ''}" style="height:${active ? Math.max(20, (f.cost / 5000) * 100) : 8}px" title="${f.label}: $${f.cost}"></div>`;
      }).join('');
    }

    if (timelineEl) {
      if (count <= 2) timelineEl.textContent = t('1-2 months');
      else if (count <= 4) timelineEl.textContent = t('2-3 months');
      else if (count <= 6) timelineEl.textContent = t('3-5 months');
      else timelineEl.textContent = t('5-8 months');
    }
  }
};
