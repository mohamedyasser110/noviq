/**
 * NOVIQ CONTENT STORE
 * ============================================================
 * Server-side content data — the single source of truth for
 * the static site content (services, industries, why, etc.)
 *
 * This replaces the old content.config.js + content.ar.js pattern
 * with a structured TypeScript module.
 *
 * Admin-editable overrides still apply via localStorage at runtime
 * (see lib/content-admin.ts).
 * ============================================================
 */

export interface ContentItem {
  title: string;
  desc: string;
  icon?: string;
  titleAr?: string;
  descAr?: string;
  img?: string;
  link?: string;
  tag?: string;
  tagAr?: string;
  challenge?: string;
  solution?: string;
  results?: string;
  challengeAr?: string;
  solutionAr?: string;
  resultsAr?: string;
}

export interface StatItem {
  to: string | number;
  suffix?: string;
  label: string;
  labelAr?: string;
}

export interface Testimonial {
  quote: string;
  name: string;
  role: string;
  company?: string;
  img?: string;
  quoteAr?: string;
  nameAr?: string;
  roleAr?: string;
}

export interface ProcessStep {
  icon: string;
  title: string;
  desc: string;
  titleAr?: string;
  descAr?: string;
}

export interface HeroCapability {
  eyebrow: string;
  title: string;
  statusLabel: string;
  footLabel: string;
  eyebrowAr?: string;
  titleAr?: string;
  statusLabelAr?: string;
  footLabelAr?: string;
  cards: Array<{
    icon: string;
    title: string;
    titleAr?: string;
  }>;
  cardsAr?: Array<{
    icon: string;
    title: string;
  }>;
}

export interface PricingTier {
  key: string;
  name: string;
  nameAr?: string;
  desc: string;
  descAr?: string;
  price: string;
  features: string[];
  featuresAr?: string[];
  featured: boolean;
}

export interface NoviqContent {
  hero: {
    badge: string;
    titleLead: string;
    titleAccent: string;
    titleTrail: string;
    description: string;
    ctaPrimary: string;
    ctaSecondary: string;
    badgeAr?: string;
    titleLeadAr?: string;
    titleAccentAr?: string;
    titleTrailAr?: string;
    descriptionAr?: string;
    ctaPrimaryAr?: string;
    ctaSecondaryAr?: string;
  };
  typewriter: { en: string[]; ar: string[] };
  services: ContentItem[];
  servicesHeader: { eyebrow: string; title: string; desc?: string; eyebrowAr?: string; titleAr?: string; descAr?: string };
  industries: ContentItem[];
  industriesHeader: { eyebrow: string; title: string; desc?: string; eyebrowAr?: string; titleAr?: string; descAr?: string };
  why: ContentItem[];
  whyHeader: { eyebrow: string; title: string; desc?: string; eyebrowAr?: string; titleAr?: string; descAr?: string };
  process: ProcessStep[];
  processHeader: { eyebrow: string; title: string; desc?: string; eyebrowAr?: string; titleAr?: string; descAr?: string };
  clients: Array<{ name: string; img?: string; icon?: string }>;
  clientsHeader: { eyebrow: string; title: string; desc?: string; eyebrowAr?: string; titleAr?: string; descAr?: string };
  projects: ContentItem[];
  portfolioHeader: { eyebrow: string; title: string; desc?: string; eyebrowAr?: string; titleAr?: string; descAr?: string };
  testimonials: Testimonial[];
  testimonialsHeader: { eyebrow: string; title: string; desc?: string; eyebrowAr?: string; titleAr?: string; descAr?: string };
  stack: string[];
  stackHeader: { eyebrow: string; title: string; desc?: string; eyebrowAr?: string; titleAr?: string; descAr?: string };
  stats: StatItem[];
  contact: {
    eyebrow: string;
    title: string;
    desc: string;
    ctaLabel: string;
    phone?: string;
    phonePlaceholder?: string;
    optional?: string;
    optionalAr?: string;
    phoneAr?: string;
    phonePlaceholderAr?: string;
    name?: string;
    namePlaceholder?: string;
    email?: string;
    emailPlaceholder?: string;
    company?: string;
    companyPlaceholder?: string;
    message?: string;
    messagePlaceholder?: string;
    sending?: string;
    sent?: string;
    error?: string;
    eyebrowAr?: string;
    titleAr?: string;
    descAr?: string;
    ctaLabelAr?: string;
  };
  footer: {
    tagline: string;
    copyright: string;
    taglineAr?: string;
    copyrightAr?: string;
    columns: Array<{
      title: string;
      titleAr?: string;
      links: Array<{ text: string; textAr?: string; route?: string }>;
    }>;
    social: string[];
    newsletterTitle?: string;
    newsletterTitleAr?: string;
    newsletterPlaceholder?: string;
    newsletterPlaceholderAr?: string;
    newsletterBtn?: string;
    newsletterBtnAr?: string;
  };
  brand: {
    email: string;
    phone: string;
    locations: string;
    emailAr?: string;
    phoneAr?: string;
    locationsAr?: string;
  };
  team?: Array<{
    name: string;
    role: string;
    img?: string;
    roleAr?: string;
  }>;
  heroCapability: HeroCapability;
  solutionBuilder: {
    steps: Array<{ id: string; title: string; titleAr?: string; desc?: string; descAr?: string }>;
  };
  promptBuilder: {
    types: string[];
    tones: string[];
    formats: string[];
    models: string[];
  };
  pricing: PricingTier[];
}

