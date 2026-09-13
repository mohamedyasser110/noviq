/* ============================================================
   ROI CALCULATOR — manual vs AI comparison
   ============================================================ */

const ROICalculator = {
  state: { employees: 50, hours: 40, rate: 50, tasks: 5, automation: 60 },

  init(container) {
    this.state = { employees: 50, hours: 40, rate: 50, tasks: 5, automation: 60 };
    this.render(container);
  },

  render(container) {
    container.innerHTML = `
      <div class="noviq-roi">
        <div class="noviq-roi-controls">
          <h3 style="margin-bottom:20px;font-size:1.1rem">${t('Your Business Parameters')}</h3>
          ${this.renderSlider('employees', t('Employees'), 5, 500, 50)}
          ${this.renderSlider('hours', t('Hours per Week per Task'), 5, 80, 40)}
          ${this.renderSlider('rate', t('Hourly Rate ($)'), 10, 200, 50)}
          ${this.renderSlider('tasks', t('Tasks per Week'), 1, 20, 5)}
          ${this.renderSlider('automation', t('Automation Feasibility (%)'), 10, 100, 60)}
        </div>
        <div>
          <div class="noviq-roi-result">
            <h3 style="font-size:1rem;margin-bottom:16px">${t('Cost Comparison')}</h3>
            <div class="noviq-roi-comparison">
              <div class="noviq-roi-col manual">
                <h4>${t('Manual')}</h4>
                <div class="value" id="roi-manual">$0</div>
              </div>
              <div class="noviq-roi-col ai">
                <h4>${t('With AI')}</h4>
                <div class="value" id="roi-ai">$0</div>
              </div>
            </div>
            <div class="noviq-result-card" style="padding:16px;margin-top:12px">
              <p style="font-size:13px;color:var(--text-secondary);margin-bottom:4px">${t('Annual Savings')}</p>
              <div style="font-family:'Space Grotesk';font-size:2rem;font-weight:700;color:#22C55E" id="roi-savings">$0</div>
              <p style="font-size:13px;color:var(--text-secondary);margin-top:4px">${t('Efficiency Gain')}: <strong id="roi-efficiency" style="color:var(--text)">0%</strong></p>
            </div>
          </div>
        </div>
      </div>`;
    this.bindEvents();
    this.calculate();
  },

  renderSlider(key, label, min, max, step) {
    return `
      <div class="noviq-roi-control-group">
        <label style="display:flex;justify-content:space-between">
          <span>${label}</span>
          <span id="${key}-val">${this.state[key]}</span>
        </label>
        <input type="range" class="noviq-slider" id="${key}-slider" min="${min}" max="${max}" step="${step}" value="${this.state[key]}">
      </div>`;
  },

  bindEvents() {
    Object.keys(this.state).forEach(key => {
      const slider = document.getElementById(`${key}-slider`);
      if (!slider) return;
      slider.addEventListener('input', () => {
        const val = parseInt(slider.value);
        this.state[key] = val;
        document.getElementById(`${key}-val`).textContent = val;
        this.calculate();
      });
    });
  },

  calculate() {
    const { employees, hours, rate, tasks, automation } = this.state;
    const annualWeeks = 48;

    const manualWeekly = employees * hours * rate * tasks;
    const manualAnnual = manualWeekly * annualWeeks;

    const autoPct = automation / 100;
    const aiCostPerTask = rate * 0.15;
    const aiWeekly = employees * (hours * (1 - autoPct) * rate * tasks) + (tasks * aiCostPerTask * employees * hours * autoPct);
    const aiAnnual = aiWeekly * annualWeeks;

    const savings = manualAnnual - aiAnnual;
    const efficiency = Math.round(autoPct * 100);

    document.getElementById('roi-manual').textContent = `$${manualAnnual.toLocaleString()}`;
    document.getElementById('roi-ai').textContent = `$${Math.round(aiAnnual).toLocaleString()}`;
    document.getElementById('roi-savings').textContent = `$${Math.round(savings).toLocaleString()}`;
    document.getElementById('roi-efficiency').textContent = `${efficiency}%`;
  }
};
