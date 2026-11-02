'use client';

/* ============================================================
   NOVIQ — CLIENT VOICES (testimonials)
   ------------------------------------------------------------
   Three independently-scrolling columns of quote cards, masked top
   and bottom so the strip reads as endless rather than clipped.

   WHY THIS FILE KEEPS SO MUCH COMMENT
   The scrolling loop is the easy part to get subtly wrong, so the
   three decisions that actually make it work are spelled out here:

   1. SEAMLESSNESS — the track holds EXACTLY two identical blocks and
      translates by the measured height of ONE block (track.scrollHeight
      / 2), in pixels. The 21st reference implementation translates
      `-50%` on a track whose children are a flat `flex flex-col gap-6
      pb-6` list, so the trailing padding sits on the track instead of
      inside a block and `-50%` lands half a padding short of the seam
      — the loop visibly stutters every cycle. Measuring sidesteps the
      unit question entirely and survives any gap/radius change.

   2. PAUSING — `animate()` on a MotionValue returns playback controls
      with real `.pause()` / `.play()`. Pausing a declarative
      `<motion.div animate={{ y: … }}>` has no supported equivalent, and
      restarting it would snap the track back to y=0. The scroll pauses
      on hover, on keyboard focus inside, when the tab is hidden, and
      when the section scrolls out of view.

   3. REDUCED MOTION — `prefers-reduced-motion: reduce` is a real
      setting, not a nicety: the marquee is disabled outright, the
      duplicated block is not rendered, and the columns lay out as a
      plain static grid. The rest of the stylesheet already honours
      this query (see .noviq-tw-caret), so the section now matches.

   The duplicate block is `aria-hidden` so a screen reader announces
   every quote once, not twice.

   DATA — fully CMS-driven, any length:
     backend/db/init.js            seed (9 voices, `img` + `*Ar` siblings)
     backend/routes/admin.js       PUT /admin/content/testimonials/array
     frontend/lib/home-content.ts  locale resolution + img normalising
   Adding a voice in the admin dashboard is live within the 60s ISR
   window; nothing here caps the list.
   ============================================================ */

import { motion, animate, useMotionValue, useReducedMotion } from 'motion/react';
import type { AnimationPlaybackControls } from 'motion/react';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Quote } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface TestimonialItem {
  quote: string;
  name: string;
  role: string;
  /** Speaker's photo. Set by the admin on the `img` field; may be empty. */
  img?: string;
}

interface TestimonialsProps {
  locale: string;
  header?: { eyebrow: string; title: string; desc: string };
  items?: TestimonialItem[];
}

/* The 21st reference hides one column per breakpoint so phones never get
   a 3-across strip. Kept identical: 1 column < md, 2 < lg, 3 above. */
const COLUMN_VISIBILITY = ['block', 'hidden md:block', 'hidden lg:block'];
/* Coprime-ish durations so the three columns never fall into lockstep. */
const COLUMN_DURATIONS = [26, 34, 30];
const MAX_COLUMNS = 3;

/** Round-robin so adjacent columns never open on the same quote. */
function distribute(items: TestimonialItem[], count: number): TestimonialItem[][] {
  const columns: TestimonialItem[][] = Array.from({ length: count }, () => []);
  items.forEach((item, i) => columns[i % count].push(item));
  return columns;
}

/** "Elena Ruiz" → "ER". First letter of the first and last word, so it
 *  also produces something sensible for Arabic names. */
function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/* ------------------------------------------------------------
   One scrolling column
   ------------------------------------------------------------ */
