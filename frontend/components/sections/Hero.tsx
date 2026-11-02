'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import ContactCta from '@/components/contact/ContactCta';
import Link from 'next/link';
import { ArrowRight, Sparkles } from 'lucide-react';
import dynamic from 'next/dynamic';
import TypewriterBadge from '@/components/sections/TypewriterBadge';
import OurClintsMarquee from '@/components/OUR CLINTS/our-clints-marquee';
import { NOVIQ_CONTENT } from '@/data/content';
import type { HomeClient } from '@/lib/home-content';
import {
  BLACK_HOLE_DEFAULTS,
  fetchVisualSettings,
  resolveBlackHole,
  type BlackHoleSettings,
} from '@/lib/hero-visual-content';

/* The black hole is a heavy WebGL fragment shader. Loading it dynamically
   keeps it out of the first-paint bundle, and `ssr: false` means it never
   runs on the server. The static markup is identical with or without it. */
const BlackHole = dynamic(
  () => import('@/components/hero3d/BlackHoleHeroSection'),
  { ssr: false }
);

interface HeroContent {
  badge: string;
  titleLead: string;
  titleAccent: string;
  titleTrail: string;
  description: string;
  ctaPrimary: string;
  ctaSecondary: string;
}

interface HeroProps {
  locale: string;
  content?: HeroContent;
  clients?: HomeClient[];
  phrases?: string[];
  eyebrow?: string;
  /** Resolved clients-section header from the CMS (title + subtitle).
   *  The wordmark cloud used to receive the eyebrow as its heading and no
   *  subtitle at all, so the marquee fell back to hardcoded literals and the
   *  admin could not change the Arabic wording. */
  clientsHeader?: { eyebrow: string; title: string; description: string };
}

