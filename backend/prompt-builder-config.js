const ID_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/;
const HEX_RE = /^#[0-9a-f]{6}$/i;
const TEMPLATE_TOKENS = new Set(['input', 'base', 'fragments', 'negative']);
const LEGACY_NEGATIVE = 'Do not replace the requested subject with a cityscape, abstract technology symbol, coin, or logo. Avoid unrelated objects, illegible text, duplicate screens, distorted UI, and watermarks.';

const FRAGMENT_UPGRADES = new Map([
  ['for healthcare and clinic services, using appointments, doctors, treatments, patient trust, and accessible medical content', 'for healthcare and clinic services, using appointment scheduling, treatment categories, patient portal cards, trust indicators, and clear medical iconography'],
  ['for a restaurant and food service, using menus, reservations, ordering, and appetizing food imagery', 'for a restaurant and food service, using menus, reservations, ordering, table layouts, and appetizing food photography without diners or staff'],
  ['for e-commerce and online shopping, using product discovery, categories, cart, offers, and checkout', 'for e-commerce and online shopping, using product-only discovery, categories, cart, offers, and checkout without lifestyle models'],
  ['for education, using courses, teachers, students, progress, and learning resources', 'for education, using course catalogs, curriculum cards, lesson progress, certificates, and learning resources without portraits'],
  ['for logistics and delivery operations, using fleet tracking, shipments, routes, and operational status', 'for logistics and delivery operations, using vehicle and package tracking, shipments, route maps, and operational status without drivers'],
  ['for financial services, using secure accounts, transactions, analytics, and customer trust', 'for financial services, using secure account cards, transactions, analytics, and trust indicators without customer portraits'],
  ['for a restaurant and food service, using menus, reservations, ordering, table layouts, and appetizing food photography without diners or staff', 'for restaurant operations, using menu management, reservation schedules, ordering workflows, table availability, kitchen status, and food photography'],
  ['for e-commerce and online shopping, using product-only discovery, categories, cart, offers, and checkout without lifestyle models', 'for e-commerce operations, using a product catalog, categories, search, cart, offers, inventory, and checkout'],
  ['for education, using course catalogs, curriculum cards, lesson progress, certificates, and learning resources without portraits', 'for education, using course catalogs, curriculum cards, lesson progress, certificates, assignments, and learning resources'],
  ['for logistics and delivery operations, using vehicle and package tracking, shipments, route maps, and operational status without drivers', 'for logistics operations, using vehicle and package tracking, shipments, route maps, delivery stages, and operational status'],
  ['for financial services, using secure account cards, transactions, analytics, and trust indicators without customer portraits', 'for financial services, using secure account cards, transactions, analytics, budgets, risk indicators, and trust signals'],
]);

const option = (id, en, ar, icon, fragment, swatches = [], extra = {}) => ({
  id, label: { en, ar }, icon, fragment, swatches, active: true, ...extra,
});

