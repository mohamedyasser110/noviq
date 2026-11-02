/* ============================================================
   DIGITAL ASSESSMENT — 30-question transformation quiz
   ============================================================ */

const DigitalAssessment = {
  questions: [],
  current: 0,
  answers: [],

  init(container) {
    this.questions = NOVIQ_CONTENT.assessment?.questions || [];
    this.current = 0;
    this.answers = new Array(this.questions.length).fill(null);
    container.innerHTML = `
      <div class="noviq-quiz">
        <div class="noviq-quiz-progress">
          <div class="noviq-quiz-progress-bar">
            <div class="noviq-quiz-progress-fill" id="quiz-fill" style="width:0%"></div>
          </div>
          <div class="noviq-quiz-progress-label" id="quiz-label">${t('Question')} 1 ${t('of')} ${this.questions.length}</div>
        </div>
        <div id="quiz-content"></div>
      </div>`;
    this.showQuestion();
  },

  showQuestion() {
    const content = document.getElementById('quiz-content');
    if (!content) return;
    if (this.current >= this.questions.length) { this.showResult(content); return; }

    const q = this.questions[this.current];
    const selected = this.answers[this.current];

    content.innerHTML = `
      <div class="noviq-quiz-question">
        <h3>${q.question}</h3>
        <div class="noviq-quiz-options" id="quiz-options">
          ${q.options.map((opt, i) => `
            <div class="noviq-quiz-option ${selected === i ? 'selected' : ''}" data-idx="${i}">${opt}</div>`).join('')}
        </div>
      </div>`;

    content.querySelectorAll('.noviq-quiz-option').forEach(el => {
      el.addEventListener('click', () => {
        const idx = parseInt(el.dataset.idx);
        this.answers[this.current] = idx;
        content.querySelectorAll('.noviq-quiz-option').forEach(o => o.classList.remove('selected'));
        el.classList.add('selected');
        setTimeout(() => {
          this.current++;
          document.getElementById('quiz-fill').style.width = `${((this.current) / this.questions.length) * 100}%`;
          document.getElementById('quiz-label').textContent = `${t('Question')} ${Math.min(this.current + 1, this.questions.length)} ${t('of')} ${this.questions.length}`;
          this.showQuestion();
        }, 300);
      });
    });
  },

  showResult(container) {
    const score = this.calculateScore();
    container.innerHTML = `
      <div class="noviq-result-card">
        <h3>${t('Digital Transformation Score')}</h3>
        <div style="font-family:'Space Grotesk';font-size:4rem;font-weight:700;color:var(--accent);margin:16px 0">${score}/100</div>
        <p>${score >= 70 ? t('Your business is well-positioned for digital transformation!') : score >= 40 ? t("You have good foundations but there's room for improvement.") : t('Starting your digital journey will unlock significant potential.')}</p>
        <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin:16px 0">
          ${this.getRecommendations(score).map(r => `<span class="noviq-badge" style="background:rgba(109,40,255,0.1);color:var(--secondary);padding:6px 14px;border-radius:8px;font-size:13px">${r}</span>`).join('')}
        </div>
        <button class="noviq-btn-primary" onclick="navigateTo('contact')">${t('Get Your Full Report')} <i data-lucide="file-text" style="width:16px;height:16px"></i></button>
      </div>`;
  },

  calculateScore() {
    const answered = this.answers.filter(a => a !== null);
    if (answered.length === 0) return 0;
    const total = answered.reduce((s, v) => s + v, 0);
    const max = answered.length * 4;
    return Math.round((total / max) * 100);
  },

  getRecommendations(score) {
    if (score >= 70) return [t('AI Integration'), t('Advanced Analytics'), t('Cloud Optimization')];
    if (score >= 40) return [t('Process Automation'), t('Data Strategy'), t('Digital Workplace')];
    return [t('Digital Assessment'), t('Core System Upgrade'), t('IT Modernization')];
  }
};