export default function Hero({ locale, content, clients: clientsProp, phrases: phrasesProp, eyebrow, clientsHeader }: HeroProps) {
  const t = useTranslations();
  const isRTL = locale === 'ar';

  /* Black hole settings come from the dashboard. The shipped defaults ARE the
     look that is live today — including the spinSpeed 0.115 that used to be
     passed as an explicit prop and silently overrode the component default,
     so there is finally one source of truth for it. A failed read falls
     back to those defaults and the hero is unaffected. */
  const [hole, setHole] = useState<BlackHoleSettings>(BLACK_HOLE_DEFAULTS);
  useEffect(() => {
    let cancelled = false;
    fetchVisualSettings('heroBlackhole', resolveBlackHole).then((next) => {
      if (!cancelled && next) setHole(next);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  /* CMS-first: the homepage passes resolved strings; without them the
     section falls back to the i18n dictionary (offline-safe). */
  const hero = {
    badge: content?.badge || t('hero.badge'),
    titleLead: content?.titleLead || t('hero.titleLead'),
    titleAccent: content?.titleAccent || t('hero.titleAccent'),
    titleTrail: content?.titleTrail || t('hero.titleTrail'),
    description: content?.description || t('hero.description'),
    ctaPrimary: content?.ctaPrimary || t('hero.ctaPrimary'),
    ctaSecondary: content?.ctaSecondary || t('hero.ctaSecondary'),
  };

  /* Clients stream in from the admin dashboard (Site Content →
     Our Clients). No logos on file? Cells render as wordmarks —
     names only, no images required. */
  const source: HomeClient[] = clientsProp ?? (NOVIQ_CONTENT.clients ?? []).map((c) => ({
    name: c.name,
    img: c.img ?? '',
    icon: c.icon ?? '',
  }));

  /* Rotating badge. Phrases come from the project's own content data
     (NOVIQ_CONTENT.typewriter) so the list stays admin-overridable; the
     next-intl string is the fallback if that list is ever empty. */
  const badgePhrases = phrasesProp ?? (isRTL ? NOVIQ_CONTENT.typewriter.ar : NOVIQ_CONTENT.typewriter.en);

  return (
    <section className="relative overflow-hidden pt-12 pb-20 md:pt-20 md:pb-28" aria-labelledby="hero-title">
      {/* Background ambient lighting */}
      <div 
        className="pointer-events-none absolute -top-40 start-1/2 -translate-x-1/2 w-[650px] h-[450px] rounded-full blur-[140px] opacity-25 dark:opacity-20"
        style={{
          background: 'radial-gradient(ellipse at center, #FF6A00 0%, #EA580C 40%, #2563EB 78%, transparent 100%)',
        }}
        aria-hidden="true"
      />

      <div className="noviq-wrap relative z-10">
        <div className="grid lg:grid-cols-12 gap-12 lg:gap-14 items-center">
          {/* Copy Column */}
          <div className="lg:col-span-6 flex flex-col items-start text-start">
            <p className="noviq-hero-badge">
              {isRTL ? <Sparkles className="h-4 w-4 text-orange-500 shrink-0" aria-hidden="true" /> : null}
              <TypewriterBadge
                phrases={badgePhrases}
                fallback={hero.badge}
                isRTL={isRTL}
              />
            </p>

            <h1
              id="hero-title"
              className="mt-6 max-w-2xl text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.1] text-slate-900 dark:text-white mb-6"
            >
              <span className="block">{hero.titleLead}</span>
              <span className="block w-fit text-gradient-future">{hero.titleAccent}</span>
              <span className="block">{hero.titleTrail}</span>
            </h1>

            <p className="mt-2 max-w-xl text-lg leading-relaxed text-ink-soft dark:text-slate-200 mb-8">
              {hero.description}
            </p>

            <div className="mt-2 flex flex-col gap-4 sm:flex-row w-full sm:w-auto">
              <ContactCta locale={locale} className="noviq-cta-primary group">
                <span>{hero.ctaPrimary}</span>
                <ArrowRight className="h-4 w-4 ms-2 rtl:rotate-180 transition-transform duration-200 group-hover:translate-x-1 rtl:group-hover:-translate-x-1" aria-hidden="true" />
              </ContactCta>
              <Link
                href={`/${locale}/portfolio`}
                className="noviq-cta-outline"
              >
                <span>{hero.ctaSecondary}</span>
              </Link>
            </div>
          </div>

          {/* Expressive Image Column */}
          <div className="lg:col-span-6 relative">
            <div className="relative mx-auto max-w-lg lg:max-w-none">
              {/* Warm ambient bleed around the card. Pure CSS on purpose —
                  the WebGL render below now fills the card itself, and a
                  second copy of this shader just to decorate the border
                  would double the cost of the heaviest thing on the page
                  for an effect a blurred gradient does perfectly well.

                  The inset is what decides how much light escapes: this
                  layer is BEHIND the card, so only the ring outside the
                  card's edge shows. It must stay LARGER than the blur in
                  globals.css, or the glow gets sliced off flat at the rim
                  and the halo dies.

                  It used to be -inset-12 / -inset-16 (48/64px) with a
                  34/30px blur — roughly 80px of dead space around the
                  card on every side, which is a lot of nothing on a
                  phone. Now 20/32px inset against a 20/18px blur: still
                  inset > blur so nothing is clipped, but the halo is
                  roughly half as far out. The gradient stops are
                  unchanged, so the colour and the falloff are identical —
                  only the footprint shrank. */}
              <div className="noviq-blackhole absolute -inset-5 sm:-inset-8 pointer-events-none" aria-hidden="true" />

              {/* The card is now a window onto the black hole rather than a
                  frame around a photograph. The static hero image is gone,
                  which is what finally let this be seen at all: while an
                  opaque image sat here, it covered the bright inner disc
                  and all that reached the page was the dim outer ring
                  leaking past the edges. With the hole itself in the card,
                  the shadow, the photon ring and the lensed halo are all in
                  frame, sharp and unmasked.

                  No blend mode, deliberately. `screen` is the obvious way to
                  make an opaque black canvas behave like a glow, and it was
                  tried first — but screen can only LIGHTEN, so screening
                  orange gas (255,140,40) over this near-white page
                  (248,244,245) returns pure white. On a light theme it
                  deletes the colour instead of producing a halo. So the sky
                  lives in the shader now (uSpace: space-blue in light,
                  page dusk in dark) on an opaque canvas — the full halo
                  survives on every theme, shadow always black. */}
              <div className="noviq-hole-card relative rounded-3xl overflow-hidden border border-slate-900/10 dark:border-white/10 shadow-2xl">
                <div className="relative aspect-[4/3]">
                  {/* Every value below is admin-editable (Site Content ->
                      Hero Visual). The defaults in lib/hero-visual-content.ts
                      are the ones that were hardcoded here, so the picture
                      does not change until someone edits something.

                      The prose is kept because the numbers were arrived at by
                      looking at the render, not by taste:
                        · stars at 0 — any starlight around the hole is lensed
                          into arcs and sparks around the shadow and competes
                          with the gas disc
                        · density and vignette left alone — raising density
                          hides the far side, raising vignette hides the ring
                        · brightness/glow/exposure raised together, glow
                          capped under the shader's 2.0 ceiling
                        · distance/elevation/roll are the shot itself: moving
                          distance pushes the gas off the edges or shrinks it
                          into the middle, and elevation decides how much of
                          the far side arches over the shadow */}
                  <BlackHole
                    spinSpeed={hole.spinSpeed}
                    orbitSpeed={hole.orbitSpeed}
                    distance={hole.distance}
                    elevation={hole.elevation}
                    roll={hole.roll}
                    fov={hole.fov}
                    diskInner={hole.diskInner}
                    diskOuter={hole.diskOuter}
                    diskThickness={hole.diskThickness}
                    diskDensity={hole.diskDensity}
                    brightness={hole.brightness}
                    glow={hole.glow}
                    exposure={hole.exposure}
                    vignette={hole.vignette}
                    doppler={hole.doppler}
                    grain={hole.grain}
                    starBrightness={hole.starBrightness}
                    hotColor={hole.hotColor}
                    midColor={hole.midColor}
                    coolColor={hole.coolColor}
                    spaceColor={hole.spaceColor}
                    spaceColorDark={hole.spaceColorDark}
                    steps={hole.steps}
                    resolution={hole.resolution}
                    maxDpr={hole.maxDpr}
                    focus={[0.5, 0.5]}
                  />
                  {/* Subtle inner viewport depth ring & vignette */}
                  <div className="pointer-events-none absolute inset-0 rounded-3xl ring-1 ring-inset ring-white/10 shadow-[inset_0_0_20px_rgba(37,99,235,0.06)]" aria-hidden="true" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Trusted by — OUR CLINTS cloud fed by the admin dashboard.
            The heading and subtitle are the CMS clientsHeader (already resolved
            for this locale by getHomeContent); `eyebrow` is only a fallback.

            `clients={source.map((c) => c.name)}` passed only the NAMES, which
            is why every uploaded logo was invisible: the component renders an
            image whenever `img` is set, and it was never given one. Passing
            the whole entry is the fix.

            `clientsHref` makes each cell a link to the full Our Clients page,
            which the component already supported but nothing was passing. */}
        <OurClintsMarquee
          title={clientsHeader?.title || eyebrow}
          description={clientsHeader?.description || undefined}
          locale={locale}
          clients={source.map((c) => ({ name: c.name, img: c.img || '' }))}
          clientsHref={`/${locale}/clients`}
          className="py-14"
        />
      </div>
    </section>
  );
}