const DEFAULT_PROMPT_BUILDER = {
  schemaVersion: 1,
  revision: 1,
  active: true,
  label: { en: 'AI Image Designer', ar: 'مصمم الصور بالذكاء الاصطناعي' },
  description: {
    en: 'Choose a few visual preferences, then generate one precise image.',
    ar: 'اختر تفضيلات التصميم ثم أنشئ صورة دقيقة ومطابقة لطلبك.',
  },
  templates: {
    base: 'User request: "{{input}}".',
    final: '{{base}}\n\nCreate {{fragments}}. Follow the user request exactly. {{negative}}',
    negative: 'Keep the requested subject as the unmistakable focus. Use a coherent composition, relevant visual elements, clean structure, and polished detail.',
  },
  groups: [
    {
      id: 'output', label: { en: 'Design Type', ar: 'نوع التصميم' },
      description: { en: 'What would you like to create?', ar: 'ما الذي تريد إنشاءه؟' },
      icon: 'panels-top-left', active: true, minSelections: 1, maxSelections: 1,
      options: [
        option('website', 'Website', 'موقع إلكتروني', 'globe', 'a high-fidelity desktop website UI with a complete homepage shown straight-on inside a clean browser frame', [], { profile: 'landscape' }),
        option('mobile-app', 'Mobile App', 'تطبيق جوال', 'smartphone', 'a high-fidelity mobile application UI presented across three polished smartphone screens', [], { profile: 'portrait' }),
        option('desktop-app', 'Desktop App', 'تطبيق ديسكتوب', 'monitor', 'a high-fidelity desktop application interface with realistic navigation and complete workflows', [], { profile: 'landscape' }),
        option('dashboard', 'SaaS Dashboard', 'لوحة تحكم SaaS', 'layout-dashboard', 'a high-fidelity enterprise SaaS dashboard with sidebar navigation, relevant KPIs, charts, tables, filters, and operational cards', [], { profile: 'landscape' }),
        option('landing-page', 'Landing Page', 'صفحة هبوط', 'panel-top', 'a conversion-focused landing page UI with a strong hero, benefits, proof, and clear calls to action', [], { profile: 'landscape' }),
        option('general-image', 'Creative Image', 'صورة إبداعية', 'image', 'one coherent high-quality creative image that keeps the requested subject as the unmistakable focus', [], { profile: 'square' }),
      ],
    },
    {
      id: 'industry', label: { en: 'Industry', ar: 'مجال المشروع' },
      description: { en: 'Choose the business context.', ar: 'اختر مجال المشروع.' },
      icon: 'building-2', active: true, minSelections: 1, maxSelections: 1,
      hiddenFor: ['general-image'],
      options: [
        option('healthcare', 'Clinic & Healthcare', 'عيادة وصحة', 'stethoscope', FRAGMENT_UPGRADES.get('for healthcare and clinic services, using appointments, doctors, treatments, patient trust, and accessible medical content')),
        option('restaurant', 'Restaurant & Food', 'مطعم وطعام', 'utensils', 'for restaurant operations, using menu management, reservation schedules, ordering workflows, table availability, kitchen status, and food photography'),
        option('ecommerce', 'E-commerce', 'متجر إلكتروني', 'shopping-bag', 'for e-commerce operations, using a product catalog, categories, search, cart, offers, inventory, and checkout'),
        option('education', 'Education', 'تعليم', 'graduation-cap', 'for education, using course catalogs, curriculum cards, lesson progress, certificates, assignments, and learning resources'),
        option('logistics', 'Logistics', 'لوجستيات', 'truck', 'for logistics operations, using vehicle and package tracking, shipments, route maps, delivery stages, and operational status'),
        option('finance', 'Financial Services', 'خدمات مالية', 'landmark', 'for financial services, using secure account cards, transactions, analytics, budgets, risk indicators, and trust signals'),
      ],
    },
    {
      id: 'palette', label: { en: 'Color Palette', ar: 'لوحة الألوان' },
      description: { en: 'Choose the primary visual mood.', ar: 'اختر الطابع اللوني الأساسي.' },
      icon: 'palette', active: true, minSelections: 1, maxSelections: 1,
      options: [
        option('tech-purple', 'Tech Purple', 'بنفسجي تقني', 'sparkles', 'with a deep violet, electric purple, and soft lavender color palette', ['#2E1065', '#7C3AED', '#C4B5FD']),
        option('medical-blue', 'Clinical Blue', 'أزرق طبي', 'heart-pulse', 'with a clean clinical blue, sky blue, and white color palette', ['#075985', '#38BDF8', '#F8FAFC']),
        option('fresh-green', 'Fresh Green', 'أخضر منعش', 'leaf', 'with a fresh emerald, mint, and off-white color palette', ['#065F46', '#34D399', '#ECFDF5']),
        option('warm-orange', 'Warm Orange', 'برتقالي دافئ', 'sun', 'with a warm amber, orange, cream, and charcoal color palette', ['#9A3412', '#FB923C', '#FFF7ED']),
        option('dark-gold', 'Dark & Gold', 'داكن وذهبي', 'gem', 'with a premium charcoal, black, muted gold, and ivory color palette', ['#111827', '#D4AF37', '#FFFBEB']),
        option('neutral-grey', 'Neutral Grey', 'رمادي محايد', 'circle', 'with a restrained slate grey, cool grey, and white color palette', ['#334155', '#94A3B8', '#F8FAFC']),
      ],
    },
    {
      id: 'style', label: { en: 'Visual Style', ar: 'أسلوب التصميم' },
      description: { en: 'Select the design language.', ar: 'اختر اللغة البصرية.' },
      icon: 'wand-sparkles', active: true, minSelections: 1, maxSelections: 1,
      options: [
        option('luxury-modern', 'Luxury Modern', 'عصري فاخر', 'gem', 'in a refined luxury-modern style with elegant typography, subtle depth, and premium spacing'),
        option('minimal', 'Minimal', 'بسيط', 'minus', 'in a clean minimalist style with generous whitespace, restrained decoration, and strong hierarchy'),
        option('glass', 'Glassmorphism', 'زجاجي', 'layers', 'in a polished glassmorphism style with translucent surfaces, controlled blur, and crisp contrast'),
        option('corporate', 'Corporate', 'مؤسسي', 'briefcase-business', 'in a trustworthy corporate style with structured grids, clear information, and professional restraint'),
        option('editorial', 'Editorial', 'تحريري', 'newspaper', 'in a bold editorial style with expressive typography, asymmetric composition, and curated imagery'),
        option('playful', 'Playful', 'مرح وحيوي', 'party-popper', 'in a playful contemporary style with friendly shapes, energetic accents, and approachable visual language'),
      ],
    },
    {
      id: 'presentation', label: { en: 'Presentation', ar: 'طريقة العرض' },
      description: { en: 'How should the result be displayed?', ar: 'كيف تريد عرض النتيجة؟' },
      icon: 'scan', active: true, minSelections: 1, maxSelections: 1,
      options: [
        option('browser', 'Browser Frame', 'إطار متصفح', 'app-window', 'presented straight-on inside one clean browser frame with the full interface visible', [], { hiddenFor: ['mobile-app', 'general-image'] }),
        option('full-page', 'Full Page', 'صفحة كاملة', 'panel-top-open', 'presented as a clean full-page interface with no distracting device mockup', [], { hiddenFor: ['mobile-app', 'general-image'] }),
        option('laptop', 'Laptop Mockup', 'شاشة لابتوب', 'laptop', 'presented on a premium laptop mockup in a restrained studio scene', [], { hiddenFor: ['mobile-app', 'general-image'] }),
        option('phones', 'Phone Screens', 'شاشات موبايل', 'smartphone', 'presented across three aligned smartphone screens showing complementary flows', [], { onlyFor: ['mobile-app'] }),
        option('case-study', 'Case Study Board', 'لوحة دراسة حالة', 'panels-top-left', 'presented as a professional product-design case study board with key screens and a compact design system', [], { hiddenFor: ['general-image'] }),
        option('clean-canvas', 'Clean Canvas', 'عرض مسطح نظيف', 'maximize', 'presented as one centered subject on a clean, uncluttered canvas', [], { onlyFor: ['general-image'] }),
      ],
    },
  ],
};

