/* ============================================================
   NOVIQ — hero visuals: the black hole and the logo
   ------------------------------------------------------------
   Both were hardcoded in their components, which made them the most
   expensive decoration on the site to change: a speed or a colour meant a
   code edit, a build and a deploy. Worse, Hero.tsx passed explicit props
   that overrode the component's own defaults, so there were two sources of
   truth for the same number and only one of them was live.

   Now the admin edits them and the values arrive through here. Two rules:

   1. DEFAULTS ARE THE SHIPPED LOOK. Whatever is in DEFAULTS is what is on
      the site right now. A missing key, an offline API or a brand-new
      install therefore renders exactly the same picture, so this change is
      invisible until someone actually edits a value.

   2. EVERY VALUE IS CLAMPED. This config feeds a raymarcher: a spin speed
      of 900 or a disc radius of -4 does not look wrong, it renders a black
      rectangle or throws inside the shader. Each field declares its own
      range, and anything outside it is clamped — so a mistyped number in
      the dashboard degrades to "the nearest sensible value" instead of
      breaking the hero.
   ============================================================ */

export type BlackHoleSettings = {
  /* motion */
  spinSpeed: number;
  orbitSpeed: number;
  /* geometry — the framing. The shipped values are the shot: moving
     `distance` either pushes the gas off the edges or shrinks it into the
     middle, and `elevation` decides how much of the far side arches over
     the shadow. Both are ranges, not free text. */
  distance: number;
  elevation: number;
  roll: number;
  fov: number;
  /* the disc */
  diskInner: number;
  diskOuter: number;
  diskThickness: number;
  diskDensity: number;
  /* light — brightness/glow/exposure were raised together to make the hole
     legible; density and vignette were deliberately left alone, because
     raising density hides the far side and a vignette hides the ring. */
  brightness: number;
  glow: number;
  exposure: number;
  vignette: number;
  doppler: number;
  grain: number;
  starBrightness: number;
  /* colour — the inner ring is hottest, the mid disc is the brand orange,
     the outer edge falls to a burnt brown. */
  hotColor: string;
  midColor: string;
  coolColor: string;
  spaceColor: string;
  spaceColorDark: string;
  /* cost — the shader is the heaviest thing on the page. steps/resolution/
     maxDpr are how you buy frame rate back without losing the picture. */
  steps: number;
  resolution: number;
  maxDpr: number;
};

export type LogoMode = 'wordmark' | 'icon' | 'morph';
export type LogoAlign = 'start' | 'center' | 'end';

/* One placement context: everything the logo needs in one device × language
   slot. The four contexts (desktopEn/desktopAr/mobileEn/mobileAr) are fully
   independent — Arabic does not derive from English and mobile does not derive
   from desktop. An earlier design shared one header with "extras on top" for
   Arabic and mobile, which meant doing arithmetic to sit Arabic differently;
   independent slots cost a few more fields and remove the arithmetic. */
export type LogoSlot = {
  /** What shows. Mobile offers wordmark|icon only — morph is a desktop
      transition; a morph written into a mobile slot resolves to the mark. */
  mode: LogoMode;
  /** ms before `morph` collapses. Read on desktop slots only. */
  morphAfterMs: number;
  wordmarkHeight: number;
  markHeight: number;
  /* The bounded area: height alone lets a wide wordmark push the navigation
     apart, and only the height was settable before slots existed. */
  maxWidth: number;
  /* Logical alignment, not left/right: `start` is the leading edge and `end`
     the trailing one. Each context carries its own, so Arabic mirrors only
     when its own slot says so. */
  align: LogoAlign;
  /* Fine horizontal nudge in physical pixels: positive is RIGHT and negative
     is LEFT, in English and in Arabic alike. */
  offsetX: number;
};

