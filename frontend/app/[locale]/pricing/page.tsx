/* ============================================================
   NOVIQ Frontend — Pricing Page (CMS-driven)
   Content comes from the admin dashboard (backend `pricing`
   key via lib/pricing-content.ts). Falls back to the static
   seed when the API is offline. Never hand-edit plans here.
   ============================================================ */
import ContactCta from '@/components/contact/ContactCta';
import { getPricingContent } from '@/lib/pricing-content';
import { CurrencySwitcher, Price } from '@/components/pricing/currency';

/* CMS edit window: this page is admin-editable, so re-read the API every 60s (ISR). */
export const revalidate = 60;

export default async function PricingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const isRTL = locale === 'ar';
  const content = await getPricingContent(locale);
  const plans = content.plans;

  return (
    <div className="min-h-screen">
      <header className="bg-slate-50 dark:bg-slate-900 py-16 md:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          {content.eyebrow ? (
            <p className="mb-3 text-sm font-semibold uppercase tracking-wider text-primary">
              {content.eyebrow}
            </p>
          ) : null}
          <h1 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white mb-4">
            {content.title}
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-300 max-w-3xl mx-auto">
            {content.description}
          </p>
          {/* Display currency only converts the figures below — plans stay
              authored in USD and the switcher never touches the CMS. */}
          <div className="mt-6 flex justify-center">
            <CurrencySwitcher />
          </div>
        </div>
      </header>

      <section className="py-16 md:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-8">
            {plans.map((plan) => (
              <div
                key={plan.id}
                className={`rounded-2xl border p-8 transition-all duration-300 ${
                  plan.popular
                    ? 'border-primary bg-white dark:bg-slate-900 shadow-xl dark:border-primary/50'
                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:shadow-lg'
                }`}
              >
                {plan.popular && (
                  <div className="flex justify-center mb-6">
                    <span className="px-4 py-1 text-xs font-medium bg-primary/10 text-primary rounded-full">
                      {isRTL ? 'الأكثر شعبية' : 'Most Popular'}
                    </span>
                  </div>
                )}
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                  {plan.name}
                </h2>
                <div className="mb-6">
                  <Price value={plan.price} className="text-4xl font-bold text-primary" />
                  {plan.price !== (isRTL ? 'مخصص' : 'Custom') && (
                    <span className="text-slate-500 dark:text-slate-400"> / {isRTL ? 'شهريًا' : 'month'}</span>
                  )}
                </div>
                <p className="text-slate-600 dark:text-slate-400 mb-6">{plan.desc}</p>
                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature, j) => (
                    <li key={j} className="flex items-center gap-3 text-sm">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="text-accent-action">
                        <path d="M20 6L9 17l-5-5" />
                      </svg>
                      <span className="text-slate-700 dark:text-slate-300">{feature}</span>
                    </li>
                  ))}
                </ul>
                {/* A plan button that goes nowhere is the "broken interface" —
                    every card must lead somewhere. It opens the shared chooser,
                    and names the plan so the dialog is specific, not generic. */}
                <ContactCta
                  locale={locale}
                  isArabic={isRTL}
                  subject={plan.name}
                  className={`block text-center w-full rounded-lg px-6 py-3 font-medium transition-colors ${
                    plan.popular
                      ? 'bg-primary text-white hover:bg-primary/90'
                      : 'border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  {plan.cta}
                </ContactCta>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
