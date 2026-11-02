/* ============================================================
   NOVIQ Frontend — Localized Home Page (/{locale})
   CMS-first: the whole landing copy comes from ONE backend call
   (GET /api/content/home via lib/home-content.ts). Every section
   below receives resolved strings and falls back to the i18n
   dictionary when the API is offline — the build never breaks.
   ============================================================ */
import Hero from '@/components/sections/Hero';
import ServicesGrid from '@/components/sections/ServicesGrid';
import Industries from '@/components/sections/Industries';
import Process from '@/components/sections/Process';
import Testimonials from '@/components/sections/Testimonials';
import { LiftoffBand } from '@/components/sections/Liftoff';
import Contact from '@/components/sections/Contact';
import { getHomeContent } from '@/lib/home-content';
import { api } from '@/lib/api-client';
import type { Metadata } from 'next';

/* CMS edit window: this page is admin-editable, so re-read the API every 60s (ISR). */
export const revalidate = 60;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const isArabic = locale === 'ar';

  /* The leading brand word comes from the CMS `brand.name`. This page has its
     own metadata, so it OVERRIDES the layout default — which is why an edit to
     the brand used to be invisible on the homepage while the subpages (which
     inherit the layout template) did show it. The literal is the offline
     fallback; the fetch never throws. */
  let shortName = isArabic ? 'نوفيك' : 'Noviq';
  try {
    const brand = (await api.content.brand()) as Record<string, unknown> | null;
    const fromCms = typeof brand?.name === 'string' ? brand.name.trim() : '';
    if (fromCms) shortName = fromCms;
  } catch {
    /* API offline — keep the shipped brand word */
  }

  return {
    title: isArabic
      ? `${shortName} — هندسة البرمجيات والذكاء الاصطناعي | حلول مخصصة وأنظمة ERP وCRM وسحابة`
      : `${shortName} — Global Software & AI Engineering | Custom AI, ERP, CRM & Cloud`,
    description: isArabic
      ? 'نوفيك تبني برمجيات ذكية: حلول ذكاء اصطناعي مخصصة، أنظمة ERP وCRM، منصات SaaS، وبنية سحابية. أكثر من 480 مشروعاً في 32 دولة.'
      : 'Noviq builds intelligent software: custom AI solutions, ERP & CRM systems, SaaS platforms, and cloud infrastructure. 480+ projects across 32 countries.',
    alternates: {
      canonical: `/${locale}`,
      languages: { en: '/en', ar: '/ar' },
    },
    openGraph: {
      title: isArabic ? `${shortName} — هندسة المستقبل عبر التقنية` : `${shortName} — Engineering the Future Through Technology`,
      url: `/${locale}`,
    },
  };
}

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const home = await getHomeContent(locale);

  return (
    <div className="flex flex-col">
      <Hero locale={locale} content={home.hero} clients={home.clients} phrases={home.typewriter} eyebrow={home.clientsEyebrow} clientsHeader={home.clientsHeader} />
      <ServicesGrid locale={locale} header={home.servicesHeader} items={home.services} />
      <Industries locale={locale} header={home.industriesHeader} items={home.industries} />
      <Process locale={locale} header={home.processHeader} items={home.process} />
      <Testimonials locale={locale} header={home.testimonialsHeader} items={home.testimonials} />
      <LiftoffBand locale={locale as 'en' | 'ar'} copy={{ eyebrow: home.contact.eyebrow, titleLead: home.contact.title, titleAccent: '', desc: home.contact.desc }} />
      <Contact locale={locale} content={home.contact} brand={home.brand} />
    </div>
  );
}
