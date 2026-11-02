/* ============================================================
   NOVIQ — About content (server-side)
   CMS-first: backend `about` key, admin-editable.
   Shape: { eyebrow{en,ar}, title{en,ar}, description{en,ar},
            mission{en,ar}, vision{en,ar},
            values[{id,title{en,ar},desc{en,ar}}] }
   ============================================================ */

import { api } from '@/lib/api-client';

export interface AboutValue {
  id: string;
  title: string;
  desc: string;
}

export interface AboutMilestone {
  year: string;
  title?: string;
  text: string;
}

export interface AboutContent {
  eyebrow: string;
  title: string;
  description: string;
  mission: string;
  vision: string;
  valuesEyebrow: string;
  valuesTitle: string;
  sinceEyebrow: string;
  journeyTitle: string;
  values: AboutValue[];
  milestones: AboutMilestone[];
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
  eyebrow: { en: 'About Noviq', ar: 'عن نوفيك' },
  title: { en: 'Engineering the Future Through Technology', ar: 'هندسة المستقبل بالتقنية والابتكار' },
  description: {
    en: 'Global software & AI engineering company helping ambitious businesses grow since 2014.',
    ar: 'شركة برمجيات وذكاء اصطناعي عالمية تساعد الأعمال الطموحة على النمو والريادة منذ عام 2014.',
  },
  mission: {
    en: 'Ship mission-critical software and AI systems that radically accelerate business metrics.',
    ar: 'بناء وتسليم برمجيات وأنظمة ذكاء اصطناعي حيوية تسرّع وتضاعف مؤشرات نمو الأعمال.',
  },
  vision: {
    en: 'Empower visionary teams worldwide to build the autonomous, resilient enterprises of tomorrow.',
    ar: 'تمكين الفرق القيادية حول العالم من بناء مؤسسات المستقبل الذكية والمرنة ذاتياً.',
  },
  valuesEyebrow: { en: 'What We Stand For', ar: 'مبادئنا وقيمنا' },
  valuesTitle: { en: 'Our Core Engineering Values', ar: 'قيمنا الهندسية الجوهرية' },
  sinceEyebrow: { en: 'Since 2014', ar: 'رحلتنا منذ 2014' },
  journeyTitle: { en: 'Our Journey & Milestones', ar: 'محطات مسيرتنا نحو الريادة' },
  values: [
    {
      id: 'value-innovation',
      title: { en: 'Innovation First', ar: 'الابتكار أولاً' },
      desc: {
        en: 'Pioneering intelligent software, next-generation AI agents, and resilient architectures that put clients years ahead of competition.',
        ar: 'ريادة البرمجيات الذكية ووكلاء الذكاء الاصطناعي وهندسة أنظمة مرنة تضع عملاءنا في صدارة المنافسة دائماً.',
      },
    },
    {
      id: 'value-quality',
      title: { en: 'Quality Obsession', ar: 'هاجس الجودة والإتقان' },
      desc: {
        en: 'Zero compromise on craft. Every line of code, benchmark, and UX interaction is engineered to the highest global standards.',
        ar: 'لا مساومة على الإتقان؛ كل سطر برمجي، وكل اختبار كفاءة، وكل تجربة مستخدم مصممة وفق أرفع المعايير العالمية.',
      },
    },
    {
      id: 'value-speed',
      title: { en: 'Speed to Impact', ar: 'سرعة الأثر والقيمة' },
      desc: {
        en: 'We replace months of deliberation with rapid, high-velocity sprints that deliver measurable business value in weeks.',
        ar: 'نستبدل أشهر الانتظار بدورات تطوير سريعة وفعالة تحقق أثراً حقيقياً وملموساً على مؤشرات الأعمال خلال أسابيع.',
      },
    },
    {
      id: 'value-transparency',
      title: { en: 'Radical Transparency', ar: 'الشفافية المطلقة' },
      desc: {
        en: 'Direct communication, shared metrics, and continuous visibility. We act as true co-founders and engineering partners.',
        ar: 'تواصل مباشر، مؤشرات أداء مشتركة، ورؤية واضحة في كل مرحلة، نعمل كشركاء تقنيين ومؤسسين مشاركين.',
      },
    },
    {
      id: 'value-security',
      title: { en: 'Security by Design', ar: 'الأمان في صميم البناء' },
      desc: {
        en: 'Enterprise-grade encryption, sovereign data controls, and defensive architectures built into every layer from day one.',
        ar: 'تشفير على مستوى المؤسسات، وتحكم كامل في سيادة البيانات، ومعماريات دفاعية مدمجة في كل طبقة منذ اليوم الأول.',
      },
    },
    {
      id: 'value-client-success',
      title: { en: 'Client Obsession', ar: 'الشغف بنجاح العميل' },
      desc: {
        en: "Our success is solely measured by our partners' market expansion, operational efficiency, and revenue velocity.",
        ar: 'يُقاس نجاحنا فقط بمدى توسع عملائنا في الأسواق، ورفع كفاءتهم التشغيلية، ومضاعفة نمو إيراداتهم.',
      },
    },
  ],
  milestones: [
    {
      year: '2014',
      title: { en: 'Foundation & Genesis', ar: 'التأسيس والانطلاقة' },
      text: {
        en: 'Noviq was founded as a boutique engineering laboratory focusing on high-performance cloud software.',
        ar: 'تأسست نوفيك كمختبر هندسي متخصص في تطوير البرمجيات السحابية عالية الأداء.',
      },
    },
    {
      year: '2017',
      title: { en: 'Enterprise Scalability', ar: 'التوسع المؤسسي' },
      text: {
        en: 'Scaled our enterprise practice, delivering multi-tenant ERP, fintech engines, and mission-critical workflows.',
        ar: 'توسيع خدمات المؤسسات الكبرى، وتقديم أنظمة تخطيط الموارد وحلول التقنية المالية الحساسة.',
      },
    },
    {
      year: '2019',
      title: { en: 'AI & Data Engineering', ar: 'هندسة البيانات والذكاء الاصطناعي' },
      text: {
        en: 'Pioneered custom AI agents, automated ML pipelines, and predictive analytics for international enterprises.',
        ar: 'إطلاق ممارسات الذكاء الاصطناعي وبناء خطوط التعلم الآلي والتحليلات التنبؤية للشركات الدولية.',
      },
    },
    {
      year: '2022',
      title: { en: 'Global Footprint', ar: 'الانتشار الدولي' },
      text: {
        en: 'Expanded across 32 countries with distributed engineering hubs across Europe, Middle East, and North America.',
        ar: 'التوسع إلى 32 دولة مع فرق هندسية متخصصة وموزعة عبر ثلاث قارات.',
      },
    },
    {
      year: '2024',
      title: { en: 'Autonomous Systems & LLMs', ar: 'الأنظمة الذاتية والنماذج التوليدية' },
      text: {
        en: 'Deployed 100+ private LLM agents, cognitive automation platforms, and autonomous workflows at enterprise scale.',
        ar: 'نشر أكثر من 100 وكيل ذكاء اصطناعي خاص ومنصات أتمتة إدراكية متقدمة في المؤسسات.',
      },
    },
    {
      year: '2026',
      title: { en: 'Industry Leadership', ar: 'ريادة الصناعة والمستقبل' },
      text: {
        en: '480+ projects delivered, 140+ enterprise partners, and industry-leading AI infrastructure architectures.',
        ar: 'أكثر من 480 مشروعاً منجزاً، و140 عميلاً مؤسسياً، وريادة عالمية في هندسة الذكاء الاصطناعي.',
      },
    },
  ],
};