export type LogoSettings = {
  /* ---- the brand assets, global to every context ----
     One logo everywhere: the files do not change between languages or
     devices, only their size and position do. (This used to be four hardcoded
     constants — two paths in the navbar, the same two in the footer.) */
  wordmarkSrc: string;
  markSrc: string;
  wordmarkAlt: string;
  markAlt: string;
  /** Master switches. A slot whose artwork is switched off renders nothing. */
  showWordmarkDesktop: boolean;
  showMarkMobile: boolean;

  desktopEn: LogoSlot;
  desktopAr: LogoSlot;
  mobileEn: LogoSlot;
  mobileAr: LogoSlot;

  /* ---- footer ----
     The footer used to render the wordmark only, at its own hardcoded size,
     with no way to change or remove it. It stays one shared placement — it is
     neither desktop-header nor mobile-header — with logical alignment (so it
     mirrors) and a physical nudge (same both languages). */
  showInFooter: boolean;
  footerVariant: 'wordmark' | 'mark';
  footerHeight: number;
  footerAlign: 'start' | 'center' | 'end';
  footerMaxWidth: number;
  footerOffsetX: number;
};

type Field<K extends string = string> = { key: K; min: number; max: number; step?: number };

/* The shipped look. See rule 1 above: these are the values on the live site
   today, including the explicit props Hero.tsx passed (spinSpeed 0.115 and
   friends), because those are the ones that were actually rendering. */
export const BLACK_HOLE_DEFAULTS: BlackHoleSettings = {
  spinSpeed: 0.115,
  orbitSpeed: 0,
  distance: 24,
  elevation: -5.5,
  roll: -20,
  fov: 42,
  diskInner: 3,
  diskOuter: 15,
  diskThickness: 0.26,
  diskDensity: 1,
  brightness: 2,
  glow: 1.72,
  exposure: 1.12,
  vignette: 0,
  doppler: 0.35,
  grain: 0.48,
  starBrightness: 0,
  hotColor: '#6AB8FF',
  midColor: '#FF8A1F',
  coolColor: '#7A2E06',
  spaceColor: '#122548',
  spaceColorDark: '#091122',
  steps: 260,
  resolution: 0.7,
  maxDpr: 1.5,
};

/* One desktop slot, in full. The shipped look: morphing wordmark in a 56px
   slot at the leading edge of a 220px box. 56 is the MEASURED rendered size —
   canvas-metered ink on the live site — not a guess: an earlier default of 40
   rendered 53px anyway because the slot never shrank below 56, so 40 was a
   fiction the slider could not act on. Every context below starts as a copy
   of this, then diverges only where the device or language needs it to. */
const DESKTOP_SLOT: LogoSlot = {
  mode: 'morph',
  morphAfterMs: 2800,
  wordmarkHeight: 56,
  markHeight: 40,
  maxWidth: 220,
  align: 'start',
  offsetX: 0,
};

/* Phones show the mark at the mark's size — metered exact, no slot involved.
   wordmarkHeight only applies if the wordmark variant is picked, where the
   image height is equally exact. */
const MOBILE_SLOT: LogoSlot = {
  mode: 'icon',
  morphAfterMs: 2800,
  wordmarkHeight: 56,
  markHeight: 40,
  maxWidth: 160,
  align: 'center',
  offsetX: 0,
};

export const LOGO_DEFAULTS: LogoSettings = {
  /* The two files that shipped. Paths are root-relative because the CMS
     stores uploads as `images/uploads/...` without a leading slash, and a
     relative path resolves against the current route — so /en/pricing would
     look for /en/images/... and 404. */
  wordmarkSrc: '/logo/noviq-wordmark.webp',
  markSrc: '/logo/noviq-icon.webp',
  wordmarkAlt: 'Noviq',
  markAlt: 'Noviq',
  showWordmarkDesktop: true,
  showMarkMobile: true,
  desktopEn: { ...DESKTOP_SLOT },
  /* Independent from English from the first day: seeded with the effective
     values the old shared header produced, so splitting the contexts changes
     nothing visually. */
  desktopAr: { ...DESKTOP_SLOT },
  mobileEn: { ...MOBILE_SLOT },
  mobileAr: { ...MOBILE_SLOT },
  showInFooter: true,
  footerVariant: 'wordmark',
  footerHeight: 56,
  footerAlign: 'center',
  footerMaxWidth: 320,
  footerOffsetX: 0,
};

