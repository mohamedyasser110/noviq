'use client';

/* ============================================================
   NOVIQ — Services grid (uniform showcase)
   ------------------------------------------------------------
   Redesign notes — what changed and why
   ------------------------------------
   1. THE CARDS ARE REAL LINKS. Each one is a <Link> to its own
      detail page (/{locale}/services/{slug}). They used to be dead
      <article>s carrying a decorative "→" that promised navigation
      and delivered none of it — no href, no tab stop, no hover
      target, and screen readers got a bare span. The arrow now
      lives inside a real affordance instead of imitating one.

   2. ICONS RESOLVE BY IDENTITY, NOT BY POSITION. The CMS ships an
      `icon` name on every service row and it used to be thrown
      away in favour of `serviceIcons[i % 9]`, so any admin edit
      that reordered or deleted a row slid every icon one place —
      the brain glyph ended up on "Custom Software". See
      lib/home-content.ts, which now matches rows by that name.

   3. TWO ROWS, PLUS THE USUAL TEXT LINK. The old sheet cut the grid
      at six cards on desktop (`:nth-child(n+7) { display: none }`) and
      floated a "View All Services" link underneath, so the three
      services below the fold were only reachable by finding and
      reading that one link. The homepage now renders exactly the
      first six — two full rows at 3-up — and every one of them opens
      its own detail page, so the cut costs nothing. The "view all"
      link stays, below the grid, in the same plain text form the
      Industries section uses: it was briefly a dashed endcap CELL,
      which was far too heavy for a link that needs no border and no
      icon. /services still lists all nine, and hides the link there
      because it would only point at the page you are on.

   4. NO MORE VOID. `justify-between` pinned a lone arrow to the
      bottom of a stretched card, leaving ~80px of dead space under
      a 2-line description. The foot is now pinned by a hairline
      rule, so the leftover height reads as structure instead.

   Every card is the SAME size — one uniform 3-up grid, no lead cell
   and no spans. Equal heights come from `grid-auto-rows: 1fr` on the
   track (and from flex stretch in the mobile track), so the clamp in
   .svc-card__desc is only a guard against one over-long CMS row.

   Mobile keeps the sideways snap scroll (one card plus a peek of
   the next); tablet and desktop become a real grid. The reveal
   follows the house pattern from Testimonials.tsx — `motion`'s
   whileInView with a per-row stagger, cancelled under
   prefers-reduced-motion.
   ============================================================ */

import { useTranslations } from 'next-intl';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { motion, useReducedMotion } from 'motion/react';
import {
  ArrowRight,
  Brain,
  Cloud,
  Code2,
  Compass,
  Globe,
  Layers,
  Plug,
  RefreshCw,
  Settings,
  Smartphone,
  Sparkles,
  Users,
  type LucideIcon,
} from 'lucide-react';

interface ServicesGridProps {
  locale: string;
  header?: { eyebrow: string; title: string; desc: string };
  items?: { title: string; desc: string; icon?: string }[];
}

/* CMS icon name → glyph. The keys are the strings the admin content
   store actually writes (backend/db/init.js seeds exactly these). */
const ICONS: Record<string, LucideIcon> = {
  brain: Brain,
  'code-2': Code2,
  layers: Layers,
  users: Users,
  sparkles: Sparkles,
  globe: Globe,
  plug: Plug,
  settings: Settings,
  compass: Compass,
  'refresh-cw': RefreshCw,
  cloud: Cloud,
  smartphone: Smartphone,
};

/* The same identity → the slug in app/[locale]/services/[slug]/page.tsx.
   Only services that actually HAVE a detail page are listed. A row
   that misses (Cloud, Mobile) links to the services index instead of
   guessing a slug and 404-ing. */
const SLUGS: Record<string, string> = {
  brain: 'ai-solutions',
  'code-2': 'custom-software',
  layers: 'erp-systems',
  users: 'crm-platforms',
  sparkles: 'saas-development',
  globe: 'web-applications',
  plug: 'api-development',
  settings: 'automation',
  compass: 'digital-transformation',
  'refresh-cw': 'digital-transformation',
};

/* Last resort for a row with no icon name at all — the old order,
   so an offline/legacy payload still renders the way it always did. */
const FALLBACK_ICONS: LucideIcon[] = [
  Brain, Code2, Layers, Users, Sparkles, Globe, Plug, Settings, Compass,
];

