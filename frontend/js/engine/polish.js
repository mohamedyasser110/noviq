/* ============================================================
   POLISH ENGINE — pro-max micro-interactions, corporate calm
   1. Header scroll progress (2px brand bar in the navbar)
   2. Back-to-top button (appears past 600px)
   3. Subtle magnetic pull on CTA buttons (fine pointer only)
   4. Navbar hides on scroll-down, returns on scroll-up
   Guards: rAF-throttled scroll, reduced-motion + low-tier aware,
   works with dynamically rendered buttons (event delegation).
   ============================================================ */
(function () {
  'use strict';

  var reducedMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var lowTier = window._deviceTier === 'low';
  var finePointer = !!(window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches);

  /* ---------- 1. Scroll progress ---------- */
  function initProgress() {
    var bar = document.getElementById('scroll-progress');
    if (!bar) return;
    var ticking = false;
    function update() {
      ticking = false;
      var h = document.documentElement;
      var max = h.scrollHeight - h.clientHeight;
      var y = h.scrollTop || document.body.scrollTop || 0;
      var p = max > 0 ? y / max : 0;
      bar.style.transform = 'scaleX(' + Math.min(1, Math.max(0, p)).toFixed(4) + ')';
    }
    window.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }, { passive: true });
    window.addEventListener('resize', update);
    window.addEventListener('load', update);
    update();
  }

  /* ---------- 2. Back to top ---------- */
  function initToTop() {
    var btn = document.getElementById('to-top');
    if (!btn) return;
    var ticking = false;
    function onScroll() {
      ticking = false;
      var y = window.scrollY || document.documentElement.scrollTop || 0;
      btn.classList.toggle('show', y > 600);
    }
    window.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; requestAnimationFrame(onScroll); }
    }, { passive: true });
    btn.addEventListener('click', function () {
      try {
        window.scrollTo({ top: 0, behavior: reducedMotion ? 'auto' : 'smooth' });
      } catch (e) { window.scrollTo(0, 0); }
    });
    onScroll();
  }

  /* ---------- 3. Subtle magnetic CTAs (delegated) ---------- */
  function initMagnetic() {
    if (reducedMotion || lowTier || !finePointer) return;
    if (document.body.classList.contains('has-gsap')) return; /* pro.js magnetic 2.0 owns this */
    var last = null;
    document.addEventListener('mousemove', function (e) {
      var el = (e.target && e.target.closest)
        ? e.target.closest('.noviq-btn-primary,.noviq-btn-secondary')
        : null;
      if (last && last !== el) { last.style.translate = ''; last = null; }
      if (!el) return;
      last = el;
      var r = el.getBoundingClientRect();
      var x = e.clientX - r.left - r.width / 2;
      var y = e.clientY - r.top - r.height / 2;
      /* `translate` property composes with the hover `transform` — no clobber. */
      el.style.translate = (x * 0.12).toFixed(1) + 'px ' + (y * 0.12).toFixed(1) + 'px';
    }, { passive: true });
    document.addEventListener('mouseleave', function () {
      if (last) { last.style.translate = ''; last = null; }
    });
  }

  /* ---------- 4. Hide navbar on scroll-down, show on scroll-up ----------
     Never hides while the mobile menu is open or focus sits inside the nav.
     Under reduced-motion the CSS keeps the bar pinned (no transform). */
  function initNavHide() {
    var nav = document.getElementById('navbar');
    if (!nav || reducedMotion || lowTier) return;
    var lastY = window.scrollY || 0;
    var ticking = false;
    function onScroll() {
      ticking = false;
      var y = window.scrollY || document.documentElement.scrollTop || 0;
      var menu = document.getElementById('mobile-menu');
      var menuOpen = false;
      try { menuOpen = !!(menu && getComputedStyle(menu).display !== 'none'); } catch (e) {}
      var focusInNav = !!(nav.contains && nav.contains(document.activeElement));
      if (y > 300 && y > lastY + 4 && !menuOpen && !focusInNav) {
        nav.classList.add('nav-hidden');
      } else if (y < lastY - 4 || y <= 300) {
        nav.classList.remove('nav-hidden');
      }
      lastY = y;
    }
    window.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; requestAnimationFrame(onScroll); }
    }, { passive: true });
    onScroll();
  }

  initProgress();
  initToTop();
  initMagnetic();
  initNavHide();
})();