/* Ranges for one slot's numbers. Below ~20px the wordmark stops being
   readable and above ~120px it starts competing with the headline it sits
   above. A nudge is for optical centring, not relocation: past ±80px the logo
   leaves its slot and overlaps the navigation. */
export const LOGO_SLOT_FIELDS: Field[] = [
  { key: 'wordmarkHeight', min: 20, max: 120, step: 1 },
  { key: 'markHeight', min: 16, max: 96, step: 1 },
  { key: 'maxWidth', min: 60, max: 480, step: 10 },
  { key: 'offsetX', min: -80, max: 80, step: 1 },
  { key: 'morphAfterMs', min: 0, max: 60000, step: 100 },
];

/* Flat footer numbers, still clamped field by field like everything else. */
export const LOGO_FIELDS: Field[] = [
  { key: 'footerHeight', min: 24, max: 160, step: 1 },
  { key: 'footerMaxWidth', min: 60, max: 900, step: 10 },
  { key: 'footerOffsetX', min: -80, max: 80, step: 1 },
];

/* An image path: root-relative, no scheme, no traversal. The CMS is
   admin-editable, so the same care applies as for a colour.

   Every segment must START with a letter, digit, dash or underscore — never
   a dot. Allowing a leading dot here would make `..` a valid segment, so
   `../secrets.png` would be accepted and handed to the browser as a path
   pointing outside the logo directory. */
const IMG_PATH = /^\/?(?:[A-Za-z0-9_-][A-Za-z0-9._-]*\/)*[A-Za-z0-9_-][A-Za-z0-9._-]*\.(?:webp|png|jpe?g|gif|svg|avif)$/i;

