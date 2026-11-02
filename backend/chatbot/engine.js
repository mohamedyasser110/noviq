/* ============================================================
   NOVIQ CHATBOT ENGINE — layered pipeline
   ------------------------------------------------------------
   Layers (first confident layer wins):
     0. Lead capture        — email/phone → contacts DB + notify
     1. Search command      — "search: X" / "ابحث عن X"
     2. Follow-up context   — short replies resolved via session
     3. Intent matching     — exact + fuzzy keywords (42 intents)
     4. BM25 retrieval      — FAQ corpus + live site content
     5. Smart fallback      — "did you mean" from top search hits

   Response: { reply, intent, language, suggestions, related,
               source: intent|faq|search|context|lead|fallback }
   ============================================================ */

const db = require('../db/init');
const { getContent } = require('../content-store');
const { notifyNewLead } = require('../mailer');
const { INTENTS, SUGGESTS, FAQS } = require('./knowledge');
const { detectLanguage, tokenize, fuzzyTokenScore } = require('./normalize');
const { search } = require('./search');
const { getArabicContent } = require('./ar-content');
const { webSearch } = require('./websearch');

const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.]{2,}/;
const PHONE_RE = /(?:\+?\d[\d\s()-]{7,}\d)/;

/* ---- Custom reply overrides (read from DB, cached per-process for 30s) ----
   Admins edit these in the dashboard; they take priority over the hardcoded
   defaults below so the chatbot answers stay accurate without code changes. */
let _overrideCache = null;
let _overrideCacheTs = 0;
const OVERRIDE_TTL = 30 * 1000;

