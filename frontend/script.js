/* ============================================================
   NOVIQ — MASTER SCRIPT
   ============================================================ */

document.addEventListener("DOMContentLoaded", () => {
  buildServices();
  initLazyBuilds();

  if (typeof lucide !== "undefined") lucide.createIcons();

  initNavbar();
  initTestimonials();
  initContact();
  initNewsletter();
  try { updateAuthUI(); } catch (e) {}
  try { pingAnalytics(); } catch (e) {}

  try { initCursor(); } catch (e) { console.warn('cursor:', e); }
  try { initHudProgress(); } catch (e) { console.warn('hud:', e); }
  try { initMagnetic(); } catch (e) { console.warn('magnetic:', e); }
  try { initTextSplit(); } catch (e) { console.warn('textSplit:', e); }
  try { initParallax(); } catch (e) { console.warn('parallax:', e); }
  try { initEnhancedReveal(); } catch (e) { console.warn('enhancedReveal:', e); }
  try { initIntro(); } catch (e) { console.warn('intro:', e); }
  try { initKeyboardNav(); } catch (e) { console.warn('keyboardNav:', e); }

  /* Force-hide intro overlay after 7 seconds (safety net) */
  setTimeout(() => {
    const overlay = document.getElementById('noviq-intro-overlay');
    if (overlay) {
      overlay.classList.add('fade-out');
      document.body.classList.remove('intro-active');
      setTimeout(() => { if (overlay.parentNode) overlay.remove(); }, 1000);
    }
    try { initReveal(); } catch (e) { console.warn('reveal fallback:', e); }
    try { initGlowBlob(); } catch (e) {}
    try { initHero3D(); } catch (e) {}
  }, 7000);

  initRipple();
  initSPARouter();
});

