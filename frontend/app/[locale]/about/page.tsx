/* ============================================================
   NOVIQ Frontend — About Page (CMS-driven, premium)
   Header/values/mission/vision come from the admin dashboard
   (backend `about` key via lib/about-content.ts). Milestones
   stay static (company timeline, rarely edited).
   ============================================================ */
import Link from 'next/link';
import ContactCta from '@/components/contact/ContactCta';
import { getAboutContent } from '@/lib/about-content';
import { readMessage, loadMessages } from '@/lib/i18n';
import { Target, Eye, ArrowRight, Sparkles, Compass, ShieldCheck, Users } from 'lucide-react';

/* CMS edit window: this page is admin-editable, so re-read the API every 60s (ISR). */
export const revalidate = 60;

const VALUE_ICONS = [Sparkles, Compass, Users, ShieldCheck, Target, Eye];

export default async function AboutPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const isArabic = locale === 'ar';
  const content = await getAboutContent(locale);
  /* Section labels were literals, so no admin edit could reach them. The
     `about.*` keys are new; the literals remain the fallback. */
  const messages = await loadMessages(locale);
  const copy = {
    home: readMessage(messages, 'common.home') || (isArabic ? 'الرئيسية' : 'Home'),
    about: readMessage(messages, 'common.about') || (isArabic ? 'من نحن' : 'About'),
    mission: readMessage(messages, 'about.mission') || (isArabic ? 'مهمتنا' : 'Mission'),
    vision: readMessage(messages, 'about.vision') || (isArabic ? 'رؤيتنا' : 'Vision'),
    valuesEyebrow: content.valuesEyebrow || readMessage(messages, 'about.valuesEyebrow') || (isArabic ? 'مبادئنا' : 'What we stand for'),
    valuesTitle: content.valuesTitle || readMessage(messages, 'about.valuesTitle') || (isArabic ? 'قيمنا' : 'Our Values'),
    sinceEyebrow: content.sinceEyebrow || readMessage(messages, 'about.sinceEyebrow') || (isArabic ? 'منذ 2014' : 'Since 2014'),
    journeyTitle: content.journeyTitle || readMessage(messages, 'about.journeyTitle') || (isArabic ? 'رحلتنا' : 'Our Journey'),
    talkToUs: readMessage(messages, 'common.talkToUs') || (isArabic ? 'تحدث معنا' : 'Talk to Us'),
  };
  const values = content.values.map((v, i) => ({
    title: v.title,
    desc: v.desc,
    Icon: VALUE_ICONS[i % VALUE_ICONS.length],
  }));

  const milestones = content.milestones;

  return (
    <div className="min-h-screen">
      {/* ---- Hero: gradient mesh + breadcrumb + eyebrow ---- */}
      <div className="relative overflow-hidden bg-slate-50 dark:bg-slate-900 py-16 md:py-24">
        <div
          className="pointer-events-none absolute -top-32 start-1/2 h-[380px] w-[620px] -translate-x-1/2 rounded-full blur-[130px] opacity-25 dark:opacity-20"
          style={{ background: 'radial-gradient(ellipse at center, #FF6A00 0%, #EA580C 42%, #2563EB 80%, transparent 100%)' }}
          aria-hidden="true"
        />
        <div className="noviq-wrap relative">
          <nav aria-label="Breadcrumb" className="mb-8 flex items-center justify-center gap-1 text-sm">
            <Link
              href={`/${locale}`}
              className="inline-flex items-center min-h-[44px] text-slate-600 dark:text-slate-400 hover:text-primary transition-colors"
            >
              {copy.home}
            </Link>
            <span className="mx-2 text-slate-400">/</span>
            <span className="font-semibold text-slate-900 dark:text-white">
              {copy.about}
            </span>
          </nav>
          <div className="text-center">
            {content.eyebrow ? (
              <p className="eyebrow inline-flex items-center gap-2">
                <Sparkles className="h-4 w-4" aria-hidden="true" />
                {content.eyebrow}
              </p>
            ) : null}
            <h1 className="mx-auto mt-5 max-w-3xl text-3xl md:text-5xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              {content.title}
            </h1>
            <p className="noviq-lead mx-auto mt-5 max-w-2xl">
              {content.description}
            </p>
          </div>

          {/* ---- Mission / Vision ---- */}
          {(content.mission || content.vision) && (
            <div className="mx-auto mt-12 grid max-w-4xl gap-5 md:grid-cols-2">
              {content.mission ? (
                <div className="group rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/80 p-7 text-start shadow-sm transition-all duration-300 hover:shadow-xl hover:border-primary/50 hover:-translate-y-1">
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-white">
                    <Target className="h-6 w-6" aria-hidden="true" />
                  </div>
                  <p className="mb-1 text-xs font-bold uppercase tracking-widest text-primary">
                    {copy.mission}
                  </p>
                  <p className="text-lg font-medium leading-relaxed text-slate-800 dark:text-slate-100">{content.mission}</p>
                </div>
              ) : null}
              {content.vision ? (
                <div className="group rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/80 p-7 text-start shadow-sm transition-all duration-300 hover:shadow-xl hover:border-primary/50 hover:-translate-y-1">
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-white">
                    <Eye className="h-6 w-6" aria-hidden="true" />
                  </div>
                  <p className="mb-1 text-xs font-bold uppercase tracking-widest text-primary">
                    {copy.vision}
                  </p>
                  <p className="text-lg font-medium leading-relaxed text-slate-800 dark:text-slate-100">{content.vision}</p>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>

      {/* ---- Values ---- */}
      <section className="py-16 md:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-12 text-center">
            <p className="eyebrow">{copy.valuesEyebrow}</p>
            <h2 className="mt-4 text-2xl md:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              {copy.valuesTitle}
            </h2>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {values.map((v, i) => (
              <div
                key={v.title}
                className="group relative overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-7 transition-all duration-300 hover:shadow-xl hover:border-primary/50 hover:-translate-y-1"
              >
                <span
                  className="pointer-events-none absolute -top-2 end-3 text-[64px] font-extrabold leading-none text-slate-100 dark:text-slate-800 select-none"
                  aria-hidden="true"
                >
                  {String(i + 1).padStart(2, '0')}
                </span>
                <div className="relative">
                  <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors duration-300 group-hover:bg-primary group-hover:text-white">
                    <v.Icon className="h-6 w-6" aria-hidden="true" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">{v.title}</h3>
                  <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">{v.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---- Journey timeline ---- */}
      <section className="py-16 md:py-24 bg-slate-50 dark:bg-slate-900">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-12 text-center">
            <p className="eyebrow">{copy.sinceEyebrow}</p>
            <h2 className="mt-4 text-2xl md:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              {copy.journeyTitle}
            </h2>
          </div>
          <ol className="relative mx-auto max-w-3xl space-y-0 border-s-2 border-slate-200 dark:border-slate-700 ms-2 ps-0">
            {milestones.map((m) => (
              <li key={m.year + (m.title || '')} className="relative pb-10 ps-10 last:pb-0">
                <span
                  className="absolute start-0 top-1 flex h-9 w-9 -translate-x-1/2 items-center justify-center rounded-full bg-primary font-mono text-[11px] font-bold text-white shadow-lg shadow-primary/30 ring-4 ring-slate-50 dark:ring-slate-900"
                  aria-hidden="true"
                >
                  {m.year.length >= 4 ? m.year.slice(2) : m.year}
                </span>
                <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 transition-all duration-300 hover:border-primary/50 hover:shadow-lg">
                  <div className="flex flex-wrap items-baseline gap-2.5 mb-1.5">
                    <span className="font-mono text-base font-bold text-primary">{m.year}</span>
                    {m.title ? (
                      <span className="text-base font-bold text-slate-900 dark:text-white">
                        {m.title}
                      </span>
                    ) : null}
                  </div>
                  <p className="leading-relaxed text-slate-600 dark:text-slate-300 text-sm">{m.text}</p>
                </div>
              </li>
            ))}
          </ol>
          <div className="mt-14 text-center">
            <ContactCta locale={locale} className="noviq-cta-primary group inline-flex items-center gap-2">
              <span>{copy.talkToUs}</span>
              <ArrowRight className="h-4 w-4 rtl:rotate-180 transition-transform duration-200 group-hover:translate-x-1 rtl:group-hover:-translate-x-1" aria-hidden="true" />
            </ContactCta>
          </div>
        </div>
      </section>
    </div>
  );
}
