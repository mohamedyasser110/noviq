/* ============================================================
   NOVIQ Frontend — Service Detail Page (CMS-driven)
   Title/desc come from the admin dashboard (Site Content →
   Services, matched by slug). Features stay curated per service
   below (EN/AR). Unknown slug → locale 404.
   ============================================================ */
import { notFound } from 'next/navigation';
import ContactCta from '@/components/contact/ContactCta';
import Link from 'next/link';
import { api } from '@/lib/api-client';

/* CMS edit window: this page is admin-editable, so re-read the API every 60s (ISR). */
export const revalidate = 60;

export async function generateStaticParams() {
  return [
    { locale: 'en', slug: 'ai-solutions' },
    { locale: 'en', slug: 'custom-software' },
    { locale: 'en', slug: 'erp-systems' },
    { locale: 'en', slug: 'crm-platforms' },
    { locale: 'en', slug: 'saas-development' },
    { locale: 'en', slug: 'web-applications' },
    { locale: 'en', slug: 'api-development' },
    { locale: 'en', slug: 'automation' },
    { locale: 'en', slug: 'digital-transformation' },
    { locale: 'ar', slug: 'ai-solutions' },
    { locale: 'ar', slug: 'custom-software' },
    { locale: 'ar', slug: 'erp-systems' },
    { locale: 'ar', slug: 'crm-platforms' },
    { locale: 'ar', slug: 'saas-development' },
    { locale: 'ar', slug: 'web-applications' },
    { locale: 'ar', slug: 'api-development' },
    { locale: 'ar', slug: 'automation' },
    { locale: 'ar', slug: 'digital-transformation' },
  ];
}

interface ServiceInfo {
  title: string;
  desc: string;
  features: string[];
}

const DETAILS: Record<string, { en: ServiceInfo; ar: ServiceInfo }> = {
  'ai-solutions': {
    en: { title: 'AI Solutions', desc: 'Custom AI models, LLM integrations, and intelligent automation built for real business outcomes.', features: ['Custom ML Models', 'LLM Integration', 'Intelligent Automation', 'Natural Language Processing', 'Computer Vision', 'MLOps'] },
    ar: { title: 'حلول الذكاء الاصطناعي', desc: 'نماذج ذكاء اصطناعي مخصصة وتكامل مع النماذج اللغوية وأتمتة ذكية لنتائج أعمال حقيقية.', features: ['نماذج تعلم آلة مخصصة', 'تكامل النماذج اللغوية', 'أتمتة ذكية', 'معالجة اللغة الطبيعية', 'الرؤية الحاسوبية', 'MLOps'] },
  },
  'custom-software': {
    en: { title: 'Custom Software', desc: 'Bespoke systems engineered around your workflows, not the other way around.', features: ['Full-Stack Engineering', 'User-Centric Design', 'Scalable Architecture', 'Enterprise Security', 'Comprehensive Testing', 'Complete Documentation'] },
    ar: { title: 'برمجيات مخصصة', desc: 'أنظمة مصممة حول سير عملك وليس العكس.', features: ['هندسة متكاملة', 'تصميم يتمحور حول المستخدم', 'بنية قابلة للتوسع', 'أمان مؤسسي', 'اختبار شامل', 'توثيق كامل'] },
  },
  'erp-systems': {
    en: { title: 'ERP Systems', desc: 'Unified operations platforms connecting finance, inventory, and people in one place.', features: ['Financial Management', 'Inventory Control', 'Human Resources', 'Supply Chain', 'Analytics & Reporting', 'Third-Party Integrations'] },
    ar: { title: 'أنظمة ERP', desc: 'منصات عمليات موحدة تربط المالية والمخزون والأفراد في مكان واحد.', features: ['الإدارة المالية', 'ضبط المخزون', 'الموارد البشرية', 'سلسلة الإمداد', 'التحليلات والتقارير', 'تكاملات خارجية'] },
  },
  'crm-platforms': {
    en: { title: 'CRM Platforms', desc: 'Sales and support tooling that gives every team a single source of truth.', features: ['Lead Management', 'Sales Automation', 'Customer Support', 'Marketing Automation', 'Sales Analytics', 'Mobile App'] },
    ar: { title: 'منصات CRM', desc: 'أدوات مبيعات ودعم تمنح كل فريق مصدراً واحداً للحقيقة.', features: ['إدارة العملاء المحتملين', 'أتمتة المبيعات', 'دعم العملاء', 'أتمتة التسويق', 'تحليلات المبيعات', 'تطبيق موبايل'] },
  },
  'saas-development': {
    en: { title: 'SaaS Development', desc: 'Multi-tenant products built to scale from first customer to first million.', features: ['Multi-Tenant Architecture', 'Billing System', 'Subscription Management', 'Data Security', 'Developer API', 'Analytics Dashboard'] },
    ar: { title: 'تطوير SaaS', desc: 'منتجات متعددة المستأجرين مصممة للتوسع من أول عميل حتى المليون.', features: ['بنية متعددة المستأجرين', 'نظام فوترة', 'إدارة الاشتراكات', 'أمن البيانات', 'واجهة API للمطورين', 'لوحة تحليلات'] },
  },
  'web-applications': {
    en: { title: 'Web Applications', desc: 'Fast, accessible, pixel-perfect interfaces engineered for growth.', features: ['React / Next.js', 'TypeScript', 'Automated Testing', 'CI/CD', 'Performance Monitoring', 'Accessibility'] },
    ar: { title: 'تطبيقات الويب', desc: 'واجهات سريعة وميسّرة ودقيقة مصممة للنمو.', features: ['React / Next.js', 'TypeScript', 'اختبار آلي', 'CI/CD', 'مراقبة الأداء', 'إمكانية الوصول'] },
  },
  'api-development': {
    en: { title: 'API Development', desc: 'Documented, versioned, secure APIs that partners enjoy integrating.', features: ['REST & GraphQL', 'Versioning', 'Authentication & Rate Limits', 'OpenAPI Docs', 'Webhooks', 'SDKs'] },
    ar: { title: 'تطوير API', desc: 'واجهات موثقة ومُصدَرة وآمنة يستمتع الشركاء بالتكامل معها.', features: ['REST و GraphQL', 'ترقيم الإصدارات', 'المصادقة وحدود المعدل', 'توثيق OpenAPI', 'Webhooks', 'حزم SDK'] },
  },
  automation: {
    en: { title: 'Business Automation', desc: 'Workflow and process automation that removes manual work at the root.', features: ['Process Mapping', 'RPA Bots', 'Approval Workflows', 'Notifications', 'Scheduled Jobs', 'Audit Trail'] },
    ar: { title: 'أتمتة الأعمال', desc: 'أتمتة سير العمل والعمليات التي تزيل العمل اليدوي من جذوره.', features: ['رسم العمليات', 'روبوتات RPA', 'سير الاعتمادات', 'التنبيهات', 'مهام مجدولة', 'سجل تدقيق'] },
  },
  'digital-transformation': {
    en: { title: 'Digital Transformation', desc: 'End-to-end modernization strategy paired with the engineering to execute it.', features: ['Discovery & Audit', 'Roadmap', 'Legacy Modernization', 'Cloud Migration', 'Team Training', 'Ongoing Support'] },
    ar: { title: 'التحول الرقمي', desc: 'استراتيجية تحديث شاملة مقترنة بالهندسة اللازمة لتنفيذها.', features: ['الاكتشاف والتدقيق', 'خارطة الطريق', 'تحديث الأنظمة القديمة', 'الترحيل السحابي', 'تدريب الفريق', 'دعم مستمر'] },
  },
};

