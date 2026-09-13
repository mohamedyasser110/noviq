/* ============================================================
   BUILD STATIC — fills nav, hero, section headers & footer text
   from NOVIQ_CONTENT. Runs before the grid builders so labels
   and copy are in place immediately (no flash of empty content).
   ============================================================ */

/* Headers that use the character-by-character split reveal —
   matches the original design's emphasis on the first four
   content sections. Add an id here to opt any future header in. */
function buildSectionHeader(id, data) {
  const el = document.getElementById(id);
  if (!el || !data) return;
  const eyebrow = localized(data,'eyebrow') || (typeof t === 'function' ? t(data.eyebrow) : data.eyebrow);
  const title = localized(data,'title') || (typeof t === 'function' ? t(data.title) : data.title);
  const desc = data.desc ? (localized(data,'desc') || (typeof t === 'function' ? t(data.desc) : data.desc)) : '';
  el.innerHTML = `
    <span class="eyebrow">${eyebrow}</span>
    <h2>${title}</h2>
    ${desc ? `<p>${desc}</p>` : ''}
  `;
}

function buildStaticContent() {
  const C = NOVIQ_CONTENT;

  /* ---- Hero badge typewriter ---- */
  const badgeText = document.getElementById("hero-badge-text");
  if (badgeText) {
    /* Clear any previous typewriter loop to prevent stacking */
    if (window._noviqTypewriterTimer) {
      clearTimeout(window._noviqTypewriterTimer);
      window._noviqTypewriterTimer = null;
    }

    const isAr = document.documentElement.lang === 'ar';

    /* Phrases are suffixes after the SVG "N" icon (the Noviq logo letter).
       Same English phrases in both languages — the N is the brand identity.
       Admin overrides via NOVIQ_CONTENT.typewriter take priority. */
    const tw = C.typewriter || {};
    const arabicPhrases = (Array.isArray(tw.ar) && tw.ar.length) ? tw.ar : null;
    const englishPhrases = [
      C.hero.badge,
      'ew Designs, Built to Impress',
      'ext-Gen AI Platforms',
      'ovel Software Engineering',
      'o-Compromise Performance',
      'avigating Digital Futures',
      'urturing Ideas Into Products',
      'etwork-Ready Enterprise Systems',
      'on-Stop Innovation Pipeline',
      'ext-Level Cloud Architecture',
      'oviq — Engineering the Future',
      'ative Intelligence, Deployed Fast',
      'ight-Time Delivery, Every Sprint',
      'ew Standards in UX & Design',
      'etwork of 32+ Countries Served',
      'ot Just Code — We Build Outcomes',
      'avigating Complex Global Engineering Challenges',
      'ext-Generation Cognitive Systems & Neural Networks',
      'ew Epoch in Enterprise Digital Transformation Platforms',
      'on-Stop Scale & Infinite Elastic Cloud Orchestration',
      'ovel Horizons in Applied Machine Learning Research',
    ];

    const phrases = (isAr && arabicPhrases) ? arabicPhrases : englishPhrases;

    let shuffledPhrases = [...phrases];
    function shuffleArray(arr) {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
    }
    shuffleArray(shuffledPhrases);

    let phraseIdx = 0, charIdx = 0, deleting = false;
    const TYPE_SPEED = isAr ? 70 : 55, DELETE_SPEED = isAr ? 35 : 28, PAUSE_END = 1800, PAUSE_START = 400;
    function typeStep() {
      const current = shuffledPhrases[phraseIdx];
      if (!deleting) {
        badgeText.textContent = current.slice(0, ++charIdx);
        if (charIdx === current.length) {
          deleting = true;
          window._noviqTypewriterTimer = setTimeout(typeStep, PAUSE_END);
          return;
        }
      } else {
        badgeText.textContent = current.slice(0, --charIdx);
        if (charIdx === 0) {
          deleting = false;
          phraseIdx++;
          if (phraseIdx >= shuffledPhrases.length) {
            const lastPhrase = shuffledPhrases[shuffledPhrases.length - 1];
            do {
              shuffleArray(shuffledPhrases);
            } while (shuffledPhrases[0] === lastPhrase && phrases.length > 1);
            phraseIdx = 0;
          }
          window._noviqTypewriterTimer = setTimeout(typeStep, PAUSE_START);
          return;
        }
      }
      window._noviqTypewriterTimer = setTimeout(typeStep, deleting ? DELETE_SPEED : TYPE_SPEED);
    }
    window._noviqTypewriterTimer = setTimeout(typeStep, 800);
  }
  const title = document.getElementById("hero-title");
  if (title) title.innerHTML = `${localized(C.hero,'titleLead') || C.hero.titleLead} <span class="gradient">${localized(C.hero,'titleAccent') || C.hero.titleAccent}</span> ${localized(C.hero,'titleTrail') || C.hero.titleTrail}`;
  const desc = document.getElementById("hero-desc");
  if (desc) desc.textContent = localized(C.hero,'description') || C.hero.description;
  const ctaPrimary = document.getElementById("hero-cta-primary");
  if (ctaPrimary) ctaPrimary.innerHTML = `${localized(C.hero,'ctaPrimary') || C.hero.ctaPrimary} <i data-lucide="arrow-right" style="width:17px;height:17px"></i>`;
  const ctaSecondary = document.getElementById("hero-cta-secondary");
  if (ctaSecondary) ctaSecondary.textContent = localized(C.hero,'ctaSecondary') || C.hero.ctaSecondary;

  /* ---- Stats ---- */
  const statsGrid = document.getElementById("stats-grid");
  if (statsGrid) {
    statsGrid.innerHTML = C.stats.map((s, i) => `
      <div class="reveal noviq-stat" style="transition-delay:${i * 90}ms">
        <div class="noviq-stat-number"><span data-counter data-to="${s.to}" data-suffix="${s.suffix}">0</span></div>
        <div class="noviq-stat-label">${localized(s,'label') || s.label}</div>
      </div>`).join('');
  }

  /* ---- Section headers ---- */
  buildSectionHeader("services-header", C.servicesHeader);
  buildSectionHeader("clients-header", C.clientsHeader);
  buildSectionHeader("why-header", C.whyHeader);
  buildSectionHeader("industries-header", C.industriesHeader);
  buildSectionHeader("portfolio-header", C.portfolioHeader);
  buildSectionHeader("process-header", C.processHeader);
  buildSectionHeader("testimonials-header", C.testimonialsHeader);
  buildSectionHeader("stack-header", C.stackHeader);

  /* ---- Testimonial dots ---- */
  const dots = document.getElementById("testimonial-dots");
  if (dots) {
    dots.innerHTML = C.testimonials.map((_, i) => `<button class="noviq-dot${i === 0 ? ' active' : ''}"></button>`).join('');
  }

  /* ---- Contact ---- */
  const cEyebrow = document.getElementById("contact-eyebrow");
  if (cEyebrow) cEyebrow.textContent = localized(C.contact,'eyebrow') || C.contact.eyebrow;
  const cTitle = document.getElementById("contact-title");
  if (cTitle) cTitle.textContent = localized(C.contact,'title') || C.contact.title;
  const cDesc = document.getElementById("contact-desc");
  if (cDesc) cDesc.textContent = localized(C.contact,'desc') || C.contact.desc;
  const cEmail = document.getElementById("contact-email");
  if (cEmail) cEmail.textContent = localized(C.brand,'email') || C.brand.email;
  const cPhone = document.getElementById("contact-phone");
  if (cPhone) cPhone.textContent = localized(C.brand,'phone') || C.brand.phone;
  const cLocations = document.getElementById("contact-locations");
  if (cLocations) cLocations.textContent = localized(C.brand,'locations') || C.brand.locations;
  const cSubmit = document.getElementById("contact-submit");
  if (cSubmit) cSubmit.textContent = localized(C.contact,'ctaLabel') || C.contact.ctaLabel;

  /* ---- Footer ---- */
  const isAr = document.documentElement.lang === 'ar';
  const fTagline = document.getElementById("footer-tagline");
  if (fTagline) fTagline.textContent = localized(C.footer,'tagline') || C.footer.tagline;

  const fNewsletterTitle = document.getElementById("footer-newsletter-title");
  if (fNewsletterTitle) fNewsletterTitle.textContent = localized(C.footer,'newsletterTitle') || C.footer.newsletterTitle || (isAr ? 'النشرة البريدية' : 'Newsletter');

  const fNewsletterEmail = document.getElementById("newsletter-email");
  if (fNewsletterEmail) fNewsletterEmail.placeholder = localized(C.footer,'newsletterPlaceholder') || C.footer.newsletterPlaceholder || (isAr ? 'أدخل بريدك الإلكتروني' : 'you@company.com');

  const fNewsletterBtn = document.getElementById("newsletter-btn");
  if (fNewsletterBtn) fNewsletterBtn.setAttribute('aria-label', localized(C.footer,'newsletterBtn') || C.footer.newsletterBtn || (isAr ? 'إرسال' : 'Subscribe'));

  const footerGrid = document.getElementById("footer-grid");
  if (footerGrid) {
    const existingCols = footerGrid.querySelectorAll('.noviq-footer-col-dynamic');
    existingCols.forEach(col => col.remove());

    const newsletterCol = footerGrid.querySelector('.noviq-footer-col-newsletter');
    const routeMap = {
      'About': '/about', 'Careers': '/careers', 'Contact': '/contact',
      'Press': '/resources', 'Privacy': '/faq', 'Terms': '/faq',
      'Blog': '/resources', 'Case Studies': '/portfolio', 'Documentation': '/resources',
      'AI Solutions': '/services', 'Custom Software': '/services', 'Cloud': '/solutions',
      'Mobile Apps': '/services', 'Support': '/contact',
      'من نحن': '/about', 'الوظائف': '/careers', 'تواصل معنا': '/contact', 'الأخبار': '/resources',
      'حلول الذكاء الاصطناعي': '/services', 'برمجيات مخصصة': '/services', 'السحابة': '/solutions',
      'تطبيقات موبايل': '/services', 'دراسات الحالة': '/portfolio', 'المدونة': '/resources',
      'التوثيق': '/resources', 'الدعم': '/contact'
    };
    const columnsHtml = (C.footer.columns || []).map(col => `
      <div class="noviq-footer-col noviq-footer-col-dynamic">
        <h5>${localized(col,'title') || col.title}</h5>
        ${(col.links || []).map(l => {
          const text = typeof l === 'string' ? l : (localized(l,'text') || localized(l,'label') || l.text || l.label || '');
          const route = typeof l === 'object' ? (l.route || routeMap[text] || '#') : (routeMap[l] || '#');
          return `<a href="${route.startsWith('/') ? '#' + route : route}">${text}</a>`;
        }).join('')}
      </div>`).join('');
    if (newsletterCol) {
      newsletterCol.insertAdjacentHTML('beforebegin', columnsHtml);
    } else {
      footerGrid.insertAdjacentHTML('beforeend', columnsHtml);
    }
  }

  const fCopyright = document.getElementById("footer-copyright");
  if (fCopyright) fCopyright.textContent = localized(C.footer,'copyright') || C.footer.copyright;
  const fSocial = document.getElementById("footer-social");
  if (fSocial) fSocial.innerHTML = C.footer.social.map(s => {
    const urlMap = { 'LinkedIn': 'https://linkedin.com', 'X': 'https://x.com', 'GitHub': 'https://github.com' };
    return `<a href="${urlMap[s] || '#'}" target="_blank" rel="noopener noreferrer">${s}</a>`;
  }).join('');
}

/* Run immediately — before DOMContentLoaded builders that depend on this text existing */
document.addEventListener("DOMContentLoaded", buildStaticContent);
