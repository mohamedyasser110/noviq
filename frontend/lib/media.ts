/* ============================================================
   NOVIQ — CMS media path normaliser
   ------------------------------------------------------------
   WHY THIS EXISTS
   The admin's image fields store the path the way the upload helper
   returns it: `images/uploads/1234_file.png` — with NO leading slash.
   A browser resolves a relative URL against the CURRENT page, so on
   `/en/portfolio` that becomes `/en/images/uploads/…` → 404, and the
   image silently disappears. Absolute-from-root URLs are the only
   form that works on a nested locale route.

   `normalizeImageSrc` makes any stored form usable:

       images/uploads/x.png   → /images/uploads/x.png
       /images/uploads/x.png  → /images/uploads/x.png
       https://cdn/x.png      → unchanged (external)
       "" or an unknown root  → the caller's fallback

   It also refuses anything outside the known public roots and any
   `..` segment, so a CMS value can never be turned into a path
   traversal or an unexpected request. (Same rule the team page
   already applied to member photos.)
   ============================================================ */

/** Folders that actually exist under frontend/public (verified). */
const ALLOWED_ROOTS = ['/images/', '/assets/', '/logo/', '/icons/'];

const EXTERNAL = /^https?:\/\//i;
const PROTOCOL_RELATIVE = /^\/\//;

export function normalizeImageSrc(raw: unknown, fallback: string): string {
  const value = typeof raw === 'string' ? raw.trim() : '';
  if (!value) return fallback;

  /* External assets are left exactly as the admin entered them. */
  if (EXTERNAL.test(value) || PROTOCOL_RELATIVE.test(value)) return value;

  const withSlash = value.startsWith('/') ? value : `/${value}`;

  /* A `..` segment can never be legitimate here. */
  if (withSlash.includes('..')) return fallback;

  return ALLOWED_ROOTS.some((root) => withSlash.startsWith(root)) ? withSlash : fallback;
}

/** Same rules, but for values that must stay empty when absent (no fallback). */
export function normalizeImageSrcOrEmpty(raw: unknown): string {
  return normalizeImageSrc(raw, '');
}

export default normalizeImageSrc;