function VoicesColumn({
  items,
  duration,
  className,
  reduced,
  active,
  rtl,
}: {
  items: TestimonialItem[];
  duration: number;
  className?: string;
  reduced: boolean;
  /** False when the section is off-screen or the tab is hidden. */
  active: boolean;
  rtl: boolean;
}) {
  const y = useMotionValue(0);
  const trackRef = useRef<HTMLDivElement>(null);
  const controlsRef = useRef<AnimationPlaybackControls | null>(null);
  /* User-driven pause (hover / focus) is tracked separately from `active`
     so the two can be released independently. Both are refs, not state:
     they gate playback imperatively and must never trigger a re-render,
     which would tear down and restart the animation. */
  const heldRef = useRef(false);
  const activeRef = useRef(active);
  activeRef.current = active;

  /* Start the loop, and keep it in sync with the real block height —
     webfonts and CMS text length both change it after first paint. */
  const start = useCallback(() => {
    controlsRef.current?.stop();
    controlsRef.current = null;
    const track = trackRef.current;
    if (reduced || !track) return;
    const half = track.scrollHeight / 2;
    if (!half) return;
    const controls = animate(y, -half, { duration, repeat: Infinity, ease: 'linear' });
    controlsRef.current = controls;
    if (heldRef.current || !activeRef.current) controls.pause();
  }, [duration, reduced, y]);

  useEffect(() => {
    if (reduced) {
      y.set(0);
      return;
    }
    start();

    const track = trackRef.current;
    let lastHalf = track ? track.scrollHeight / 2 : 0;
    const observer =
      track && typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => {
            const next = track.scrollHeight / 2;
            // 1px tolerance: sub-pixel jitter must not restart the loop.
            if (Math.abs(next - lastHalf) > 1) {
              lastHalf = next;
              start();
            }
          })
        : null;
    if (observer && track) observer.observe(track);

    return () => {
      observer?.disconnect();
      controlsRef.current?.stop();
      controlsRef.current = null;
    };
  }, [reduced, start, y]);

  /* Off-screen / hidden tab: freeze without losing the current offset. */
  useEffect(() => {
    if (reduced) return;
    if (active) {
      if (!heldRef.current) controlsRef.current?.play();
    } else {
      controlsRef.current?.pause();
    }
  }, [active, reduced]);

  const hold = useCallback(() => {
    heldRef.current = true;
    controlsRef.current?.pause();
  }, []);

  const release = useCallback(() => {
    heldRef.current = false;
    if (activeRef.current) controlsRef.current?.play();
  }, []);

  const cardList = (hidden: boolean) => (
    <ul className="flex flex-col gap-5 pb-5" aria-hidden={hidden || undefined}>
      {items.map((item, i) => (
        <li
          key={`${item.name}-${i}`}
          dir={rtl ? 'rtl' : 'ltr'}
          className="group rounded-2xl border border-slate-200 bg-white p-7 shadow-lg shadow-primary/5 transition-shadow duration-300 hover:shadow-xl hover:shadow-primary/10 dark:border-slate-700 dark:bg-slate-900 dark:shadow-slate-950/40"
        >
          {/* Signal layer = ACCENT (blue), per the palette rule in
              globals.css: PRIMARY carries structure, ACCENT carries signal
              only. The previous build hard-coded an orange→blue gradient
              on the quote glyph, which did not survive dark mode. */}
          <Quote
            aria-hidden="true"
            className="h-7 w-7 text-accent-action dark:text-accent-bright"
            strokeWidth={2}
          />

          <p className="mt-4 text-[0.975rem] leading-relaxed text-slate-700 dark:text-slate-300">
            {item.quote}
          </p>

          <div className="mt-5 flex items-center gap-3">
            {item.img ? (
              // Plain <img>: CMS paths are runtime data, not static
              // imports, so next/image cannot pre-optimise them.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={item.img}
                alt={item.name}
                width={44}
                height={44}
                loading="lazy"
                decoding="async"
                className="h-11 w-11 shrink-0 rounded-full object-cover ring-2 ring-slate-100 transition-transform duration-300 group-hover:scale-105 dark:ring-slate-800"
              />
            ) : (
              <span
                aria-hidden="true"
                className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary/10 text-sm font-bold tracking-tight text-primary-strong ring-2 ring-slate-100 dark:bg-primary/15 dark:text-primary-glow dark:ring-slate-800"
              >
                {initialsOf(item.name || '?')}
              </span>
            )}
            <div className="min-w-0">
              <div className="truncate font-semibold leading-5 tracking-tight text-slate-900 dark:text-white">
                {item.name}
              </div>
              {/* NOT truncated: a role like "Head of Platform, Helix
                  Manufacturing" overflows a 20rem card, and an ellipsis
                  there reads as a rendering bug rather than a design
                  choice. Names stay on one line; roles wrap. */}
              <div className="text-sm leading-5 tracking-tight text-slate-500 dark:text-slate-400">
                {item.role}
              </div>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );

  if (reduced) {
    return <div className={cn('w-full max-w-xs', className)}>{cardList(false)}</div>;
  }

  return (
    <div
      className={cn('w-full max-w-xs', className)}
      onMouseEnter={hold}
      onMouseLeave={release}
      onFocusCapture={hold}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) release();
      }}
    >
      <motion.div ref={trackRef} style={{ y }} className="flex flex-col">
        {cardList(false)}
        {/* The seam closer: an identical second block, hidden from AT. */}
        {cardList(true)}
      </motion.div>
    </div>
  );
}