function fromSeed(locale: Locale, live: boolean): AboutContent {
  return {
    eyebrow: pick(SEED.eyebrow, locale),
    title: pick(SEED.title, locale),
    description: pick(SEED.description, locale),
    mission: pick(SEED.mission, locale),
    vision: pick(SEED.vision, locale),
    valuesEyebrow: pick(SEED.valuesEyebrow, locale),
    valuesTitle: pick(SEED.valuesTitle, locale),
    sinceEyebrow: pick(SEED.sinceEyebrow, locale),
    journeyTitle: pick(SEED.journeyTitle, locale),
    values: (SEED.values as Record<string, unknown>[]).map((v, i) => ({
      id: typeof v.id === 'string' ? v.id : `value-${i}`,
      title: pick(v.title, locale),
      desc: pick(v.desc, locale),
    })).filter((v) => v.title),
    milestones: (SEED.milestones as Record<string, unknown>[]).map((m) => ({
      year: String(m.year || ''),
      title: pick(m.title, locale),
      text: pick(m.text || m.desc, locale),
    })).filter((m) => m.year && m.text),
    live,
  };
}

export async function getAboutContent(locale: string): Promise<AboutContent> {
  const loc: Locale = locale === 'ar' ? 'ar' : 'en';
  try {
    const data = (await api.content.about()) as Record<string, unknown>;
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('empty');
    const rawValues = Array.isArray(data.values) ? data.values : [];
    const values: AboutValue[] = (rawValues as Record<string, unknown>[]).map((v, i) => ({
      id: typeof v.id === 'string' && v.id ? v.id : `value-${i}`,
      title: pick(v.title, loc),
      desc: pick(v.desc, loc),
    })).filter((v) => v.title);

    const rawMilestones = Array.isArray(data.milestones) ? data.milestones : [];
    const milestones: AboutMilestone[] = (rawMilestones as Record<string, unknown>[]).map((m) => ({
      year: String(m.year || ''),
      title: pick(m.title, loc),
      text: pick(m.text || m.desc, loc),
    })).filter((m) => m.year && m.text);

    const fallback = fromSeed(loc, true);
    return {
      eyebrow: pick(data.eyebrow, loc) || fallback.eyebrow,
      title: pick(data.title, loc) || fallback.title,
      description: pick(data.description, loc) || fallback.description,
      mission: pick(data.mission, loc) || fallback.mission,
      vision: pick(data.vision, loc) || fallback.vision,
      valuesEyebrow: pick(data.valuesEyebrow, loc) || fallback.valuesEyebrow,
      valuesTitle: pick(data.valuesTitle, loc) || fallback.valuesTitle,
      sinceEyebrow: pick(data.sinceEyebrow, loc) || fallback.sinceEyebrow,
      journeyTitle: pick(data.journeyTitle, loc) || fallback.journeyTitle,
      values: values.length ? values : fallback.values,
      milestones: milestones.length ? milestones : fallback.milestones,
      live: true,
    };
  } catch {
    return fromSeed(loc, false);
  }
}

export default getAboutContent;
