'use client';

/* ============================================================
   FlowingLogos — seamless infinite logo marquee utility
   (canopy method): the track holds TWO identical groups with
   `gap: var(--gap)`; translating exactly `-50%` closes the loop
   with no seam. Duration via `--duration` (e.g.
   className="[--duration:35s]"), gap via `--gap`.
   Pauses on hover/focus and degrades to a static wrapped strip
   under prefers-reduced-motion.
   `variant="wordmark"` renders names as logo-like wordmarks in
   rotating brand colours (no image needed).

   LANGUAGE NOTE (this is why Arabic must look identical to
   English, and why it is handled in CSS rather than here):
   the -50% loop only closes when the two groups sit side by side
   in the SAME order. `dir="rtl"` mirrors flex layout and puts group
   2 to the left of group 1, which scrolls the row into empty space
   and breaks the seam. So `.flowing-logos-canopy-track` and
   `.flowing-logos-group` are pinned to `direction: ltr` in
   globals.css, and the page direction is deliberately NOT allowed
   to touch the mechanism. Consequence: this component needs no
   locale branching at all — same seam, same travel, same timing in
   both languages. Do not add an RTL variant here; fix the CSS.
   ============================================================ */

import Image from 'next/image';
import { cn } from '@/lib/utils';

export interface FlowingLogo {
  name: string;
  image?: string;
  /** Where the cell navigates when clicked. Omit for a non-interactive cell. */
  href?: string;
  /** Screen-reader label when the visible name is not the link text. */
  linkLabel?: string;
}

/* Dark blue → orange → yellow → black, cycling per cell. */
const WORDMARK_TONES = [
  'flowing-wordmark--navy',
  'flowing-wordmark--orange',
  'flowing-wordmark--amber',
  'flowing-wordmark--ink',
];

/* Distinctive typefaces cycling per client. */
const WORDMARK_FONTS = [
  'flowing-wordmark--f-display',
  'flowing-wordmark--f-mono',
  'flowing-wordmark--f-serif',
  'flowing-wordmark--f-sans',
  'flowing-wordmark--f-cairo',
];

interface FlowingLogosProps {
  data: FlowingLogo[];
  /**
   * `logo` = bare image, no box. See LogoCell.
   * `mixed` = per-cell choice: an entry WITH artwork renders its round
   * logo PLUS its name in one pill, an entry WITHOUT renders its wordmark
   * name — logos join the names in the same row for visual variety.
   */
  variant?: 'wide' | 'square' | 'wordmark' | 'logo' | 'mixed';
  className?: string;
  /** Flip travel direction (middle row runs opposite). */
  reverse?: boolean;
  /** Shift the tone/font cycle so rows never look synchronized. */
  toneOffset?: number;
}

