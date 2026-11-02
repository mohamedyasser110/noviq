'use client';

import { useEffect, useRef } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { Building2, Factory, GraduationCap, Landmark, Wallet, ShoppingBag, Scale, Truck } from 'lucide-react';

interface IndustriesProps {
  locale: string;
  header?: { eyebrow: string; title: string; desc: string };
  items?: { title: string }[];
}

const industryIcons = [Building2, Factory, GraduationCap, Landmark, Wallet, ShoppingBag, Scale, Truck];
const industryKeys = ['healthcare', 'manufacturing', 'education', 'realEstate', 'finance', 'retail', 'government', 'logistics'];

/* Time between neighbouring cards revealing. 100ms x 7 = 700ms total cascade. */
const STAGGER_MS = 0.1;

/* Scroll-driven hover wave: each card holds the full hover look in turn, in
   order, the first time the grid scrolls into view — desktop and mobile
   alike (phones never hover, so without this they never see the effect).
   Runs once like the reveal; the mouse keeps working normally throughout. */
const WAVE_START_MS = 600;
const WAVE_STEP_MS = 280;
const WAVE_HOLD_MS = 1000;

export default function Industries({ locale, header, items }: IndustriesProps) {
  const t = useTranslations();
  const gridRef = useRef<HTMLDivElement | null>(null);
  const reduced = Boolean(useReducedMotion());

  /* CMS-first: resolved strings from the homepage bundle; otherwise i18n. */
  const head = {
    eyebrow: header?.eyebrow || t('industries.eyebrow') || 'Industries',
    title: header?.title || t('industries.title'),
    desc: header?.desc || t('industries.description'),
  };
  const industries = (items && items.length ? items : industryKeys.map((k) => ({ title: t(`industries.${k}`) }))).map((s, i) => ({
    ...s,
    icon: industryIcons[i % industryIcons.length],
  }));

  /* One reveal path for every viewport. motion's whileInView fires per card as
     it enters, with a per-index delay for the cascade — desktop and mobile
     alike, verified live on both. (An IntersectionObserver fallback used to live
     here, but its `revealed` state was never read by the render, so it only
     burned observers and re-renders while claiming mobile duties.) */
  useEffect(() => {
    if (reduced) return;
    const root = gridRef.current;
    if (!root || typeof window === 'undefined') return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        io.disconnect();
        const cards = Array.from(root.querySelectorAll('.industry-card'));
        cards.forEach((card, i) => {
          timers.push(
            setTimeout(() => {
              card.classList.add('industry-hot');
              timers.push(setTimeout(() => card.classList.remove('industry-hot'), WAVE_HOLD_MS));
            }, WAVE_START_MS + i * WAVE_STEP_MS),
          );
        });
      },
      { threshold: 0.25 },
    );
    io.observe(root);
    return () => {
      io.disconnect();
      timers.forEach(clearTimeout);
    };
  }, [reduced, industries.length]);

  return (
    <section className="noviq-section-qodix" aria-labelledby="industries-heading">
      <div className="noviq-wrap">
        <div className="max-w-3xl mb-16">
          <p className="eyebrow">{head.eyebrow}</p>
          <h2 id="industries-heading" className="noviq-h2 mt-5 text-slate-900 dark:text-white">
            {head.title}
          </h2>
          <p className="noviq-lead">
            {head.desc}
          </p>
        </div>

        {/* Scroll-in stagger: each card arrives in turn with a lift + fade.
            motion's whileInView fires per card as it enters, with a per-index
            delay for the cascade — one path for desktop and mobile.
            `once` keeps it to a single pass. */}
        <div ref={gridRef} className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {industries.map((industry, i) => (
            <motion.article
              key={i}
              initial={reduced ? false : { opacity: 0, y: 32, scale: 0.95 }}
              whileInView={{ opacity: 1, y: 0, scale: 1 }}
              whileHover={reduced ? undefined : { y: -6, scale: 1.03 }}
              whileTap={reduced ? undefined : { scale: 0.97 }}
              viewport={{ once: true, amount: 0.35 }}
              transition={{
                duration: 0.6,
                delay: reduced ? 0 : i * STAGGER_MS,
                ease: [0.16, 1, 0.3, 1],
              }}
              className="industry-card group relative overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700/60 bg-white dark:bg-slate-900 p-5 sm:p-6 text-center cursor-pointer"
            >
              {/* Gradient background sweep on hover */}
              <span
                aria-hidden="true"
                className="absolute inset-0 bg-gradient-to-br from-primary/[0.04] via-transparent to-accent/[0.04] opacity-0 transition-opacity duration-500 group-hover:opacity-100"
              />

              {/* Top accent line that blooms on hover */}
              <span
                aria-hidden="true"
                className="absolute inset-x-6 top-0 h-[2px] origin-center scale-x-0 rounded-full bg-gradient-to-r from-primary/0 via-primary to-primary/0 transition-transform duration-500 ease-out group-hover:scale-x-100"
              />

              {/* Bottom accent that mirrors the top (subtle) */}
              <span
                aria-hidden="true"
                className="absolute inset-x-10 bottom-0 h-px origin-center scale-x-0 rounded-full bg-gradient-to-r from-accent/0 via-accent/50 to-accent/0 transition-transform duration-700 ease-out group-hover:scale-x-100"
              />

              {/* Icon container with hover glow + rotation */}
              <div className="industry-icon-wrap relative h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mx-auto mb-4 transition-all duration-500 group-hover:bg-primary group-hover:text-white group-hover:shadow-lg group-hover:shadow-primary/30 group-hover:rotate-3 group-hover:scale-110">
                <industry.icon className="h-7 w-7 transition-transform duration-500 group-hover:scale-110" aria-hidden="true" />
                {/* Glow ring behind icon on hover */}
                <span
                  aria-hidden="true"
                  className="absolute inset-0 rounded-2xl ring-0 ring-primary/0 transition-all duration-500 group-hover:ring-4 group-hover:ring-primary/20"
                />
              </div>

              {/* Index number */}
              <p className="text-[11px] font-bold tracking-[0.18em] text-slate-400 dark:text-slate-500 mb-1.5 transition-colors duration-300 group-hover:text-primary/60" aria-hidden="true">
                {String(i + 1).padStart(2, '0')}
              </p>

              {/* Title */}
              <h3 className="relative text-base sm:text-lg font-semibold text-slate-900 dark:text-white transition-colors duration-300 group-hover:text-primary dark:group-hover:text-primary">
                {industry.title}
              </h3>
            </motion.article>
          ))}
        </div>

        <div className="mt-12 text-center">
          <a
            href={`/${locale}/industries`}
            className="noviq-view-all inline-flex items-center gap-2 text-primary font-medium hover:underline"
          >
            {t('industries.viewAll')}
            <span aria-hidden="true">→</span>
          </a>
        </div>
      </div>
    </section>
  );
}