const serviceKeys = ['ai', 'custom', 'erp', 'crm', 'saas', 'web', 'api', 'automation', 'digital'];

/* How many rows the HOMEPAGE shows, at the 3-up desktop grid. Two rows
   is the whole budget for this section; the remainder is /services. */
const HOME_ROWS = 2;
const DESKTOP_COLS = 3;

const pad2 = (n: number) => String(n).padStart(2, '0');

export default function ServicesGrid({ locale, header, items }: ServicesGridProps) {
  const t = useTranslations();
  const pathname = usePathname();
  const reduced = useReducedMotion();

  /* CMS-first: resolved strings from the homepage bundle; otherwise i18n. */
  const head = {
    eyebrow: header?.eyebrow || t('services.eyebrow') || 'Services',
    title: header?.title || t('services.title'),
    desc: header?.desc || t('services.description'),
  };

  const rows: { title: string; desc: string; icon?: string }[] =
    items && items.length
      ? items
      : serviceKeys.map((k) => ({ title: t(`services.${k}`), desc: t(`services.${k}Desc`) }));

  /* /services is the full catalogue — show all of it. Everywhere else
     (the homepage) the section is a teaser of two rows. */
  const isFullCatalogue = (pathname || '').replace(/\/+$/, '').endsWith('/services');
  const visible = isFullCatalogue ? rows : rows.slice(0, HOME_ROWS * DESKTOP_COLS);

  const services = visible.map((service, i) => {
    const Icon = (service.icon && ICONS[service.icon]) || FALLBACK_ICONS[i % FALLBACK_ICONS.length];
    const slug = service.icon ? SLUGS[service.icon] : undefined;
    return {
      title: service.title,
      desc: service.desc,
      Icon,
      href: slug ? `/${locale}/services/${slug}` : `/${locale}/services`,
    };
  });

  return (
    <section
      className="noviq-section-qodix bg-slate-50/60 dark:bg-slate-900/40"
      aria-labelledby="services-heading"
    >
      <div className="noviq-wrap">
        <motion.div
          className="max-w-3xl"
          initial={reduced ? false : { opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          <p className="eyebrow">{head.eyebrow}</p>
          <h2 id="services-heading" className="noviq-h2 mt-5 text-slate-900 dark:text-white">
            {head.title}
          </h2>
          <p className="noviq-lead">{head.desc}</p>
        </motion.div>

        {/* Mobile: sideways snap, one card plus a peek. md+: a real grid. */}
        <div className="services-viewport">
          <ul className="services-track">
            {services.map((service, i) => (
              <motion.li
                key={`${service.href}-${i}`}
                className="services-cell"
                initial={reduced ? false : { opacity: 0, y: 26 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{
                  duration: 0.55,
                  delay: reduced ? 0 : (i % DESKTOP_COLS) * 0.06,
                  ease: [0.16, 1, 0.3, 1],
                }}
              >
                <Link href={service.href} className="svc-card">
                  <span className="svc-card__top">
                    <span className="svc-card__icon">
                      <service.Icon aria-hidden="true" />
                    </span>
                    {/* Ghost numeral — the documented role of the accent blue. */}
                    <span className="svc-card__num" aria-hidden="true">
                      {pad2(i + 1)}
                    </span>
                  </span>

                  <h3 className="svc-card__title">{service.title}</h3>
                  {service.desc ? <p className="svc-card__desc">{service.desc}</p> : null}

                  <span className="svc-card__foot" aria-hidden="true">
                    <span className="svc-card__rule" />
                    <span className="svc-card__go">
                      <ArrowRight />
                    </span>
                  </span>
                </Link>
              </motion.li>
            ))}
          </ul>
        </div>

        {/* The same text link the Industries section uses. This was a
            card once (the dashed endcap cell) and that was far too
            heavy for a link — no icon, no border and no box. Hidden on
            /services, where it would only link to the page you are
            already standing on. */}
        {!isFullCatalogue ? (
          <div className="mt-12 text-center">
            <a
              href={`/${locale}/services`}
              className="noviq-view-all inline-flex items-center gap-2 text-primary font-medium hover:underline"
            >
              {t('services.viewAll')}
              <span aria-hidden="true">→</span>
            </a>
          </div>
        ) : null}
      </div>
    </section>
  );
}
