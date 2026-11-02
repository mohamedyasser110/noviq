'use client';

/* ============================================================
   NOVIQ — Hero badge typewriter
   ------------------------------------------------------------
   Restores the rotating tagline on the hero badge. The phrase
   lists are the project's own data (NOVIQ_CONTENT.typewriter,
   data/content.ts) — 11 English + 7 Arabic entries, all written
   as COMPLETE phrases.

   Why complete phrases, not N-suffixes: an earlier version stored
   them as suffixes to complete the drawn "N" monogram
   ('ext-Gen AI Platforms'), which required the monogram and the
   phrase to fuse into a ligature. They never did — the monogram is
   a separate flex item with a gap, so it read as "N ew Designs"
   and the non-suffix entry rendered as "NGlobal Software & AI
   Engineering". Complete sentences with a plain gap are what read
   correctly, so the normaliser below only exists to defend against
   an admin re-adding a suffix via the content-override system.

   SSR / hydration: the first paint always shows the complete first
   phrase, which is exactly what the server rendered, so the two
   agree and there is no hydration mismatch. Typing starts one tick
   later, inside an effect.

   Reduced motion: when the user asks for less motion the badge
   renders a single static phrase and the caret never animates.
   ============================================================ */

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';

const TYPE_MS = 55; // per character typed
const DELETE_MS = 26; // per character deleted
const HOLD_MS = 2400; // full phrase held before deleting
const GAP_MS = 420; // pause on an empty badge between phrases

type Phase = 'typing' | 'hold' | 'deleting';

/**
 * Defend against a stored value that is still an N-suffix.
 *
 * Mirrors the normaliser described in .21st/design.json: complete
 * Arabic sentences pass through untouched (they are already whole),
 * as does any Latin phrase that already starts with N. Anything else
 * gets the monogram letter back.
 */
function withMonogram(phrase: string): string {
  const text = phrase.trim();
  if (!text) return text;
  if (/[\u0600-\u06FF]/.test(text)) return text; // Arabic = complete sentence
  if (/^n/i.test(text)) return text; // already leads with the monogram
  return `N${text.charAt(0).toUpperCase()}${text.slice(1)}`;
}

/**
 * Hand the leading "N" over to the drawn logo mark.
 *
 * Every English phrase in the content file is authored to lead with N
 * ("New Designs…", "Next-Gen…", "Novel…") precisely so the mark can supply
 * that letter. Stripping it here — instead of storing N-less suffixes —
 * keeps the data readable and makes the fusion purely presentational.
 *
 * The earlier attempt read as "N ew Designs" because of LAYOUT, not data:
 * the mark was a flex item separated by a gap. `.noviq-badge-n` puts mark
 * and text in one inline flow with a negative inline-end margin, so the
 * glyph actually touches the following letter.
 */
function withoutMonogram(phrase: string): string {
  if (/[\u0600-\u06FF]/.test(phrase)) return phrase; // Arabic has no N to fuse
  if (!/^n/i.test(phrase)) return phrase; // not N-led: leave it whole
  return phrase.slice(1);
}

/**
 * The liquid-N mark, sized to sit on a text baseline.
 *
 * Gradient/filter ids are suffixed `Badge` on purpose: the navbar and the
 * loading screen render the same glyph, and duplicate ids across three
 * inline SVGs make every one of them resolve to the first definition.
 *
 * viewBox is cropped to the painted stroke (the glyph path spans
 * x 28-72 / y 23-73 at strokeWidth 15) so the mark carries no dead
 * padding when it is set at cap height next to running text.
 */
function BadgeN({ className }: { className?: string }) {
  return (
    <Image
      src="/logo/noviq-icon.webp"
      alt="N"
      width={18}
      height={18}
      className={className}
      priority
      /* Matches Navbar, Footer and Loading: an 18px inline mark does not need
         the optimizer. Without this the `priority` preload pointed at
         /_next/image, which the optimizer answered with 400 — so the badge
         rendered as a broken image. */
      unoptimized
    />
  );
}

interface TypewriterBadgeProps {
  /** Phrase list for the active locale. */
  phrases?: string[];
  /** Shown when the list is missing or empty. */
  fallback: string;
  /** Drives text direction so Arabic is not forced into LTR. */
  isRTL?: boolean;
  /**
   * Draw the leading "N" as the logo mark and type only the remainder.
   * Latin only — the Arabic phrases are whole sentences with no N to give
   * away, so the mark is dropped there rather than prefixed to nothing.
   */
  fuseMonogram?: boolean;
}

export default function TypewriterBadge({
  phrases,
  fallback,
  isRTL = false,
  fuseMonogram = false,
}: TypewriterBadgeProps) {
  // Keep complete natural phrases so words like Novel, Next-Gen, New remain whole and readable
  const list = useMemo(() => {
    const cleaned = (phrases ?? [])
      .map(withMonogram)
      .map((p) => p.trim())
      .filter(Boolean);
    if (cleaned.length) return cleaned;
    const fb = fallback || '';
    return [withMonogram(fb)];
  }, [phrases, fallback]);

  // Server and first client render both produce list[0] in full.
  const [index, setIndex] = useState(0);
  const [text, setText] = useState(list[0]);
  const [phase, setPhase] = useState<Phase>('typing');
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReduceMotion(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  // Keep the badge correct if the locale swaps the phrase list under us.
  useEffect(() => {
    setIndex(0);
    setText(list[0]);
    setPhase('typing');
  }, [list]);

  useEffect(() => {
    // Static under reduced motion, and pointless for a single phrase.
    if (reduceMotion || list.length < 2) {
      setText(list[0] ?? fallback);
      setPhase('hold');
      return;
    }

    const phrase = list[index % list.length];
    let timer: number;

    if (phase === 'typing') {
      if (text.length < phrase.length) {
        timer = window.setTimeout(
          () => setText(phrase.slice(0, text.length + 1)),
          TYPE_MS
        );
      } else {
        setPhase('hold');
      }
    } else if (phase === 'hold') {
      timer = window.setTimeout(() => setPhase('deleting'), HOLD_MS);
    } else if (text.length > 0) {
      timer = window.setTimeout(
        () => setText(phrase.slice(0, text.length - 1)),
        DELETE_MS
      );
    } else {
      timer = window.setTimeout(() => {
        setIndex((i) => (i + 1) % list.length);
        setPhase('typing');
      }, GAP_MS);
    }

    return () => window.clearTimeout(timer);
  }, [phase, text, index, list, fallback, reduceMotion]);

  const phrase = list[index % list.length];
  const showCaret = !reduceMotion && list.length > 1 && phase !== 'hold';

  const shown = text || phrase;

  /* When the badge-N SVG is visible (LTR), strip the leading "N" from
     the displayed phrase so it reads as one fused word:
       BadgeN-glyph + "ew Designs, Built to Impress"
     rather than doubling it:
       BadgeN-glyph + "New Designs, Built to Impress" */
  const displayText = !isRTL ? withoutMonogram(shown) : shown;

  return (
    <span
      className="noviq-tw inline-flex items-center gap-0"
      dir={isRTL ? 'rtl' : 'ltr'}
      aria-live="off"
    >
      {!isRTL && (
        <>
          <BadgeN className="noviq-badge-n" />
          <span className="sr-only">Noviq: </span>
        </>
      )}
      <span className="font-semibold tracking-wide">{displayText}</span>
      {showCaret ? (
        <span className="noviq-tw-caret text-primary font-bold" aria-hidden="true">
          |
        </span>
      ) : null}
    </span>
  );
}
