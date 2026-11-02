/* ============================================================
   A11Y ENGINE — skip link, SPA heading focus, menu Escape
   Deferred-compatible, zero dependencies, all-guarded.
   Read-only partner of router.js / navigation.js (never edits
   them): listens to the public 'route-change' + 'hashchange'
   events those engines already emit.
   ============================================================ */
(function () {
  'use strict';

  var SKIP_ID = 'noviq-skip-link';
  var APP_MAIN_ID = 'app-main';
  var HOME_ID = 'home';
  var HOME_SECTIONS_ID = 'home-sections';
  var MOBILE_MENU_ID = 'mobile-menu';
  var MOBILE_TOGGLE_ID = 'mobile-toggle';
  var FOCUS_DELAY_MS = 90; /* let transitionToPage/GSAP wipe finish paint */

  function isReducedMotion() {
    try {
      return !!(window.matchMedia &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    } catch (e) { return false; }
  }

  function isArabic() {
    try {
      return (document.documentElement.lang || 'en').toLowerCase().indexOf('ar') === 0;
    } catch (e) { return false; }
  }

  function computedVisible(el) {
    try {
      if (!el) return false;
      if (window.getComputedStyle) {
        var cs = window.getComputedStyle(el);
        if (cs && (cs.display === 'none' || cs.visibility === 'hidden')) return false;
      } else if (el.style && el.style.display === 'none') {
        return false;
      }
      return true;
    } catch (e) { return false; }
  }

  function isVisible(el) {
    try {
      if (!computedVisible(el)) return false;
      /* offsetParent is null for fixed-position elements — only treat
         an explicit zero-rect as hidden, never a missing offsetParent */
      try {
        var r = el.getBoundingClientRect ? el.getBoundingClientRect() : null;
        if (r && r.width === 0 && r.height === 0) return false;
      } catch (e2) {}
      return true;
    } catch (e) { return false; }
  }

  /* Programmatic focus must not paint a ring (mouse / route-change users);
     keyboard Tab users still get :focus-visible once the mark clears on blur. */
  function quietFocus(el) {
    if (!el || !el.focus) return;
    try { el.classList.add('noviq-quiet-focus'); } catch (e) {}
    try {
      el.addEventListener('blur', function clear() {
        try { el.classList.remove('noviq-quiet-focus'); } catch (e2) {}
      }, { once: true });
    } catch (e3) {}
    try { el.focus({ preventScroll: true }); }
    catch (e4) { try { el.focus(); } catch (e5) {} }
  }

  /* ---- (a) Skip link: first body child → main landmark ---- */
  function currentSkipTarget() {
    try {
      var appMain = document.getElementById(APP_MAIN_ID);
      if (computedVisible(appMain)) return appMain;
      /* Home route: #app-main is display:none, land on hero instead */
      var home = document.getElementById(HOME_ID) ||
                 document.getElementById(HOME_SECTIONS_ID);
      return home || document.body;
    } catch (e) { return document.body; }
  }

  function labelSkipLink(link) {
    try {
      link.textContent = isArabic() ? 'تخطَّ إلى المحتوى' : 'Skip to content';
      link.setAttribute('aria-label', link.textContent);
    } catch (e) {}
  }

  function injectSkipLink() {
    try {
      if (document.getElementById(SKIP_ID)) return;
      var link = document.createElement('a');
      link.id = SKIP_ID;
      link.className = 'noviq-skip-link';
      link.setAttribute('href', '#' + APP_MAIN_ID);
      labelSkipLink(link);
      link.addEventListener('click', function (e) {
        try {
          var target = currentSkipTarget();
          if (!target || target === document.body) return; /* default anchor */
          e.preventDefault();
          var heading = target.querySelector ?
            (target.querySelector('h1') || target) : target;
          if (heading && heading.focus) {
            try { heading.setAttribute('tabindex', '-1'); } catch (e2) {}
            try { heading.setAttribute('data-a11y-heading', 'true'); } catch (e3) {}
            quietFocus(heading);
          }
          try {
            target.scrollIntoView({
              behavior: isReducedMotion() ? 'auto' : 'smooth',
              block: 'start'
            });
          } catch (e4) {}
        } catch (e5) {}
      });
      document.body.insertBefore(link, document.body.firstChild);
      /* Keep label in sync across EN/AR switches */
      try {
        new MutationObserver(function () {
          try { labelSkipLink(link); } catch (e6) {}
        }).observe(document.documentElement,
          { attributes: true, attributeFilter: ['lang'] });
      } catch (e7) {}
    } catch (e) {}
  }

  /* ---- (b) SPA heading focus: announce the new page ----
     Content-based container pick (not layout-box sniffing): the
     route that owns an h1 wins; display:none containers lose.
     Idempotent with router.js _focusPage (skips if already focused). */
  function focusPageHeading() {
    try {
      var appMain = document.getElementById(APP_MAIN_ID);
      var home = document.getElementById(HOME_SECTIONS_ID);
      var heading = null;
      try {
        if (appMain && computedVisible(appMain)) {
          heading = appMain.querySelector('h1') || appMain.querySelector('h2');
        }
        if (!heading && home && computedVisible(home)) {
          heading = home.querySelector('h1') || home.querySelector('h2');
        }
        /* Last resort: whichever container owns a heading at all */
        if (!heading && appMain) {
          heading = appMain.querySelector('h1') || appMain.querySelector('h2');
        }
        if (!heading && home) {
          heading = home.querySelector('h1') || home.querySelector('h2');
        }
      } catch (e) { return; }
      if (!heading) return;
      if (document.activeElement === heading) return; /* router got there first */
      try { heading.setAttribute('tabindex', '-1'); } catch (e2) {}
      try { heading.setAttribute('data-a11y-heading', 'true'); } catch (e3) {}
      quietFocus(heading);
    } catch (e) {}
  }

  function scheduleHeadingFocus() {
    try {
      window.setTimeout(focusPageHeading, FOCUS_DELAY_MS);
    } catch (e) {}
  }

  /* ---- aria-current mirror (CSS styles [aria-current=page] but
     updateActiveNav() only sets inline color — this fills the gap) ---- */
  function syncAriaCurrent(path) {
    try {
      var normalized = '#' + String(path || '/home').replace(/^#?\/?/, '/');
      normalized = normalized.replace(/\/+/g, '/');
      var links = document.querySelectorAll(
        '.noviq-desktop-nav a, .noviq-mobile-menu a');
      for (var i = 0; i < links.length; i++) {
        var a = links[i];
        var href = a.getAttribute('href') || '';
        if (href === normalized ||
            (normalized === '#/home' && href === '#home')) {
          a.setAttribute('aria-current', 'page');
        } else if (a.hasAttribute('aria-current')) {
          a.removeAttribute('aria-current');
        }
      }
    } catch (e) {}
  }

  /* ---- (c) Escape closes the mobile menu (ids from navigation.js) ---- */
  function closeMobileMenu() {
    try {
      var menu = document.getElementById(MOBILE_MENU_ID);
      var toggle = document.getElementById(MOBILE_TOGGLE_ID);
      if (!menu || menu.style.display === 'none') return false;
      if (!isVisible(menu)) return false;
      menu.style.display = 'none';
      try {
        if (toggle) {
          toggle.innerHTML = '';
          if (typeof createIcon === 'function') {
            toggle.appendChild(createIcon('menu', 24));
          }
          if (typeof lucide !== 'undefined' && lucide.createIcons) {
            lucide.createIcons();
          }
          toggle.setAttribute('aria-expanded', 'false');
        }
      } catch (e) {}
      /* Also collapse any open mega menus + accordions for a clean state */
      try {
        document.querySelectorAll('.noviq-mega-menu').forEach(function (m) {
          m.style.display = 'none';
          m.setAttribute('aria-hidden', 'true');
        });
        document.querySelectorAll('.mega-trigger[aria-expanded="true"]')
          .forEach(function (t) { t.setAttribute('aria-expanded', 'false'); });
      } catch (e2) {}
      return true;
    } catch (e) { return false; }
  }

  function initEscape() {
    try {
      /* Bubble phase: initKeyboardNav() uses capture + stopImmediatePropagation
         for arrows only — Escape is untouched, so both coexist. */
      document.addEventListener('keydown', function (e) {
        try {
          if (!e || e.key !== 'Escape' && e.key !== 'Esc') return;
          var closed = closeMobileMenu();
          if (closed) {
            try {
              var toggle = document.getElementById(MOBILE_TOGGLE_ID);
              if (toggle) quietFocus(toggle);
            } catch (e2) {}
            try { e.preventDefault(); } catch (e3) {}
          }
        } catch (e4) {}
      });
    } catch (e) {}
  }

  function initRouteFocus() {
    try {
      document.addEventListener('route-change', function (e) {
        try {
          if (e && e.detail && e.detail.path) syncAriaCurrent(e.detail.path);
        } catch (e2) {}
        scheduleHeadingFocus();
      });
      /* Fallback if a hash changes without route-change (e.g. /home showHome) */
      var lastHash = null;
      window.addEventListener('hashchange', function () {
        try {
          var h = window.location.hash || '#/home';
          if (h === lastHash) return;
          lastHash = h;
          var clean = h.replace(/^#/, '');
          if (clean.charAt(0) !== '/') clean = '/' + clean;
          syncAriaCurrent(clean);
          scheduleHeadingFocus();
        } catch (e) {}
      });
      /* First paint: label the current nav item for AT users */
      try {
        var initial = (window.location.hash || '#/home').replace(/^#/, '');
        if (initial.charAt(0) !== '/') initial = '/' + initial;
        syncAriaCurrent(initial);
      } catch (e2) {}
    } catch (e) {}
  }

  function boot() {
    try { injectSkipLink(); } catch (e) {}
    try { initRouteFocus(); } catch (e2) {}
    try { initEscape(); } catch (e3) {}
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }

  /* Test hooks (no globals polluted beyond one namespace) */
  try {
    window.NoviqA11y = {
      focusPageHeading: focusPageHeading,
      closeMobileMenu: closeMobileMenu,
      syncAriaCurrent: syncAriaCurrent
    };
  } catch (e) {}
})();
