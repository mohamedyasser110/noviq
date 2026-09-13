/* ============================================================
   ROUTER — hash-based SPA client-side router
   ============================================================ */

const OLD_HASH_MAP = {
  'home': '/home',
  'builder': '/builder',
  'solution-builder': '/builder',
  'solutions': '/solutions',
  'services': '/services',
  'about': '/about',
  'industries': '/industries',
  'portfolio': '/portfolio',
  'process': '/about',
  'testimonials': '/about',
  'stack': '/about',
  'contact': '/contact',
};

const AppRouter = {
  routes: {},
  current: null,
  pageContainer: null,

  init(containerId = 'app-main') {
    this.pageContainer = document.getElementById(containerId);
    window.addEventListener('hashchange', () => this.resolve());
    window.addEventListener('load', () => {
      setTimeout(() => this.resolve(), 100);
    });
  },

  register(path, renderFn) {
    const key = path.replace(/^#/, '');
    this.routes[key] = renderFn;
  },

  go(path, data) {
    const normalized = path.startsWith('/') ? path : '/' + path;
    history.pushState(data || {}, '', `#${normalized}`);
    this.resolve();
  },

  /* Move focus to the rendered page heading for assistive tech users
     (tabindex -1 = focusable without being in the tab order) */
  _focusPage(container) {
    const heading = container && container.querySelector('h1, h2');
    if (heading) {
      heading.setAttribute('tabindex', '-1');
      heading.focus({ preventScroll: true });
    }
  },

  resolve() {
    let hash = window.location.hash || '#/home';

    /* Redirect old-style hashes (e.g. #home, #solutions) to SPA routes */
    const oldKey = hash.replace('#', '');
    if (OLD_HASH_MAP[oldKey]) {
      hash = '#' + OLD_HASH_MAP[oldKey];
      history.replaceState(null, '', hash);
    }

    let clean = hash.replace(/^#/, '') || '/home';
    /* Normalize: if no leading slash, add one */
    if (!clean.startsWith('/')) clean = '/' + clean;
    const parts = clean.split('/');
    const base = parts.length > 2 ? `/${parts[1]}` : clean;
    const encodedParam = parts.length > 2 ? parts.slice(2).join('/') : null;
    let param = encodedParam;
    if (encodedParam) {
      try { param = encodedParam.split('/').map(decodeURIComponent).join('/'); } catch {}
    }

    let fn = this.routes[clean] || this.routes[base];
    if (!fn) {
      /* Render a proper 404 page instead of silently redirecting to /home */
      fn = this.routes['/404'];
      if (!fn) {
        fn = (param, container) => {
          if (!container) container = document.getElementById('app-main');
          if (container) {
            container.innerHTML = `
              <div class="noviq-page-hero" style="text-align:center;padding:120px 6% 80px">
                <div style="font-size:clamp(72px,12vw,140px);font-weight:800;color:var(--primary);line-height:1;letter-spacing:-0.04em">404</div>
                <h1 style="margin:16px 0 8px">${typeof t === 'function' ? t('Page Not Found') : 'Page Not Found'}</h1>
                <p style="color:var(--text-secondary);max-width:480px;margin:0 auto 28px">The page you're looking for doesn't exist or has been moved.</p>
                <a href="#/home" class="noviq-btn-primary">${typeof t === 'function' ? t('Go Home') : 'Go Home'}</a>
              </div>`;
          }
          document.title = '404 — Page Not Found | Noviq';
          window.scrollTo({ top: 0 });
        };
      }
      this.current = clean;
      const container = document.getElementById('app-main');
      const event = new CustomEvent('route-change', { detail: { path: clean, param, notFound: true } });
      document.dispatchEvent(event);
      fn(param, container);
      this._focusPage(container);
      return;
    }

    if (fn && typeof fn === 'function') {
      this.current = clean;
      const container = document.getElementById('app-main');
      const event = new CustomEvent('route-change', { detail: { path: clean, param } });
      document.dispatchEvent(event);
      fn(param, container);
      /* Scroll to top on route change (unless navigating to an anchor) */
      if (!param || !param.startsWith('#')) {
        window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
      }
      this._focusPage(container);
    }
  },

  getParam() {
    const hash = window.location.hash || '#/home';
    const parts = hash.replace(/^#/, '').split('/');
    return parts.length > 2 ? parts.slice(2).join('/') : null;
  }
};
