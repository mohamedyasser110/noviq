/* ============================================================
   NOVIQ — social handle normalisers
   ------------------------------------------------------------
   WHY THIS EXISTS

   The admin edits these as free text (Site Content → Brand), and
   people type them the way they know them, not the way a URL
   needs them:

       whatsapp  "01062339274"      ← Egyptian local, leading 0
       facebook  "@noviqsolutions"  ← handle, with an @
       instagram "noviqsolutions"   ← bare handle

   Two of those produced broken links before this module existed:

   * WhatsApp. Both the contact section and the footer did
     `value.replace(/[^\d]/g, '')` and handed the result to wa.me,
     so "01062339274" became `https://wa.me/01062339274` — a dead
     link. wa.me needs the FULL international number with the trunk
     zero REMOVED, i.e. country code then the national number:
     Egypt +20, so 01062339274 → 201062339274. Silently dropping
     the 0 is the single most common way a wa.me link breaks.

   * Facebook/Instagram. The old fallback only checked
     `.startsWith('http')`, so a leading "@" survived into the path
     and produced `https://facebook.com/@noviqsolutions`.

   Both helpers are total: any input returns either a usable
   absolute https URL or ''. Callers render nothing for '' rather
   than a link that goes nowhere.
   ============================================================ */

/* Region → dialling code, for the numbers people write locally.
   Extend as the brand opens in more markets; an unknown region
   falls through to the raw digits rather than being guessed at. */
const REGION_CODES: Record<string, string> = {
  EG: '20', // Egypt
  SA: '966', // Saudi Arabia
  AE: '971', // UAE
  KW: '965', // Kuwait
  QA: '974', // Qatar
  BH: '973', // Bahrain
  OM: '968', // Oman
  JO: '962', // Jordan
  LB: '961', // Lebanon
  IQ: '964', // Iraq
  PS: '970', // Palestine
  SY: '963', // Syria
  YE: '967', // Yemen
  SD: '249', // Sudan
  LY: '218', // Libya
  TN: '216', // Tunisia
  DZ: '213', // Algeria
  MA: '212', // Morocco
  US: '1', // USA / Canada
  GB: '44', // UK
};

/** Parse "EG", "us", " +20 " etc. → "20" / "1" / '' */
function regionCode(raw: string): string {
  const key = raw.trim().toUpperCase();
  if (!key) return '';
  if (key === '+' || key === '00') return '';
  if (REGION_CODES[key]) return REGION_CODES[key];
  /* "EG" and also "EGP" — the ISO alpha-3 the browser hands us. */
  const three = key.slice(0, 3);
  if (REGION_CODES[three]) return REGION_CODES[three];
  return '';
}

/**
 * A ready-to-use wa.me URL, or '' when there is nothing to link.
 *
 * Accepts every form an admin is likely to paste and produces the
 * one form wa.me accepts:
 *
 *   "01062339274"                 → .../201062339274   (EG inferred, 0 dropped)
 *   "+201062339274"               → .../201062339274
 *   "20 106 233 9274"             → .../201062339274
 *   "0020 1062339274"             → .../201062339274
 *   "01062339274" with region EG  → .../201062339274
 *   "+1 415 555 0182"             → .../14155550182
 *   "201062339274"                → .../201062339274   (already international)
 *
 * @param whatsapp  the raw CMS value
 * @param region    the brand's region, used only to add a country code
 *                  that is missing. Defaults to '' (infer), which covers
 *                  the Egypt case because a bare 0-prefixed national
 *                  number is read as Egypt — the one market this brand
 *                  is actually in.
 */
export function waMeUrl(whatsapp: string | undefined | null, region = ''): string {
  if (!whatsapp) return '';
  const raw = String(whatsapp).trim();
  if (!raw) return '';
  /* Already a full URL — respect it verbatim. */
  if (/^https?:\/\//i.test(raw)) return raw;

  /* Four input shapes, and which country code (if any) they carry. */
  const plus = raw.match(/^\+\s*([0-9]{1,4})/); // "+20 106…"
  const doubleZero = /^00[0-9]/.test(raw); // "0020 106…"

  /* Digits of the SUBSCRIBER number, i.e. with any country code removed. */
  let national: string;
  let prefix = ''; // country code we are certain about
  if (plus) {
    prefix = plus[1];
    national = raw.slice(plus[0].length).replace(/\D/g, '');
  } else if (doubleZero) {
    /* "00" IS the international prefix, so what follows already starts
       with the country code. Strip that too, or it would be doubled. */
    const all = raw.replace(/^00/, '').replace(/\D/g, '');
    prefix = all.slice(0, 2);
    national = all.slice(2);
  } else {
    national = raw.replace(/\D/g, '');
  }

  /* A national number carries its trunk zero. Dropping it is exactly what
     turns "01062339274" into the "1062339274" that "+20" needs. */
  const isLocal = national.startsWith('0');
  if (isLocal) national = national.replace(/^0+/, '');

  /* Nothing but zeros was entered ("0", "000"). A bare country code is not
     a phone number, so this is an unset field — not a link to "20". */
  if (!national) return '';

  /* Local number with no country code anywhere: it must be national, so
     add one. Egypt is the only inference made without being told. */
  if (!prefix && isLocal) prefix = regionCode(region) || '20';

  return `https://wa.me/${prefix}${national}`;
}

/**
 * A profile URL for Facebook / Instagram / X / LinkedIn, or ''.
 *
 * Accepts a bare handle, an @handle, a path ("noviqsolutions"), or a
 * full URL (returned untouched). The leading @ is stripped because it
 * is a handle sigil, not part of the path.
 */
export function profileUrl(handle: string | undefined | null, base: string): string {
  if (!handle) return '';
  const raw = String(handle).trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  const slug = raw.replace(/^@+/, '').replace(/^\/+/, '').replace(/\/+$/, '');
  if (!slug) return '';
  return `${base.replace(/\/+$/, '')}/${slug}`;
}

/** Gmail (or any mailto:) address — '' when unset. */
export function mailtoUrl(email: string | undefined | null): string {
  if (!email) return '';
  const raw = String(email).trim();
  if (!raw) return '';
  /* A pasted "mailto:x@y" or a stray angle bracket both break the link. */
  const cleaned = raw.replace(/^mailto:/i, '').replace(/^<|>$/g, '').trim();
  return cleaned ? `mailto:${cleaned}` : '';
}
