/* ============================================================
   NOVIQ — Pricing content (server-side)
   ------------------------------------------------------------
   CMS-first like team/resources: the backend stores `pricing`
   in SQLite, edited from the admin (Site Content → Pricing).
   Shape: { eyebrow{en,ar}, title{en,ar}, description{en,ar},
            plans[{ id, name{en,ar}, price{en,ar}, desc{en,ar},
                     features{en[],ar[]}, popular, cta{en,ar} }] }
   Offline → honest static seed below (same copy as the DB seed).
   ============================================================ */

import { api } from '@/lib/api-client';

export interface LocalizedText {
  en: string;
  ar: string;
}

export interface PricingPlan {
  id: string;
  name: string;
  price: string;
  desc: string;
  features: string[];
  popular: boolean;
  cta: string;
}

export interface PricingContent {
  eyebrow: string;
  title: string;
  description: string;
  plans: PricingPlan[];
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

function pickList(value: unknown, locale: Locale): string[] {
  if (!value || typeof value !== 'object') return [];
  const pair = value as Partial<Record<Locale, unknown>>;
  const primary = pair[locale];
  if (Array.isArray(primary)) return primary.filter((x): x is string => typeof x === 'string');
  const secondary = locale === 'en' ? pair.ar : pair.en;
  if (Array.isArray(secondary)) return secondary.filter((x): x is string => typeof x === 'string');
  return [];
}

const SEED = {
  eyebrow: { en: 'Pricing', ar: 'الأسعار' },
  title: { en: 'Transparent Pricing', ar: 'أسعار بسيطة وشفافة' },
  description: { en: 'No hidden fees. No surprises. Just great software.', ar: 'لا رسوم خفية. لا مفاجآت. فقط برمجيات رائعة.' },
  plans: [
    { id: 'starter', name: { en: 'Starter', ar: 'البدء' }, price: { en: '$150', ar: '$150' }, desc: { en: 'For small businesses & initial projects', ar: 'للشركات الصغيرة والمبادرات الأولية' }, features: { en: ['Up to 5 users', 'Email support', '1 database', 'Weekly reports'], ar: ['حتى 5 مستخدمين', 'دعم عبر البريد', 'قاعدة بيانات واحدة', 'تقارير أسبوعية'] }, popular: false, cta: { en: 'Get Started', ar: 'ابدأ الآن' } },
    { id: 'professional', name: { en: 'Professional', ar: 'محترف' }, price: { en: '$199', ar: '$199' }, desc: { en: 'For medium businesses & advanced solutions', ar: 'للشركات المتوسطة والحلول المتقدمة' }, features: { en: ['Up to 50 users', '24/7 support', 'Unlimited databases', 'Custom reports', 'Full API'], ar: ['حتى 50 مستخدمًا', 'دعم 24/7', 'قواعد بيانات غير محدودة', 'تقارير مخصصة', 'API متكامل'] }, popular: true, cta: { en: 'Get Started', ar: 'ابدأ الآن' } },
    { id: 'enterprise', name: { en: 'Enterprise', ar: 'مؤسسي' }, price: { en: '$250', ar: '$250' }, desc: { en: 'For enterprises & complex solutions', ar: 'للشركات الكبرى والحلول المعقدة' }, features: { en: ['Bespoke', 'Dedicated engineer', 'Flexible architecture', 'Premium support', 'Custom features', 'SLA guaranteed'], ar: ['خاص بك', 'مهندس مخصص', 'بنية مرنة', 'دعم متميز', 'ميزات مخصصة', 'ضمانات سحبية'] }, popular: false, cta: { en: 'Get Started', ar: 'ابدأ الآن' } },
  ],
};

function fromSeed(locale: Locale, live: boolean): PricingContent {
  return {
    eyebrow: pick(SEED.eyebrow, locale),
    title: pick(SEED.title, locale),
    description: pick(SEED.description, locale),
    plans: SEED.plans.map((p) => ({
      id: p.id,
      name: pick(p.name, locale),
      price: pick(p.price, locale),
      desc: pick(p.desc, locale),
      features: pickList(p.features, locale),
      popular: p.popular,
      cta: pick(p.cta, locale),
    })),
    live,
  };
}

export async function getPricingContent(locale: string): Promise<PricingContent> {
  const loc: Locale = locale === 'ar' ? 'ar' : 'en';
  try {
    const data = (await api.content.pricing()) as Record<string, unknown>;
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('empty');
    const rawPlans = Array.isArray(data.plans) ? data.plans : [];
    if (!rawPlans.length) throw new Error('no plans');
    const plans: PricingPlan[] = (rawPlans as Record<string, unknown>[]).map((p, i) => ({
      id: typeof p.id === 'string' && p.id ? p.id : `plan-${i}`,
      name: pick(p.name, loc),
      price: pick(p.price, loc),
      desc: pick(p.desc, loc),
      features: pickList(p.features, loc),
      popular: p.popular === true,
      cta: pick(p.cta, loc) || (loc === 'ar' ? 'ابدأ الآن' : 'Get Started'),
    })).filter((p) => p.name);
    if (!plans.length) throw new Error('no usable plans');
    return {
      eyebrow: pick(data.eyebrow, loc) || fromSeed(loc, true).eyebrow,
      title: pick(data.title, loc) || fromSeed(loc, true).title,
      description: pick(data.description, loc) || fromSeed(loc, true).description,
      plans,
      live: true,
    };
  } catch {
    return fromSeed(loc, false);
  }
}

export default getPricingContent;
