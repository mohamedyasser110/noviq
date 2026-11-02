/* ============================================================
   Text-integrity guard for admin-supplied strings
   ------------------------------------------------------------
   A CMS string arrives from a file, an import, or a paste. If any
   step in that chain decodes UTF-8 bytes with the wrong codepage,
   the Arabic comes out as box-drawing and Greek characters instead
   of letters — which still *renders*, still occupies space, and
   looks like a font problem rather than a data problem.

   That is exactly what happened to `pages.*.labelAr`: every Arabic
   navigation label in the CMS is mojibake, and the whole Arabic
   site's navigation was unreadable. Because the corrupted glyphs
   are all punctuation, they contain no break opportunities, so each
   label became one unbreakable token ~900px wide and pushed the
   document 597px past the viewport on every page.

   The fix for the data is an import fix. This file is the fix for
   the class of bug: a corrupt translation is treated as absent, so
   the healthy fallback wins instead of the garbage.
   ============================================================ */

/* Box drawing, geometric shapes, Greek and Latin-1 supplement. These are the
   ranges a mis-decoded UTF-8 byte stream lands in — never legitimate Arabic. */
const SUSPECT = /[\u2500-\u259F\u0370-\u03FF\u00A0-\u00FF]/g;
const ARABIC = /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/;

/** True when `value` looks like Arabic that lost its encoding.
 *
 *  The threshold is deliberately 3, not 1: a real string can legitimately
 *  contain one Latin-1 character — "© 2026", "£", a curly quote — and
 *  flagging those would hide good content. Corrupted Arabic produces dozens.
 *
 *  Returns false for anything containing real Arabic, so a correctly
 *  encoded string is never rejected, and false for empty/non-strings so a
 *  missing value falls through the caller's normal fallback. */
export function looksLikeMojibake(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const text = value.trim();
  if (!text) return false;
  /* Real Arabic present means the string survived the round trip. */
  if (ARABIC.test(text)) return false;
  const suspect = text.match(SUSPECT);
  return suspect !== null && suspect.length >= 3;
}

/** The admin value if it is usable, otherwise `fallback`.
 *
 *  This is the call shape that matters: it keeps the editability of the CMS
 *  while making a corrupt value impossible to ship. */
export function preferHealthy(value: unknown, fallback: string): string {
  return looksLikeMojibake(value) ? fallback : (typeof value === 'string' && value.trim() ? value : fallback);
}