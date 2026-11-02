/* ============================================================
   REVEAL ENGINE — scroll-triggered entrance animations + counters
   ============================================================ */

/* Immediately reveal elements already in the viewport (above the fold):
   guarantees first paint shows hero content even if the observer
   delivers late; the rest animate on scroll as before. */
function revealIfInView(els, io) {
  const h = window.innerHeight || 900;
  els.forEach(el => {
    try {
      const r = el.getBoundingClientRect();
      if (r.top < h * 0.94 && r.bottom > 0) el.classList.add("visible");
      else io.observe(el);
    } catch (e) { io.observe(el); }
  });
}

function initReveal() {
  const els = document.querySelectorAll(".reveal");
  if (!('IntersectionObserver' in window)) { els.forEach(el => el.classList.add("visible")); return; }
  if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) { els.forEach(el => el.classList.add("visible")); return; }
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add("visible");
        io.unobserve(e.target);
      }
    });
  }, { threshold: 0.12 });
  revealIfInView(els, io);
}

/* Re-observe for dynamically added elements (lazy-built sections) */
const _revealVariants = [
  { cls: 'reveal-left', threshold: 0.15 },
  { cls: 'reveal-right', threshold: 0.15 },
  { cls: 'reveal-scale', threshold: 0.12 },
  { cls: 'reveal', threshold: 0.15 },
];

function initEnhancedReveal() {
  const reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!('IntersectionObserver' in window) || reduced) {
    document.querySelectorAll('.reveal-left,.reveal-right,.reveal-scale,.reveal').forEach(el => el.classList.add('visible'));
    return;
  }
  _revealVariants.forEach(({ cls, threshold }) => {
    const els = document.querySelectorAll(`.${cls}`);
    if (!els.length) return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) { e.target.classList.add('visible'); io.unobserve(e.target); }
      });
    }, { threshold });
    revealIfInView(els, io);
  });
}

function observeReveal(el) {
  const match = _revealVariants.find(v => el.classList.contains(v.cls));
  if (!match) return;
  try {
    const r = el.getBoundingClientRect();
    const h = window.innerHeight || 900;
    if (r.top < h * 0.94 && r.bottom > 0) { el.classList.add('visible'); return; }
  } catch (e) {}
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); io.unobserve(e.target); } });
  }, { threshold: match.threshold });
  io.observe(el);
}

/* ---- Counters (Pro-Max expo easing, corporate calm) ---- */
function animateCounter(el, to, suffix = "", duration = 1800) {
  let start = null;
  const step = (ts) => {
    if (!start) start = ts;
    const progress = Math.min((ts - start) / duration, 1);
    const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
    el.textContent = Math.floor(eased * to).toLocaleString() + suffix;
    if (progress < 1) requestAnimationFrame(step);
    else el.textContent = to.toLocaleString() + suffix;
  };
  requestAnimationFrame(step);
}

/* Re-sweep helper: reveal everything currently in the viewport.
   Called on window load (fonts/layout final) as a safety net. */
function revealInViewSweep() {
  const h = window.innerHeight || 900;
  document.querySelectorAll('.reveal:not(.visible),.reveal-left:not(.visible),.reveal-right:not(.visible),.reveal-scale:not(.visible)').forEach(el => {
    try {
      const r = el.getBoundingClientRect();
      if (r.top < h * 0.94 && r.bottom > 0) el.classList.add('visible');
    } catch (e) {}
  });
}

function initCounters() {
  const els = document.querySelectorAll("[data-counter]");
  const finish = (el) => {
    const to = parseInt(el.dataset.to);
    const suffix = el.dataset.suffix || "";
    if (!isNaN(to)) el.textContent = to.toLocaleString() + suffix;
  };
  /* No observer or reduced motion: show final values immediately. */
  if (!('IntersectionObserver' in window) ||
      (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches)) {
    els.forEach(finish);
    return;
  }
  const start = (el) => {
    if (el.dataset.counted) return;
    el.dataset.counted = "1";
    const to = parseInt(el.dataset.to);
    const suffix = el.dataset.suffix || "";
    if (isNaN(to)) return;
    animateCounter(el, to, suffix);
  };
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) { start(e.target); io.unobserve(e.target); }
    });
  }, { threshold: 0.2 });
  const h = window.innerHeight || 900;
  els.forEach(el => {
    try {
      const r = el.getBoundingClientRect();
      if (r.top < h * 0.94 && r.bottom > 0) start(el);
      else io.observe(el);
    } catch (e) { io.observe(el); }
  });
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