function initSPARouter() {
  AppRouter.init();

  const R = (path, fn) => AppRouter.register(path, fn);

  R('/home', (p, c) => {
    showHome();
  });

  R('/services', (p, c) => { hideHome(); showApp(); transitionToPage(c, renderServicesPage, p); });
  R('/industries', (p, c) => { hideHome(); showApp(); transitionToPage(c, renderIndustriesPage, p); });
  R('/solutions', (p, c) => { hideHome(); showApp(); transitionToPage(c, renderSolutionsPage, p); });
  R('/portfolio', (p, c) => { hideHome(); showApp(); transitionToPage(c, renderPortfolioPage, p); });
  R('/pricing', (p, c) => { hideHome(); showApp(); transitionToPage(c, renderPricingPage, p); });
  R('/ai-lab', (p, c) => { hideHome(); showApp(); transitionToPage(c, renderAILabPage, p); });
  R('/resources', (p, c) => { hideHome(); showApp(); transitionToPage(c, renderResourcesPage, p); });
  R('/resource', (p, c) => { hideHome(); showApp(); transitionToPage(c, renderResourceDetailPage, p); });
  R('/team', (p, c) => { hideHome(); showApp(); transitionToPage(c, renderTeamPage, p); });
  R('/member', (p, c) => { hideHome(); showApp(); transitionToPage(c, renderMemberDetailPage, p); });
  R('/careers', (p, c) => { hideHome(); showApp(); transitionToPage(c, renderCareersPage, p); });
  R('/faq', (p, c) => { hideHome(); showApp(); transitionToPage(c, renderFAQPage, p); });
  R('/contact', (p, c) => { hideHome(); showApp(); transitionToPage(c, renderContactPage, p); });
  R('/about', (p, c) => { hideHome(); showApp(); transitionToPage(c, renderAboutPage, p); });
  R('/why', (p, c) => { hideHome(); showApp(); transitionToPage(c, renderWhyPage, p); });
  R('/toolkit', (p, c) => { hideHome(); showApp(); transitionToPage(c, renderToolkitPage, p); });
  R('/stack', (p, c) => { hideHome(); showApp(); transitionToPage(c, renderToolkitPage, p); });
  R('/monitor', (p, c) => { hideHome(); showApp(); transitionToPage(c, renderMonitorPage, p); });

  R('/builder', (p, c) => {
    hideHome(); showApp();
    c.innerHTML = '<div class="noviq-page-hero"><div class="noviq-breadcrumb"><a href="#/home">' + t('Home') + '</a> <span>/</span> <span>' + t('Solution Builder') + '</span></div><div class="reveal noviq-hero-badge"><i data-lucide="settings" style="width:14px;height:14px"></i> ' + t('Custom Solution') + '</div><h1>' + t('Build Your Solution') + '</h1><p>' + t("Answer a few questions and we'll generate a custom proposal.") + '</p></div><div class="noviq-page-section" style="padding-top:40px"><div id="builder-container"></div></div>';
    const bc = document.getElementById('builder-container');
    if (bc && typeof SolutionBuilder !== 'undefined') SolutionBuilder.init(bc);
  });

  R('/ai-consultant', (p, c) => {
    hideHome(); showApp();
    c.innerHTML = '<div class="noviq-page-hero" style="padding-bottom:40px"><div class="noviq-breadcrumb"><a href="#/home">' + t('Home') + '</a> <span>/</span> <span>' + t('AI Consultant') + '</span></div><h1>' + t('AI Consultant') + '</h1><p>' + t('Get personalized recommendations for your business.') + '</p></div><div class="noviq-page-section" style="padding-top:40px"><div id="consultant-container" style="max-width:600px;margin:0 auto"></div></div>';
    const cc = document.getElementById('consultant-container');
    if (cc && typeof AIConsultant !== 'undefined') AIConsultant.init(cc);
  });

  R('/estimator', (p, c) => {
    hideHome(); showApp();
    c.innerHTML = '<div class="noviq-page-hero" style="padding-bottom:40px"><div class="noviq-breadcrumb"><a href="#/home">' + t('Home') + '</a> <span>/</span> <span>' + t('Cost Estimator') + '</span></div><h1>' + t('Cost Estimator') + '</h1><p>' + t('Estimate your project budget based on features.') + '</p></div><div class="noviq-page-section" style="padding-top:40px"><div id="estimator-container"></div></div>';
    const ec = document.getElementById('estimator-container');
    if (ec && typeof CostEstimator !== 'undefined') CostEstimator.init(ec);
  });

  R('/assessment', (p, c) => {
    hideHome(); showApp();
    c.innerHTML = '<div class="noviq-page-hero" style="padding-bottom:40px"><div class="noviq-breadcrumb"><a href="#/home">' + t('Home') + '</a> <span>/</span> <span>' + t('Assessment') + '</span></div><h1>' + t('Digital Transformation Assessment') + '</h1><p>' + t('Evaluate your digital readiness with our comprehensive quiz.') + '</p></div><div class="noviq-page-section" style="padding-top:40px"><div id="assessment-container"></div></div>';
    const ac = document.getElementById('assessment-container');
    if (ac && typeof DigitalAssessment !== 'undefined') DigitalAssessment.init(ac);
  });

  R('/roi', (p, c) => {
    hideHome(); showApp();
    c.innerHTML = '<div class="noviq-page-hero" style="padding-bottom:40px"><div class="noviq-breadcrumb"><a href="#/home">' + t('Home') + '</a> <span>/</span> <span>' + t('ROI Calculator') + '</span></div><h1>' + t('ROI Calculator') + '</h1><p>' + t('Compare manual vs AI costs for your business.') + '</p></div><div class="noviq-page-section" style="padding-top:40px"><div id="roi-container"></div></div>';
    const rc = document.getElementById('roi-container');
    if (rc && typeof ROICalculator !== 'undefined') ROICalculator.init(rc);
  });

  R('/login', (p, c) => { hideHome(); showApp(); renderLoginPage(p, c); });
  R('/signup', (p, c) => { hideHome(); showApp(); renderLoginPage(p, c); });
  R('/forgot-password', (p, c) => { hideHome(); showApp(); renderForgotPasswordPage(p, c); });
  R('/account', (p, c) => { hideHome(); showApp(); renderAccountPage(p, c); });

  R('/service', (p, c) => { hideHome(); showApp(); transitionToPage(c, renderServiceDetailPage, p); });
  R('/industry', (p, c) => { hideHome(); showApp(); transitionToPage(c, renderIndustryDetailPage, p); });
  R('/solution', (p, c) => { hideHome(); showApp(); transitionToPage(c, renderSolutionDetailPage, p); });
  R('/case-study', (p, c) => { hideHome(); showApp(); transitionToPage(c, renderCaseStudyPage, p); });
  R('/ai-demo', (p, c) => { hideHome(); showApp(); transitionToPage(c, renderAIDemoPage, p); });

  R('/404', (p, c) => {
    hideHome(); showApp();
    c.innerHTML = '<div class="noviq-page-hero"><h1>' + t('Page Not Found') + '</h1><p>' + t("The page you're looking for doesn't exist.") + '</p><button class="noviq-btn-primary" style="margin-top:16px" onclick="navigateTo(\'home\')">' + t('Go Home') + '</button></div>';
  });

  document.addEventListener('route-change', (e) => {
    updateActiveNav(e.detail.path);
    updatePageMeta(e.detail.path);
    try { pingAnalytics(e.detail.path); } catch {}
  });
}

