/* ============================================================
   REVEAL ENGINE — scroll-triggered entrance animations + counters
   ============================================================ */

function initReveal() {
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add("visible");
        io.unobserve(e.target);
      }
    });
  }, { threshold: 0.12 });
  document.querySelectorAll(".reveal").forEach(el => io.observe(el));
}

/* Re-observe for dynamically added elements (lazy-built sections) */
const _revealVariants = [
  { cls: 'reveal-left', threshold: 0.15 },
  { cls: 'reveal-right', threshold: 0.15 },
  { cls: 'reveal-scale', threshold: 0.12 },
  { cls: 'reveal', threshold: 0.15 },
];

function initEnhancedReveal() {
  _revealVariants.forEach(({ cls, threshold }) => {
    const els = document.querySelectorAll(`.${cls}`);
    if (!els.length) return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) { e.target.classList.add('visible'); io.unobserve(e.target); }
      });
    }, { threshold });
    els.forEach(el => io.observe(el));
  });
}

function observeReveal(el) {
  const match = _revealVariants.find(v => el.classList.contains(v.cls));
  if (!match) return;
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); io.unobserve(e.target); } });
  }, { threshold: match.threshold });
  io.observe(el);
}

/* ---- Counters ---- */
function animateCounter(el, to, suffix = "", duration = 1800) {
  let start = null;
  const step = (ts) => {
    if (!start) start = ts;
    const progress = Math.min((ts - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.floor(eased * to).toLocaleString() + suffix;
    if (progress < 1) requestAnimationFrame(step);
    else el.textContent = to.toLocaleString() + suffix;
  };
  requestAnimationFrame(step);
}

function initCounters() {
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        const to = parseInt(e.target.dataset.to);
        const suffix = e.target.dataset.suffix || "";
        animateCounter(e.target, to, suffix);
        io.unobserve(e.target);
      }
    });
  }, { threshold: 0.2 });
  document.querySelectorAll("[data-counter]").forEach(el => io.observe(el));
}

/* ---- 3D tilt on hover ---- */
function initTilt() {
  if (window._deviceTier === 'low') return;
  document.querySelectorAll("[data-tilt]").forEach(el => {
    el.addEventListener("mousemove", e => {
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      el.style.transform = `perspective(900px) rotateX(${(-py*8).toFixed(2)}deg) rotateY(${(px*10).toFixed(2)}deg) translateY(-6px)`;
    });
    el.addEventListener("mouseleave", () => {
      el.style.transform = "perspective(900px) rotateX(0) rotateY(0) translateY(0)";
    });
  });
}

/* ---- Text split reveal (char-by-char EN, word-by-word AR) ---- */
function initTextSplit() {
  const AR_RE = /[\u0600-\u06FF]/;
  document.querySelectorAll('.text-split-reveal').forEach(el => {
    const text = el.textContent.trim();
    el.innerHTML = '';
    const words = text.split(' ');
    words.forEach((word, wi) => {
      if (wi > 0) el.appendChild(document.createTextNode(' '));
      const wSpan = document.createElement('span');
      wSpan.style.display = 'inline-block';
      wSpan.style.whiteSpace = 'nowrap';
      if (AR_RE.test(word)) {
        /* Arabic joins letters contextually — splitting chars into separate
           spans breaks the ligatures (حروف مقطعة). Animate the whole word. */
        const span = document.createElement('span');
        span.className = 'char';
        span.textContent = word;
        span.style.transitionDelay = (wi * 3 * 35) + 'ms';
        wSpan.appendChild(span);
      } else {
        word.split('').forEach((ch, ci) => {
          const span = document.createElement('span');
          span.className = 'char';
          span.textContent = ch;
          span.style.transitionDelay = ((wi * 3 + ci) * 35) + 'ms';
          wSpan.appendChild(span);
        });
      }
      el.appendChild(wSpan);
    });
  });

  const chars = document.querySelectorAll('.text-split-reveal .char');
  if (!chars.length) return;
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
    });
  }, { threshold: 0.5 });
  chars.forEach(c => io.observe(c));
}

/* ---- Parallax layers ---- */
function initParallax() {
  const targets = document.querySelectorAll('[data-parallax]');
  if (!targets.length) return;
  let ticking = false;

  window.addEventListener('scroll', () => {
    if (!ticking) {
      requestAnimationFrame(() => {
        targets.forEach(el => {
          const speed = parseFloat(el.dataset.parallax) || 0.1;
          const rect = el.getBoundingClientRect();
          const center = rect.top + rect.height / 2;
          const viewCenter = window.innerHeight / 2;
          const offset = (center - viewCenter) * speed;
          el.style.transform = `translate3d(0,${offset * -1}px,0)`;
        });
        ticking = false;
      });
      ticking = true;
    }
  }, { passive: true });
}

/* ---- Spotlight mouse follower on cards ---- */
function initSpotlightHover() {
  if (window._deviceTier === 'low' || (window.matchMedia && window.matchMedia('(pointer: coarse)').matches)) return;
  document.addEventListener('mousemove', (e) => {
    const card = e.target.closest('.noviq-glass-card, .noviq-service-card, .noviq-why-card, .noviq-project-card, .noviq-industry-card, .noviq-card');
    if (card) {
      const rect = card.getBoundingClientRect();
      card.style.setProperty('--mouse-x', `${(e.clientX - rect.left).toFixed(1)}px`);
      card.style.setProperty('--mouse-y', `${(e.clientY - rect.top).toFixed(1)}px`);
    }
  }, { passive: true });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initSpotlightHover);
} else {
  initSpotlightHover();
}