function cloneDefaults() {
  return JSON.parse(JSON.stringify(DEFAULT_PROMPT_BUILDER));
}

function upgradePromptBuilder(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { value: input, changed: false };
  const value = JSON.parse(JSON.stringify(input));
  let changed = false;
  if (value.templates && (value.templates.negative === LEGACY_NEGATIVE || /Unless the user explicitly requests people/.test(value.templates.negative))) {
    value.templates.negative = DEFAULT_PROMPT_BUILDER.templates.negative;
    changed = true;
  }
  for (const group of value.groups || []) {
    for (const item of group.options || []) {
      let replacement = FRAGMENT_UPGRADES.get(item.fragment);
      while (replacement && replacement !== item.fragment) {
        item.fragment = replacement;
        changed = true;
        replacement = FRAGMENT_UPGRADES.get(item.fragment);
      }
    }
  }
  if (changed) value.revision = Math.max(1, parseInt(value.revision, 10) || 1) + 1;
  return { value, changed };
}

function validateText(value, name, max, required = true) {
  if (typeof value !== 'string') return `${name} must be text.`;
  if (required && !value.trim()) return `${name} is required.`;
  if (value.length > max) return `${name} is too long (max ${max}).`;
  return null;
}

function validateLocalized(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return `${name} must contain en and ar.`;
  return validateText(value.en, `${name}.en`, 120) || validateText(value.ar, `${name}.ar`, 120);
}

function templateTokens(value) {
  return Array.from(String(value).matchAll(/{{\s*([a-z]+)\s*}}/g), m => m[1]);
}

