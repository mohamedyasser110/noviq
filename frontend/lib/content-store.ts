/**
 * NOVIQ CONTENT STORE (Server-side)
 * ============================================================
 * Provides typed access to site content for React Server Components.
 * This replaces the old client-side NOVIQ_CONTENT pattern with server-side
 * data access — content is loaded at build time and served via props.
 * ============================================================
 */

import { NOVIQ_CONTENT, type ContentItem, type NoviqContent } from '@/data/content';

export function getAllContent(): NoviqContent {
  return NOVIQ_CONTENT;
}

export function getServices(): ContentItem[] {
  return NOVIQ_CONTENT.services;
}

export function getServiceBySlug(slug: string): ContentItem | undefined {
  return NOVIQ_CONTENT.services.find(
    (s) => s.title.toLowerCase().replace(/\s+/g, '-') === slug
  );
}

export function getIndustries(): ContentItem[] {
  return NOVIQ_CONTENT.industries;
}

export function getProjects(): ContentItem[] {
  return NOVIQ_CONTENT.projects;
}

export function getTestimonials() {
  return NOVIQ_CONTENT.testimonials;
}

export function getStats() {
  return NOVIQ_CONTENT.stats;
}

export function getWhyItems(): ContentItem[] {
  return NOVIQ_CONTENT.why;
}

export function getProcessSteps() {
  return NOVIQ_CONTENT.process;
}

export function getClients() {
  return NOVIQ_CONTENT.clients;
}

export function getStack() {
  return NOVIQ_CONTENT.stack;
}

export function getHero() {
  return NOVIQ_CONTENT.hero;
}

export function getBrand() {
  return NOVIQ_CONTENT.brand;
}

export function getFooter() {
  return NOVIQ_CONTENT.footer;
}

export function getTeam() {
  /* `img` is empty on purpose: these are placeholders shown only when the CMS
     is unreachable, and the old `/images/team/*.jpg` paths pointed at files
     that do not exist in public/ — so the offline fallback rendered four broken
     images. An empty value makes team-content fall back to initials. */
  return NOVIQ_CONTENT.team || [
    { name: 'Ahmed Hassan', role: 'CEO & Founder', img: '' },
    { name: 'Sarah Chen', role: 'VP Engineering', img: '' },
    { name: 'Omar Khalil', role: 'Product Director', img: '' },
    { name: 'Layla Abbas', role: 'Head of Design', img: '' },
  ];
}

export function getFAQs(locale: 'en' | 'ar' = 'en') {
  if (locale === 'ar') {
    return [
      { q: 'ما التقنيات التي تستخدمها نوفيك؟', a: 'نعمل مع React، Next.js، Node.js، TypeScript، Python، .NET، Docker، Kubernetes، AWS، Azure، Google Cloud، PostgreSQL، MongoDB، Redis، TensorFlow، PyTorch و OpenAI.' },
      { q: 'كم تستغرق المشاريع عادةً؟', a: 'صفحات هبوط تأخذ 2-4 أسابيع، MVP ويب أو موبايل 6-12 أسبوعاً، وأنظمة ERP/CRM الكاملة 3-6 أشهر.' },
      { q: 'ما نموذج التسعير لديكم؟', a: 'يعتمد التسعير على نطاق المشروع مع خطط تبدأ من المبتدئين عبر النمو إلى المؤسسات.' },
      { q: 'هل تقدمون دعماً بعد الإطلاق؟', a: 'نعم — الدعم المستمر يشمل المراقبة وإصلاح الأخطاء والتحديثات، بعقود تصل إلى دعم 24/7.' },
      { q: 'هل يمكنكم العمل مع فريقنا الحالي؟', a: 'بالتأكيد. نقدم فرق مخصصة وتعزيزات، ونتكامل بانتظام مع فرق التكنولوجيا في العملاء.' },
    ];
  }

  return [
    { q: 'What technologies does Noviq use?', a: 'We work with React, Next.js, Node.js, TypeScript, Python, .NET, Docker, Kubernetes, AWS, Azure, Google Cloud, PostgreSQL, MongoDB, Redis, TensorFlow, PyTorch, and OpenAI.' },
    { q: 'How long does a typical project take?', a: 'Landing pages take 2-4 weeks, web or mobile MVPs take 6-12 weeks, and full ERP/CRM systems take 3-6 months.' },
    { q: 'What is your pricing model?', a: 'Pricing depends on project scope with plans from Starter through Growth to Enterprise. We support milestone-based payments.' },
    { q: 'Do you offer post-launch support?', a: 'Yes — ongoing support includes monitoring, bug fixes, updates, and upgrades, with SLAs up to 24/7 support.' },
    { q: 'Can you work with our existing team?', a: 'Absolutely. We offer dedicated teams and staff augmentation, and regularly integrate with in-house engineering teams.' },
  ];
}

export function getPricingTiers(locale: 'en' | 'ar' = 'en') {
  const isArabic = locale === 'ar';
  return [
    {
      key: 'starter',
      nameEn: 'Starter',
      nameAr: 'المبتدئ',
      descEn: 'Perfect for small teams starting their digital journey.',
      descAr: 'مثالي للفرق الصغيرة التي تبدأ رحلتها الرقمية.',
      price: '$99',
      featuresEn: ['Up to 10 Users', 'Core Features', 'Email Support', 'Basic Analytics', '1 Integration'],
      featuresAr: ['حتى 10 مستخدمين', 'الميزات الأساسية', 'دعم بريدي', 'تحليلات أساسية', 'تكامل واحد'],
      featured: false,
    },
    {
      key: 'growth',
      nameEn: 'Growth',
      nameAr: 'النمو',
      descEn: 'For growing businesses needing advanced capabilities.',
      descAr: 'للأعمال النامية التي تحتاج قدرات متقدمة.',
      price: '$499',
      featuresEn: ['Up to 50 Users', 'All Features', 'Priority Support', 'Advanced Analytics', '5 Integrations', 'AI Assistant'],
      featuresAr: ['حتى 50 مستخدماً', 'كل الميزات', 'دعم ذو أولوية', 'تحليلات متقدمة', '5 تكاملات', 'مساعد ذكاء اصطناعي'],
      featured: true,
    },
    {
      key: 'enterprise',
      nameEn: 'Enterprise',
      nameAr: 'المؤسسة',
      descEn: 'Full-scale solutions for large organizations.',
      descAr: 'حلول شاملة للمنظمات الكبيرة.',
      price: isArabic ? 'اتصل بنا' : 'Contact Us',
      featuresEn: ['Unlimited Users', 'Everything in Growth', 'Dedicated Support', 'Custom AI Models', 'Unlimited Integrations', 'SLA Guarantee', 'On-premise Option'],
      featuresAr: ['مستخدمون بلا حد', 'كل ما في النمو', 'دعم مخصص', 'نماذج ذكاء اصطناعي مخصصة', 'تكاملات بلا حد', 'ضمان SLA', 'خيار محلي'],
      featured: false,
    },
  ];
}

export default {
  getAllContent,
  getServices,
  getServiceBySlug,
  getIndustries,
  getProjects,
  getTestimonials,
  getStats,
  getWhyItems,
  getProcessSteps,
  getClients,
  getStack,
  getHero,
  getBrand,
  getFooter,
  getTeam,
  getFAQs,
  getPricingTiers,
};