/**
 * The canonical English source of truth for all static content.
 * This is what NOVIQ_CONTENT contained in content.config.js.
 */
export const NOVIQ_CONTENT: NoviqContent = {
  hero: {
    badge: 'New Designs, Built to Impress',
    titleLead: 'Engineering the Future',
    titleAccent: 'Through Technology',
    titleTrail: 'for ambitious businesses',
    description: 'Custom AI solutions, ERP & CRM systems, SaaS platforms, cloud infrastructure, and web & mobile applications engineered end to end.',
    ctaPrimary: 'Start Your Project',
    ctaSecondary: 'View Our Work',
    badgeAr: 'نصنع المستقبل بالتقنية',
    titleLeadAr: 'هندسة المستقبل',
    titleAccentAr: 'بالتقنية',
    titleTrailAr: 'للشركات الطموحة',
    descriptionAr: 'حلول ذكاء اصطناعي مخصصة، أنظمة ERP و CRM، منصات SaaS، بنية سحابية، وتطبيقات ويب وموبايل — مصممة للتوسع.',
    ctaPrimaryAr: 'ابدأ مشروعك',
    ctaSecondaryAr: 'عرض أعمالنا',
  },
  typewriter: {
    en: [
      'New Designs, Built to Impress',
      'Next-Gen AI Platforms',
      'Novel Software Engineering',
      'No-Compromise Performance',
      'Navigating Digital Futures',
      'Nurturing Ideas Into Products',
      'Network-Ready Enterprise Systems',
      'Non-Stop Innovation Pipeline',
      'Next-Level Cloud Architecture',
      'Noviq — Engineering the Future',
      'Native Intelligence, Deployed Fast',
    ],
    ar: [
      'نصنع المستقبل بالتقنية',
      'حلول ذكاء اصطناعي متقدمة',
      'برمجيات مؤسسية موثوقة',
      'تحول رقمي شامل',
      'نوفيك — هندسة المستقبل',
      'ابتكار بلا توقف',
      'جودة عالمية بمعايير مؤسسية',
    ],
  },
  services: [
    { title: 'AI Solutions', desc: 'Custom AI models, LLM integrations, and intelligent automation built for real business outcomes.', icon: 'brain', titleAr: 'حلول الذكاء الاصطناعي', descAr: 'أنظمة ذكاء اصطناعي مخصصة وأتمتة ذكية تعزز كفاءة الأعمال وتصنع أثراً ملموساً.' },
    { title: 'Custom Software Development', desc: 'Bespoke systems engineered around your workflows, not the other way around.', icon: 'code-2', titleAr: 'تطوير برمجيات مخصصة', descAr: 'أنظمة مبنية خصيصاً لتناسب سير عملك وتلبي تطلعات فريقك.' },
    { title: 'ERP Systems', desc: 'Unified operations platforms connecting finance, inventory, and people in one place.', icon: 'layers', titleAr: 'أنظمة ERP', descAr: 'حلول متكاملة تربط الحسابات والمخزون والموارد البشرية في منصة واحدة.' },
    { title: 'CRM Platforms', desc: 'Sales and support tooling that gives every team a single source of truth.', icon: 'users', titleAr: 'منصات CRM', descAr: 'أدوات ذكية للمبيعات والدعم تمنح فريقك رؤية شاملة لكل عميل.' },
    { title: 'Cloud Solutions', desc: 'Resilient, auto-scaling infrastructure across AWS, Azure, and Google Cloud.', icon: 'cloud', titleAr: 'حلول سحابية', descAr: 'بنية سحابية آمنة ومرنة تضمن استقرار منصتك تحت أي ضغط.' },
    { title: 'SaaS Development', desc: 'Multi-tenant products built to scale from first customer to first million.', icon: 'globe', titleAr: 'تطوير SaaS', descAr: 'منتجات سحابية متطورة مصممة للنمو السلس من أول عميل حتى مليون.' },
    { title: 'Web Applications', desc: 'Fast, accessible, pixel-perfect interfaces engineered for growth.', icon: 'globe', titleAr: 'تطبيقات ويب', descAr: 'واجهات فائقة السرعة وسلسة الاستخدام توفر تجربة تصفح راقية.' },
    { title: 'Mobile Applications', desc: 'Native-feel iOS and Android apps from a single, maintainable codebase.', icon: 'smartphone', titleAr: 'تطبيقات موبايل', descAr: 'تطبيقات أصلية عالية الأداء لأنظمة iOS وAndroid بلمسة تصميمية مبدعة.' },
    { title: 'API Development', desc: 'Documented, versioned, secure APIs that partners actually enjoy integrating.', icon: 'plug', titleAr: 'تطوير API', descAr: 'ربط برمجي آمن وسلس بين مختلف منظوماتك التطبيقية والشركاء.' },
    { title: 'Business Automation', desc: 'Workflow and process automation that removes manual work at the root.', icon: 'settings', titleAr: 'أتمتة الأعمال', descAr: 'أتمتة ذكية للمهام الروتينية لرفع الإنتاجية وتقليل الجهد اليدوي.' },
    { title: 'Digital Transformation', desc: 'Full modernization strategy paired with practical engineering.', icon: 'compass', titleAr: 'التحول الرقمي', descAr: 'رؤية استراتيجية واضحة لتحديث تقنياتك وتحويل أفكارك إلى واقع.' },
  ],
  servicesHeader: {
    eyebrow: 'What We Build',
    title: 'Full-Spectrum Software & AI Solutions',
    desc: 'From intelligent automation to enterprise-grade platforms, engineered end to end.',
    eyebrowAr: 'ما نبنيه',
    titleAr: 'حلول برمجية وذكاء اصطناعي متكاملة',
    descAr: 'من الأتمتة الذكية إلى المنصات المؤسسية، مصممة من البداية للنهاية.',
  },
  industries: [
    { title: 'Healthcare', desc: 'Patient intelligence platforms, HIPAA compliance, telehealth integration.', icon: 'heart-pulse', titleAr: 'الرعاية الصحية', descAr: 'منصات ذكاء المرضى، امتثال HIPAA، تكامل الرعاية عن بعد.' },
    { title: 'Finance', desc: 'Core banking platforms, fraud detection, regulatory reporting.', icon: 'wallet', titleAr: 'القطاع المالي', descAr: 'أنظمة مصرفية أساسية، كشف الاحتيال، تقارير تنظيمية.' },
    { title: 'Manufacturing', desc: 'Smart factory platforms, predictive maintenance, supply chain optimization.', icon: 'factory', titleAr: 'التصنيع', descAr: 'منصات مصنع ذكي، صيانة تنبؤية، تحسين سلسلة الإمداد.' },
    { title: 'Education', desc: 'EdTech platforms, adaptive learning, virtual classrooms.', icon: 'graduation-cap', titleAr: 'التعليم', descAr: 'منصات تعليم تقني، تعلم تكيفي، فصول افتراضية.' },
    { title: 'E-commerce & Retail', desc: 'Intelligent commerce engines, personalization, inventory optimization.', icon: 'shopping-bag', titleAr: 'التجارة الإلكترونية', descAr: 'محركات تجارة ذكية، تخصيص شخصي، تحسين المخزون.' },
    { title: 'Government', desc: 'Secure citizen service portals, digital transformation programs.', icon: 'scale', titleAr: 'الحكومة', descAr: 'بوابات خدمات مواطن آمنة، برامج تحول رقمي.' },
    { title: 'Logistics', desc: 'Fleet management, real-time tracking, warehouse automation.', icon: 'truck', titleAr: 'الخدمات اللوجستية', descAr: 'إدارة الأساطيل، تتبع لحظي، أتمتة المستودعات.' },
  ],
  industriesHeader: {
    eyebrow: 'Trusted Across Every Major Industry',
    title: 'We Serve',
    desc: 'We deliver tailored solutions for healthcare, finance, manufacturing, and more.',
    eyebrowAr: 'شريك موثوق عبر القطاعات الرئيسية',
    titleAr: 'ما نخدمه',
    descAr: 'نقدم حلولاً مخصصة للرعاية الصحية والقطاع المالي والتصنيع والمزيد.',
  },
  why: [
    { title: 'Innovation First', desc: "We push boundaries and explore what's possible.", icon: 'sparkles', titleAr: 'الابتكار أولاً', descAr: 'ندفع الحدود ونستكشف الممكن.' },
    { title: 'Quality Obsession', desc: 'Every line of code is engineered to the highest standard.', icon: 'shield-check', titleAr: 'هاجس الجودة', descAr: 'كل سطر برمجي مصمم بأعلى المعايير.' },
    { title: 'People-Centric', desc: 'Technology serves people, not the other way around.', icon: 'users', titleAr: 'الإنسان أولاً', descAr: 'التقنية في خدمة الإنسان وليس العكس.' },
    { title: 'Global Mindset', desc: 'Diverse perspectives create better solutions.', icon: 'globe', titleAr: 'تفكير عالمي', descAr: 'التنوع في وجهات النظر يصنع حلولاً أفضل.' },
  ],
  whyHeader: {
    eyebrow: 'Why Noviq',
    title: 'Built Different. Built to Last.',
    desc: 'Eight reasons ambitious teams choose Noviq — engineered for outcomes, not just output.',
    eyebrowAr: 'لماذا نوفيك',
    titleAr: 'مصممة بشكل مختلف. مبنية لتدوم.',
    descAr: 'ثمانية أسباب تجعل الفرق الطموحة تختار نوفيك — هندسة للنتائج وليس للمخرجات فقط.',
  },
  process: [
    { icon: 'clipboard-check', title: 'Requirements Analysis', desc: 'Deep dive into your business goals and technical constraints.', titleAr: 'تحليل المتطلبات', descAr: 'تحليل عميق لأهدافك وقيودك التقنية.' },
    { icon: 'design', title: 'Architecture Design', desc: 'Design scalable, resilient system architecture for long-term growth.', titleAr: 'تصميم المعمارية', descAr: 'تصميم بنية متوسعة ومقاومة للنمو طويل الأمد.' },
    { icon: 'code', title: 'Agile Development', desc: 'Iterative sprints with regular demos and feedback loops.', titleAr: 'تطوير مرن', descAr: 'إصدارات متكررة مع عروض وملاحظات منتظمة.' },
    { icon: 'test-tube', title: 'Quality Assurance', desc: 'Comprehensive testing including security, performance, and usability.', titleAr: 'ضمان الجودة', descAr: 'اختبار شامل يشمل الأمان والأداء وسهولة الاستخدام.' },
    { icon: 'rocket', title: 'Deployment', desc: 'Smooth deployment with monitoring and rollback strategies.', titleAr: 'الإطلاق', descAr: 'نشر سلس مع مراقبة واستراتيجيات التراجع.' },
    { icon: 'life-buoy', title: 'Ongoing Support', desc: '24/7 monitoring, maintenance, and continuous improvement.', titleAr: 'دعم مستمر', descAr: 'مراقبة 24/7، صيانة، وتحسين مستمر.' },
  ],
  processHeader: {
    eyebrow: 'Our Approach',
    title: 'The Noviq Process',
    desc: 'Our proven 6-step methodology delivers results you can measure.',
    eyebrowAr: 'منهجيتنا',
    titleAr: 'عملية نوفيك',
    descAr: 'منهجيتنا المثبتة بـ 6 خطوات تسلّم نتائج يمكن قياسها.',
  },
  clients: [
    { name: 'Meridian Health', icon: 'hospital' },
    { name: 'Arkline Logistics', icon: 'truck' },
    { name: 'Solace Finance', icon: 'wallet' },
    { name: 'Nexus Retail', icon: 'shopping-bag' },
    { name: 'Vertex Education', icon: 'graduation-cap' },
    { name: 'PrimeTech', icon: 'factory' },
  ],
  clientsHeader: {
    eyebrow: 'Our Clients',
    title: 'Trusted By',
    desc: 'Organizations that rely on us for mission-critical systems.',
    eyebrowAr: 'عملاؤنا',
    titleAr: 'موثوق من قبل',
    descAr: 'منظمات تعتمد علينا لأنظمتها الحرجة.',
  },
  projects: [
    {
      title: 'AI-Powered Healthcare Platform',
      desc: 'A comprehensive patient intelligence platform with HIPAA-compliant data handling and real-time analytics.',
      tag: 'Healthcare',
      img: '/images/project-healthcare.png',
      results: '40% reduction in patient wait times, 99.9% uptime',
      challenge: 'Our client needed a platform that could scale with rapid growth while maintaining performance and reliability across multiple regions.',
      solution: 'We designed and built a modern, cloud-native platform leveraging AI and real-time data processing.',
      titleAr: 'منصة صحية مدعومة بالذكاء الاصطناعي',
      descAr: 'منصة شاملة لذكاء المرضى مع معالجة بيانات متوافقة مع HIPAA والتحليلات اللحظية.',
      tagAr: 'الرعاية الصحية',
      resultsAr: 'تقليل انتظار المرضى بنسبة 40%، وقت تشغيل 99.9%',
      challengeAr: 'احتاج عميلنا لحل قادر على التوسع مع النمو السريع مع الحفاظ على الأداء والموثوقية عبر مناطق متعددة.',
      solutionAr: 'صممنا وبنينا منصة سحابية حديثة تستفيد من الذكاء الاصطناعي ومعالجة البيانات اللحظية.',
    },
    {
      title: 'Enterprise SaaS Platform',
      desc: 'A multi-tenant SaaS solution for large enterprises with custom AI-driven analytics and automated compliance reporting.',
      tag: 'Enterprise',
      img: '/images/project-fintech.png',
      results: '99.99% uptime, 50K+ active users, 2s avg response',
      challenge: '',
      solution: '',
      titleAr: 'منصة SaaS للمؤسسات',
      descAr: 'حل SaaS متعدد المستأجرين للمؤسسات الكبيرة مع تحليلات ذكية مخصصة وتقارير امتثال آلية.',
      tagAr: 'المؤسسات',
      resultsAr: 'وقت تشغيل 99.99%، 50K+ مستخدم نشط، 2ث متوسط رد',
    },
    {
      title: 'Smart Manufacturing System',
      desc: 'An IoT-enabled factory platform with predictive maintenance and real-time supply chain optimization.',
      tag: 'Manufacturing',
      img: '/images/project-retail.png',
      results: '35% efficiency gain, 99.5% defect detection rate',
      challenge: '',
      solution: '',
      titleAr: 'نظام تصنيع ذكي',
      descAr: 'منصة مصنع مُمكّن بالإنترنت الأشياء مع صيانة تنبؤية وتحسين سلسلة إمداد لحظي.',
      tagAr: 'التصنيع',
      resultsAr: 'تحسن الكفاءة 35%، معدل كشف عيوب 99.5%',
    },
  ],
  portfolioHeader: {
    eyebrow: 'Featured Work',
    title: 'Case Studies From the Field',
    desc: "Real projects, real results — see how we've helped businesses transform.",
    eyebrowAr: 'أعمال مختارة',
    titleAr: 'دراسات حالة من أرض الواقع',
    descAr: 'مشاريع حقيقية ونتائج ملموسة — اكتشف كيف ساعدنا أعمالاً على التحول.',
  },
  testimonials: [
    {
      quote: 'Noviq rebuilt our core platform in four months and it hasn\'t gone down once since launch.',
      name: 'Elena Ruiz',
      role: 'CTO, Meridian Health',
      img: '/images/testimonials/elena-ruiz.svg',
      quoteAr: 'نجحت نوفيك في إعادة تطوير منصتنا الرئيسية في وقت قياسي، والنتيجة أداء استثنائي واستقرار تام منذ اليوم الأول.',
      nameAr: 'إيلينا رويز',
      roleAr: 'المديرة التقنية، Meridian Health',
    },
    {
      quote: 'The AI system they built now handles forecasting that used to take our team a full week.',
      name: 'James Whitfield',
      role: 'COO, Arkline Logistics',
      img: '/images/testimonials/james-whitfield.svg',
      quoteAr: 'أنظمة الذكاء الاصطناعي التي طوروها اختصرت التحليلات التنبؤية من أسابيع إلى ثوانٍ معدودة بكفاءة مذهلة.',
      nameAr: 'جيمس ويتفيلد',
      roleAr: 'مدير العمليات، Arkline Logistics',
    },
    {
      quote: 'Best engineering partner we\'ve worked with — precise, fast, and genuinely invested in outcomes.',
      name: 'Priya Nandakumar',
      role: 'VP Product, Solace Finance',
      img: '/images/testimonials/priya-nandakumar.svg',
      quoteAr: 'نوفيك شريك تقني استثنائي: احترافية عالية، سرعة إنجاز، واهتمام حقيقي بتحقيق نتائج ملموسة.',
      nameAr: 'بريا نانداكومار',
      roleAr: 'نائبة رئيس المنتج، Solace Finance',
    },
    {
      quote: 'They took over a codebase two other vendors had abandoned and had it in production inside a quarter.',
      name: 'Daniel Okafor',
      role: 'VP Engineering, Vertex Retail',
      img: '/images/testimonials/daniel-okafor.svg',
      quoteAr: 'استلموا كوداً تخلّى عنه مقاولان سابقان وأصبح جاهزاً للإنتاج خلال أقل من ثلاثة أشهر.',
      nameAr: 'دانيال أوكافور',
      roleAr: 'نائب رئيس الهندسة، Vertex Retail',
    },
    {
      quote: 'The first discovery call was sharper than any briefing we had written ourselves.',
      name: 'Sara Lindqvist',
      role: 'Chief Product Officer, Nimbus Cloud',
      img: '/images/testimonials/sara-lindqvist.svg',
      quoteAr: 'جلست الاستكشاف الأولى كانت أدق من أي موجز قمنا نحن بكتابته.',
      nameAr: 'سارة ليندكفيست',
      roleAr: 'رئيسة المنتجات، Nimbus Cloud',
    },
    {
      quote: 'Sixteen campuses, one platform, zero outages. Their team still trains ours.',
      name: 'Omar Haddad',
      role: 'Managing Director, Orbit Education',
      img: '/images/testimonials/omar-haddad.svg',
      quoteAr: 'ستة عشر حرماً جامعياً، منصة واحدة، دون أي انقطاع. وفريقهم ما زال يدرب فريقنا.',
      nameAr: 'عمر حداد',
      roleAr: 'المدير التنفيذي، Orbit Education',
    },
    {
      quote: 'They argued us out of a feature we asked for, and they were right.',
      name: 'Aisha Rahman',
      role: 'Director of Digital, Pulse Media',
      img: '/images/testimonials/aisha-rahman.svg',
      quoteAr: 'ناقشونا وأقنعونا بعدم تنفيذ ميزة طلبناها، وكانوا على حق.',
      nameAr: 'عائشة رحمن',
      roleAr: 'مديرة التحول الرقمي، Pulse Media',
    },
    {
      quote: 'Migration weekend, zero factory downtime. I have never seen that happen.',
      name: 'Lucas Moreau',
      role: 'Head of Platform, Helix Manufacturing',
      img: '/images/testimonials/lucas-moreau.svg',
      quoteAr: 'عطلة ترحيل كاملة دون أي توقّف في المصنع. لم أشهد مثل هذا من قبل.',
      nameAr: 'لوكاس مورو',
      roleAr: 'رئيس المنصة، Helix Manufacturing',
    },
    {
      quote: 'They rebuilt our ledger and passed every audit on the first submission.',
      name: 'Mei Tanaka',
      role: 'CTO, Solace Finance',
      img: '/images/testimonials/mei-tanaka.svg',
      quoteAr: 'أعادوا بناء دفتر حساباتنا واجتازوا كل التدقيقات من أول تقديم.',
      nameAr: 'mei تاناكا',
      roleAr: 'المديرة التقنية، Solace Finance',
    },
  ],
  testimonialsHeader: {
    eyebrow: 'Client Voices',
    title: 'What Our Partners Say',
    desc: 'Six teams on what actually changed after shipping with Noviq.',
    eyebrowAr: 'آراء العملاء',
    titleAr: 'أصوات عملائنا',
    descAr: 'ستة فرق تحكي ماذا تغيّر فعلياً بعد العمل مع نوفيك.',
  },
  stack: [
    'React', 'Next.js', 'Node.js', 'TypeScript',
    'Python', 'TensorFlow', 'PyTorch', 'OpenAI',
    'PostgreSQL', 'MongoDB', 'Redis', 'Docker',
    'Kubernetes', 'AWS', 'Azure', 'Google Cloud',
  ],
  stackHeader: {
    eyebrow: 'Our Toolkit',
    title: 'Technology We Trust',
    desc: 'The proven stack behind every project we ship — picked for performance, security and scale.',
    eyebrowAr: 'أدواتنا',
    titleAr: 'التقنيات التي نثق بها',
    descAr: 'التقنيات المجرّبة التي نقود بها كل مشروع — مختارة للأداء والأمان وقابلية التوسع.',
  },
  stats: [
    { to: 480, suffix: '+', label: 'Projects Delivered', labelAr: 'مشروع منجز' },
    { to: 140, suffix: '+', label: 'Global Clients', labelAr: 'عميل عالمي' },
    { to: 32, suffix: '', label: 'Countries Served', labelAr: 'دولة مخدومة' },
    { to: 99, suffix: '%', label: 'Client Satisfaction', labelAr: 'رضا العملاء' },
  ],
  contact: {
    eyebrow: 'Get In Touch',
    title: 'Send Us a Message',
    desc: "Tell us about your project and we'll get back to you within one business day.",
    ctaLabel: 'Send Message',
    eyebrowAr: 'تواصل معنا',
    titleAr: 'أرسل لنا رسالة',
    descAr: 'أخبرنا عن مشروعك وسنعاود التواصل خلال يوم عمل واحد.',
    ctaLabelAr: 'إرسال الرسالة',
    /* The phone INPUT is optional — the address block above it is the brand
       number. Both the label and the placeholder are CMS-owned so an admin
       can reword them; `phonePlaceholderAr` carries a LRM so the + sign does
       not jump to the wrong end of the line on the Arabic page. */
    phone: 'Phone',
    phoneAr: 'الهاتف',
    phonePlaceholder: '+1 415 555 0182',
    phonePlaceholderAr: '‎+1 415 555 0182',
    optional: '(optional)',
    optionalAr: '(اختياري)',
    name: 'Full Name',
    namePlaceholder: 'Your name',
    email: 'Work Email',
    emailPlaceholder: 'Work email',
    company: 'Company',
    companyPlaceholder: 'Your company',
    message: 'Tell us about your project',
    messagePlaceholder: 'Tell us about your project',
    sending: 'Sending...',
    sent: 'Message Sent!',
    error: 'Failed to send. Please try again.',
  },
  footer: {
    tagline: 'Global Software & AI Engineering Company',
    copyright: '© 2024 Noviq Solutions. All rights reserved.',
    taglineAr: 'شركة برمجيات وذكاء اصطناعي عالمية',
    copyrightAr: '© 2024 نوفيك سوليوشنز. جميع الحقوق محفوظة.',
    columns: [
      {
        title: 'Services',
        links: [
          { text: 'AI Solutions', route: '/services' },
          { text: 'Custom Software', route: '/services' },
          { text: 'ERP Systems', route: '/services' },
          { text: 'CRM Platforms', route: '/services' },
        ],
        titleAr: 'الخدمات',
      },
      {
        title: 'Industries',
        links: [
          { text: 'Healthcare', route: '/industries' },
          { text: 'Finance', route: '/industries' },
          { text: 'Manufacturing', route: '/industries' },
          { text: 'Education', route: '/industries' },
        ],
        titleAr: 'القطاعات',
      },
      {
        title: 'Company',
        links: [
          { text: 'About', route: '/about' },
          { text: 'Careers', route: '/careers' },
          { text: 'Contact', route: '/contact' },
        ],
        titleAr: 'الشركة',
      },
      {
        title: 'Resources',
        links: [
          { text: 'Blog', route: '/resources' },
          { text: 'FAQ', route: '/faq' },
          { text: 'Privacy', route: '/faq' },
          { text: 'Terms', route: '/faq' },
        ],
        titleAr: 'المصادر',
      },
    ],
    social: ['LinkedIn', 'X', 'GitHub'],
    newsletterTitle: 'Newsletter',
    newsletterPlaceholder: 'you@company.com',
    newsletterBtn: 'Subscribe',
    newsletterTitleAr: 'النشرة البريدية',
    newsletterPlaceholderAr: 'أدخل بريدك الإلكتروني',
    newsletterBtnAr: 'إرسال',
  },
  brand: {
    email: 'hello@noviqsolutions.com',
    phone: '+1-415-555-0182',
    locations: 'San Francisco • London • Singapore',
    emailAr: 'hello@noviqsolutions.com',
    phoneAr: '+1-415-555-0182',
    locationsAr: 'سان فرانسيسكو • لندن • سنغافورة',
  },
  team: [
    { name: 'Ahmed Hassan', role: 'CEO & Founder', img: '', roleAr: 'الرئيس التنفيذي' },
    { name: 'Sarah Chen', role: 'VP Engineering', img: '', roleAr: 'نائبة الرئيس للهندسة' },
    { name: 'Omar Khalil', role: 'Product Director', img: '', roleAr: 'مدير المنتجات' },
    { name: 'Layla Abbas', role: 'Head of Design', img: '', roleAr: 'رئيسة التصميم' },
  ],
  heroCapability: {
    eyebrow: 'What We Build',
    title: 'Intelligent Engineering',
    statusLabel: 'Live',
    footLabel: 'Built for scale. Ready for tomorrow.',
    cards: [
      { icon: 'brain', title: 'AI Engineering' },
      { icon: 'code-2', title: 'Software Architecture' },
      { icon: 'cloud', title: 'Cloud Infrastructure' },
      { icon: 'zap', title: 'Real-Time Processing' },
      { icon: 'shield-check', title: 'Security First' },
      { icon: 'globe', title: 'Global Scale' },
    ],
    eyebrowAr: 'ما نبنيه',
    titleAr: 'هندسة ذكية',
    statusLabelAr: 'مباشر',
    footLabelAr: 'مصممة للتوسع. جاهزة للغد.',
    cardsAr: [
      { icon: 'brain', title: 'هندسة الذكاء الاصطناعي' },
      { icon: 'code-2', title: 'الهندسة المعمارية' },
      { icon: 'cloud', title: 'البنية السحابية' },
      { icon: 'zap', title: 'معالجة لحظية' },
      { icon: 'shield-check', title: 'الأمان أولاً' },
      { icon: 'globe', title: 'نطاق عالمي' },
    ],
  },
  solutionBuilder: {
    steps: [
      { id: 'business', title: 'Business Type', desc: 'What type of business are you in?' },
      { id: 'team', title: 'Team Size', desc: 'How many employees does your company have?' },
      { id: 'challenge', title: 'Challenge', desc: 'What is your biggest operational challenge?' },
      { id: 'goals', title: 'Goals', desc: 'What are your primary goals?' },
      { id: 'timeline', title: 'Timeline', desc: 'What is your ideal timeline?' },
      { id: 'budget', title: 'Budget', desc: 'What is your budget range?' },
    ],
  },
  promptBuilder: {
    types: ['Content Writing', 'Code Generation', 'Data Analysis', 'Creative Writing', 'Translation', 'Summarization'],
    tones: ['Professional', 'Casual', 'Technical', 'Creative', 'Persuasive', 'Educational'],
    formats: ['Structured (headings, bullets)', 'JSON', 'Markdown', 'Plain Text', 'Table', 'Step-by-step'],
    models: ['GPT-4 / Claude / General', 'GPT-3.5', 'Llama / Open Source', 'Code-specific (CodeLlama, etc.)'],
  },
  pricing: [
    {
      key: 'starter',
      name: 'Starter',
      nameAr: 'المبتدئ',
      desc: 'Perfect for small teams starting their digital journey.',
      descAr: 'مثالي للفرق الصغيرة التي تبدأ رحلتها الرقمية.',
      price: '$99',
      features: ['Up to 10 Users', 'Core Features', 'Email Support', 'Basic Analytics', '1 Integration'],
      featuresAr: ['حتى 10 مستخدمين', 'الميزات الأساسية', 'دعم بريدي', 'تحليلات أساسية', 'تكامل واحد'],
      featured: false,
    },
    {
      key: 'growth',
      name: 'Growth',
      nameAr: 'النمو',
      desc: 'For growing businesses needing advanced capabilities.',
      descAr: 'للأعمال النامية التي تحتاج قدرات متقدمة.',
      price: '$499',
      features: ['Up to 50 Users', 'All Features', 'Priority Support', 'Advanced Analytics', '5 Integrations', 'AI Assistant'],
      featuresAr: ['حتى 50 مستخدماً', 'كل الميزات', 'دعم ذو أولوية', 'تحليلات متقدمة', '5 تكاملات', 'مساعد ذكاء اصطناعي'],
      featured: true,
    },
    {
      key: 'enterprise',
      name: 'Enterprise',
      nameAr: 'المؤسسة',
      desc: 'Full-scale solutions for large organizations.',
      descAr: 'حلول شاملة للمنظمات الكبيرة.',
      price: 'Contact Us',
      features: ['Unlimited Users', 'Everything in Growth', 'Dedicated Support', 'Custom AI Models', 'Unlimited Integrations', 'SLA Guarantee', 'On-premise Option'],
      featuresAr: ['مستخدمون بلا حد', 'كل ما في النمو', 'دعم مخصص', 'نماذج ذكاء اصطناعي مخصصة', 'تكاملات بلا حد', 'ضمان SLA', 'خيار محلي'],
      featured: false,
    },
  ],
};

