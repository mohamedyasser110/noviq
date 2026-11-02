/* ============================================================
   NOVIQ — FAQ content (server-side)
   CMS-first: backend `faq` key, admin-editable.
   Shape: { eyebrow{en,ar}, title{en,ar}, description{en,ar},
            items[{ id, q{en,ar}, a{en,ar} }] }
   ============================================================ */

import { api } from '@/lib/api-client';

export interface FaqItem {
  id: string;
  q: string;
  a: string;
}

export interface FaqContent {
  eyebrow: string;
  title: string;
  description: string;
  items: FaqItem[];
  live: boolean;
}

type Locale = 'en' | 'ar';

function pick(value: unknown, locale: Locale): string {
  if (!value || typeof value !== 'object') return '';
  const pair = value as Partial<Record<Locale, unknown>>;
  const primary = pair[locale];
  if (typeof primary === 'string' && primary.trim()) return primary;
  const secondary = locale === 'en' ? pair.ar : pair.en;
  return typeof secondary === 'string' ? secondary : '';
}

const SEED_ITEMS = [
  { id: 'faq-tech', q: { en: 'What technologies does Noviq use?', ar: 'ما التقنيات التي تستخدمها نوفيك؟' }, a: { en: 'We work with React, Next.js, Node.js, TypeScript, Python, .NET, Docker, Kubernetes, AWS, Azure, Google Cloud, PostgreSQL, MongoDB, Redis, TensorFlow, PyTorch, and OpenAI.', ar: 'نعمل مع React وNext.js وNode.js وTypeScript وPython و.NET وDocker وKubernetes وAWS وAzure وGoogle Cloud وPostgreSQL وMongoDB وRedis وTensorFlow وPyTorch وOpenAI.' } },
  { id: 'faq-duration', q: { en: 'How long does a typical project take?', ar: 'كم تستغرق المشاريع عادةً؟' }, a: { en: 'Landing pages take 2-4 weeks, web or mobile MVPs take 6-12 weeks, and full ERP/CRM systems take 3-6 months.', ar: 'صفحات هبوط تأخذ 2-4 أسابيع، MVP ويب أو موبايل 6-12 أسبوعاً، وأنظمة ERP/CRM الكاملة 3-6 أشهر.' } },
  { id: 'faq-pricing', q: { en: 'What is your pricing model?', ar: 'ما نموذج التسعير لديكم؟' }, a: { en: 'Pricing depends on project scope with plans from Starter through Growth to Enterprise. We support milestone-based payments.', ar: 'يعتمد التسعير على نطاق المشروع مع خطط تبدأ من المبتدئين عبر النمو إلى المؤسسات.' } },
  { id: 'faq-support', q: { en: 'Do you offer post-launch support?', ar: 'هل تقدمون دعماً بعد الإطلاق؟' }, a: { en: 'Yes — ongoing support includes monitoring, bug fixes, updates, and upgrades, with SLAs up to 24/7 support.', ar: 'نعم — الدعم المستمر يشمل المراقبة وإصلاح الأخطاء والتحديثات، بعقود تصل إلى دعم 24/7.' } },
  { id: 'faq-team', q: { en: 'Can you work with our existing team?', ar: 'هل يمكنكم العمل مع فريقنا الحالي؟' }, a: { en: 'Absolutely. We offer dedicated teams and staff augmentation, and regularly integrate with in-house engineering teams.', ar: 'بالتأكيد. نقدم فرق مخصصة وتعزيزات، ونتكامل بانتظام مع فرق التكنولوجيا في العملاء.' } },
];

const SEED_META = {
  eyebrow: { en: 'FAQ', ar: 'الأسئلة الشائعة' },
  title: { en: 'Frequently Asked Questions', ar: 'الأسئلة الشائعة' },
  description: { en: 'Everything you need to know about working with Noviq.', ar: 'كل ما تحتاج معرفته للعمل مع نوفيك.' },
};

function fromSeed(locale: Locale, live: boolean): FaqContent {
  return {
    eyebrow: pick(SEED_META.eyebrow, locale),
    title: pick(SEED_META.title, locale),
    description: pick(SEED_META.description, locale),
    items: SEED_ITEMS.map((it) => ({ id: it.id, q: pick(it.q, locale), a: pick(it.a, locale) })).filter((it) => it.q && it.a),
    live,
  };
}

export async function getFaqContent(locale: string): Promise<FaqContent> {
  const loc: Locale = locale === 'ar' ? 'ar' : 'en';
  try {
    const data = (await api.content.faq()) as Record<string, unknown>;
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('empty');
    const raw = Array.isArray(data.items) ? data.items : [];
    if (!raw.length) throw new Error('no items');
    const items: FaqItem[] = (raw as Record<string, unknown>[]).map((it, i) => ({
      id: typeof it.id === 'string' && it.id ? it.id : `faq-${i}`,
      q: pick(it.q, loc),
      a: pick(it.a, loc),
    })).filter((it) => it.q && it.a);
    if (!items.length) throw new Error('no usable items');
    return {
      eyebrow: pick(data.eyebrow, loc) || fromSeed(loc, true).eyebrow,
      title: pick(data.title, loc) || fromSeed(loc, true).title,
      description: pick(data.description, loc) || fromSeed(loc, true).description,
      items,
      live: true,
    };
  } catch {
    return fromSeed(loc, false);
  }
}

export default getFaqContent;