function clampImage(value: unknown, fallback: string): string {
  const s = typeof value === 'string' ? value.trim() : '';
  if (!s) return fallback;
  if (IMG_PATH.test(s)) return s.startsWith('/') ? s : '/' + s;
  /* An absolute URL is legitimate — a CDN or a staging host — but the
     scheme has to be one that cannot execute. */
  if (/^https:\/\/[^\s"'<>]+$/i.test(s)) return s;
  return fallback;
}

function clampAlt(value: unknown, fallback: string): string {
  const s = typeof value === 'string' ? value.trim().slice(0, 120) : '';
  return s || fallback;
}

/* Ranges. The cost fields are capped tightly on purpose: a hero that drops
   the visitor's frame rate is worse than a slightly softer hole. */
export const BLACK_HOLE_FIELDS: Field[] = [
  { key: 'spinSpeed', min: 0, max: 0.6, step: 0.005 },
  { key: 'orbitSpeed', min: -0.2, max: 0.2, step: 0.005 },
  { key: 'distance', min: 8, max: 60, step: 0.5 },
  { key: 'elevation', min: -85, max: 85, step: 0.5 },
  { key: 'roll', min: -180, max: 180, step: 1 },
  { key: 'fov', min: 12, max: 100, step: 1 },
  { key: 'diskInner', min: 1.2, max: 12, step: 0.1 },
  { key: 'diskOuter', min: 6, max: 40, step: 0.5 },
  { key: 'diskThickness', min: 0.02, max: 1.2, step: 0.01 },
  { key: 'diskDensity', min: 0.1, max: 2, step: 0.05 },
  { key: 'brightness', min: 0, max: 4, step: 0.05 },
  { key: 'glow', min: 0, max: 3, step: 0.05 },
  { key: 'exposure', min: 0.1, max: 2, step: 0.02 },
  { key: 'vignette', min: 0, max: 1, step: 0.05 },
  { key: 'doppler', min: 0, max: 1, step: 0.05 },
  { key: 'grain', min: 0.05, max: 1.5, step: 0.02 },
  { key: 'starBrightness', min: 0, max: 2, step: 0.05 },
  { key: 'steps', min: 40, max: 460, step: 10 },
  { key: 'resolution', min: 0.25, max: 1, step: 0.05 },
  { key: 'maxDpr', min: 0.5, max: 2, step: 0.25 },
];

export const BLACK_HOLE_COLORS: (keyof BlackHoleSettings)[] = [
  'hotColor',
  'midColor',
  'coolColor',
  'spaceColor',
  'spaceColorDark',
];

const HEX = /^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/;

function clampNumber(value: unknown, field: Field, fallback: number): number {
  const n = typeof value === 'number' ? value : parseFloat(String(value));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(field.max, Math.max(field.min, n));
}

function clampColor(value: unknown, fallback: string): string {
  const s = typeof value === 'string' ? value.trim() : '';
  return HEX.test(s) ? s : fallback;
}

/**
 * Merge whatever the CMS stored over the shipped defaults, field by field,
 * with every value clamped. Returns a complete settings object — never a
 * partial one — so the caller can spread it straight onto the component.
 */
export function resolveBlackHole(input: unknown): BlackHoleSettings {
  const src = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const out: Record<string, unknown> = { ...BLACK_HOLE_DEFAULTS };
  const defs = BLACK_HOLE_DEFAULTS as unknown as Record<string, number>;
  for (const field of BLACK_HOLE_FIELDS) {
    out[field.key] = clampNumber(src[field.key], field, defs[field.key]);
  }
  for (const key of BLACK_HOLE_COLORS) {
    out[key] = clampColor(src[key], BLACK_HOLE_DEFAULTS[key] as string);
  }
  /* The shader divides by (diskOuter - diskInner) and reads a sheet at the
     rim, so an inner radius at or past the outer one has no valid geometry —
     pull the outer edge out rather than letting it reach the shader. */
  const inner = out.diskInner as number;
  const outer = out.diskOuter as number;
  if (outer <= inner + 0.5) out.diskOuter = inner + 0.5;
  return out as unknown as BlackHoleSettings;
}

function resolveLogoSlot(input: unknown, fallback: LogoSlot, allowMorph: boolean): LogoSlot {
  const src = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const defs = fallback as unknown as Record<string, number>;
  const out: Record<string, unknown> = {};
  for (const field of LOGO_SLOT_FIELDS) {
    out[field.key] = clampNumber(src[field.key], field, defs[field.key]);
  }
  const mode = src.mode;
  const modes = allowMorph ? ['wordmark', 'icon', 'morph'] : ['wordmark', 'icon'];
  return {
    ...(out as unknown as LogoSlot),
    mode: modes.includes(mode as string) ? (mode as LogoMode) : fallback.mode,
    align:
      src.align === 'center' || src.align === 'end'
        ? src.align
        : (fallback.align as LogoAlign),
  };
}

/* The pre-split shape (one shared header + Arabic/mobile extras) still resolves:
   old installs, and any row saved before the split, convert to the four
   independent slots with the effective values they were rendering. */
function logoFromLegacy(src: Record<string, unknown>): {
  desktopEn: LogoSlot;
  desktopAr: LogoSlot;
  mobileEn: LogoSlot;
  mobileAr: LogoSlot;
} {
  const num = (v: unknown, fb: number) => (typeof v === 'number' && Number.isFinite(v) ? v : fb);
  /* Pre-split rows always rendered through a 56px-floored slot, so any stored
     wordmark height below 56 painted 56 anyway. Bumping preserves the rendered
     look exactly; without it the split would visibly shrink those logos.
     Already-split rows never pass through here, so a deliberate 40 stays 40. */
  const legacyWordmark = Math.max(56, num(src.headerWordmarkHeight, 40));
  const desktopEn: LogoSlot = {
    mode: src.mode === 'wordmark' || src.mode === 'icon' || src.mode === 'morph' ? src.mode : 'morph',
    morphAfterMs: num(src.morphAfterMs, 2800),
    wordmarkHeight: legacyWordmark,
    markHeight: num(src.headerMarkHeight, 40),
    maxWidth: num(src.headerMaxWidth, 220),
    align: src.headerAlign === 'center' || src.headerAlign === 'end' ? src.headerAlign : 'start',
    offsetX: num(src.headerOffsetX, 0),
  };
  const arAlign =
    src.headerAlignAr === 'start' || src.headerAlignAr === 'center' || src.headerAlignAr === 'end'
      ? src.headerAlignAr
      : desktopEn.align;
  const desktopAr: LogoSlot = {
    ...desktopEn,
    align: arAlign,
    offsetX: desktopEn.offsetX + num(src.headerOffsetXAr, 0),
  };
  const mobileBase: LogoSlot = {
    mode: 'icon',
    morphAfterMs: desktopEn.morphAfterMs,
    wordmarkHeight: desktopEn.wordmarkHeight,
    markHeight: desktopEn.markHeight,
    maxWidth: 160,
    align: 'center',
    offsetX: 0,
  };
  const mobileEn: LogoSlot = { ...mobileBase, offsetX: desktopEn.offsetX + num(src.mobileOffsetX, 0) };
  const mobileAr: LogoSlot = { ...mobileBase, offsetX: desktopAr.offsetX + num(src.mobileOffsetX, 0) };
  return { desktopEn, desktopAr, mobileEn, mobileAr };
}

export function resolveLogo(input: unknown): LogoSettings {
  const src = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const defs = LOGO_DEFAULTS as unknown as Record<string, number>;
  const out: Record<string, unknown> = { ...LOGO_DEFAULTS };
  for (const field of LOGO_FIELDS) {
    out[field.key] = clampNumber(src[field.key], field, defs[field.key]);
  }
  out.wordmarkSrc = clampImage(src.wordmarkSrc, LOGO_DEFAULTS.wordmarkSrc);
  out.markSrc = clampImage(src.markSrc, LOGO_DEFAULTS.markSrc);
  out.wordmarkAlt = clampAlt(src.wordmarkAlt, LOGO_DEFAULTS.wordmarkAlt);
  out.markAlt = clampAlt(src.markAlt, LOGO_DEFAULTS.markAlt);

  const hasSlots = src.desktopEn || src.desktopAr || src.mobileEn || src.mobileAr;
  const legacy = hasSlots
    ? null
    : logoFromLegacy(src);
  const pick = (key: 'desktopEn' | 'desktopAr' | 'mobileEn' | 'mobileAr', allowMorph: boolean) => {
    if (hasSlots && src[key] && typeof src[key] === 'object') {
      return resolveLogoSlot(src[key], LOGO_DEFAULTS[key], allowMorph);
    }
    if (legacy) {
      /* Clamp even converted values — a legacy row could hold anything. */
      return resolveLogoSlot(legacy[key], LOGO_DEFAULTS[key], allowMorph);
    }
    return { ...LOGO_DEFAULTS[key] };
  };
  return {
    ...(out as unknown as LogoSettings),
    desktopEn: pick('desktopEn', true),
    desktopAr: pick('desktopAr', true),
    mobileEn: pick('mobileEn', false),
    mobileAr: pick('mobileAr', false),
    showWordmarkDesktop:
      src.showWordmarkDesktop === undefined
        ? LOGO_DEFAULTS.showWordmarkDesktop
        : Boolean(src.showWordmarkDesktop),
    showMarkMobile:
      src.showMarkMobile === undefined
        ? LOGO_DEFAULTS.showMarkMobile
        : Boolean(src.showMarkMobile),
    showInFooter:
      src.showInFooter === undefined
        ? LOGO_DEFAULTS.showInFooter
        : Boolean(src.showInFooter),
    footerVariant:
      src.footerVariant === 'mark' ? 'mark' : LOGO_DEFAULTS.footerVariant,
    footerAlign:
      src.footerAlign === 'center' || src.footerAlign === 'end'
        ? src.footerAlign
        : LOGO_DEFAULTS.footerAlign,
  };
}

/* ---- the API read ------------------------------------------------- */

/**
 * Fetch one settings key. Returns null on any failure so the caller falls
 * back to the shipped defaults — a settings read must never be able to take
 * the hero down with it.
 */
export async function fetchVisualSettings<T>(
  key: string,
  resolve: (input: unknown) => T,
): Promise<T | null> {
  try {
    const base = process.env.NEXT_PUBLIC_API_URL || '';
    const res = await fetch(`${base}/api/content/${key}`, { cache: 'no-store' });
    if (!res.ok) return null;
    return resolve(await res.json());
  } catch {
    return null;
  }
}