function LogoCell({
  logo,
  variant,
  tone,
  font,
}: {
  logo: FlowingLogo;
  variant: 'wide' | 'square' | 'wordmark' | 'logo' | 'mixed';
  tone: string;
  font: string;
}) {
  /* `logo` keeps the bare artwork element (`bareImageEl`): the raw <Image>
     with no wrapper at all, for callers that want marks alone. `mixed`
     instead uses `brandEl` (round logo + name) so the company name stays
     visible beside its mark. */
  const isArabicScript = /[؀-ۿ]/.test(logo.name);
  const src =
    logo.image && (logo.image.startsWith('/') || /^https?:\/\//i.test(logo.image))
      ? logo.image
      : logo.image
        ? `/${logo.image}`
        : '';

  /* One visual, two possible wrappers. When there is a destination the cell
     is a real <a>, so it is keyboard-reachable, shows a focus ring, and
     announces itself as a link. Without one it stays a <span> — a dead <a>
     with no href is worse than plain text for a screen reader. */
  /* The atoms every variant is composed from. `wordmarkEl` is the
     typographic name; `bareImageEl` is the uploaded artwork with no box,
     no border, no caption — see the LOGO-ONLY note below; `brandEl` is the
     round logo beside the name for `mixed` rows. Extracted once so each
     variant picks without duplicating either branch. */
  const wordmarkEl = (
    /* `dir="auto"` + the `lang` hint matter in the two-language case: the
       track is pinned to LTR (see the block comment at the top of this
       file) so the marquee loop cannot break, which means an Arabic-script
       name has to sort ITSELF out inside the cell. `dir="auto"` does that,
       and `:lang(ar)` in the stylesheet lets the CSS drop letter-spacing
       only for names that are really Arabic — so a Latin brand name on the
       Arabic page keeps exactly the same metrics. */
    <span className={cn('flowing-wordmark', tone, font)} dir="auto" lang={isArabicScript ? 'ar' : undefined}>
      {logo.name}
    </span>
  );
  const bareImageEl = (
    <Image
      src={src}
      alt={logo.name}
      width={176}
      height={52}
      className="flowing-logo-img flowing-logo-img--bare"
      /* Not lazy: the track is translated off-screen and animates, so a
         lazy image never reaches the viewport and stays permanently blank. */
      loading="eager"
      decoding="async"
    />
  );
  /* `brandEl` — the MIXED-row cell for a client WITH artwork: the logo
     cropped to a circle BESIDE the company name (the name was always shown
     and stays shown — the artwork joins it for visual variety instead of
     replacing it). The circle sits on solid white so transparent artwork
     stays legible in dark mode; the name inherits the row's tone colour so
     the cloud keeps its colour rhythm. alt="" because the visible name
     already announces the brand — a real alt here would be read twice. */
  const brandEl = (
    <span className={cn('flowing-brand', tone)}>
      <Image
        src={src}
        alt=""
        width={88}
        height={88}
        className="flowing-brand-img"
        /* Not lazy: the track is translated off-screen and animates, so a
           lazy image never reaches the viewport and stays permanently blank. */
        loading="eager"
        decoding="async"
      />
      <span className="flowing-brand-name" dir="auto" lang={isArabicScript ? 'ar' : undefined}>
        {logo.name}
      </span>
    </span>
  );
  /* The NAME is rendered from the name, always.
   *
   * This used to be `variant === 'wordmark' && !src`, so a client that had a
   * logo uploaded fell through to the boxed-cell branch even in a name row —
   * which produced the exact thing the user rejected: a tile of artwork
   * sitting in the same row as the typographic names, logo welded to name,
   * and the two bands indistinguishable. The artwork belongs to the logo row
   * alone (variant="logo"); a name row renders a name whether or not one
   * exists elsewhere.
   *
   * `mixed` is the per-cell choice: round logo + name where artwork
   * exists, bare wordmark where it does not — logos scattered among names
   * in the same row. */
  const visual =
    variant === 'wordmark' ? (
      wordmarkEl
    ) : variant === 'logo' ? (
      /* LOGO-ONLY variant.

         `wide` and `square` render the image INSIDE a
         `.flowing-logo-cell` — a bordered, tinted box. That is what the user
         rejected: a cloud of brand logos should read as marks on the page,
         not as a grid of tiles, and the box fights the logo's own silhouette
         (a mark that already contains whitespace ends up visually inset
         inside another rectangle).

         So this variant emits the bare <Image> with no wrapper element at
         all. Nothing to box, nothing to border, and the logo keeps whatever
         aspect ratio it was drawn with. The alt text still carries the
         brand name for assistive tech, so nothing is lost by removing the
         visible caption. */
      bareImageEl
    ) : variant === 'mixed' ? (
      src ? brandEl : wordmarkEl
    ) : (
      <span
        className={cn(
          'flowing-logo-cell',
          variant === 'square' ? 'flowing-logo-cell--square' : 'flowing-logo-cell--wide'
        )}
      >
        {src ? (
          <Image
            src={src}
            alt={logo.name}
            width={variant === 'square' ? 120 : 176}
            height={variant === 'square' ? 64 : 52}
            className="flowing-logo-img"
            /* Not lazy: the track is translated off-screen and animates, so
               lazy cells never reach the viewport and stay permanently blank. */
            loading="eager"
            decoding="async"
          />
        ) : (
          <>
            <span className="flowing-logo-glyph" aria-hidden="true">
              {(logo.name.trim().charAt(0).toUpperCase() || 'N')}
            </span>
            <span className="flowing-logo-name">{logo.name}</span>
          </>
        )}
        {/* The name is always present for a screen reader: on an image cell
            the alt already carries it, and duplicating it here would be read
            twice. The cell is a link, so the link needs a name of its own. */}
        <span className="sr-only">{src ? logo.name : ''}</span>
      </span>
    );

  if (!logo.href) return visual;

  return (
    <a
      href={logo.href}
      className="flowing-logo-link"
      /* The track is decorative repetition; every duplicate link in the
         mirrored group would be announced twice. aria-hidden on the whole
         group (set by the caller) already hides those, but the label here
         still has to be right for the visible copy. */
      aria-label={logo.linkLabel || logo.name}
    >
      {visual}
      {/* The per-cell arrow that used to sit here is gone.

       * `.flowing-logo-arrow` had no rule anywhere in the stylesheet, so what
       * actually rendered was a raw "→" glyph in the inherited body text
       * colour — no spacing, no alignment, nothing. Between every wordmark it
       * read as a typo; beside a bare brand mark it attached itself to the
       * logo, and a screenshot showed the section as a grid of arrows rather
       * than a cloud of marks.

       * A moving row cannot lean on hover as its only affordance, so the
       * accessibility is unchanged by the removal: the cell keeps its
       * aria-label and the link keeps a focus ring that also pauses the
       * row — which is the affordance that actually works on touch. */}
    </a>
  );
}

export function FlowingLogos({ data, variant = 'wide', className, reverse = false, toneOffset = 0 }: FlowingLogosProps) {
  if (!data || data.length === 0) return null;

  const group = (ariaHidden: boolean) => (
    <div className="flowing-logos-group" aria-hidden={ariaHidden || undefined}>
      {data.map((logo, i) => (
        <LogoCell
          key={`${logo.name}-${i}`}
          logo={logo}
          variant={variant}
          tone={WORDMARK_TONES[(i + toneOffset) % WORDMARK_TONES.length]}
          font={WORDMARK_FONTS[(i + toneOffset * 2) % WORDMARK_FONTS.length]}
        />
      ))}
    </div>
  );

  return (
    <div className={cn('flowing-logos-canopy', className)}>
      <div className={cn('flowing-logos-canopy-track', reverse && 'is-reverse')}>
        {group(false)}
        {group(true)}
      </div>
    </div>
  );
}
