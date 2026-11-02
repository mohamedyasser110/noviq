"use client";

/* ============================================================
   OUR CLINTS — عملاؤنا بنفس طريقة LogoCloudMarquee
   (motion blur-in + FlowingLogos) لكن بدل الصور: اسم العميل
   نفسه هو اللوجو — خط مميز ضخم بألوان متناوبة:
   كحلي غامق ← برتقالي ← أصفر ← أسود.
   البيانات من لوحة التحكم (Site Content → Our Clients).
   ثلاثة صفوف بسرعات مختلفة، الأوسط معكوس الاتجاه.
   ============================================================ */

import { motion } from "motion/react";
import { FlowingLogos, type FlowingLogo } from "@/components/ui/logo-cloud-marquee-utils/flowing-logos";
import { cn } from "@/lib/utils";

/* Deterministic shuffle (mulberry32). A plain Math.random() would order the
   rows differently on the server and on the first client render — a
   hydration mismatch on every load. Fixed seeds per row keep server and
   client identical while still scattering logos among names. */
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled<T>(list: T[], seed: number): T[] {
  const arr = [...list];
  const rand = mulberry32(seed);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** One client in the cloud. A name is required; an image is optional. */
export interface OurClintsEntry {
  name: string;
  /** Logo path from the admin (Site Content → Our Clients). Empty = wordmark. */
  img?: string;
}

interface OurClintsMarqueeProps {
  title?: string;
  description?: string;
  /**
   * Accepts plain strings (the old wordmark-only shape) OR objects with a
   * logo. Both are supported so an existing caller passing string[] keeps
   * working unchanged while an admin who uploads logos gets them rendered.
   */
  clients?: Array<string | OurClintsEntry>;
  locale?: string;
  className?: string;
  /** Where a clicked client goes. Omit to render a non-interactive cloud. */
  clientsHref?: string;
}

/** Normalise the two accepted shapes into one. */
function toEntries(input: Array<string | OurClintsEntry>): OurClintsEntry[] {
  const out: OurClintsEntry[] = [];
  for (const item of input) {
    if (typeof item === 'string') {
      if (item.trim()) out.push({ name: item.trim() });
    } else if (item && typeof item.name === 'string' && item.name.trim()) {
      out.push({ name: item.name.trim(), img: item.img?.trim() || '' });
    }
  }
  return out;
}

export default function OurClintsMarquee({
  title,
  description,
  clients = [],
  locale = "en",
  className,
  clientsHref,
}: OurClintsMarqueeProps) {
  const isRTL = locale === "ar";
  const heading = title ?? (isRTL ? "عملاؤنا" : "Our Clients");
  const sub =
    description ??
    (isRTL
      ? "نفخر بشراكات تدوم — من الشركات الناشئة إلى المؤسسات الكبرى."
      : "Proud partnerships that last — from startups to enterprises.");

  /* Names the destination for every cell's aria-label. Without it the link
     announces as bare "Meridian Health", which gives a screen-reader user
     no clue that following it goes somewhere. */
  const ctaLabel = clientsHref
    ? isRTL
      ? "شاهد كل عملائنا"
      : "See all our clients"
    : "";
  const words = heading.split(" ");

  const entries = toEntries(clients);

  /* Rows: three bands, each a scattered mix of brand pills and coloured
   * wordmarks travelling together — never a logo-only row. A client WITH
   * artwork renders its round logo PLUS its name in one pill (the name stays
   * visible as before); a client WITHOUT renders its name as a wordmark;
   * both live in the same row so the eye reads one varied cloud, not two
   * segregated bands.
   *
   * Each row is shuffled with its own fixed seed: the scatter differs per
   * row (and the middle row also runs reversed), while server and client
   * render the identical order. Durations stay 32/47/26s — coprime-ish, so
   * the rows never visibly re-align. */
  interface MarqueeRow {
    list: OurClintsEntry[];
    duration: string;
    reverse: boolean;
    delay: number;
    /** Shift the colour/typeface cycle so rows never look synchronised. */
    offset: number;
  }

  const rows: MarqueeRow[] = [
    { list: shuffled(entries, 11), duration: "[--duration:32s]", reverse: false, delay: 0, offset: 0 },
    { list: shuffled(entries, 29), duration: "[--duration:47s]", reverse: true, delay: 0.06, offset: 2 },
    { list: shuffled(entries, 53), duration: "[--duration:26s]", reverse: false, delay: 0.12, offset: 1 },
  ];

  /* One logo array per row, carrying the destination and the resolved image
     path. Built here rather than inside FlowingLogos so this component owns
     the navigation decision. */
  const toLogos = (list: OurClintsEntry[]): FlowingLogo[] =>
    list.map((e) => ({
      name: e.name,
      image: e.img || undefined,
      href: clientsHref,
      linkLabel: `${e.name} — ${ctaLabel}`,
    }));

  return (
    /* `noviq-clients` is what globals.css keys the hover/focus scroll-pause
       on (`.noviq-clients:hover .noviq-clients-track { animation-play-state:
       paused }`). Nothing rendered that class, so the pause never fired and a
       moving wall of logos was unclickable with a pointer. Adding it is what
       makes both the hover affordance and the click target work. */
    <section
      className={cn(
        "noviq-clients relative mt-20 w-full overflow-hidden py-16 md:mt-28",
        className
      )}
    >
      <div className="mx-auto max-w-6xl px-6">
        {/* Latin eyebrow: wide tracking is the point.
            Arabic is a cursive script — letter-spacing inserts gaps between
            joined glyphs and the words read as severed letters, so RTL gets
            normal spacing. */}
        <p
          className={cn(
            "relative z-10 mx-auto max-w-4xl text-center text-sm font-extrabold text-primary md:text-base",
            !isRTL && "uppercase tracking-[0.24em]"
          )}
        >
          {words.map((word, index) => (
            <motion.span
              key={`${word}-${index}`}
              initial={{ opacity: 0, filter: "blur(6px)", y: 12 }}
              whileInView={{ opacity: 1, filter: "blur(0px)", y: 0 }}
              viewport={{ once: true }}
              transition={{
                duration: 0.4,
                delay: index * 0.08,
                ease: "easeInOut",
              }}
              className="mr-2 inline-block"
            >
              {word}
            </motion.span>
          ))}
        </p>

        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="relative z-10 mx-auto mt-4 max-w-2xl text-center text-base text-zinc-500 dark:text-zinc-400 md:text-lg"
        >
          {sub}
        </motion.p>

        <div className="relative mt-10 space-y-5">
          {rows.map((row, r) => (
            <motion.div
              key={r}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: row.delay }}
              className="relative"
            >
            {/* No per-row fade overlays: `.flowing-logos-canopy` already fades
                both edges with a colour-agnostic mask, which reads identically
                in light and dark. The old `flowing-fade` gradient divs painted
                a solid dark block on the sides in dark mode — a visible bar
                floating over the page background instead of a blend. */}
              {/* `toLogos(row.list)` — not `row.list.map((name) => ({ name }))`.
                  That literal stripped `img` and `href` off every entry before
                  FlowingLogos ever saw it, so uploaded logos never rendered and
                  the cells were not clickable, no matter what the caller passed.
                  `mixed` picks per cell: round logo + name where artwork
                  exists, wordmark where it does not. */}
              <FlowingLogos
                data={toLogos(row.list)}
                variant="mixed"
                reverse={row.reverse}
                toneOffset={row.offset}
                className={row.duration}
              />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
