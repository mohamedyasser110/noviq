/* ============================================================
   NOVIQ API CLIENT — single source of truth for backend URLs
   ------------------------------------------------------------
   All frontend code must build API URLs through NoviqAPI instead
   of reading window.NOVIQ_API_URL directly, so the base origin
   is resolved in exactly one place.
   ============================================================ */

const NoviqAPI = (() => {
  const base = (typeof window !== 'undefined' && window.NOVIQ_API_URL) || '';

  function url(path) {
    return base + '/api' + (path || '');
  }

  return {
    base,                       // backend origin only (no /api) — for custom paths
    url,                        // api.url('/contact') -> base + '/api/contact'
  };
})();