function getOverrides() {
  if (!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='chatbot_replies'").get()) return {};
  if (_overrideCache && Date.now() - _overrideCacheTs < OVERRIDE_TTL) return _overrideCache;
  const rows = db.prepare('SELECT key, reply_en, reply_ar FROM chatbot_replies').all();
  const map = {};
  for (const r of rows) {
    if (r.reply_en || r.reply_ar) map[r.key] = { en: r.reply_en, ar: r.reply_ar };
  }
  _overrideCache = map;
  _overrideCacheTs = Date.now();
  return map;
}

/* Public so the admin "save reply" route can bust the cache instantly. */
function invalidateOverrideCache() { _overrideCache = null; _overrideCacheTs = 0; }

/* Returns custom reply text if an admin override exists for this key, else null. */
function getCustomReply(key, lang) {
  const o = getOverrides()[key];
  if (!o) return null;
  const txt = (lang === 'ar' ? o.ar : o.en) || o.en || o.ar;
  return txt || null;
}

/* Returns default reply text for a given intent or FAQ key */
function getDefaultReply(key, lang) {
  // Check if it's an intent
  if (INTENTS[key] && ANSWERS[key]) {
    const enContent = getContent();
    const content = lang === 'ar' ? getArabicContent(enContent) : enContent;
    return ANSWERS[key](content, lang);
  }
  
  // Check if it's a FAQ
  const allFaqs = require('./knowledge').FAQS;
  const faq = allFaqs.find(f => f.id === key);
  if (faq) {
    return faq.a[lang] || null;
  }
  
  return null;
}

/* ================= Intent matching ================= */

const KEYWORD_INDEX = [];
for (const [intent, langs] of Object.entries(INTENTS)) {
  for (const list of [langs.en, langs.ar]) {
    for (const kw of list) {
      const tokens = tokenize(kw);
      if (tokens.length) {
        KEYWORD_INDEX.push({ intent, tokens, weight: Math.max(1, tokens.length * 2) });
      }
    }
  }
}

function matchIntent(message) {
  const msgTokens = tokenize(message);
  if (!msgTokens.length) return { intent: null, score: 0 };
  const padded = ' ' + msgTokens.join(' ') + ' ';

  const scores = {};
  for (const { intent, tokens, weight } of KEYWORD_INDEX) {
    if (padded.includes(' ' + tokens.join(' ') + ' ')) {
      scores[intent] = (scores[intent] || 0) + weight;
      continue;
    }
    const win = tokens.length;
    if (msgTokens.length < win) continue;
    let best = 0;
    for (let i = 0; i + win <= msgTokens.length; i++) {
      let sum = 0;
      let ok = true;
      for (let j = 0; j < win; j++) {
        const s = fuzzyTokenScore(msgTokens[i + j], tokens[j]);
        if (s === 0) { ok = false; break; }
        sum += s;
      }
      if (ok) best = Math.max(best, sum / win);
    }
    if (best > 0 && best < 1) {
      scores[intent] = (scores[intent] || 0) + weight * best;
    }
  }

  let bestIntent = { intent: null, score: 0 };
  for (const [intent, score] of Object.entries(scores)) {
    if (score > bestIntent.score) bestIntent = { intent, score };
  }
  return bestIntent;
}

/* ================= Answer builders (live DB content) ================= */

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function listServices(content, lang, max = 6) {
  const services = Array.isArray(content.services) ? content.services.slice(0, max) : [];
  return services.map(s => `• ${s.title} — ${s.desc}`).join('\n');
}

function listProjects(content, lang, max = 4) {
  const projects = Array.isArray(content.projects) ? content.projects.slice(0, max) : [];
  return projects.map(p => `• [${p.tag}] ${p.title}: ${p.desc}`).join('\n');
}

function listStats(content, lang) {
  const stats = Array.isArray(content.stats) ? content.stats : [];
  return stats.map(s => `• ${s.to}${s.suffix || ''} ${s.label}`).join('\n');
}

function listIndustries(content, lang) {
  const inds = Array.isArray(content.industries) ? content.industries : [];
  return inds.map(i => i.title).join(lang === 'ar' ? '، ' : ', ');
}

function listTestimonials(content, lang, max = 2) {
  const items = Array.isArray(content.testimonials) ? content.testimonials.slice(0, max) : [];
  return items.map(tm => `"${tm.quote}" — ${tm.name}, ${tm.role}`).join('\n');
}

function contactBlock(content, lang) {
  const brand = content.brand || {};
  return lang === 'ar'
    ? `البريد: ${brand.email || 'hello@noviqsolutions.com'}\nالهاتف: ${brand.phone || '+1 (415) 555-0182'}\nالمكاتب: ${brand.locations || 'San Francisco · London · Singapore'}`
    : `Email: ${brand.email || 'hello@noviqsolutions.com'}\nPhone: ${brand.phone || '+1 (415) 555-0182'}\nOffices: ${brand.locations || 'San Francisco · London · Singapore'}`;
}

const ANSWERS = {
  greeting: (c, lang) => lang === 'ar'
    ? pick(['مرحباً بك في نوفيك! 👋 كيف أقدر أساعدك اليوم؟ اسألني عن خدماتنا أو الأسعار أو مشاريعنا.', 'أهلاً وسهلاً! أنا مساعد نوفيك الذكي. تفضل بسؤالك عن أي خدمة أو مشروع.'])
    : pick(['Welcome to Noviq! 👋 How can I help you today? Ask me about our services, pricing, or projects.', "Hello! I'm the Noviq assistant. Ask me anything about our services or how we can help your business."]),
  goodbye: (c, lang) => lang === 'ar'
    ? 'شكراً لتواصلك مع نوفيك! نتمنى لك يوماً رائعاً. 👋'
    : 'Thanks for chatting with Noviq! Have a great day. 👋',
  thanks: (c, lang) => lang === 'ar'
    ? 'العفو! سعيد بمساعدتك. هل هناك شيء آخر تود معرفته؟'
    : "You're welcome! Happy to help. Is there anything else you'd like to know?",
  help: (c, lang) => lang === 'ar'
    ? 'يمكنني مساعدتك في:\n• التعرف على خدماتنا (ذكاء اصطناعي، ERP، CRM، مواقع، تطبيقات...)\n• الأسعار والباقات\n• مشاريعنا السابقة وقصص النجاح\n• حجز استشارة مجانية\n• البحث في معرفتنا: اكتب "ابحث عن ..." متبوعة بأي موضوع\n\nاكتب سؤالك بحرية!'
    : 'I can help you with:\n• Our services (AI, ERP, CRM, web, mobile...)\n• Pricing and packages\n• Past projects and case studies\n• Booking a free consultation\n• Searching our knowledge: type "search: ..." followed by any topic\n\nJust type your question!',
  bot_identity: (c, lang) => lang === 'ar'
    ? `أنا مساعد نوفيك الذكي — شات بوت مبني بواسطة فريق ${(c.brand && c.brand.fullName) || 'Noviq Solutions'} ومتصل مباشرة بقاعدة بيانات الشركة. إذا رغبت بالتحدث مع شخص حقيقي أرسل بريدك وسيتواصل معك فريقنا خلال يوم عمل.`
    : `I'm the Noviq smart assistant — a chatbot built by ${(c.brand && c.brand.fullName) || 'Noviq Solutions'} connected live to our company database. If you'd like a human, share your email and our team will reach out within one business day.`,
  services_overview: (c, lang) => (lang === 'ar'
    ? `نقدم مجموعة متكاملة من الخدمات:\n${listServices(c, lang, 8)}\n\nهل تريد تفاصيل عن خدمة معينة؟`
    : `We offer a full spectrum of services:\n${listServices(c, lang, 8)}\n\nWant details about a specific service?`),
  service_ai: (c, lang) => lang === 'ar'
    ? 'نبني حلول ذكاء اصطناعي مخصصة: نماذج تنبؤية، شات بوتات، معالجة لغة، رؤية حاسوبية، وأتمتة ذكية باستخدام Python وTensorFlow وPyTorch وOpenAI. أخبرني عن حالتك وسأقترح الحل المناسب، أو احجز استشارة مجانية من صفحة التواصل.'
    : 'We build custom AI solutions: predictive models, chatbots, NLP, computer vision, and intelligent automation using Python, TensorFlow, PyTorch, and OpenAI. Tell me about your use case, or book a free consultation from the contact page.',
  service_erp: (c, lang) => lang === 'ar'
    ? 'أنظمة ERP لدينا توحد العمليات: المالية، المخزون، المشتريات، والموارد البشرية في منصة واحدة مصممة حسب سير عملك. تبدأ المشاريع عادة بجلسة تحليل مجانية لاحتياجاتك.'
    : 'Our ERP systems unify operations: finance, inventory, procurement, and HR in one platform designed around your workflows. Projects usually start with a free requirements-analysis session.',
  service_crm: (c, lang) => lang === 'ar'
    ? 'منصات CRM لدينا تمنح فرق المبيعات والدعم مصدراً واحداً للحقيقة: إدارة العملاء المحتملين، خطوط المبيعات، التذاكر، والتقارير — مع تكامل كامل مع أنظمتك الحالية.'
    : 'Our CRM platforms give sales and support teams a single source of truth: lead management, pipelines, ticketing, and reporting — fully integrated with your existing systems.',
  service_cloud: (c, lang) => lang === 'ar'
    ? 'نقدم حلولاً سحابية مرنة وقابلة للتوسع التلقائي على AWS وAzure وGoogle Cloud، مع DevOps وKubernetes ونسخ احتياطي وخطط تعافٍ من الكوارث.'
    : 'We deliver resilient, auto-scaling cloud infrastructure across AWS, Azure, and Google Cloud, with DevOps, Kubernetes, backups, and disaster-recovery plans.',
  service_saas: (c, lang) => lang === 'ar'
    ? 'نبني منتجات SaaS متعددة المستأجرين مصممة للتوسع من أول عميل حتى المليون: اشتراكات، فوترة، لوحات تحكم، وتحليلات — كل ذلك جاهز للإطلاق.'
    : 'We build multi-tenant SaaS products designed to scale from your first customer to your millionth: subscriptions, billing, dashboards, and analytics — launch-ready.',
  service_web: (c, lang) => lang === 'ar'
    ? 'نطور مواقع وتطبيقات ويب سريعة ومتجاوبة وبتصميم مميز باستخدام React وNext.js وNode.js — من صفحات الهبوط إلى البوابات المؤسسية الكاملة ولوحات التحكم.'
    : 'We build fast, accessible, pixel-perfect websites and web apps with React, Next.js, and Node.js — from landing pages to full enterprise portals and dashboards.',
  service_mobile: (c, lang) => lang === 'ar'
    ? 'نطور تطبيقات iOS وAndroid بتجربة أصلية من كود واحد قابل للصيانة، مع النشر الكامل على App Store وGoogle Play.'
    : 'We build native-feel iOS and Android apps from a single, maintainable codebase, with full publishing to the App Store and Google Play.',
  service_api: (c, lang) => lang === 'ar'
    ? 'نطور واجهات برمجية REST وGraphQL موثقة وآمنة، وننفذ تكاملات مع بوابات الدفع وواتساب والرسائل وأي نظام خارجي تحتاجه.'
    : 'We build documented, versioned, secure REST and GraphQL APIs, and implement integrations with payment gateways, WhatsApp, SMS, and any third-party system you need.',
  service_automation: (c, lang) => lang === 'ar'
    ? 'أتمتة العمليات لدينا تزيل العمل اليدوي من الجذور: سير عمل تلقائي، تقارير مجدولة، وتكاملات ذكية. عملاؤنا يوفرون في المتوسط 40% من وقت العمليات.'
    : 'Our process automation removes manual work at the root: automated workflows, scheduled reports, and smart integrations. Our clients save 40% of operations time on average.',
  service_custom: (c, lang) => lang === 'ar'
    ? 'نبني برمجيات مخصصة مصممة حول سير عملك — وليس العكس. من استبدال ملفات الإكسل إلى تحديث الأنظمة القديمة بالكامل، مع خطة تحول رقمي واضحة.'
    : 'We build bespoke software engineered around your workflows — not the other way around. From replacing spreadsheets to full legacy modernization, with a clear digital-transformation roadmap.',
  pricing: (c, lang) => lang === 'ar'
    ? 'أسعارنا تعتمد على نطاق المشروع:\n• الباقة الأساسية: مناسبة للفرق الصغيرة والمنتجات الأولية\n• باقة النمو: للأعمال المتوسطة بقدرات متقدمة\n• باقة المؤسسات: حلول شاملة بمتطلبات مخصصة\n\nللحصول على تقدير دقيق جرب "مقدر التكلفة" في الموقع، أو أرسل بريدك الإلكتروني هنا وسنرسل لك عرض سعر مفصل.'
    : 'Our pricing depends on project scope:\n• Starter: ideal for small teams and MVPs\n• Growth: for scaling businesses needing advanced capabilities\n• Enterprise: full-scale solutions with custom requirements\n\nFor an accurate estimate try the Cost Estimator on our site, or share your email here and we\'ll send a detailed quote.',
  payment: (c, lang) => lang === 'ar'
    ? 'ندعم الدفع على مراحل مرتبطة بتسليمات المشروع (عادة 30% مقدماً)، عبر التحويل البنكي أو البطاقات. تفاصيل الشروط تحدد في العقد مع ضمان جودة التسليم.'
    : 'We support milestone-based payments tied to deliverables (typically 30% upfront), via bank transfer or cards. Full terms are defined in the contract with delivery quality guarantees.',
  timeline: (c, lang) => lang === 'ar'
    ? 'المدة النموذجية:\n• صفحة هبوط أو موقع تعريفي: 2-4 أسابيع\n• تطبيق ويب/موبايل MVP: 6-12 أسبوعاً\n• نظام ERP/CRM متكامل: 3-6 أشهر\n\nنعمل بسبرنتات أسبوعية مع عروض تقدم منتظمة، ويمكن تسريع الجدول للمشاريع العاجلة.'
    : 'Typical timelines:\n• Landing page or company site: 2-4 weeks\n• Web/mobile MVP: 6-12 weeks\n• Full ERP/CRM system: 3-6 months\n\nWe work in weekly sprints with regular demos, and can accelerate for urgent projects.',
  process: (c, lang) => {
    const steps = Array.isArray(c.process) ? c.process : [];
    const list = steps.map((s, i) => `${i + 1}. ${s.title}: ${s.desc}`).join('\n');
    return lang === 'ar'
      ? `منهجيتنا مبنية لليقين:\n${list}`
      : `Our process is built for certainty:\n${list}`;
  },
  portfolio: (c, lang) => (lang === 'ar'
    ? `من مشاريعنا المميزة:\n${listProjects(c, lang)}\n\nيمكنك استعراض دراسات الحالة كاملة في صفحة أعمالنا.`
    : `Some of our featured projects:\n${listProjects(c, lang)}\n\nYou can browse full case studies on our portfolio page.`),
  industries: (c, lang) => (lang === 'ar'
    ? `نخدم قطاعات متعددة: ${listIndustries(c, lang)}.\n\nأخبرني عن قطاعك وسأشارك خبرتنا فيه.`
    : `We serve multiple industries: ${listIndustries(c, lang)}.\n\nTell me your industry and I'll share our experience in it.`),
  industry_healthcare: (c, lang) => lang === 'ar'
    ? 'في الرعاية الصحية بنينا منصات متوافقة مع HIPAA تربط أكثر من 200 عيادة بسجل رعاية موحد، مع أنظمة مواعيد وطب عن بعد وتكامل مختبرات.'
    : 'In healthcare we\'ve built HIPAA-compliant platforms connecting 200+ clinics on one care record, with scheduling, telehealth, and lab integrations.',
  industry_finance: (c, lang) => lang === 'ar'
    ? 'في القطاع المالي بنينا بنية تسوية لحظية تعالج أكثر من 4 ملايين معاملة يومياً لبنك رقمي، مع محركات مخاطر وامتثال تلقائي.'
    : 'In finance we\'ve built real-time reconciliation infrastructure processing 4M+ daily transactions for a digital bank, with risk engines and automated compliance.',
  industry_ecommerce: (c, lang) => lang === 'ar'
    ? 'في التجارة الإلكترونية بنينا محركات تجارة موحدة تربط المخزون وإدارة العملاء خلف تجربة متجر واحدة، مع تخصيص ذكي وتسعير ديناميكي.'
    : 'In e-commerce we\'ve built omnichannel engines unifying inventory and CRM behind a single storefront experience, with AI personalization and dynamic pricing.',
  industry_other: (c, lang) => (lang === 'ar'
    ? `لدينا خبرة عملية في: ${listIndustries(c, lang)}.\nأخبرني بتفاصيل مشروعك في قطاعك وسأقترح الحل الأنسب.`
    : `We have hands-on experience in: ${listIndustries(c, lang)}.\nTell me about your project in your sector and I'll suggest the right solution.`),
  about_company: (c, lang) => {
    const brand = c.brand || {};
    return lang === 'ar'
      ? `${brand.fullName || 'Noviq Solutions'} — شركة هندسة برمجيات وذكاء اصطناعي عالمية. ${(c.footer && c.footer.tagline) || ''}\nمكاتبنا: ${brand.locations || 'San Francisco · London · Singapore'}`
      : `${brand.fullName || 'Noviq Solutions'} — a global software and AI engineering company. ${(c.footer && c.footer.tagline) || ''}\nOffices: ${brand.locations || 'San Francisco · London · Singapore'}`;
  },
  stats: (c, lang) => (lang === 'ar'
    ? `أرقامنا تتحدث:\n${listStats(c, lang)}`
    : `Our numbers speak:\n${listStats(c, lang)}`),
  team: (c, lang) => lang === 'ar'
    ? 'فريقنا من المهندسين والمصممين والاستراتيجيين الخبراء فقط — لا تعلم على حساب ميزانيتك. نوفر أيضاً فرقاً مخصصة وتعزيز الكوادر للمؤسسات.'
    : 'Our team is senior engineers, designers, and strategists only — no learning on your budget. We also offer dedicated teams and staff augmentation for enterprises.',
  locations: (c, lang) => contactBlock(c, lang),
  contact: (c, lang) => (lang === 'ar'
    ? `يسعدنا تواصلك!\n${contactBlock(c, lang)}\n\nأو اترك بريدك الإلكتروني هنا وسنتواصل معك خلال يوم عمل واحد.`
    : `We'd love to hear from you!\n${contactBlock(c, lang)}\n\nOr leave your email here and we'll reach out within one business day.`),
  meeting: (c, lang) => lang === 'ar'
    ? 'ممتاز! لحجز استشارة مجانية: اترك بريدك الإلكتروني أو رقم هاتفك هنا في المحادثة وسيتواصل معك فريقنا خلال يوم عمل لتحديد موعد يناسبك.'
    : 'Great! To book a free consultation: leave your email or phone number here in the chat and our team will contact you within one business day to schedule a time.',
  support: (c, lang) => lang === 'ar'
    ? 'نقدم دعماً مستمراً بعد الإطلاق: مراقبة، إصلاح أخطاء، تحديثات، وترقيات — مع اتفاقيات مستوى خدمة تصل إلى دعم على مدار الساعة و99.9% وقت تشغيل.'
    : 'We provide ongoing post-launch support: monitoring, bug fixes, updates, and upgrades — with SLAs up to 24/7 support and 99.9% uptime.',
  careers: (c, lang) => lang === 'ar'
    ? 'نبحث دائماً عن مواهب! استعرض الوظائف المتاحة في صفحة الوظائف على موقعنا، أو أرسل سيرتك الذاتية إلى بريدنا وسنتواصل معك عند توفر شاغر مناسب.'
    : 'We\'re always looking for talent! Browse open positions on our careers page, or send your resume to our email and we\'ll reach out when a suitable role opens.',
  technology: (c, lang) => {
    const stack = Array.isArray(c.stack) ? c.stack.join(', ') : '';
    return lang === 'ar'
      ? `نعمل بأحدث التقنيات الموثوقة:\n${stack}\n\nنختار التقنية المناسبة لكل مشروع حسب احتياجاته.`
      : `We work with modern, trusted technology:\n${stack}\n\nWe pick the right stack for each project's needs.`;
  },
  security: (c, lang) => lang === 'ar'
    ? 'الأمان مدمج من اليوم الأول: تشفير البيانات، اختبارات اختراق، وامتثال للمعايير العالمية. نوقع اتفاقيات سرية (NDA) وتكون ملكية الكود المصدري كاملة لك عند التسليم.'
    : 'Security is baked in from day one: encryption, penetration testing, and global compliance standards. We sign NDAs, and you get full source-code ownership on delivery.',
  testimonials: (c, lang) => (lang === 'ar'
    ? `ماذا يقول عملاؤنا:\n${listTestimonials(c, lang)}`
    : `What our clients say:\n${listTestimonials(c, lang)}`),
  why_us: (c, lang) => {
    const why = Array.isArray(c.why) ? c.why.slice(0, 4).map(w => `• ${w.title}: ${w.desc}`).join('\n') : '';
    return lang === 'ar' ? `ما يميز نوفيك:\n${why}` : `What makes Noviq different:\n${why}`;
  },
  newsletter: (c, lang) => lang === 'ar'
    ? 'يمكنك الاشتراك في نشرتنا البريدية من أسفل أي صفحة في الموقع لتصلك أحدث المقالات والأدلة التقنية. كما تجد مقالات وأوراقاً بحثية في صفحة المصادر.'
    : 'You can subscribe to our newsletter from the footer of any page to get the latest articles and technical guides. You\'ll also find articles and whitepapers on our Resources page.',
  ai_lab: (c, lang) => lang === 'ar'
    ? 'مختبر الذكاء الاصطناعي يتيح لك تجربة أدواتنا مباشرة: مولد الصور، المترجم، التعرف على النصوص، الصوت الذكي، الملخص، ومولد الأوامر — كلها مجانية بدون تسجيل!'
    : 'The AI Lab lets you try our tools live: image generator, translator, OCR, voice AI, summarizer, and prompt generator — all free, no signup needed!',
  start_project: (c, lang) => lang === 'ar'
    ? 'رائع! لنبدأ مشروعك:\n1. أخبرني بفكرتك أو احتياجك هنا\n2. اترك بريدك الإلكتروني وسيتواصل معك فريقنا خلال يوم عمل\n3. أو استخدم "منشئ الحلول" في الموقع للحصول على عرض فوري\n\nما نوع المشروع الذي تفكر فيه؟'
    : 'Awesome! Let\'s start your project:\n1. Tell me your idea or need right here\n2. Leave your email and our team will contact you within one business day\n3. Or use the Solution Builder on our site for an instant proposal\n\nWhat kind of project are you thinking about?',
  language_switch: (c, lang) => lang === 'ar'
    ? 'أنا أتحدث العربية والإنجليزية بطلاقة! اكتب بأي لغة تفضلها وسأجيبك بنفس اللغة. 🌍'
    : 'I speak both English and Arabic fluently! Write in whichever language you prefer and I\'ll answer in the same one. 🌍',
  image_generation: (c, lang) => lang === 'ar'
    ? 'يمكنني توليد صور باستخدام الذكاء الاصطناعي! اذهب إلى "مختبر الذكاء الاصطناعي" في الموقع واستخدم أداة مولد الصور، أو اكتب "مولد صور: وصف الصورة" هنا وسأرسل لك رابط الصورة مباشرة.'
    : 'I can generate images with AI! Go to the AI Lab on our site and use the image generator tool, or type "generate image: your description" here and I\'ll send you the image link directly.',
};

/* ================= Session context (in-memory, 30 min TTL) ================= */

const SESSIONS = new Map();
const SESSION_TTL = 30 * 60 * 1000;

function getSession(id) {
  const s = SESSIONS.get(id);
  if (s && Date.now() - s.ts < SESSION_TTL) return s;
  return null;
}

function setSession(id, intent) {
  if (SESSIONS.size > 500) {
    const cutoff = Date.now() - SESSION_TTL;
    for (const [k, v] of SESSIONS) if (v.ts < cutoff) SESSIONS.delete(k);
  }
  SESSIONS.set(id, { lastIntent: intent, ts: Date.now() });
}

/* Short follow-ups: "how much?", "كم السعر؟", "how long?", "تفاصيل أكثر" */
const FOLLOWUP_PATTERNS = [
  { re: /^(how much|price|cost|كم|بكم|كم سعر|كم السعر|كم التكلفه|كم تكلفته|السعر|التكلفه|بكام)[?؟\s]*$/i, target: 'pricing' },
  { re: /^(how long|when|duration|كم المده|كم يستغرق|متى|المده|كم مده|قد ايش ياخذ)[?؟\s]*$/i, target: 'timeline' },
  { re: /^(more|details|more details|tell me more|explain|تفاصيل|المزيد|اشرح|وضح|زيدني|كمل|اكمل)[?؟\s]*$/i, target: 'SAME' },
];

function resolveFollowup(message, session) {
  if (!session || !session.lastIntent) return null;
  const trimmed = String(message).trim();
  if (tokenize(trimmed).length > 4) return null;
  for (const { re, target } of FOLLOWUP_PATTERNS) {
    if (re.test(trimmed)) {
      return target === 'SAME' ? session.lastIntent : target;
    }
  }
  return null;
}

/* ================= Search command + related helpers ================= */

const SEARCH_CMD = /^(?:search|find|lookup|ابحث عن|ابحث|بحث عن|بحث|دور على|دور عن)[:\s]+(.+)/i;

function formatSearchReply(results, lang) {
  if (!results.length) {
    return lang === 'ar'
      ? 'لم أجد نتائج مطابقة. جرب كلمات أخرى، أو اسألني مباشرة عن خدماتنا وأسعارنا.'
      : 'No matching results. Try different words, or ask me directly about our services and pricing.';
  }
  const lines = results.map((r, i) => `${i + 1}. ${r.title}\n   ${r.snippet}`);
  return (lang === 'ar' ? '🔎 أفضل النتائج:\n\n' : '🔎 Top results:\n\n') + lines.join('\n\n');
}

function relatedLinks(results, lang) {
  return results.slice(0, 3).map(r => ({ title: r.title, link: r.link, type: r.type }));
}

/* ================= Lead capture ================= */

function captureLead(message, sessionId, lang) {
  const email = (message.match(EMAIL_RE) || [])[0];
  const phone = (message.match(PHONE_RE) || [])[0];
  if (!email && !phone) return null;

  const history = db.prepare(
    "SELECT message FROM chat_messages WHERE session_id = ? AND role = 'user' ORDER BY id DESC LIMIT 6"
  ).all(sessionId).map(r => r.message).reverse().join(' | ');

  db.prepare('INSERT INTO contacts (name, email, company, message, status) VALUES (?, ?, ?, ?, ?)').run(
    lang === 'ar' ? 'عميل من الشات بوت' : 'Chatbot lead',
    email || '',
    phone ? `Phone: ${phone}` : '',
    `[Chatbot] ${message}${history ? `\nRecent context: ${history}` : ''}`,
    'new'
  );

  notifyNewLead('chatbot lead', { email, phone, message: message.slice(0, 1000) });

  return lang === 'ar'
    ? 'تم استلام بياناتك بنجاح! ✅ سيتواصل معك فريقنا خلال يوم عمل واحد. هل هناك شيء آخر أساعدك به؟'
    : 'Got your details! ✅ Our team will contact you within one business day. Anything else I can help with?';
}

/* ================= Storage ================= */

function ensureChatTable() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      role TEXT NOT NULL,
      message TEXT NOT NULL,
      intent TEXT DEFAULT '',
      language TEXT DEFAULT 'en',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_chat_session ON chat_messages(session_id);
  `);
}
ensureChatTable();

/* ================= Main pipeline ================= */

const INTENT_STRONG = 2;      // exact keyword phrase hit
const BM25_STRONG = 2.5;      // confident retrieval score
const FAQ_OVERRIDE = 11;      // BM25 score where a specific FAQ beats a generic intent

function suggestionsFor(intent, lang) {
  const s = SUGGESTS[intent] || SUGGESTS.fallback;
  return s[lang] || s.en;
}

async function replySingleChunk(message, session, lang) {
  /* Arabic questions get Arabic site content (services, projects, ...) */
  const enContent = getContent();
  const content = lang === 'ar' ? getArabicContent(enContent) : enContent;
  let intent = 'fallback';
  let source = 'fallback';
  let text = null;
  let related = [];
  let suggestions = null;

  /* Layer 0 — lead capture */
  const leadReply = captureLead(message, session, lang);
  if (leadReply) {
    text = leadReply;
    intent = 'lead_capture';
    source = 'lead';
  }

  /* Layer 1 — explicit search command */
  if (!text) {
    const cmd = message.match(SEARCH_CMD);
    if (cmd) {
      const results = search(cmd[1], lang, 5);
      text = formatSearchReply(results, lang);
      related = relatedLinks(results, lang);
      intent = 'search';
      source = 'search';
    }
  }

  /* Layer 2 — contextual follow-up ("how much?" after a service) */
  if (!text) {
    const followTarget = resolveFollowup(message, getSession(session));
    if (followTarget && ANSWERS[followTarget]) {
      text = ANSWERS[followTarget](content, lang);
      intent = followTarget;
      source = 'context';
      suggestions = suggestionsFor(followTarget, lang);
    }
  }

  /* Layers 3+4 — intent matching and BM25 retrieval run together, best wins.
     A specific FAQ scoring >= FAQ_OVERRIDE beats a generic intent, since
     intents are broad overviews while FAQs answer precise questions.
     But live content (services/industries/projects) should not beat a strong
     hand-crafted intent answer. */
  let match = null;
  if (!text) {
    match = matchIntent(message);
    const results = search(message, lang, 4);
    const topScore = results.length ? results[0].score : 0;
    const topIsFaq = results.length && results[0].faq;

    const useFaq = () => {
      const top = results[0];
      const faqId = top.faq ? top.faq.id : null;
      const custom = faqId ? getCustomReply(faqId, lang) : null;
      if (custom) {
        text = custom;
      } else if (top.faq) {
        text = top.faq.a[lang === 'ar' ? 'ar' : 'en'];
      } else {
        text = `${top.title}:\n${top.snippet}`;
      }
      related = relatedLinks(results.slice(1).length ? results.slice(1) : results, lang);
      intent = top.faq ? 'faq_' + top.faq.id : 'content_' + top.type;
      source = 'faq';
      suggestions = suggestionsFor(intent, lang);
    };
    const useIntent = () => {
      const custom = getCustomReply(match.intent, lang);
      text = custom || ANSWERS[match.intent](content, lang);
      intent = match.intent;
      source = 'intent';
      suggestions = suggestionsFor(match.intent, lang);
    };

    const strongIntent = match.intent && match.score >= INTENT_STRONG && ANSWERS[match.intent];
    /* FAQ beats intent when clearly more specific: absolute threshold OR
       double the intent's score (with a floor so noise never wins) */
    const faqWins = topIsFaq &&
      (topScore >= FAQ_OVERRIDE || (topScore >= 6 && topScore >= 2 * (match.score || 0)));

    if (faqWins) {
      useFaq();                                   // specific FAQ wins outright
    } else if (strongIntent) {
      useIntent();                                // strong hand-crafted intent wins
    } else if (topScore >= BM25_STRONG) {
      useFaq();                                   // moderate FAQ/content beats weak intent
    } else if (match.intent && match.score > 0 && ANSWERS[match.intent]) {
      useIntent();                                // weak fuzzy intent beats fallback
    } else {
      /* Layer 5 — smart fallback with "did you mean" */
      const didYouMean = results.slice(0, 3);
      if (didYouMean.length) {
        const names = didYouMean.map(r => `• ${r.title}`).join('\n');
        text = lang === 'ar'
          ? `لم أفهم سؤالك تماماً، لكن ربما تقصد:\n${names}\n\nاختر من الاقتراحات أو أعد صياغة سؤالك. يمكنك أيضاً كتابة "ابحث عن ..." للبحث في معرفتنا.`
          : `I didn't quite catch that, but you might mean:\n${names}\n\nPick a suggestion or rephrase. You can also type "search: ..." to search our knowledge base.`;
        related = relatedLinks(didYouMean, lang);
        suggestions = didYouMean.map(r => r.title).slice(0, 3);
      } else {
        /* Layer 6 — external web search fallback (async, non-blocking) */
        const webResult = await webSearch(message, lang).catch(() => null);
        if (webResult) {
          text = lang === 'ar'
            ? `لم أجد إجابة في معرفة نوفيك، لكن وجدت هذا من ${webResult.source}:\n\n${webResult.snippet}\n\nالمصدر: ${webResult.url}\n\n💡 للأسئلة عن نوفيك، اسأل عن: خدماتنا، الأسعار، مشاريعنا، أو حجز استشارة.`
            : `I couldn't find an answer in Noviq's knowledge, but here's what I found from ${webResult.source}:\n\n${webResult.snippet}\n\nSource: ${webResult.url}\n\n💡 For questions about Noviq, ask about: our services, pricing, projects, or booking a consultation.`;
          intent = 'web_fallback';
          source = 'web';
          related = [{ title: webResult.title, link: webResult.url }];
        } else {
          text = lang === 'ar'
            ? 'عذراً، لم أفهم سؤالك تماماً. يمكنك السؤال عن: خدماتنا، الأسعار، مشاريعنا، حجز استشارة، أو معلومات التواصل. أو اترك بريدك الإلكتروني وسيتواصل معك فريقنا مباشرة.'
            : "Sorry, I didn't quite catch that. You can ask about: our services, pricing, projects, booking a consultation, or contact info. Or leave your email and our team will reach out directly.";
          intent = 'fallback';
          source = 'fallback';
        }
      }
    }
  }

  /* Remember the topic for follow-ups (skip smalltalk/fallback) */
  if (['intent', 'context', 'faq'].includes(source) &&
      !['greeting', 'goodbye', 'thanks', 'language_switch'].includes(intent)) {
    setSession(session, intent);
  }

  if (!suggestions) suggestions = suggestionsFor('fallback', lang);

  db.prepare('INSERT INTO chat_messages (session_id, role, message, intent, language) VALUES (?, ?, ?, ?, ?)')
    .run(session, 'bot', text, intent, lang);

  return { reply: text, intent, language: lang, suggestions, related, source };
}