/**
 * Returns content with Arabic fields resolved when language is Arabic.
 *
 * Every `fooAr` is copied onto `foo` so a page can just read
 * `content.x.title` and get the right language. The `fooAr` keys are
 * KEPT as well (not deleted) — some pages still read them explicitly
 * (`isArabic ? h.titleAr : h.title`), and dropping them made the
 * Arabic <h1> render empty on /toolkit and /why.
 */
export function getContentForLocale(content: NoviqContent, locale: 'en' | 'ar'): NoviqContent {
  if (locale === 'en') return content;

  const convert = (obj: unknown): unknown => {
    if (Array.isArray(obj)) {
      return obj.map(convert);
    }
    if (obj && typeof obj === 'object') {
      const entries = Object.entries(obj as Record<string, unknown>);
      const result: Record<string, unknown> = {};
      /* 1. pass through everything except the *Ar aliases */
      for (const [key, value] of entries) {
        if (key.endsWith('Ar')) continue;
        result[key] = convert(value);
      }
      /* 2. copy each *Ar onto its base name, keeping the *Ar key intact */
      for (const [key, value] of entries) {
        if (!key.endsWith('Ar') || value === undefined) continue;
        const baseKey = key.slice(0, -2);
        const converted = convert(value);
        result[key] = converted;
        /* only override the base when the Arabic copy actually has text */
        const hasText =
          typeof converted === 'string'
            ? converted.trim() !== ''
            : converted !== null && converted !== undefined;
        if (hasText) result[baseKey] = converted;
      }
      return result;
    }
    return obj;
  };

  return convert(content) as NoviqContent;
}

export default NOVIQ_CONTENT;
