/* ============================================================
   PRO ENGINE — full-power GSAP layer (progressive enhancement)
   - hero master timeline (badge → title → desc → CTAs → mock)
   - hero mock parallax scrub (ScrollTrigger)
   - magnetic 2.0 CTAs (quickTo + elastic release)
   - SPA page wipe API (window.__proWipe) for page-transitions.js
   RULES: no-ops without window.gsap (CDN fail), reduced-motion,
   low-tier devices, or coarse pointers. Never fights the .reveal
   IO system: hero bits are unclaimed from it before animating.
   ============================================================ */
(function () {
  'use strict';
  if (!window.gsap) return; /* CDN unreachable — legacy engines own motion */

  var reduced = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var lowTier = window._deviceTier === 'low';
  var finePointer = !!(window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches);
  var hasST = !!window.ScrollTrigger;
  if (hasST) { try { gsap.registerPlugin(ScrollTrigger); } catch (e) { hasST = false; } }

  document.body.classList.add('has-gsap'); /* tells polish.js to stand down its magnetic */

  /* ---------- 1. Hero master timeline ---------- */
  function heroIntro() {
    var bits = document.querySelectorAll('#home .reveal');
    if (!bits.length) return;
    var titleEl = document.getElementById('hero-title');
    var titleWrap = titleEl && titleEl.closest ? titleEl.closest('.reveal') : null;
    bits.forEach(function (el) { el.classList.remove('reveal', 'visible'); });
    if (reduced || lowTier) return; /* unclaimed = visible, no motion */
    try {
      /* Title wrapper is animated word-by-word below — keep it out of the generic tween */
      var rest = [];
      bits.forEach(function (el) { if (el !== titleWrap) rest.push(el); });
      if (rest.length) gsap.from(rest, { y: 28, opacity: 0, duration: 0.85, ease: 'power3.out', stagger: 0.09, clearProps: 'all' });
      heroTitleWords(titleWrap); /* Agent-1: word-level title animation, after unclaim */
      var mock = document.querySelector('#home .noviq-hero-mock');
      if (mock) gsap.from(mock, { y: 36, opacity: 0, scale: 0.97, duration: 1.05, ease: 'power3.out', delay: 0.25, clearProps: 'all' });
    } catch (e) {}
  }

  /* ---------- 2. Hero mock parallax scrub ---------- */
  function heroParallax() {
    if (!hasST || reduced || lowTier) return;
    var mock = document.querySelector('#home .noviq-hero-3d');
    if (!mock) return;
    try {
      gsap.to(mock, {
        yPercent: 9, ease: 'none',
        scrollTrigger: { trigger: '#home', start: 'top top', end: 'bottom top', scrub: 1 }
      });
      /* SPA route show/hide shifts layout — recalc triggers */
      window.addEventListener('hashchange', function () {
        try { ScrollTrigger.refresh(); } catch (e) {}
      });
    } catch (e) {}
  }

  /* ---------- 3. Magnetic 2.0 (delegated, elastic release) ---------- */
  function magneticPro() {
    if (reduced || lowTier || !finePointer) return;
    var cache = new WeakMap();
    function movers(el) {
      var m = cache.get(el);
      if (!m) {
        m = {
          x: gsap.quickTo(el, 'x', { duration: 0.35, ease: 'power2.out' }),
          y: gsap.quickTo(el, 'y', { duration: 0.35, ease: 'power2.out' })
        };
        cache.set(el, m);
      }
      return m;
    }
    var last = null;
    document.addEventListener('mousemove', function (e) {
      var el = (e.target && e.target.closest)
        ? e.target.closest('.noviq-btn-primary,.noviq-btn-secondary')
        : null;
      if (last && last !== el) {
        try { gsap.to(last, { x: 0, y: 0, duration: 0.7, ease: 'elastic.out(1, 0.35)' }); } catch (err) {}
        last = null;
      }
      if (!el) return;
      last = el;
      try {
        var r = el.getBoundingClientRect();
        var m = movers(el);
        m.x((e.clientX - r.left - r.width / 2) * 0.18);
        m.y((e.clientY - r.top - r.height / 2) * 0.18);
      } catch (err) {}
    }, { passive: true });
    document.addEventListener('mouseleave', function () {
      if (last) { try { gsap.to(last, { x: 0, y: 0, duration: 0.7, ease: 'elastic.out(1, 0.35)' }); } catch (err) {} last = null; }
    });
  }

  /* ---------- 3b. Hero title word-split (Agent-1) ----------
     EN animates word-by-word; Arabic animates whole words too (never
     chars) so ligatures and shaping stay intact. Markup-preserving:
     inner elements (e.g. .gradient accent span) are recursed, not flattened. */
  var AR_WORD_RE = /[\u0600-\u06FF]/;
  function splitTitleWords(el) {
    if (!el) return [];
    if (el.dataset && el.dataset.noviqSplit === '1') {
      return Array.prototype.slice.call(el.querySelectorAll('.ht-word'));
    }
    var doc = el.ownerDocument || document;
    function wrapWords(node) {
      var child = node.firstChild;
      while (child) {
        var next = child.nextSibling;
        if (child.nodeType === 3) {
          var parts = String(child.nodeValue).split(/(\s+)/);
          var frag = doc.createDocumentFragment();
          var hasWord = false;
          parts.forEach(function (p) {
            if (!p) return;
            if (/^\s+$/.test(p)) { frag.appendChild(doc.createTextNode(p)); return; }
            var s = doc.createElement('span');
            s.className = 'ht-word';
            s.textContent = p;
            frag.appendChild(s);
            hasWord = true;
          });
          if (hasWord) node.replaceChild(frag, child);
        } else if (child.nodeType === 1) {
          wrapWords(child);
        }
        child = next;
      }
    }
    wrapWords(el);
    try { el.dataset.noviqSplit = '1'; } catch (e) {}
    return Array.prototype.slice.call(el.querySelectorAll('.ht-word'));
  }
  function heroTitleWords(titleWrap, attempt) {
    var title = document.getElementById('hero-title');
    if (!title) return;
    var text = title.textContent || '';
    if (!text.trim()) {
      /* build-static.js populates the title; retry once if we raced it */
      if (!attempt) setTimeout(function () { heroTitleWords(titleWrap, 1); }, 400);
      return;
    }
    try {
      var words = splitTitleWords(title);
      if (!words.length) return;
      var isAR = AR_WORD_RE.test(text);
      gsap.from(words, {
        y: isAR ? 18 : 26, opacity: 0,
        duration: isAR ? 0.7 : 0.8, ease: 'power3.out',
        stagger: 0.06, delay: 0.05, clearProps: 'transform,opacity'
      });
    } catch (e) {}
  }

  /* ---------- 3c. Hero mock 3D tilt (Agent-1) ----------
     Subtle ±6deg tilt following the mouse. Desktop fine-pointer only;
     off under reduced-motion / low-tier. Elastic reset on leave. */
  function heroTilt() {
    if (reduced || lowTier || !finePointer) return;
    var zone = document.querySelector('#home .noviq-hero-3d');
    var mock = document.querySelector('#home .noviq-hero-mock');
    if (!zone || !mock) return;
    try {
      gsap.set(mock, { transformPerspective: 900 });
      var rX = gsap.quickTo(mock, 'rotationX', { duration: 0.5, ease: 'power2.out' });
      var rY = gsap.quickTo(mock, 'rotationY', { duration: 0.5, ease: 'power2.out' });
      zone.addEventListener('mousemove', function (e) {
        try {
          var r = zone.getBoundingClientRect();
          if (!r.width || !r.height) return;
          var px = (e.clientX - r.left) / r.width - 0.5;
          var py = (e.clientY - r.top) / r.height - 0.5;
          rY(px * 12);   /* ±6deg */
          rX(-py * 12);  /* ±6deg */
        } catch (err) {}
      }, { passive: true });
      zone.addEventListener('mouseleave', function () {
        try { gsap.to(mock, { rotationX: 0, rotationY: 0, duration: 0.9, ease: 'elastic.out(1, 0.4)' }); } catch (err) {}
      });
    } catch (e) {}
  }

  /* ---------- 3d. Hero scroll cue (Agent-1) ----------
     Minimal mouse motif injected at the end of #home. Fades out after
     the first scroll (safety auto-dismiss). Never injected under
     reduced-motion; CSS also force-hides it there. */
  function heroScrollCue() {
    if (reduced) return;
    var home = document.getElementById('home');
    if (!home || home.querySelector('.noviq-scroll-cue')) return;
    try {
      var cue = document.createElement('div');
      cue.className = 'noviq-scroll-cue';
      cue.setAttribute('aria-hidden', 'true');
      cue.innerHTML = '<span class="noviq-scroll-cue__mouse"><span class="noviq-scroll-cue__wheel"></span></span>';
      home.appendChild(cue);
      if (!lowTier) {
        gsap.from(cue, { opacity: 0, y: 8, duration: 0.7, ease: 'power2.out', delay: 1.2, clearProps: 'all' });
      }
      var done = false;
      function dismiss() {
        if (done) return; done = true;
        window.removeEventListener('scroll', dismiss);
        try {
          if (!lowTier) {
            gsap.to(cue, { opacity: 0, duration: 0.4, ease: 'power2.out', onComplete: function () { cue.remove(); } });
          } else { cue.remove(); }
        } catch (e) { try { cue.remove(); } catch (err) {} }
      }
      window.addEventListener('scroll', dismiss, { passive: true });
      setTimeout(dismiss, 9000); /* safety: never linger */
    } catch (e) {}
  }

  /* ---------- 4. SPA page wipe API ----------
     Includes a timer safety: if rAF stalls (occluded/headless tab throttles
     GSAP's ticker), the wipe is force-finished so content NEVER gets stuck
     behind the overlay and mid() always runs exactly once. */
  window.__proWipe = function (mid) {
    var wipe = document.getElementById('page-wipe');
    if (!wipe || reduced || lowTier) { mid(); return; }
    var done = false;
    function runMid() {
      if (done) return;
      done = true;
      try { mid(); } catch (e) {}
      try { window.scrollTo(0, 0); } catch (err) {}
    }
    try {
      wipe.classList.add('wiping');
      var tl = gsap.timeline({ onComplete: function () { wipe.classList.remove('wiping'); } });
      tl.set(wipe, { transformOrigin: 'top', pointerEvents: 'auto' })
        .to(wipe, { scaleY: 1, duration: 0.22, ease: 'power2.in' })
        .add(runMid)
        .set(wipe, { transformOrigin: 'bottom' })
        .to(wipe, { scaleY: 0, duration: 0.34, ease: 'power2.out' }, '+=0.04')
        .set(wipe, { pointerEvents: 'none' });
      /* rAF-stall safety net (timers still fire, throttled): force completion */
      setTimeout(function () {
        if (done) return;
        try { tl.kill(); } catch (e) {}
        try {
          gsap.set(wipe, { scaleY: 0, pointerEvents: 'none' });
          wipe.classList.remove('wiping');
        } catch (err) {}
        runMid();
      }, 1200);
    } catch (e) { runMid(); }
  };

  /* ---------- 3d. Re-split hero title after language switch ----------
     build-static.js replaces #hero-title text on lang apply, wiping the
     .ht-word spans. Re-split (and replay the cascade) when that happens.
     Own split mutations are ignored: by observer time our words exist. */
  function watchTitleResplit() {
    var title = document.getElementById('hero-title');
    if (!title || !window.MutationObserver) return;
    var ticking = false;
    try {
      new MutationObserver(function () {
        try {
          if (title.querySelectorAll('.ht-word').length) return;
          if (ticking) return;
          ticking = true;
          setTimeout(function () {
            ticking = false;
            try { title.removeAttribute('data-noviq-split'); } catch (e) {}
            if (reduced || lowTier) { try { splitTitleWords(title); } catch (err) {} return; }
            heroTitleWords();
          }, 80);
        } catch (e) {}
      }).observe(title, { childList: true, characterData: true, subtree: true });
    } catch (e) {}
  }

  /* ---------- 5. Apple spring press-scale (Agent-C) ----------
     pressed-scale on primary CTAs via quickTo (down to 0.97 in
     0.15s, elastic release in 0.45s). Composes with magneticPro
     (scale is independent of its x/y) and never touches .reveal
     elements. Interruptible via overwrite:'auto'; the release
     tween clears its inline scale so CSS :hover regains control.
     CSS :active{scale} in apple-motion.css covers the no-gsap
     fallback (gated behind body:not(.has-gsap)).
     Magnetic release verified springy already: elastic.out(1,
     0.35) in magneticPro — no change needed. */
  function appleMotionTierFlag() {
    try {
      if (reduced || lowTier) document.body.classList.add('apple-motion-off');
    } catch (e) {}
  }
  function applePressScale() {
    if (reduced || lowTier || !finePointer) return;
    var cache = new WeakMap();
    var pressed = [];
    function downTo(el) {
      var fn = cache.get(el);
      if (!fn) {
        fn = gsap.quickTo(el, 'scale', { duration: 0.15, ease: 'power2.out', overwrite: 'auto' });
        cache.set(el, fn);
      }
      return fn;
    }
    function targetOf(e) {
      return (e.target && e.target.closest)
        ? e.target.closest('.noviq-btn-primary:not(.reveal)')
        : null;
    }
    document.addEventListener('pointerdown', function (e) {
      var el = targetOf(e);
      if (!el) return;
      try {
        downTo(el)(0.97);
        if (pressed.indexOf(el) === -1) pressed.push(el);
      } catch (err) {}
    }, { passive: true });
    function releaseAll() {
      while (pressed.length) {
        (function (el) {
          try {
            gsap.to(el, {
              scale: 1, duration: 0.45, ease: 'elastic.out(1, 0.5)',
              overwrite: 'auto', clearProps: 'scale'
            });
          } catch (err) {}
        })(pressed.pop());
      }
    }
    document.addEventListener('pointerup', releaseAll, { passive: true });
    document.addEventListener('pointercancel', releaseAll, { passive: true });
    window.addEventListener('blur', releaseAll); /* release off-window: never stick at 0.97 */
  }
  function appleMotionInit() {
    appleMotionTierFlag();
    applePressScale();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', appleMotionInit);
  else appleMotionInit();

  function init() {
    heroIntro();
    heroParallax();
    magneticPro();
    heroTilt();      /* Agent-1 */
    heroScrollCue(); /* Agent-1 */
    watchTitleResplit(); /* coordinator: survive i18n rebuilds */
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
