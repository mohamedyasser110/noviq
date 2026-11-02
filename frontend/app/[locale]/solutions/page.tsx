/* ============================================================
   NOVIQ Frontend — Solutions Page (CMS-driven)
   Cards come from the admin dashboard (Site Content → Ready-Made
   Solutions). Falls back to the static seed when offline.
   ============================================================ */
import { api } from '@/lib/api-client';
import { readMessage, loadMessages } from '@/lib/i18n';
import { createIcon } from '@/lib/utils';
import { CurrencySwitcher, Price } from '@/components/pricing/currency';
import ContactCta from '@/components/contact/ContactCta';

/* CMS edit window: this page is admin-editable, so re-read the API every 60s (ISR). */
export const revalidate = 60;

interface SolutionCard {
  id: string;
  title: string;
  desc: string;
  icon: string;
  price: string;
}

const FALLBACK: SolutionCard[] = [
  { id: 'clinic-management', title: 'Clinic Management', desc: 'Complete system for managing medical clinics, patients, and appointments.', icon: 'stethoscope', price: '$249/year' },
  { id: 'school-erp', title: 'School ERP', desc: 'Comprehensive platform for managing schools, students, teachers, and curricula.', icon: 'graduation-cap', price: '$299/year' },
  { id: 'hr-payroll', title: 'HR & Payroll', desc: 'Integrated HR, payroll, and attendance management system.', icon: 'users', price: '$199/year' },
  { id: 'inventory-system', title: 'Inventory System', desc: 'Smart inventory management with real-time tracking and reorder alerts.', icon: 'package', price: '$179/year' },
  { id: 'pos-system', title: 'POS System', desc: 'Modern POS supporting multiple payments and branch management.', icon: 'shopping-cart', price: '$149/year' },
  { id: 'fleet-management', title: 'Fleet Management', desc: 'Fleet tracking and monitoring with route optimization and maintenance.', icon: 'truck', price: '$279/year' },
];

const FALLBACK_AR: SolutionCard[] = [
  { id: 'clinic-management', title: 'إدارة العيادات', desc: 'نظام متكامل لإدارة العيادات الطبية والمرضى والمواعيد.', icon: 'stethoscope', price: '$249/سنة' },
  { id: 'school-erp', title: 'ERP للمدارس', desc: 'منصة شاملة لإدارة المدارس والطلاب والمعلمين والمناهج.', icon: 'graduation-cap', price: '$299/سنة' },
  { id: 'hr-payroll', title: 'الموارد والرواتب', desc: 'نظام متكامل للموارد البشرية والرواتب والحضور والانصراف.', icon: 'users', price: '$199/سنة' },
  { id: 'inventory-system', title: 'نظام المخزون', desc: 'إدارة مخزون ذكية مع تتبع فوري وتنبيهات إعادة الطلب.', icon: 'package', price: '$179/سنة' },
  { id: 'pos-system', title: 'نظام نقطة البيع', desc: 'نقاط بيع حديثة تدعم المدفوعات المتعددة وإدارة الفروع.', icon: 'shopping-cart', price: '$149/سنة' },
  { id: 'fleet-management', title: 'إدارة الأساطيل', desc: 'تتبع ومراقبة الأساطيل مع تحسين المسارات والصيانة.', icon: 'truck', price: '$279/سنة' },
];

async function getSolutions(locale: string): Promise<SolutionCard[]> {
  try {
    const data = (await api.content.solutionsList()) as Record<string, unknown>[];
    if (!Array.isArray(data) || !data.length) throw new Error('empty');
    const cards: SolutionCard[] = data.map((s, i) => ({
      id: typeof s.title === 'string' ? s.title.toLowerCase().replace(/[^a-z0-9]+/g, '-') : `solution-${i}`,
      title: typeof s.title === 'string' ? s.title : '',
      desc: typeof s.desc === 'string' ? s.desc : '',
      icon: typeof s.icon === 'string' ? s.icon : 'package',
      price: typeof s.price === 'string' ? s.price : '',
    })).filter((s) => s.title);
    if (!cards.length) throw new Error('no usable');
    // CMS solutions are EN-administered; AR keeps the curated fallback.
    if (locale === 'ar') return FALLBACK_AR;
    return cards;
  } catch {
    return locale === 'ar' ? FALLBACK_AR : FALLBACK;
  }
}