/* ---- Dynamic SEO: per-route titles & descriptions (EN/AR) ---- */
const PAGE_META = {
  '/home':       { en: ['Noviq — Global Software & AI Engineering Company', 'Custom AI, ERP, CRM, SaaS, cloud, web & mobile — engineered end to end.'], ar: ['نوفيك — هندسة برمجيات وذكاء اصطناعي عالمية', 'ذكاء اصطناعي مخصص، ERP، CRM، سحابة، ويب وموبايل — هندسة متكاملة.'] },
  '/services':   { en: ['Software & AI Services | Noviq', 'AI solutions, custom software, ERP, CRM, cloud, SaaS, web and mobile development services.'], ar: ['خدمات البرمجيات والذكاء الاصطناعي | نوفيك', 'حلول ذكاء اصطناعي وبرمجيات مخصصة وERP وCRM وسحابة وتطوير ويب وموبايل.'] },
  '/industries': { en: ['Industries We Serve | Noviq', 'Healthcare, finance, manufacturing, education, retail, government, and logistics technology solutions.'], ar: ['القطاعات التي نخدمها | نوفيك', 'حلول تقنية للرعاية الصحية والمالية والتصنيع والتعليم والتجزئة والحكومة واللوجستيات.'] },
  '/solutions':  { en: ['Ready-to-Deploy Solutions | Noviq', 'Pre-engineered software packages tailored to your industry, backed by delivery expertise.'], ar: ['حلول جاهزة للإطلاق | نوفيك', 'حزم برمجية جاهزة مصممة لقطاعك ومدعومة بخبرة تسليم حقيقية.'] },
  '/portfolio':  { en: ['Portfolio & Case Studies | Noviq', 'Real projects with measurable results: logistics AI, digital banking, healthcare platforms, and more.'], ar: ['أعمالنا ودراسات الحالة | نوفيك', 'مشاريع حقيقية بنتائج ملموسة: ذكاء لوجستي وبنوك رقمية ومنصات صحية والمزيد.'] },
  '/pricing':    { en: ['Pricing & Plans | Noviq', 'Transparent pricing from Starter to Enterprise. Try the cost estimator for an instant quote.'], ar: ['الأسعار والباقات | نوفيك', 'أسعار شفافة من الأساسية حتى المؤسسية. جرب مقدر التكلفة لعرض فوري.'] },
  '/about':      { en: ['About Noviq | Global Engineering Team', '480+ projects across 32 countries since 2014. Meet the team engineering the future.'], ar: ['عن نوفيك | فريق هندسي عالمي', 'أكثر من 480 مشروعاً في 32 دولة منذ 2014. تعرف على الفريق الذي يصنع المستقبل.'] },
  '/why':        { en: ['Why Noviq — Built Different, Built to Last | Noviq', 'Innovation, precision, scalability, performance, security and reliability — why teams choose Noviq.'], ar: ['لماذا نوفيك — مختلفون وللأبد | نوفيك', 'الابتكار والدقة وقابلية التوسع والأداء والأمان والموثوقية — لماذا تختار الفرق نوفيك.'] },
  '/toolkit':    { en: ['Our Toolkit — Technology We Trust | Noviq', 'React, Node.js, Python, AWS, Azure, PostgreSQL, OpenAI and more — the stack behind 480+ projects.'], ar: ['أدواتنا — التقنيات التي نثق بها | نوفيك', 'React وNode.js وPython وAWS وAzure وPostgreSQL وOpenAI وغيرها — التقنيات وراء أكثر من 480 مشروعاً.'] },
  '/stack':      { en: ['Our Toolkit — Technology We Trust | Noviq', 'React, Node.js, Python, AWS, Azure, PostgreSQL, OpenAI and more — the stack behind 480+ projects.'], ar: ['أدواتنا — التقنيات التي نثق بها | نوفيك', 'React وNode.js وPython وAWS وAzure وPostgreSQL وOpenAI وغيرها — التقنيات وراء أكثر من 480 مشروعاً.'] },
  '/contact':    { en: ['Contact Noviq | Free Consultation', 'Tell us about your project — we reply within one business day. Offices in SF, London, Singapore.'], ar: ['تواصل مع نوفيك | استشارة مجانية', 'أخبرنا عن مشروعك — نرد خلال يوم عمل واحد. مكاتب في سان فرانسيسكو ولندن وسنغافورة.'] },
  '/careers':    { en: ['Careers at Noviq | Join Our Team', 'Open positions for engineers, designers, and thinkers who want to build meaningful technology.'], ar: ['الوظائف في نوفيك | انضم لفريقنا', 'وظائف مفتوحة للمهندسين والمصممين الراغبين ببناء تقنية ذات معنى.'] },
  '/resources':  { en: ['Resources & Insights | Noviq', 'Articles, whitepapers, and technical guides on AI, cloud, and digital transformation.'], ar: ['المصادر والرؤى | نوفيك', 'مقالات وأوراق بحثية وأدلة تقنية عن الذكاء الاصطناعي والسحابة والتحول الرقمي.'] },
  '/resource':   { en: ['Resource | Noviq', 'News, articles, research, and technical guides from Noviq.'], ar: ['محتوى معرفي | نوفيك', 'أخبار ومقالات وأبحاث وأدلة تقنية من نوفيك.'] },
  '/team':       { en: ['Our Team | Noviq', 'Meet the engineers, designers, and strategists behind Noviq. View profiles, portfolios, and CVs.'], ar: ['فريقنا | نوفيك', 'تعرف على المهندسين والمصممين والاستراتيجيين وراء نوفيك. تصفح الملفات والأعمال والسير الذاتية.'] },
  '/member':     { en: ['Team Member | Noviq', 'Meet a member of the Noviq team.'], ar: ['عضو الفريق | نوفيك', 'تعرف على أحد أعضاء فريق نوفيك.'] },
  '/faq':        { en: ['FAQ | Noviq', 'Answers about technologies, timelines, pricing, security, and working with Noviq.'], ar: ['الأسئلة الشائعة | نوفيك', 'إجابات عن التقنيات والمدد والأسعار والأمان والعمل مع نوفيك.'] },
  '/ai-lab':     { en: ['AI Lab — Free Smart Assistant | Noviq', 'Bilingual AI chatbot with image generation, OCR, voice, and translation. Try it free.'], ar: ['مختبر الذكاء الاصطناعي — مساعد ذكي مجاني | نوفيك', 'شات بوت ثنائي اللغة مع توليد صور وOCR وصوت وترجمة. جربه مجاناً.'] },
  '/login':      { en: ['Sign In | Noviq', 'Sign in to your Noviq account.'], ar: ['تسجيل الدخول | نوفيك', 'سجّل الدخول إلى حسابك في نوفيك.'] },
  '/signup':     { en: ['Create Account | Noviq', 'Create your Noviq account to get started.'], ar: ['إنشاء حساب | نوفيك', 'أنشئ حسابك في نوفيك للبدء.'] },
  '/account':    { en: ['My Account | Noviq', 'Manage your Noviq account.'], ar: ['حسابي | نوفيك', 'إدارة حسابك في نوفيك.'] },
};

