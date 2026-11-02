/* ============================================================
   NOVIQ Frontend — Careers Page (CMS-driven)
   Content comes from the admin dashboard (backend `careers`
   key via lib/careers-content.ts). Falls back to the static
   seed when the API is offline.
   ============================================================ */
import { BookOpen, Users, Briefcase, DollarSign, Globe, Clock } from 'lucide-react';
import ContactCta from '@/components/contact/ContactCta';
import { getCareersContent } from '@/lib/careers-content';
import { readMessage, loadMessages } from '@/lib/i18n';

/* CMS edit window: this page is admin-editable, so re-read the API every 60s (ISR). */
export const revalidate = 60;

const BENEFIT_ICONS = [Briefcase, DollarSign, Globe, Clock, Users, BookOpen];

export default async function CareersPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const isArabic = locale === 'ar';
  const content = await getCareersContent(locale);
  /* `careers.applyNow` already existed in the dictionary but was shadowed by a
     literal; the other two keys are new. Both languages now resolve from the
     admin-editable dictionary, with the literal as the fallback. */
  const messages = await loadMessages(locale);
  const whyTitle = readMessage(messages, 'careers.whyTitle') || (isArabic ? 'لماذا العمل في نوفيك' : 'Why Work at Noviq');
  /* Named …Label because `openPositions` below is the mapped position array. */
  const openPositionsLabel = readMessage(messages, 'careers.openPositions') || (isArabic ? 'الوظائف المفتوحة' : 'Open Positions');
  const applyNow = readMessage(messages, 'careers.applyNow') || (isArabic ? 'تقدّم الآن' : 'Apply Now');

  const benefits = content.benefits.map((b, i) => ({
    ...b,
    icon: BENEFIT_ICONS[i % BENEFIT_ICONS.length],
  }));
  const openPositions = content.positions.map((p) => ({
    id: p.id,
    title: p.title,
    dept: p.desc,
    location: '',
  }));

  return (
    <div className="min-h-screen">
      <div className="bg-slate-50 dark:bg-slate-900 py-16 md:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <p className="mb-3 text-sm font-semibold uppercase tracking-wider text-primary">
            {content.eyebrow}
          </p>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white mb-4">
            {content.title}
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-300 max-w-3xl mx-auto">
            {content.description}
          </p>
        </div>
      </div>

      <section className="py-16 md:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white mb-10 text-center">
            {whyTitle}
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            {benefits.map((b) => (
              <div
                key={b.id}
                className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 text-center"
              >
                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary mx-auto mb-4">
                  <b.icon className="h-6 w-6" aria-hidden="true" />
                </div>
                <h3 className="font-semibold text-slate-900 dark:text-white mb-2">{b.title}</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400">{b.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 md:py-24 bg-slate-50 dark:bg-slate-900">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white mb-10 text-center">
            {openPositionsLabel}
          </h2>
          <div className="space-y-4 max-w-3xl mx-auto">
            {openPositions.map((pos) => (
              <div
                key={pos.id}
                className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6"
              >
                <div className="flex justify-between items-start gap-4 flex-wrap">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{pos.title}</h3>
                    <p className="text-slate-600 dark:text-slate-400 text-sm">{pos.dept}</p>
                  </div>
                  {pos.location ? (
                    <span className="text-sm text-slate-500 dark:text-slate-400">{pos.location}</span>
                  ) : null}
                </div>
                <ContactCta locale={locale} className="mt-4 inline-flex items-center rounded-lg bg-primary px-4 py-3 text-sm font-medium text-white hover:bg-primary/90 transition-colors">
                  {applyNow}
                </ContactCta>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