export default async function SolutionsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const messages = await loadMessages(locale);
  const isRTL = locale === 'ar';
  const solutions = await getSolutions(locale);
  /* Card CTA + footer CTA are dictionary-driven so the admin can reword them
     from Site Content → Translations; the literals are the unchanged fallback. */
  const solutionCta = readMessage(messages, 'solutions.cta') || (isRTL ? 'احصل على هذا الحل' : 'Get This Solution');
  const buildCustom = readMessage(messages, 'solutions.buildCustom') || (isRTL ? 'صمّم حلاً مخصصاً' : 'Build Custom');

  return (
    <div className="min-h-screen">
      <header className="bg-slate-50 dark:bg-slate-900 py-16 md:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white mb-4">
            {readMessage(messages, 'solutions.title') || 'Ready-to-Deploy Solutions'}
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-300 max-w-3xl mx-auto">
            {readMessage(messages, 'solutions.description') || 'Pre-engineered software packages tailored to your industry, backed by delivery expertise.'}
          </p>
          <div className="mt-6 flex justify-center">
            <CurrencySwitcher />
          </div>
        </div>
      </header>

      <section className="py-16 md:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {solutions.map((solution) => (
              <article
                key={solution.id}
                /* flex column + mt-auto on the CTA: descriptions run one to
                   four lines, so without this the price block and the button
                   ride up with the text and the three cards in a row end up
                   with their CTAs at three different heights. */
                className="group flex flex-col rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 hover:border-primary/50 dark:hover:border-primary/50 hover:shadow-lg transition-all duration-300"
              >
                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary mb-4 group-hover:bg-primary group-hover:text-white transition-colors">
                  {createIcon(solution.icon.toLowerCase(), { className: 'h-6 w-6' })}
                </div>
                <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
                  {solution.title}
                </h3>
                <p className="text-slate-600 dark:text-slate-400 mb-2">
                  {solution.desc}
                </p>
                {/* Price, the negotiable note and the button travel together
                    as one bottom-anchored block (mt-auto above). Anchoring
                    only the button left the price sitting wherever the
                    description happened to end, so a two-line card showed
                    its figure higher than its neighbours. */}
                <div className="mt-auto">
                  {/* CMS stores "$249/year": the figure converts, the billing
                      period is presentation and stays locale-rendered. */}
                  {solution.price ? (
                    <p className="mb-1 text-sm font-bold text-primary">
                      <Price value={solution.price.replace(/\s*\/(year|سنة)\s*$/, '')} />
                      <span className="font-medium text-slate-500 dark:text-slate-400"> / {isRTL ? 'سنة' : 'year'}</span>
                    </p>
                  ) : null}
                  {/* Prices are starting points, always open to discussion. */}
                  <p className="mb-4 text-xs font-medium text-slate-400 dark:text-slate-500">
                    {isRTL ? 'قابل للتفاوض' : 'Negotiable'}
                  </p>
                  <ContactCta
                    locale={locale}
                    isArabic={isRTL}
                    className="inline-flex items-center gap-2 min-h-[44px] text-primary font-medium hover:underline"
                    subject={solution.title}
                  >
                    {solutionCta}
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <line x1="5" y1="12" x2="19" y2="12" />
                      <polyline points="12 5 19 12 12 19" />
                    </svg>
                  </ContactCta>
                </div>
              </article>
            ))}
          </div>

          <div className="mt-12 text-center">
            <a
              href={`/${locale}/builder`}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 dark:border-slate-600 px-6 py-3 text-base font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              {buildCustom}
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <polyline points="16 18 22 12 16 6" />
                <polyline points="8 6 2 12 8 18" />
              </svg>
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