function validatePromptBuilder(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { error: 'Prompt Builder must be an object.' };
  if (input.schemaVersion !== 1) return { error: 'Unsupported Prompt Builder schema version.' };
  if (typeof input.active !== 'boolean') return { error: 'Builder active state must be true or false.' };
  const localizedError = validateLocalized(input.label, 'label') || validateLocalized(input.description, 'description');
  if (localizedError) return { error: localizedError };
  if (!input.templates || typeof input.templates !== 'object') return { error: 'Prompt templates are required.' };
  for (const key of ['base', 'final', 'negative']) {
    const error = validateText(input.templates[key], `templates.${key}`, 8000, key !== 'negative');
    if (error) return { error };
    for (const token of templateTokens(input.templates[key])) {
      if (!TEMPLATE_TOKENS.has(token)) return { error: `Unknown template token: {{${token}}}.` };
    }
  }
  if (!input.templates.base.includes('{{input}}')) return { error: 'Base template must include {{input}}.' };
  if (!input.templates.final.includes('{{base}}') || !input.templates.final.includes('{{fragments}}')) {
    return { error: 'Final template must include {{base}} and {{fragments}}.' };
  }
  if (!Array.isArray(input.groups) || !input.groups.length || input.groups.length > 30) return { error: 'Builder must have 1-30 groups.' };
  const groupIds = new Set();
  let totalOptions = 0;
  for (const group of input.groups) {
    if (!group || typeof group !== 'object' || !ID_RE.test(group.id || '') || groupIds.has(group.id)) return { error: 'Group IDs must be unique safe identifiers.' };
    groupIds.add(group.id);
    const groupError = validateLocalized(group.label, `groups.${group.id}.label`) || validateLocalized(group.description, `groups.${group.id}.description`);
    if (groupError) return { error: groupError };
    if (typeof group.icon !== 'string' || group.icon.length > 64) return { error: `Invalid icon for group ${group.id}.` };
    if (typeof group.active !== 'boolean') return { error: `Invalid active state for group ${group.id}.` };
    for (const field of ['hiddenFor', 'onlyFor']) {
      if (group[field] !== undefined && (!Array.isArray(group[field]) || group[field].some(id => !ID_RE.test(id)))) return { error: `Invalid ${field} for group ${group.id}.` };
    }
    if (!Number.isInteger(group.minSelections) || !Number.isInteger(group.maxSelections) || group.minSelections < 0 || group.maxSelections < group.minSelections) {
      return { error: `Invalid selection limits for group ${group.id}.` };
    }
    if (!Array.isArray(group.options) || !group.options.length || group.options.length > 100) return { error: `Group ${group.id} must have 1-100 options.` };
    const optionIds = new Set();
    totalOptions += group.options.length;
    for (const item of group.options) {
      if (!item || typeof item !== 'object' || !ID_RE.test(item.id || '') || optionIds.has(item.id)) return { error: `Option IDs in ${group.id} must be unique safe identifiers.` };
      optionIds.add(item.id);
      const optionError = validateLocalized(item.label, `options.${item.id}.label`) || validateText(item.fragment, `options.${item.id}.fragment`, 2000);
      if (optionError) return { error: optionError };
      if (typeof item.icon !== 'string' || item.icon.length > 64 || typeof item.active !== 'boolean') return { error: `Invalid option metadata for ${item.id}.` };
      if (item.profile !== undefined && item.profile !== '' && !['square', 'landscape', 'portrait'].includes(item.profile)) return { error: `Invalid profile for ${item.id}.` };
      if (item.swatches !== undefined && (!Array.isArray(item.swatches) || item.swatches.length > 5 || item.swatches.some(color => !HEX_RE.test(color)))) {
        return { error: `Invalid color swatches for ${item.id}.` };
      }
      for (const field of ['hiddenFor', 'onlyFor']) {
        if (item[field] !== undefined && (!Array.isArray(item[field]) || item[field].some(id => !ID_RE.test(id)))) return { error: `Invalid ${field} for ${item.id}.` };
      }
    }
    const activeCount = group.options.filter(item => item.active).length;
    if (group.active && group.maxSelections > activeCount) return { error: `Selection limit exceeds active options in ${group.id}.` };
  }
  if (totalOptions > 500) return { error: 'Prompt Builder supports up to 500 options.' };
  const normalized = JSON.parse(JSON.stringify(input));
  normalized.revision = Math.max(1, parseInt(input.revision, 10) || 1);
  if (Buffer.byteLength(JSON.stringify(normalized), 'utf8') > 256 * 1024) return { error: 'Prompt Builder configuration is too large.' };
  return { value: normalized };
}

module.exports = { DEFAULT_PROMPT_BUILDER, cloneDefaults, upgradePromptBuilder, validatePromptBuilder };
