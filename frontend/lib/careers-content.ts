/* ============================================================
   NOVIQ — Careers content (server-side)
   CMS-first: backend `careers` key, admin-editable.
   Shape: { eyebrow{en,ar}, title{en,ar}, description{en,ar},
            benefits[{id,title{en,ar},desc{en,ar}}],
            positions[{id,title{en,ar},desc{en,ar}}] }
   ============================================================ */

import { api } from '@/lib/api-client';

export interface CareersEntry {
  id: string;
  title: string;
  desc: string;
}

export interface CareersContent {
  eyebrow: string;
  title: string;
  description: string;
  benefits: CareersEntry[];
  positions: CareersEntry[];
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

const SEED = {
  eyebrow: { en: 'Careers', ar: 'الوظائف' },
  title: { en: 'Join Our Team', ar: 'انضم إلى فريقنا' },
  description: { en: "We build the future through technology — and we're looking for creative talent to join us.", ar: 'نبني المستقبل عبر التقنية — ونبحث عن مواهب مبدعة تنضم إلينا.' },
  benefits: [
    { id: 'benefit-growth', title: { en: 'Career Growth', ar: 'نمو مهني' }, desc: { en: 'Continuous professional development', ar: 'فرص تطوير مهني مستمر' } },
    { id: 'benefit-pay', title: { en: 'Competitive Pay', ar: 'رواتب تنافسية' }, desc: { en: 'Competitive compensation packages', ar: 'حزمة مكافآت تنافسية' } },
    { id: 'benefit-remote', title: { en: 'Remote Work', ar: 'عمل عن بُعد' }, desc: { en: 'Flexible work from anywhere', ar: 'مرونة العمل من أي مكان' } },
    { id: 'benefit-balance', title: { en: 'Work-Life Balance', ar: 'توازن حياة-عمل' }, desc: { en: 'Real support for wellness', ar: 'دعم حقيقي للرفاهية' } },
    { id: 'benefit-culture', title: { en: 'Team Culture', ar: 'ثقافة فريقية' }, desc: { en: 'Collaborative and inspiring environment', ar: 'بيئة تعاونية وملهمة' } },
    { id: 'benefit-learning', title: { en: 'Continuous Learning', ar: 'تعلم مستمر' }, desc: { en: 'Workshops and ongoing training', ar: 'ورش عمل وتدريب دائم' } },
  ],
  positions: [
    { id: 'senior-swe', title: { en: 'Senior Software Engineer', ar: 'مهندس برمجيات أول' }, desc: { en: 'Product Development · Remote', ar: 'تطوير المنتجات · عن بُعد' } },
    { id: 'ai-eng', title: { en: 'AI Engineer', ar: 'مهندس ذكاء اصطناعي' }, desc: { en: 'AI Lab · San Francisco / London', ar: 'مختبر الذكاء الاصطناعي · سان فرانسيسكو / لندن' } },
    { id: 'devops', title: { en: 'DevOps Engineer', ar: 'مهندس DevOps' }, desc: { en: 'Infrastructure · Remote', ar: 'البنية التحتية · عن بُعد' } },
    { id: 'uiux', title: { en: 'UI/UX Designer', ar: 'مصمم واجهات وتجربة استخدام' }, desc: { en: 'User Experience · Remote', ar: 'تجربة المستخدم · عن بُعد' } },
  ],
};

function mapList(raw: unknown, locale: Locale): CareersEntry[] {
  if (!Array.isArray(raw)) return [];
  return (raw as Record<string, unknown>[]).map((it, i) => ({
    id: typeof it.id === 'string' && it.id ? it.id : `item-${i}`,
    title: pick(it.title, locale),
    desc: pick(it.desc, locale),
  })).filter((it) => it.title);
}

function fromSeed(locale: Locale, live: boolean): CareersContent {
  return {
    eyebrow: pick(SEED.eyebrow, locale),
    title: pick(SEED.title, locale),
    description: pick(SEED.description, locale),
    benefits: mapList(SEED.benefits, locale),
    positions: mapList(SEED.positions, locale),
    live,
  };
}

export async function getCareersContent(locale: string): Promise<CareersContent> {
  const loc: Locale = locale === 'ar' ? 'ar' : 'en';
  try {
    const data = (await api.content.careers()) as Record<string, unknown>;
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('empty');
    const benefits = mapList(data.benefits, loc);
    const positions = mapList(data.positions, loc);
    if (!benefits.length && !positions.length) throw new Error('no items');
    return {
      eyebrow: pick(data.eyebrow, loc) || fromSeed(loc, true).eyebrow,
      title: pick(data.title, loc) || fromSeed(loc, true).title,
      description: pick(data.description, loc) || fromSeed(loc, true).description,
      benefits: benefits.length ? benefits : fromSeed(loc, true).benefits,
      positions: positions.length ? positions : fromSeed(loc, true).positions,
      live: true,
    };
  } catch {
    return fromSeed(loc, false);
  }
}

export default getCareersContent;