async function reply(message, sessionId) {
  const rawMsg = String(message || '').trim();
  const lang = detectLanguage(rawMsg);
  const session = String(sessionId || 'anonymous').slice(0, 64);

  db.prepare('INSERT INTO chat_messages (session_id, role, message, language) VALUES (?, ?, ?, ?)')
    .run(session, 'user', rawMsg.slice(0, 4000), lang);

  if (rawMsg.length > 1000) {
    const chunks = [];
    for (let i = 0; i < rawMsg.length; i += 1000) {
      chunks.push(rawMsg.slice(i, i + 1000));
    }
    const stageResults = [];
    for (let idx = 0; idx < chunks.length; idx++) {
      const res = await replySingleChunk(chunks[idx], session, lang);
      stageResults.push({
        stage: idx + 1,
        total: chunks.length,
        reply: res.reply,
        intent: res.intent,
        source: res.source,
        related: res.related,
        suggestions: res.suggestions
      });
    }
    const header = lang === 'ar'
      ? `تم تقسيم رسالتك المعالجة لكبر حجمها إلى ${chunks.length} مراحل:\n\n`
      : `Your message was processed in ${chunks.length} stages due to its length:\n\n`;
    const combinedReply = header + stageResults.map(r => `🔹 ${lang === 'ar' ? `المرحلة ${r.stage} من ${r.total}` : `Stage ${r.stage} of ${r.total}`}:\n${r.reply}`).join('\n\n---\n\n');

    return {
      reply: combinedReply,
      intent: 'multi_stage',
      language: lang,
      source: 'chunked_pipeline',
      stages: stageResults,
      related: stageResults.flatMap(r => r.related || []),
      suggestions: stageResults[0]?.suggestions || null
    };
  }

  return await replySingleChunk(rawMsg, session, lang);
}

module.exports = { reply, matchIntent, detectLanguage, invalidateOverrideCache, getCustomReply, getDefaultReply };