function updatePageMeta(path) {
  const base = '/' + (path || '/home').split('/')[1];
  const meta = PAGE_META[base] || PAGE_META['/home'];
  const isAr = document.documentElement.lang === 'ar';
  const [title, desc] = isAr ? meta.ar : meta.en;
  document.title = title;
  const md = document.querySelector('meta[name="description"]');
  if (md) md.setAttribute('content', desc);
  const ogT = document.querySelector('meta[property="og:title"]');
  if (ogT) ogT.setAttribute('content', title);
  const ogD = document.querySelector('meta[property="og:description"]');
  if (ogD) ogD.setAttribute('content', desc);
  const ogL = document.querySelector('meta[property="og:locale"]');
  if (ogL) ogL.setAttribute('content', isAr ? 'ar_AR' : 'en_US');
  /* Update canonical + hreflang to reflect current language */
  const canonical = document.querySelector('link[rel="canonical"]');
  if (canonical) {
    const url = canonical.getAttribute('href').split('?')[0];
    canonical.setAttribute('href', url + '?lang=' + (isAr ? 'ar' : 'en'));
  }
  document.querySelectorAll('link[rel="alternate"][hreflang]').forEach(link => {
    const href = link.getAttribute('href').split('?')[0];
    const lang = link.getAttribute('hreflang');
    if (lang === 'x-default') {
      link.setAttribute('href', href);
    } else {
      link.setAttribute('href', href + '?lang=' + lang);
    }
  });
}