/* ------------------------------------------------------------
   Section
   ------------------------------------------------------------ */
export default function Testimonials({ locale, header, items }: TestimonialsProps) {
  const t = useTranslations();
  const reduced = Boolean(useReducedMotion());
  const sectionRef = useRef<HTMLElement>(null);
  /* Two independent reasons to stop: scrolled past, or tab in background.
     Kept apart so releasing one does not wrongly resume the other. */
  const [onScreen, setOnScreen] = useState(false);
  const [tabVisible, setTabVisible] = useState(true);
  const active = onScreen && tabVisible;

  const head = {
    eyebrow: header?.eyebrow || t('testimonials.eyebrow'),
    title: header?.title || t('testimonials.title'),
    desc: header?.desc || t('testimonials.description'),
  };

  const list = (items ?? []).filter((item) => item && (item.quote || item.name));
  const columns = distribute(list, Math.min(MAX_COLUMNS, Math.max(1, list.length)));

  /* One observer for the whole section: a homepage block far down the
     page should not keep animating for a visitor who never reached it,
     and a backgrounded tab should not either. */
  useEffect(() => {
    const onVisibility = () => setTabVisible(!document.hidden);
    document.addEventListener('visibilitychange', onVisibility);
    onVisibility();

    const node = sectionRef.current;
    const observer =
      node && typeof IntersectionObserver !== 'undefined'
        ? new IntersectionObserver(
            (entries) => setOnScreen(entries.some((e) => e.isIntersecting)),
            { threshold: 0.05 },
          )
        : null;
    if (observer && node) observer.observe(node);
    else setOnScreen(true); // no observer support: never block the animation

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      observer?.disconnect();
    };
  }, []);

  return (
    <section
      ref={sectionRef}
      className="noviq-section-qodix"
      aria-labelledby="testimonials-heading"
    >
      <div className="noviq-wrap">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          viewport={{ once: true }}
          className="mx-auto max-w-3xl text-center"
        >
          <p className="eyebrow">{head.eyebrow}</p>
          <h2
            id="testimonials-heading"
            className="noviq-h2 mx-auto mt-5 text-slate-900 dark:text-white"
          >
            {head.title}
          </h2>
          {head.desc ? <p className="noviq-lead mx-auto text-center">{head.desc}</p> : null}
        </motion.div>

        {list.length > 0 && (
          <div
            className="noviq-voices mt-10 flex justify-center gap-5 md:gap-6"
            role="region"
            aria-label={t('testimonials.slide')}
          >
            {columns.map((column, i) => (
              <VoicesColumn
                key={i}
                items={column}
                duration={COLUMN_DURATIONS[i % COLUMN_DURATIONS.length]}
                className={COLUMN_VISIBILITY[i]}
                reduced={reduced}
                active={active}
                rtl={locale === 'ar'}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