function slugify(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export default async function ServiceDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const isRTL = locale === 'ar';
  const detail = DETAILS[slug];
  if (!detail) notFound();

  /* CMS override: match the admin's service title to this slug so an
     admin rename flows to the detail header (EN live). */
  let title = isRTL ? detail.ar.title : detail.en.title;
  let desc = isRTL ? detail.ar.desc : detail.en.desc;
  try {
    const list = (await api.content.services()) as { title?: string; desc?: string }[];
    if (Array.isArray(list)) {
      const match = list.find((s) => s && typeof s.title === 'string' && slugify(s.title) === slug);
      if (match && !isRTL) {
        if (match.title) title = match.title;
        if (match.desc) desc = match.desc;
      }
    }
  } catch {
    /* offline → curated copy above */
  }
  const service: ServiceInfo = { title, desc, features: isRTL ? detail.ar.features : detail.en.features };

  return (
    <div className="min-h-screen">
      <header className="bg-slate-50 dark:bg-slate-900 py-16 md:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Link
            href={`/${locale}/services`}
            className="inline-flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 hover:text-primary mb-8 transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
            {isRTL ? 'العودة إلى الخدمات' : 'Back to Services'}
          </Link>
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-slate-900 dark:text-white mb-4">
            {service.title}
          </h1>
          <p className="text-lg md:text-xl text-slate-600 dark:text-slate-300 max-w-3xl">
            {service.desc}
          </p>
        </div>
      </header>

      <section className="py-16 md:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white mb-10 text-center">
            {isRTL ? 'أبرز المميزات' : 'Key Features'}
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {service.features.map((feature, i) => (
              <div
                key={i}
                className="group rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 hover:border-primary/50 dark:hover:border-primary/50 hover:shadow-lg transition-all duration-300"
              >
                <h3 className="font-semibold text-slate-900 dark:text-white">
                  {feature}
                </h3>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 md:py-24 bg-slate-50 dark:bg-slate-900">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white mb-4">
            {isRTL ? 'جاهز تبدأ؟' : 'Ready to Get Started?'}
          </h2>
          <p className="text-lg text-slate-600 dark:text-slate-300 mb-8 max-w-2xl mx-auto">
            {isRTL ? 'أخبرنا عن مشروعك وسنعاود إليك خلال يوم عمل واحد.' : "Tell us about your project and we'll get back to you within one business day."}
          </p>
          <ContactCta locale={locale} className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-base font-medium text-white hover:bg-primary/90 transition-colors">
            {isRTL ? 'ابدأ مشروعك' : 'Start Your Project'}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </ContactCta>
        </div>
      </section>
    </div>
  );
}