/* ---- Footer newsletter ---- */
function initNewsletter() {
  const input = document.getElementById('newsletter-email');
  const btn = document.getElementById('newsletter-btn');
  if (!input || !btn) return;
  const API = (typeof NoviqAPI !== 'undefined' ? NoviqAPI : { url: p => ((window.NOVIQ_API_URL || '') + '/api' + (p || '')) });
  const submit = () => {
    const email = input.value.trim();
    const isAr = document.documentElement.lang === 'ar';
    if (!email || !email.includes('@')) {
      input.classList.add('error');
      setTimeout(() => input.classList.remove('error'), 1200);
      return;
    }
    btn.disabled = true;
    fetch(API.url('/newsletter/subscribe'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
      .then(r => r.json())
      .then(d => {
        btn.disabled = false;
        if (d.error) { showToast(d.error); return; }
        input.value = '';
        showToast(isAr ? 'تم الاشتراك في النشرة البريدية! ✅' : 'Subscribed to the newsletter! ✅');
      })
      .catch(() => {
        btn.disabled = false;
        showToast(isAr ? 'تعذر الاشتراك. حاول مرة أخرى.' : 'Could not subscribe. Please try again.');
      });
  };
  btn.addEventListener('click', submit);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });
}

/* ---- Lightweight visit analytics (no cookies) ---- */
function getVisitorId() {
  let vid = localStorage.getItem('noviq_vid');
  if (!vid) {
    vid = 'v' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
    localStorage.setItem('noviq_vid', vid);
  }
  return vid;
}

function pingAnalytics(path) {
  try {
    const API = (typeof NoviqAPI !== 'undefined' ? NoviqAPI : { url: p => ((window.NOVIQ_API_URL || '') + '/api' + (p || '')) });
    path = path || (location.hash || '#/home').replace('#', '');
    fetch(API.url('/analytics/visit'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, language: document.documentElement.lang, visitorId: getVisitorId() }),
    }).catch(() => {});
  } catch {}
}

function showHome() {
  const homeSections = document.getElementById('home-sections');
  const appMain = document.getElementById('app-main');
  if (homeSections) {
    homeSections.classList.remove('noviq-hidden');
    homeSections.style.display = '';
  }
  if (appMain) { appMain.innerHTML = ''; appMain.style.display = 'none'; }

  try { initGlowBlob(); } catch (e) {}
  try { initHero3D(); } catch (e) {}

  window.scrollTo({ top: 0 });
}

function hideHome() {
  const homeSections = document.getElementById('home-sections');
  if (homeSections) {
    homeSections.classList.add('noviq-hidden');
    homeSections.style.display = '';
  }
}

function showApp() {
  const appMain = document.getElementById('app-main');
  if (appMain) appMain.style.display = '';
}

function updateActiveNav(path) {
  const normalized = `#${path}`;
  const links = document.querySelectorAll('.noviq-desktop-nav a, .noviq-mobile-menu a');
  for (let i = 0; i < links.length; i++) {
    const a = links[i];
    a.style.color = (a.getAttribute('href') || '') === normalized ? 'var(--text)' : '';
  }
}

function showToast(msg, icon) {
  let toast = document.getElementById('noviq-toast-global');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'noviq-toast-global';
    toast.className = 'noviq-toast';
    document.body.appendChild(toast);
  }
  toast.textContent = '';
  if (icon) {
    const iconSpan = document.createElement('span');
    iconSpan.className = 'toast-icon';
    iconSpan.textContent = icon;
    toast.appendChild(iconSpan);
  }
  const msgSpan = document.createElement('span');
  msgSpan.textContent = msg;
  toast.appendChild(msgSpan);
  toast.classList.add('show');
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => toast.classList.remove('show'), 3000);
}

function initRipple() {
  document.querySelectorAll('.noviq-btn-primary, .noviq-btn-secondary').forEach(btn => {
    btn.addEventListener('click', function(e) {
      const rect = this.getBoundingClientRect();
      const ripple = document.createElement('span');
      ripple.className = 'noviq-ripple';
      const size = Math.max(rect.width, rect.height);
      ripple.style.width = ripple.style.height = size + 'px';
      ripple.style.left = (e.clientX - rect.left - size / 2) + 'px';
      ripple.style.top = (e.clientY - rect.top - size / 2) + 'px';
      this.appendChild(ripple);
      setTimeout(() => ripple.remove(), 600);
    });
  });
}
