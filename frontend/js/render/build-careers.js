/* ============================================================
   BUILD CAREERS — job listings page
   ============================================================ */

function renderCareersPage(param, container) {
  const jobs = [
    { title: t('Senior Full Stack Developer'), dept: t('Engineering'), loc: t('Remote'), type: t('Full-time'), desc: 'Build and maintain production systems serving millions. React, Node.js, Python.' },
    { title: t('AI/ML Engineer'), dept: t('AI'), loc: t('Remote'), type: t('Full-time'), desc: 'Design and train custom AI models for enterprise clients. TensorFlow, PyTorch.' },
    { title: t('UI/UX Designer'), dept: t('Design'), loc: t('Remote'), type: t('Full-time'), desc: 'Create beautiful, intuitive interfaces for complex enterprise applications.' },
    { title: t('DevOps Engineer'), dept: t('Infrastructure'), loc: t('Remote'), type: t('Full-time'), desc: 'Manage cloud infrastructure across AWS, Azure, and GCP for 50+ services.' },
    { title: t('Technical Writer'), dept: t('Documentation'), loc: t('Remote'), type: t('Contract'), desc: 'Create clear, comprehensive technical documentation for our platforms.' },
    { title: t('Product Manager'), dept: t('Product'), loc: t('Remote'), type: t('Full-time'), desc: 'Drive product strategy and execution for our core platform offerings.' },
  ];

  container.innerHTML = `
    <div class="noviq-page-hero">
      <div class="noviq-breadcrumb"><a href="#/home">${t('Home')}</a> <span>/</span> <span>${t('Careers')}</span></div>
      <div class="reveal noviq-hero-badge"><i data-lucide="users" style="width:14px;height:14px"></i> ${t('Join Our Team')}</div>
      <h1>${t('Build the Future With Us')}</h1>
      <p>${t("We're looking for talented people who want to work on meaningful technology.")}</p>
    </div>
    <div class="noviq-page-section">
      <div style="max-width:900px;margin:0 auto">
        <div style="display:flex;gap:8px;margin-bottom:32px;flex-wrap:wrap" class="noviq-career-filters">
          <button class="noviq-btn-option active" data-cfilter="all">${t('All')}</button>
          ${[...new Set(jobs.map(j => j.dept))].map(d => `<button class="noviq-btn-option" data-cfilter="${d.toLowerCase()}">${d}</button>`).join('')}
        </div>
        <div class="noviq-careers-grid" style="display:flex;flex-direction:column;gap:12px"></div>
      </div>
    </div>
    <div class="noviq-page-section-alt" style="text-align:center">
      <h2>${t("Don't See the Right Role?")}</h2>
      <button class="noviq-btn-primary" onclick="navigateTo('contact')">${t('Send Open Application')} <i data-lucide="send" style="width:16px;height:16px"></i></button>
    </div>`;

  function renderJobs(filter) {
    const grid = container.querySelector('.noviq-careers-grid');
    if (!grid) return;
    const filtered = filter === 'all' ? jobs : jobs.filter(j => j.dept.toLowerCase() === filter);
    grid.innerHTML = filtered.map(job => `
      <div class="reveal noviq-glass-card" style="padding:24px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px" data-tilt="">
        <div style="flex:1;min-width:200px">
          <h4 style="font-size:15px;margin-bottom:4px">${job.title}</h4>
          <div style="display:flex;gap:12px;font-size:12px;color:var(--text-secondary)">
            <span>${job.dept}</span><span>•</span><span>${job.loc}</span><span>•</span><span>${job.type}</span>
          </div>
          <p style="font-size:13px;color:var(--text-secondary);margin-top:8px">${job.desc}</p>
        </div>
        <button class="noviq-btn-primary" style="flex-shrink:0" onclick="navigateTo('contact')">${t('Apply Now')} <i data-lucide="arrow-right" style="width:14px;height:14px"></i></button>
      </div>`).join('');

    if (typeof observeReveal === 'function') {
      grid.querySelectorAll('.reveal, .reveal-left, .reveal-right, .reveal-scale').forEach(function(item) {
        observeReveal(item);
      });
    }
  }

  renderJobs('all');

  container.querySelector('.noviq-career-filters').addEventListener('click', (e) => {
    const btn = e.target.closest('.noviq-btn-option');
    if (!btn) return;
    container.querySelectorAll('.noviq-btn-option').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderJobs(btn.dataset.cfilter);
  });
}