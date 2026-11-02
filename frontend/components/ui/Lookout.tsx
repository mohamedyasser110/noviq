'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

/* ============================================================
   Lookout — expressive eyes that watch the auth form.
   Adapted to Noviq tokens: all paint classes resolve through
   tailwind.config.js (card/border/background/foreground/muted),
   so both themes work with zero custom CSS. Iris defaults to
   the site's signal blue; pass irisColor to override.
   SSR-safe: everything DOM lives in useEffect.
   ============================================================ */

/** `auto` derives the expression from focus, password and idle state; anything else forces it. */
export type LookoutMood = 'auto' | 'neutral' | 'reading' | 'secret' | 'peek' | 'happy' | 'sad' | 'sleepy';
type Expression = Exclude<LookoutMood, 'auto'>;

export interface LookoutProps extends Omit<React.ComponentProps<'div'>, 'children' | 'ref'> {
  /** Rendered size in px (the drawing is square). */
  size?: number;
  /** Head shape. */
  shape?: 'orb' | 'square';
  /**
   * Element whose fields the eyes watch (a form or a container). Defaults to the whole document.
   * Attach the ref in the same render as Lookout; it is read when Lookout mounts.
   */
  scope?: React.RefObject<HTMLElement | null>;
  /** What to follow: the pointer, the focused field's caret, or both (the field wins while one is focused). */
  follow?: 'both' | 'pointer' | 'form';
  /** Blink every few seconds. */
  blink?: boolean;
  /** Look away and lower the lids while a password field is focused; peek when it is revealed. */
  lookAwayForPasswords?: boolean;
  /** Seconds without pointer or keyboard activity before the eyes get sleepy. 0 disables. */
  idleAfter?: number;
  /** Force an expression. `auto` (default) derives it from what the form is doing. */
  mood?: LookoutMood;
  /** Where the eyes rest when nothing is happening, as [x, y] in −1..1. */
  restGaze?: [number, number];
  /** Iris color. Defaults to Noviq signal blue (the system's second color). */
  irisColor?: string;
  /** Host element ref (React 19 ref-as-prop). */
  ref?: React.Ref<HTMLDivElement | null>;
}

/* ---------- drawing data (SVG units; the head spans y 10–114, the eyes sit at y 64) ---------- */

/** Lid travel: the lid rect covers y 48–82; -34 clears the eye, 0 closes it. */
const LID: Record<Expression, number> = {
  neutral: -30,
  reading: -32,
  secret: -20,
  peek: -38,
  happy: -25,
  sad: -27,
  sleepy: -13,
};

const BROWS: Record<Expression, { left: string; right: string }> = {
  neutral: { left: 'translateY(0)', right: 'translateY(0)' },
  reading: { left: 'translateY(-1px)', right: 'translateY(-1px)' },
  secret: { left: 'translateY(-2px) rotate(-6deg)', right: 'translateY(-2px) rotate(6deg)' },
  peek: { left: 'translateY(-6px)', right: 'translateY(-6px)' },
  happy: { left: 'translateY(-3px)', right: 'translateY(-3px)' },
  sad: { left: 'translateY(2px) rotate(-14deg)', right: 'translateY(2px) rotate(14deg)' },
  sleepy: { left: 'translateY(4px)', right: 'translateY(4px)' },
};

/** Every mouth is M,Q,Q so the `d` transition can morph instead of snapping. */
const MOUTH: Record<Expression, string> = {
  neutral: 'M52 91 Q60 93.5 68 91 Q60 93.5 52 91',
  reading: 'M53 91 Q60 92.5 67 91 Q60 92.5 53 91',
  secret: 'M54 92 Q60 90 66 92 Q60 90 54 92',
  peek: 'M56 89 Q60 97 64 89 Q60 82 56 89',
  happy: 'M49 89 Q60 100 71 89 Q60 100 49 89',
  sad: 'M51 95 Q60 87.5 69 95 Q60 87.5 51 95',
  sleepy: 'M55 92 Q60 92.2 65 92 Q60 92.2 55 92',
};

const EYES = [41, 79] as const;
const EYE_Y = 64;

/** Noviq signal blue — the system's second color, readable on both themes. */
const NOVIQ_IRIS = '#2F7CF6';

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

function isField(el: Element | null): el is HTMLInputElement | HTMLTextAreaElement {
  if (!el) return false;
  if (el instanceof HTMLTextAreaElement) return true;
  if (!(el instanceof HTMLInputElement)) return false;
  return !['checkbox', 'radio', 'range', 'color', 'file', 'submit', 'button', 'reset', 'image', 'hidden'].includes(el.type);
}

/** Inputs whose selection API applies; others (email, number, date…) report `selectionStart` as null. */
function hasSelection(el: HTMLInputElement | HTMLTextAreaElement) {
  return el instanceof HTMLTextAreaElement || ['text', 'search', 'url', 'tel', 'password'].includes(el.type);
}

/**
 * Lookout — expressive eyes that read along with a form. They follow the pointer, look at the caret
 * of the focused field, look away for passwords, peek when the password is revealed, and get sleepy
 * when nothing happens. Decorative: never focusable, never in the way of the form.
 */
export function Lookout({
  size = 96,
  shape = 'orb',
  scope,
  follow = 'both',
  blink = true,
  lookAwayForPasswords = true,
  idleAfter = 8,
  mood = 'auto',
  restGaze = [0, 0],
  irisColor = NOVIQ_IRIS,
  className,
  style,
  ref,
  ...rest
}: LookoutProps) {
  const uid = React.useId().replace(/[^a-zA-Z0-9]/g, '');
  const hostRef = React.useRef<HTMLDivElement | null>(null);
  const pupilsRef = React.useRef<Array<SVGGElement | null>>([]);
  const lidsRef = React.useRef<Array<SVGRectElement | null>>([]);
  const apiRef = React.useRef<{ decide: () => void; rearm: () => void } | null>(null);
  const [expression, setExpression] = React.useState<Expression>('neutral');

  // The engine reads props through this ref, written after render (never during it).
  const opts = React.useRef({ follow, blink, lookAwayForPasswords, idleAfter, mood, restGaze });
  React.useLayoutEffect(() => {
    opts.current = { follow, blink, lookAwayForPasswords, idleAfter, mood, restGaze };
  });

  const setHost = React.useCallback(
    (node: HTMLDivElement | null) => {
      hostRef.current = node;
      if (typeof ref === 'function') ref(node);
      else if (ref) ref.current = node;
    },
    [ref],
  );

  React.useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    const scopeEl: ParentNode & EventTarget = scope?.current ?? document;

    // Per-frame state lives here, never in React state.
    const gaze = { x: 0, y: 0 };
    const target = { x: 0, y: 0 };
    const lid = { y: LID.neutral, target: LID.neutral, blinkTo: null as number | null };
    let rect = host.getBoundingClientRect();
    let raf = 0;
    let blinkTimer = 0;
    let blinkBack = 0;
    let idleTimer = 0;
    let peekTimer = 0;
    let lastArm = 0;
    let expr: Expression = 'neutral';
    let focused: HTMLInputElement | HTMLTextAreaElement | null = null;
    let pointer: { x: number; y: number } | null = null;
    let pointerDirty = false;
    let decideTimer = 0;
    let peekTarget: { x: number; y: number } | null = null;
    let sleepy = false;
    let visible = true;
    let typeObserver: MutationObserver | null = null;

    // One mirror span, reused for every caret measurement.
    const mirror = document.createElement('span');
    mirror.setAttribute('aria-hidden', 'true');
    mirror.style.cssText =
      'position:absolute;visibility:hidden;white-space:pre;left:-9999px;top:-9999px;pointer-events:none;';
    document.body.appendChild(mirror);
    let maskWidth = 0;

    const paint = () => {
      for (const g of pupilsRef.current) if (g) g.style.transform = `translate(${(gaze.x * 6).toFixed(2)}px, ${(gaze.y * 5).toFixed(2)}px)`;
      for (const r of lidsRef.current) if (r) r.style.transform = `translateY(${lid.y.toFixed(2)}px)`;
    };

    /** Viewport point → gaze vector relative to the eyes (uses the cached host rect). */
    const aimAt = (px: number, py: number) => {
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height * 0.5;
      target.x = clamp((px - cx) / (rect.width * 1.6), -1, 1);
      target.y = clamp((py - cy) / (rect.height * 1.6), -1, 1);
    };

    const tick = () => {
      raf = 0;
      if (!visible) return;
      if (pointerDirty) {
        pointerDirty = false;
        if (pointer && !focused && !peekTarget && !sleepy && opts.current.follow !== 'form' && opts.current.mood === 'auto')
          aimAt(pointer.x, pointer.y);
      }
      const lidGoal = lid.blinkTo ?? lid.target;
      if (reduce.matches) {
        gaze.x = target.x;
        gaze.y = target.y;
        lid.y = lidGoal;
        paint();
        return;
      }
      gaze.x += (target.x - gaze.x) * 0.18;
      gaze.y += (target.y - gaze.y) * 0.18;
      lid.y += (lidGoal - lid.y) * (lid.blinkTo !== null ? 0.55 : 0.28);
      paint();
      const moving =
        Math.abs(target.x - gaze.x) > 0.002 || Math.abs(target.y - gaze.y) > 0.002 || Math.abs(lidGoal - lid.y) > 0.05;
      if (moving) raf = requestAnimationFrame(tick);
      else {
        gaze.x = target.x;
        gaze.y = target.y;
        lid.y = lidGoal;
        paint();
      }
    };
    const wake = () => {
      if (!raf && visible) raf = requestAnimationFrame(tick);
    };
    /** Coalesces bursts (selectionchange during a drag, input + focus) into one decision per task turn. */
    const scheduleDecide = () => {
      if (decideTimer) return;
      decideTimer = window.setTimeout(() => {
        decideTimer = 0;
        decide();
      }, 0);
    };

    const setExpr = (next: Expression) => {
      if (next === expr) return;
      expr = next;
      lid.target = LID[next];
      setExpression(next);
    };

    const lookAway = () => {
      // Away from the field, and down: the body language of "I'm not reading that".
      const f = focused?.getBoundingClientRect();
      const fieldIsRight = f ? f.left + f.width / 2 > rect.left + rect.width / 2 : true;
      target.x = fieldIsRight ? -0.9 : 0.9;
      target.y = 0.55;
    };

    const restPose = () => {
      const [rx, ry] = opts.current.restGaze;
      target.x = clamp(rx, -1, 1);
      target.y = clamp(ry, -1, 1);
    };

    /** Copy the field's text metrics into the mirror once per focus. */
    const adoptFieldFont = (el: HTMLInputElement | HTMLTextAreaElement) => {
      const cs = getComputedStyle(el);
      for (const p of [
        'fontFamily',
        'fontSize',
        'fontWeight',
        'fontStyle',
        'fontVariant',
        'fontStretch',
        'letterSpacing',
        'wordSpacing',
        'textTransform',
      ] as const) mirror.style[p] = cs[p];
      mirror.textContent = '•';
      maskWidth = mirror.getBoundingClientRect().width;
    };

    /** Caret position of the focused field, so the eyes read along. Falls back to the field's centre. */
    const caretPoint = (el: HTMLInputElement | HTMLTextAreaElement) => {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      const centre = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      if (cs.direction === 'rtl' || !['left', 'start'].includes(cs.textAlign)) return centre;
      const upTo = hasSelection(el) ? (el.selectionStart ?? el.value.length) : el.value.length;
      let w: number;
      if (el.type === 'password') w = maskWidth * upTo;
      else {
        mirror.textContent = el.value.slice(0, upTo);
        w = upTo ? mirror.getBoundingClientRect().width : 0;
      }
      const inset = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.borderLeftWidth) || 0);
      return { x: r.left + clamp(inset + w - el.scrollLeft, inset, r.width - 8), y: centre.y };
    };

    const decide = () => {
      const m = opts.current.mood;
      const secretField = !!focused && focused.type === 'password' && opts.current.lookAwayForPasswords;

      if (m !== 'auto') setExpr(m);
      else if (peekTarget) setExpr('peek');
      else if (secretField) setExpr('secret');
      else if (focused) setExpr('reading');
      else if (sleepy) setExpr('sleepy');
      else setExpr('neutral');

      if (peekTarget) aimAt(peekTarget.x, peekTarget.y);
      else if (expr === 'secret' || (m === 'secret' && !focused)) lookAway();
      else if (focused && opts.current.follow !== 'pointer') {
        const p = caretPoint(focused);
        aimAt(p.x, p.y);
      } else if (expr === 'sleepy') {
        target.x = 0;
        target.y = 0.5;
      } else if (pointer && opts.current.follow !== 'form' && m === 'auto') aimAt(pointer.x, pointer.y);
      else restPose();
      wake();
    };

    const armIdle = (force = false) => {
      const now = performance.now();
      if (!force && now - lastArm < 800 && !sleepy) return;
      lastArm = now;
      window.clearTimeout(idleTimer);
      if (sleepy) {
        sleepy = false;
        scheduleDecide();
      }
      const s = opts.current.idleAfter;
      if (s > 0 && !reduce.matches)
        idleTimer = window.setTimeout(() => {
          sleepy = true;
          scheduleDecide();
        }, s * 1000);
    };

    const blinkAllowed = () => opts.current.blink && !reduce.matches && !document.hidden && visible;
    const doBlink = () => {
      if (!blinkAllowed()) return;
      lid.blinkTo = 0;
      wake();
      blinkBack = window.setTimeout(() => {
        lid.blinkTo = null;
        wake();
        if (Math.random() < 0.18) blinkTimer = window.setTimeout(doBlink, 180);
        else scheduleBlink();
      }, 110);
    };
    let firstBlink = true;
    const scheduleBlink = () => {
      window.clearTimeout(blinkTimer);
      if (!blinkAllowed()) return;
      // The first blink waits longer: a screenshot taken a few seconds after load should never catch closed eyes.
      const delay = firstBlink ? 6500 + Math.random() * 2500 : 2500 + Math.random() * 3500;
      firstBlink = false;
      blinkTimer = window.setTimeout(doBlink, delay);
    };

    const watchType = (el: HTMLInputElement | HTMLTextAreaElement | null) => {
      typeObserver?.disconnect();
      typeObserver = null;
      if (!(el instanceof HTMLInputElement)) return;
      let wasPassword = el.type === 'password';
      typeObserver = new MutationObserver(() => {
        const isPassword = el.type === 'password';
        if (wasPassword && !isPassword) {
          const r = el.getBoundingClientRect();
          peek({ x: r.left + r.width / 2, y: r.top + r.height / 2 }, 1400);
        }
        wasPassword = isPassword;
        if (el.type === 'password') maskWidth ||= 0;
        scheduleDecide();
      });
      typeObserver.observe(el, { attributes: true, attributeFilter: ['type'] });
    };

    const peek = (at: { x: number; y: number }, ms: number) => {
      peekTarget = at;
      scheduleDecide();
      window.clearTimeout(peekTimer);
      peekTimer = window.setTimeout(() => {
        peekTarget = null;
        scheduleDecide();
      }, ms);
    };

    const onFocusIn = (e: Event) => {
      const t = e.target as Element | null;
      focused = isField(t) ? t : null;
      if (focused) adoptFieldFont(focused);
      watchType(focused);
      rect = host.getBoundingClientRect();
      armIdle(true);
      scheduleDecide();
    };
    const onFocusOut = () => {
      focused = null;
      watchType(null);
      scheduleDecide();
    };
    const onInput = () => {
      armIdle();
      if (focused) scheduleDecide();
    };
    const onSelection = () => {
      if (focused && document.activeElement === focused) scheduleDecide();
    };
    const onPointer = (e: PointerEvent) => {
      pointer = { x: e.clientX, y: e.clientY };
      pointerDirty = true;
      armIdle();
      wake();
    };
    const onClick = (e: Event) => {
      const el = (e.target as Element | null)?.closest?.("[data-lookout='reveal']");
      if (!el) return;
      const r = el.getBoundingClientRect();
      peek({ x: r.left + r.width / 2, y: r.top + r.height / 2 }, 1400);
    };
    const onKey = () => armIdle();
    const onLayout = () => {
      rect = host.getBoundingClientRect();
      scheduleDecide();
    };
    const onVisibility = () => {
      if (document.hidden) window.clearTimeout(blinkTimer);
      else {
        armIdle(true);
        scheduleBlink();
        wake();
      }
    };

    const io = new IntersectionObserver(
      ([entry]) => {
        visible = entry?.isIntersecting ?? true;
        if (visible) {
          rect = host.getBoundingClientRect();
          scheduleBlink();
          scheduleDecide();
        } else {
          window.clearTimeout(blinkTimer);
          cancelAnimationFrame(raf);
          raf = 0;
        }
      },
      { threshold: 0 },
    );
    io.observe(host);

    scopeEl.addEventListener('focusin', onFocusIn);
    scopeEl.addEventListener('focusout', onFocusOut);
    scopeEl.addEventListener('input', onInput);
    scopeEl.addEventListener('click', onClick);
    document.addEventListener('selectionchange', onSelection);
    document.addEventListener('keydown', onKey);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pointermove', onPointer, { passive: true });
    window.addEventListener('resize', onLayout);
    window.addEventListener('scroll', onLayout, { passive: true, capture: true });
    reduce.addEventListener('change', wake);

    // Adopt a field that is already focused when we mount (e.g. autofocus).
    const active = document.activeElement;
    if (isField(active) && scopeEl.contains(active)) {
      focused = active;
      adoptFieldFont(active);
      watchType(active);
    }
    apiRef.current = {
      decide: scheduleDecide,
      rearm: () => {
        armIdle(true);
        scheduleBlink();
      },
    };
    armIdle(true);
    scheduleBlink();
    decide();
    paint();

    return () => {
      apiRef.current = null;
      io.disconnect();
      scopeEl.removeEventListener('focusin', onFocusIn);
      scopeEl.removeEventListener('focusout', onFocusOut);
      scopeEl.removeEventListener('input', onInput);
      scopeEl.removeEventListener('click', onClick);
      document.removeEventListener('selectionchange', onSelection);
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pointermove', onPointer);
      window.removeEventListener('resize', onLayout);
      window.removeEventListener('scroll', onLayout, { capture: true });
      reduce.removeEventListener('change', wake);
      typeObserver?.disconnect();
      mirror.remove();
      cancelAnimationFrame(raf);
      window.clearTimeout(decideTimer);
      window.clearTimeout(blinkTimer);
      window.clearTimeout(blinkBack);
      window.clearTimeout(idleTimer);
      window.clearTimeout(peekTimer);
    };
  }, [scope]);

  // Behaviour props apply immediately: re-run the decision and re-arm the timers.
  const [restX, restY] = restGaze;
  React.useEffect(() => {
    apiRef.current?.rearm();
    apiRef.current?.decide();
  }, [mood, follow, lookAwayForPasswords, idleAfter, blink, restX, restY]);

  const brows = BROWS[expression];

  return (
    <div
      ref={setHost}
      data-slot="lookout"
      data-expression={expression}
      className={cn('pointer-events-none inline-block select-none', className)}
      style={{ width: size, height: size, ...style }}
      {...rest}
    >
      <svg
        viewBox="0 0 120 120"
        width={size}
        height={size}
        aria-hidden="true"
        focusable="false"
        className="block overflow-visible"
      >
        <defs>
          {EYES.map((cx, i) => (
            <clipPath key={cx} id={`${uid}-${i}`}>
              <ellipse cx={cx} cy={EYE_Y} rx="13.5" ry="15.5" />
            </clipPath>
          ))}
        </defs>

        {shape === 'orb' ? (
          <circle cx="60" cy="62" r="52" className="fill-card stroke-border" strokeWidth="1.5" />
        ) : (
          <rect x="8" y="10" width="104" height="104" rx="30" className="fill-card stroke-border" strokeWidth="1.5" />
        )}

        {EYES.map((cx, i) => (
          <g key={cx} data-slot="eye">
            <ellipse
              cx={cx}
              cy={EYE_Y}
              rx="13.5"
              ry="15.5"
              className="fill-background stroke-border dark:fill-foreground"
              strokeWidth="1"
            />
            <g
              ref={(n) => {
                pupilsRef.current[i] = n;
              }}
            >
              <circle cx={cx} cy={EYE_Y} r="7.5" fill={irisColor} />
              <circle cx={cx} cy={EYE_Y} r="3.6" className="fill-foreground dark:fill-background" />
              {/* Catchlight: always the lightest value in the eye. */}
              <circle cx={cx - 2.6} cy={EYE_Y - 3} r="2" className="fill-background dark:fill-foreground" opacity="0.95" />
            </g>
            <g clipPath={`url(#${uid}-${i})`}>
              <rect
                ref={(n) => {
                  lidsRef.current[i] = n;
                }}
                x={cx - 15}
                y="48"
                width="30"
                height="34"
                className="fill-card"
                style={{ transform: `translateY(${LID.neutral}px)` }}
              />
            </g>
          </g>
        ))}

        {/* Brows and mouth change with expressions; classes carry the transitions so reduced motion can switch them off. */}
        <path
          d="M30 44 Q41 38.5 52 44"
          fill="none"
          strokeWidth="2.6"
          strokeLinecap="round"
          className="stroke-foreground transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
          style={{ transform: brows.left, transformOrigin: '41px 42px' }}
        />
        <path
          d="M68 44 Q79 38.5 90 44"
          fill="none"
          strokeWidth="2.6"
          strokeLinecap="round"
          className="stroke-foreground transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
          style={{ transform: brows.right, transformOrigin: '79px 42px' }}
        />
        <path
          d={MOUTH[expression]}
          fill="none"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="stroke-foreground [transition:d_220ms_cubic-bezier(0.22,1,0.36,1)] motion-reduce:[transition:none]"
        />
      </svg>
    </div>
  );
}

export default Lookout;
