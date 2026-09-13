const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const config = require('../config');
const { cloneDefaults, upgradePromptBuilder } = require('../prompt-builder-config');

const DB_PATH = config.DB_PATH;

/* Ensure the data directory exists (server/data by default).
   On shared hosting the folder must be writable (chmod 755/775).
   Fail with a clear message instead of a cryptic crash. */
try {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
} catch (err) {
  console.error('[DB] FATAL: cannot create database directory: ' + path.dirname(DB_PATH));
  console.error('[DB] ' + err.message);
  console.error('[DB] Fix: create the folder manually and make it writable, or set DB_PATH env var.');
  process.exit(1);
}

/* One-time migration: move the old frontend-coupled DB into the backend */
const LEGACY_DB = path.join(__dirname, '..', '..', 'frontend', 'data', 'noviq.db');
if (!fs.existsSync(DB_PATH) && fs.existsSync(LEGACY_DB)) {
  try {
    fs.copyFileSync(LEGACY_DB, DB_PATH);
    console.log('[DB] Migrated legacy database into server/data/');
  } catch (err) {
    console.warn('[DB] Legacy migration skipped: ' + err.message);
  }
}

let db;
try {
  db = new Database(DB_PATH);
} catch (err) {
  console.error('[DB] FATAL: cannot open SQLite database at ' + DB_PATH);
  console.error('[DB] ' + err.message);
  console.error('[DB] On shared hosting: run NPM Install on Linux (do NOT upload Windows node_modules),');
  console.error('[DB] ensure Node >= 18, then `npm rebuild better-sqlite3`.');
  process.exit(1);
}

/* WAL is fast locally but needs -wal/-shm sidecar writes. Some shared
   filesystems block that, so fall back to DELETE mode instead of crashing. */
try {
  db.pragma('journal_mode = WAL');
} catch (err) {
  console.warn('[DB] WAL mode unavailable, falling back to DELETE: ' + err.message);
  try { db.pragma('journal_mode = DELETE'); } catch {}
}
try {
  db.pragma('foreign_keys = ON');
} catch (err) {
  console.warn('[DB] foreign_keys pragma skipped: ' + err.message);
}

function migrate() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS contacts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      company TEXT DEFAULT '',
      message TEXT NOT NULL,
      status TEXT DEFAULT 'new',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS newsletter (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      subscribed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      active INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS assessments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT DEFAULT '',
      email TEXT DEFAULT '',
      company TEXT DEFAULT '',
      answers TEXT NOT NULL,
      score INTEGER DEFAULT 0,
      level TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS consultations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT DEFAULT '',
      email TEXT DEFAULT '',
      company TEXT DEFAULT '',
      industry TEXT DEFAULT '',
      budget TEXT DEFAULT '',
      timeline TEXT DEFAULT '',
      message TEXT DEFAULT '',
      status TEXT DEFAULT 'new',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS solution_builds (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT DEFAULT '',
      email TEXT DEFAULT '',
      company TEXT DEFAULT '',
      steps TEXT NOT NULL,
      summary TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email);
    CREATE INDEX IF NOT EXISTS idx_contacts_status ON contacts(status);
    CREATE INDEX IF NOT EXISTS idx_newsletter_email ON newsletter(email);
    CREATE INDEX IF NOT EXISTS idx_consultations_status ON consultations(status);

    CREATE TABLE IF NOT EXISTS content (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      first_name TEXT NOT NULL,
      last_name TEXT DEFAULT '',
      email TEXT NOT NULL UNIQUE COLLATE NOCASE,
      password TEXT NOT NULL,
      role TEXT DEFAULT 'user',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

    CREATE TABLE IF NOT EXISTS password_resets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL COLLATE NOCASE,
      code TEXT NOT NULL,
      expires_at DATETIME NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_password_resets_email ON password_resets(email);

    CREATE TABLE IF NOT EXISTS visits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      day TEXT NOT NULL,
      path TEXT NOT NULL DEFAULT '/',
      language TEXT DEFAULT 'en',
      count INTEGER DEFAULT 1,
      UNIQUE(day, path, language)
    );

    CREATE INDEX IF NOT EXISTS idx_visits_day ON visits(day);

    /* Chatbot reply overrides — admin-editable custom answers that take
       priority over the hardcoded defaults in engine.js / knowledge.js.
       key   = intent name (e.g. 'pricing') or faq id (e.g. 'warranty')
       type  = 'intent' | 'faq'
       reply_en / reply_ar = custom answer text (empty = use default) */
    CREATE TABLE IF NOT EXISTS chatbot_replies (
      key TEXT PRIMARY KEY,
      type TEXT NOT NULL DEFAULT 'intent',
      reply_en TEXT DEFAULT '',
      reply_ar TEXT DEFAULT '',
      category TEXT DEFAULT '',
      image TEXT DEFAULT '',
      file TEXT DEFAULT '',
      label_en TEXT DEFAULT '',
      label_ar TEXT DEFAULT '',
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    /* Admin tables (canonical home; middleware/auth.js also guards with IF NOT EXISTS) */
    CREATE TABLE IF NOT EXISTS admin_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      role TEXT DEFAULT 'admin',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS admin_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      admin_id INTEGER NOT NULL,
      token TEXT NOT NULL UNIQUE,
      ip TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (admin_id) REFERENCES admin_users(id) ON DELETE CASCADE
    );

    /* Chat log table (canonical home; chatbot/engine.js also guards with IF NOT EXISTS) */
    CREATE TABLE IF NOT EXISTS chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      role TEXT NOT NULL,
      message TEXT NOT NULL,
      intent TEXT DEFAULT '',
      language TEXT DEFAULT 'en',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON chat_messages(session_id);

    /* Site-wide settings (admin-editable runtime config: motion, perf, etc.) */
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    /* Admin/system event log — SEPARATE from chat_messages (chat log).
       Stores admin logins, rate-limit hits (429), and other notable events.
       Savable via CSV export, deletable per-row or all at once. */
    CREATE TABLE IF NOT EXISTS admin_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      level TEXT NOT NULL DEFAULT 'info',
      source TEXT NOT NULL DEFAULT 'admin',
      message TEXT NOT NULL DEFAULT '',
      ip TEXT DEFAULT '',
      path TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_admin_logs_created ON admin_logs(created_at);
  `);

  /* Migration: add new columns to existing chatbot_replies table */
  try {
    const cols = db.prepare("PRAGMA table_info(chatbot_replies)").all().map(c => c.name);
    if (!cols.includes('image')) db.exec("ALTER TABLE chatbot_replies ADD COLUMN image TEXT DEFAULT ''");
    if (!cols.includes('file')) db.exec("ALTER TABLE chatbot_replies ADD COLUMN file TEXT DEFAULT ''");
    if (!cols.includes('label_en')) db.exec("ALTER TABLE chatbot_replies ADD COLUMN label_en TEXT DEFAULT ''");
    if (!cols.includes('label_ar')) db.exec("ALTER TABLE chatbot_replies ADD COLUMN label_ar TEXT DEFAULT ''");
  } catch {}

}

migrate();

function seedContent() {
  const count = db.prepare('SELECT COUNT(*) as c FROM content').get().c;
  if (count > 0) return;

  const seedData = {
    brand: JSON.stringify({ name: "Noviq", fullName: "Noviq Solutions", tagline: "Software, engineered forward.", email: "hello@noviqsolutions.com", phone: "+1 (415) 555-0182", locations: "San Francisco · London · Singapore" }),
    hero: JSON.stringify({ badge: "Global Software & AI Engineering", titleLead: "Engineering the", titleAccent: "Future", titleTrail: "Through Technology", description: "We build intelligent software, AI-powered platforms, enterprise systems, and scalable digital solutions that help ambitious businesses grow.", ctaPrimary: "Start Your Project", ctaSecondary: "View Our Work" }),
    servicesHeader: JSON.stringify({ eyebrow: "What We Build", title: "Full-Spectrum Software & AI Solutions", desc: "From intelligent automation to enterprise-grade platforms, engineered end to end." }),
    whyHeader: JSON.stringify({ eyebrow: "Why Noviq", title: "Built Different, Built to Last" }),
    industriesHeader: JSON.stringify({ eyebrow: "Who We Serve", title: "Trusted Across Every Major Industry" }),
    portfolioHeader: JSON.stringify({ eyebrow: "Featured Work", title: "Case Studies From the Field" }),
    processHeader: JSON.stringify({ eyebrow: "How We Work", title: "A Process Built for Certainty" }),
    testimonialsHeader: JSON.stringify({ eyebrow: "Client Voices", title: "What Our Partners Say" }),
    stackHeader: JSON.stringify({ eyebrow: "Our Toolkit", title: "Technology We Trust" }),
    contact: JSON.stringify({ eyebrow: "Get In Touch", title: "Let's Build Something Exceptional", desc: "Tell us about your project and we'll get back to you within one business day.", ctaLabel: "Send Message", successMessage: "We'll be in touch within one business day." }),
    footer: JSON.stringify({ tagline: "Global software and AI engineering for ambitious, growth-minded businesses.", columns: [{ title: "Company", links: ["About", "Careers", "Contact", "Press"] }, { title: "Services", links: ["AI Solutions", "Custom Software", "Cloud", "Mobile Apps"] }, { title: "Resources", links: ["Case Studies", "Blog", "Documentation", "Support"] }], social: ["LinkedIn", "X", "GitHub"], copyright: "© 2026 Noviq Solutions. All rights reserved." }),
  };

  const arraysData = {
    nav: JSON.stringify([{ label: "Home", href: "#home" }, { label: "Solutions", href: "#solutions" }, { label: "Industries", href: "#industries" }, { label: "Portfolio", href: "#portfolio" }, { label: "About", href: "#about" }, { label: "Contact", href: "#contact" }]),
    stats: JSON.stringify([{ to: 480, suffix: "+", label: "Projects Delivered" }, { to: 32, suffix: "", label: "Countries Served" }, { to: 140, suffix: "+", label: "Enterprise Clients" }, { to: 12, suffix: "+", label: "Years of Experience" }]),
    services: JSON.stringify([{ icon: "brain", title: "AI Solutions", desc: "Custom AI models, LLM integrations, and intelligent automation built for real business outcomes." }, { icon: "code-2", title: "Custom Software", desc: "Bespoke systems engineered around your workflows, not the other way around." }, { icon: "layers", title: "ERP Systems", desc: "Unified operations platforms that connect finance, inventory, and people in one place." }, { icon: "users", title: "CRM Platforms", desc: "Sales and support tooling that gives every team a single source of truth." }, { icon: "cloud", title: "Cloud Solutions", desc: "Resilient, auto-scaling infrastructure across AWS, Azure, and Google Cloud." }, { icon: "sparkles", title: "SaaS Development", desc: "Multi-tenant products built to scale from first customer to first million." }, { icon: "globe", title: "Web Applications", desc: "Fast, accessible, pixel-perfect interfaces engineered for growth." }, { icon: "smartphone", title: "Mobile Applications", desc: "Native-feel iOS and Android apps from a single, maintainable codebase." }, { icon: "plug", title: "API Development", desc: "Documented, versioned, secure APIs that your partners actually enjoy integrating." }, { icon: "settings", title: "Automation", desc: "Workflow and process automation that removes manual work at the root." }, { icon: "compass", title: "Digital Transformation", desc: "End-to-end modernization strategy paired with the engineering to execute it." }]),
    why: JSON.stringify([{ icon: "sparkles", title: "Innovation", desc: "We ship what's next, not what's already common." }, { icon: "target", title: "Precision", desc: "Every detail engineered with intent, nothing left to chance." }, { icon: "gauge", title: "Scalability", desc: "Architecture built to grow with your business, not against it." }, { icon: "rocket", title: "Performance", desc: "Sub-second load times and infrastructure that never blinks." }, { icon: "shield-check", title: "Security", desc: "Enterprise-grade protection baked in from day one." }, { icon: "award", title: "Reliability", desc: "99.9% uptime backed by real operational discipline." }, { icon: "globe", title: "Global Standards", desc: "Compliant, accessible, and built for international scale." }, { icon: "brain", title: "Expert Engineers", desc: "Senior talent only — no learning on your budget." }]),
    industries: JSON.stringify([{ icon: "building-2", title: "Healthcare" }, { icon: "factory", title: "Manufacturing" }, { icon: "graduation-cap", title: "Education" }, { icon: "landmark", title: "Real Estate" }, { icon: "wallet", title: "Finance" }, { icon: "shopping-bag", title: "Retail" }, { icon: "scale", title: "Government" }, { icon: "truck", title: "Logistics" }]),
    projects: JSON.stringify([{ tag: "AI Platform", title: "Predictive Ops for a Logistics Network", desc: "A demand-forecasting engine that cut idle fleet time by 31% across six countries.", img: "images/project-ai.png" }, { tag: "FinTech", title: "Unified Ledger for a Digital Bank", desc: "Real-time reconciliation infrastructure processing 4M+ transactions daily.", img: "images/project-fintech.png" }, { tag: "Healthcare", title: "Patient Intelligence Suite", desc: "A HIPAA-compliant platform connecting 200+ clinics on one care record.", img: "images/project-healthcare.png" }, { tag: "Retail", title: "Omnichannel Commerce Engine", desc: "Inventory and CRM unification behind a single storefront experience.", img: "images/project-retail.png" }]),
    process: JSON.stringify([{ icon: "search", title: "Discovery", desc: "We study your business, users, and constraints before writing a line of code." }, { icon: "pen-tool", title: "Planning", desc: "Scope, architecture, and roadmap defined with full transparency." }, { icon: "layers", title: "UI/UX", desc: "Interfaces designed around clarity, speed, and real user behavior." }, { icon: "hammer", title: "Development", desc: "Agile sprints with weekly demos and continuous integration." }, { icon: "bug", title: "Testing", desc: "Automated and manual QA across every device and edge case." }, { icon: "upload-cloud", title: "Deployment", desc: "Zero-downtime releases into hardened, monitored infrastructure." }, { icon: "life-buoy", title: "Support", desc: "Ongoing optimization, monitoring, and a team that stays reachable." }]),
    testimonials: JSON.stringify([{ quote: "Noviq rebuilt our core platform in four months and it hasn't gone down once since launch.", name: "Elena Ruiz", role: "CTO, Meridian Health" }, { quote: "The AI system they built now handles forecasting that used to take our team a full week.", name: "James Whitfield", role: "COO, Arkline Logistics" }, { quote: "Best engineering partner we've worked with — precise, fast, and genuinely invested in outcomes.", name: "Priya Nandakumar", role: "VP Product, Solace Finance" }]),
    stack: JSON.stringify(["React", "Next.js", "Node.js", "TypeScript", "Python", ".NET", "Docker", "Kubernetes", "AWS", "Azure", "Google Cloud", "PostgreSQL", "MongoDB", "Redis", "TensorFlow", "PyTorch", "OpenAI"]),
  };

  const insert = db.prepare('INSERT OR IGNORE INTO content (key, value) VALUES (?, ?)');
  const insertMany = db.transaction((data) => { for (const [k, v] of Object.entries(data)) insert.run(k, v); });
  insertMany({ ...seedData, ...arraysData });
  console.log('[DB] Content seeded from defaults');
}

seedContent();

/* Keys added after the first release: insert them even on existing databases. */
function ensureNewContentKeys() {
  const newKeys = {
    clientsHeader: JSON.stringify({ eyebrow: "Our Clients", title: "Partners Who Trust Noviq Worldwide" }),
    clients: JSON.stringify([
      { icon: "heart-pulse", name: "Meridian Health", img: "" },
      { icon: "truck", name: "Arkline Logistics", img: "" },
      { icon: "wallet", name: "Solace Finance", img: "" },
      { icon: "shopping-bag", name: "Vertex Retail", img: "" },
      { icon: "cloud", name: "Nimbus Cloud", img: "" },
      { icon: "graduation-cap", name: "Orbit Education", img: "" },
      { icon: "factory", name: "Helix Manufacturing", img: "" },
      { icon: "radio", name: "Pulse Media", img: "" },
    ]),
    resources: JSON.stringify({
      hero: {
        eyebrow: { en: 'Knowledge Hub', ar: 'مركز المعرفة' },
        title: { en: 'Resources & Insights', ar: 'المصادر والرؤى' },
        description: {
          en: 'Stay ahead with our latest news, articles, whitepapers, and technical guides.',
          ar: 'تابع أحدث أخبارنا ومقالاتنا وأبحاثنا وأدلتنا التقنية.',
        },
      },
      tabs: [
        { id: 'news', label: { en: 'News', ar: 'الأخبار' }, active: true },
        { id: 'blog', label: { en: 'Articles', ar: 'المقالات' }, active: true },
        { id: 'whitepapers', label: { en: 'Whitepapers', ar: 'الأبحاث' }, active: true },
        { id: 'downloads', label: { en: 'Downloads', ar: 'التحميلات' }, active: true },
      ],
      items: {
        news: [],
        blog: [],
        whitepapers: [],
        downloads: [],
      },
    }),
    team: JSON.stringify({
      hero: {
        eyebrow: { en: 'Our Team', ar: 'فريقنا' },
        title: { en: 'Meet the Minds Behind Noviq', ar: 'تعرف على عقول نوفيك' },
        description: {
          en: 'Engineers, designers, and strategists crafting software that matters. View profiles, portfolios, and CVs.',
          ar: 'مهندسون ومصممون واستراتيجيون يصنعون برمجيات ذات أثر. تصفح الملفات الشخصية والأعمال والسير الذاتية.',
        },
      },
      members: [
        {
          id: 'member-ahmed-hassan',
          name: { en: 'Ahmed Hassan', ar: 'أحمد حسن' },
          role: { en: 'Lead AI Engineer', ar: 'مهندس ذكاء اصطناعي أول' },
          bio: { en: 'Ahmed leads our AI practice, shipping LLM-powered products from prototype to production across three continents.', ar: 'يقود أحمد فريق الذكاء الاصطناعي، ويطلق منتجات مدعومة بالنماذج اللغوية من النموذج الأولي إلى الإنتاج.' },
          photo: '',
          portfolio: '',
          cv: '',
          email: '',
          linkedin: '',
          github: '',
          facebook: '',
          status: 'published',
          featured: true,
        },
        {
          id: 'member-sara-mahmoud',
          name: { en: 'Sara Mahmoud', ar: 'سارة محمود' },
          role: { en: 'Senior UI/UX Designer', ar: 'مصممة واجهات أولى' },
          bio: { en: 'Sara crafts interfaces used by millions, obsessing over every pixel, motion curve, and micro-interaction.', ar: 'تصمم سارة واجهات يستخدمها الملايين، وتهتم بأدق التفاصيل من البكسل إلى الحركة.' },
          photo: '',
          portfolio: '',
          cv: '',
          email: '',
          linkedin: '',
          github: '',
          facebook: '',
          status: 'published',
          featured: true,
        },
        {
          id: 'member-omar-khaled',
          name: { en: 'Omar Khaled', ar: 'عمر خالد' },
          role: { en: 'Full-Stack Developer', ar: 'مطور Full-Stack' },
          bio: { en: 'Omar builds resilient cloud platforms with Node.js and React, keeping our uptime at 99.9% and our deploys boring.', ar: 'يبني عمر منصات سحابية متينة بـ Node.js و React، ويحافظ على استمرارية الخدمة بنسبة 99.9%.' },
          photo: '',
          portfolio: '',
          cv: '',
          email: '',
          linkedin: '',
          github: '',
          facebook: '',
          status: 'published',
          featured: false,
        },
      ],
    }),
    solutions: JSON.stringify([
      { icon: 'stethoscope', title: 'Clinic Management', desc: 'Complete practice management with appointments, EHR, billing, and lab integration.', price: '$299/mo' },
      { icon: 'graduation-cap', title: 'School ERP', desc: 'Student records, attendance, grades, scheduling, and parent communication.', price: '$399/mo' },
      { icon: 'users', title: 'HR & Payroll', desc: 'Employee database, payroll processing, leave management, and performance tracking.', price: '$249/mo' },
      { icon: 'package', title: 'Inventory System', desc: 'Real-time stock tracking, purchase orders, warehousing, and supplier management.', price: '$199/mo' },
      { icon: 'shopping-cart', title: 'POS System', desc: 'Point of sale with order management, payments, receipts, and sales analytics.', price: '$149/mo' },
      { icon: 'truck', title: 'Fleet Management', desc: 'Vehicle tracking, fuel management, maintenance scheduling, and driver logs.', price: '$349/mo' },
    ]),
  };
  const insert = db.prepare('INSERT OR IGNORE INTO content (key, value) VALUES (?, ?)');
  for (const [k, v] of Object.entries(newKeys)) insert.run(k, v);

  /* Migration: admin email column (admin login by username OR email) */
  try {
    const cols = db.prepare('PRAGMA table_info(admin_users)').all().map(c => c.name);
    if (!cols.includes('email')) {
      db.exec("ALTER TABLE admin_users ADD COLUMN email TEXT DEFAULT ''");
      console.log('[DB] Added email column to admin_users');
    }
  } catch {}

  /* Migration: add icons to client items saved before the icon field existed */
  const CLIENT_ICONS = {
    'Meridian Health': 'heart-pulse', 'Arkline Logistics': 'truck',
    'Solace Finance': 'wallet', 'Vertex Retail': 'shopping-bag',
    'Nimbus Cloud': 'cloud', 'Orbit Education': 'graduation-cap',
    'Helix Manufacturing': 'factory', 'Pulse Media': 'radio',
  };
  const row = db.prepare("SELECT value FROM content WHERE key = 'clients'").get();
  if (row) {
    try {
      const arr = JSON.parse(row.value);
      let changed = false;
      for (const c of arr) {
        if (c && typeof c === 'object' && !c.icon) {
          c.icon = CLIENT_ICONS[c.name] || 'building-2';
          changed = true;
        }
      }
      if (changed) {
        db.prepare("UPDATE content SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = 'clients'").run(JSON.stringify(arr));
        console.log('[DB] Added icons to existing clients');
      }
    } catch {}
  }

  /* Migration: portfolio links and case-study copy are managed centrally. */
  const projectsRow = db.prepare("SELECT value FROM content WHERE key = 'projects'").get();
  if (projectsRow) {
    try {
      const projects = JSON.parse(projectsRow.value);
      let changed = false;
      for (const project of projects) {
        if (!project || typeof project !== 'object') continue;
        const defaults = {
          tagAr: '', titleAr: '', descAr: '', link: '',
          challenge: '', challengeAr: '', solution: '', solutionAr: '',
          results: '', resultsAr: '',
        };
        for (const [key, value] of Object.entries(defaults)) {
          if (project[key] === undefined) { project[key] = value; changed = true; }
        }
      }
      if (changed) {
        db.prepare("UPDATE content SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = 'projects'").run(JSON.stringify(projects));
        console.log('[DB] Added links and case-study fields to projects');
      }
    } catch {}
  }
}
ensureNewContentKeys();

/* Seed interactive-tool content keys (solutionBuilder, costEstimator, assessment,
   aiConsultant). INSERT OR IGNORE — safe on existing databases. */
function ensureToolContent() {
  const icon = (name) => `<i data-lucide="${name}" style="width:22px;height:22px"></i>`;

  const toolData = {
    solutionBuilder: JSON.stringify({
      steps: [
        { key: 'business', label: 'Business', title: 'What type of business are you in?', desc: 'Select all that apply so we can tailor the proposal.', multi: true, options: [
          { value: 'saas', label: 'SaaS / Tech', icon: icon('cloud') },
          { value: 'ecommerce', label: 'E-commerce', icon: icon('shopping-cart') },
          { value: 'healthcare', label: 'Healthcare', icon: icon('stethoscope') },
          { value: 'finance', label: 'Finance', icon: icon('wallet') },
          { value: 'manufacturing', label: 'Manufacturing', icon: icon('factory') },
          { value: 'education', label: 'Education', icon: icon('graduation-cap') },
          { value: 'retail', label: 'Retail', icon: icon('shopping-bag') },
          { value: 'other', label: 'Other', icon: icon('circle') },
        ]},
        { key: 'scope', label: 'Scope', title: 'What scale of system do you need?', desc: 'Pick the scope that best matches your ambition.', multi: false, options: [
          { value: 'mvp', label: 'MVP / Prototype', icon: icon('rocket') },
          { value: 'internal', label: 'Internal Tool', icon: icon('briefcase') },
          { value: 'saas-product', label: 'SaaS Product', icon: icon('layers') },
          { value: 'enterprise', label: 'Enterprise Platform', icon: icon('building-2') },
          { value: 'marketplace', label: 'Marketplace', icon: icon('store') },
        ]},
        { key: 'features', label: 'Features', title: 'Which core features do you need?', desc: 'Select everything that applies to your product.', multi: true, options: [
          { value: 'auth', label: 'User Authentication & Roles', icon: icon('lock') },
          { value: 'payments', label: 'Payment Processing', icon: icon('credit-card') },
          { value: 'dashboard', label: 'Analytics Dashboard', icon: icon('bar-chart-3') },
          { value: 'file-upload', label: 'File Upload & Storage', icon: icon('upload-cloud') },
          { value: 'realtime', label: 'Real-time (Chat/Live)', icon: icon('message-circle') },
          { value: 'notifications', label: 'Push & Email Notifications', icon: icon('bell') },
          { value: 'i18n', label: 'Multi-language Support', icon: icon('languages') },
          { value: 'admin', label: 'Admin Panel', icon: icon('settings') },
        ]},
        { key: 'ai', label: 'AI', title: 'Which AI capabilities are you after?', desc: 'Optional — choose none if not needed yet.', multi: true, options: [
          { value: 'chatbot', label: 'AI Chatbot', icon: icon('message-square') },
          { value: 'recommendations', label: 'Recommendations', icon: icon('sparkles') },
          { value: 'ocr-vision', label: 'OCR / Computer Vision', icon: icon('scan-text') },
          { value: 'forecasting', label: 'Forecasting', icon: icon('trending-up') },
          { value: 'sentiment', label: 'Sentiment Analysis', icon: icon('smile') },
          { value: 'none', label: 'None for now', icon: icon('minus') },
        ]},
        { key: 'integrations', label: 'Integrations', title: 'Third-party integrations', desc: 'Connect to the services you already use.', multi: true, options: [
          { value: 'payment-gateway', label: 'Payment Gateway', icon: icon('credit-card') },
          { value: 'email-sms', label: 'Email / SMS', icon: icon('mail') },
          { value: 'crm', label: 'CRM', icon: icon('users') },
          { value: 'erp', label: 'ERP', icon: icon('box') },
          { value: 'maps', label: 'Maps & Geolocation', icon: icon('map-pin') },
          { value: 'cloud-storage', label: 'Cloud Storage', icon: icon('database') },
          { value: 'none', label: 'None for now', icon: icon('minus') },
        ]},
        { key: 'design', label: 'Design', title: 'What level of design & UX?', desc: 'Choose the polish your product deserves.', multi: false, options: [
          { value: 'standard', label: 'Standard', icon: icon('square') },
          { value: 'premium', label: 'Premium', icon: icon('star') },
          { value: 'enterprise', label: 'Enterprise', icon: icon('award') },
        ]},
        { key: 'timeline', label: 'Timeline', title: 'When do you need it live?', desc: 'Be realistic — we will align delivery to this.', multi: false, options: [
          { value: 'asap', label: 'ASAP', icon: icon('zap') },
          { value: '1-3m', label: '1-3 months', icon: icon('calendar') },
          { value: '3-6m', label: '3-6 months', icon: icon('calendar-days') },
          { value: '6-12m', label: '6-12 months', icon: icon('calendar-range') },
        ]},
        { key: 'budget', label: 'Budget', title: 'What is your budget range?', desc: 'Rough range is fine — it shapes the scope.', multi: false, options: [
          { value: '<10k', label: 'Under $10K', icon: icon('dollar-sign') },
          { value: '10-50k', label: '$10K - $50K', icon: icon('banknote') },
          { value: '50-150k', label: '$50K - $150K', icon: icon('coins') },
          { value: '150k+', label: '$150K+', icon: icon('gem') },
        ]},
      ]
    }),

    costEstimator: JSON.stringify({
      features: [
        { key: 'auth', label: 'User Authentication & Roles', cost: 3000 },
        { key: 'payments', label: 'Payment Processing', cost: 5000 },
        { key: 'dashboard', label: 'Analytics Dashboard', cost: 4500 },
        { key: 'realtime', label: 'Real-time Features (Chat/Live)', cost: 6000 },
        { key: 'file-upload', label: 'File Upload & Storage', cost: 2500 },
        { key: 'notifications', label: 'Push & Email Notifications', cost: 2000 },
        { key: 'i18n', label: 'Multi-language Support', cost: 3000 },
        { key: 'admin', label: 'Admin Panel', cost: 4000 },
        { key: 'ai', label: 'AI Features (Chatbot/Vision)', cost: 8000 },
        { key: 'api', label: 'Public API & Integrations', cost: 3500 },
        { key: 'mobile', label: 'Mobile App (iOS + Android)', cost: 10000 },
        { key: 'maps', label: 'Maps & Geolocation', cost: 2500 },
      ]
    }),

    assessment: JSON.stringify({
      questions: [
        { question: 'Do you have a documented digital strategy?', options: ['No', 'Informal/verbal', 'Documented but partial', 'Yes, fully documented & reviewed'] },
        { question: 'How is leadership involved in technology decisions?', options: ['Not involved', 'Reactive only', 'Involved in major projects', 'Drives a tech-first agenda'] },
        { question: 'What share of revenue depends on digital channels?', options: ['None', 'Under 10%', '10-40%', 'Over 40%'] },
        { question: 'Do you measure digital KPIs (conversion, retention, NPS)?', options: ['No', 'Occasionally', 'Most of them', 'All, dashboards live'] },
        { question: 'How mature is your data infrastructure?', options: ['Spreadsheets only', 'Some databases', 'Central data warehouse', 'Cloud lakehouse + governance'] },
        { question: 'Can teams access data without IT help?', options: ['No', 'Rarely', 'Usually', 'Self-service BI for all'] },
        { question: 'Do you use analytics for forecasting?', options: ['Never', 'Sometimes', 'Regularly for key metrics', 'Real-time predictive models'] },
        { question: 'Is customer data unified across systems?', options: ['No, siloed', 'Partially', 'Mostly unified', 'Single 360 customer view'] },
        { question: 'Are your core systems cloud-based?', options: ['All on-premise', 'Mixed', 'Mostly cloud', 'Cloud-native, multi-region'] },
        { question: 'How do you deploy software?', options: ['Manual', 'Scripted', 'CI pipeline', 'CI/CD with automated rollback'] },
        { question: 'Do you use version control for all code?', options: ['No', 'Some projects', 'Yes, most projects', 'Yes, with code review policy'] },
        { question: 'How is infrastructure provisioned?', options: ['Manual / ticket-based', 'Scripts', 'Some infrastructure-as-code', 'Fully IaC (Terraform/Pulumi)'] },
        { question: 'How automated are your key business processes?', options: ['Manual', 'A few automated', 'Many automated', 'End-to-end automation'] },
        { question: 'Do you have an ERP or core operations system?', options: ['No', 'Legacy/partial', 'Modern but fragmented', 'Unified modern ERP'] },
        { question: 'How do customers interact with you digitally?', options: ['No digital channel', 'Basic website', 'Web + some self-service', 'Full omnichannel (web/app/chat)'] },
        { question: 'Do you offer a mobile experience?', options: ['No', 'Mobile-friendly site only', 'Native app', 'Multiple native apps, updated regularly'] },
        { question: 'How do you handle customer support?', options: ['Phone/email only', 'Basic ticketing', 'Help desk + knowledge base', 'AI-assisted omnichannel support'] },
        { question: 'Do you personalize the customer experience?', options: ['No', 'Basic segmentation', 'Behavioral targeting', 'AI-driven personalization'] },
        { question: 'Are payments and billing digitized?', options: ['No', 'Partially', 'Mostly online', 'Fully automated invoicing & billing'] },
        { question: 'How is cybersecurity managed?', options: ['No formal policy', 'Basic antivirus/firewall', 'Documented policies + audits', 'Continuous monitoring + compliance'] },
        { question: 'Do you control access with SSO/MFA?', options: ['No', 'Some systems', 'MFA on key systems', 'SSO + MFA across everything'] },
        { question: 'How do you handle data backups?', options: ['No regular backups', 'Occasional manual', 'Scheduled backups', 'Automated, tested, off-site, encrypted'] },
        { question: 'Are you compliant with relevant regulations (GDPR/HIPAA/PCI)?', options: ['Unknown', 'Aware, not compliant', 'Partially compliant', 'Fully compliant & certified'] },
        { question: 'How is the team\'s digital skills level?', options: ['Low', 'Mixed', 'Mostly skilled', 'Continuous upskilling program'] },
        { question: 'Is there a dedicated tech/innovation team?', options: ['No', 'One person', 'Small team', 'Cross-functional product squads'] },
        { question: 'How do you adopt new technologies?', options: ['Never', 'When forced', 'Evaluate regularly', 'Early adopter, run experiments'] },
        { question: 'Do you use AI/ML in any process?', options: ['No', 'Experimenting', 'One production use case', 'Multiple AI use cases in production'] },
        { question: 'How do you collect customer feedback?', options: ['Rarely', 'Occasional surveys', 'Regular surveys', 'Continuous, integrated into product'] },
        { question: 'Do you run A/B tests on your digital channels?', options: ['No', 'Rarely', 'Sometimes', 'Continuous experimentation program'] },
        { question: 'Do you have a roadmap for digital initiatives?', options: ['No', 'Informal ideas', 'Annual roadmap', 'Quarterly, funded, tracked roadmap'] },
      ]
    }),

    aiConsultant: JSON.stringify({
      flow: [
        { key: 'business', question: 'What type of business are you in?', options: ['SaaS/Tech', 'E-commerce', 'Healthcare', 'Finance', 'Manufacturing', 'Education', 'Other'] },
        { key: 'employees', question: 'How many employees does your company have?', options: ['1-10', '11-50', '51-200', '201-500', '500+'] },
        { key: 'challenge', question: "What's your biggest operational challenge?", options: ['Manual processes', 'Data silos', 'Scaling issues', 'Customer experience', 'Cost optimization', 'Not sure'] },
        { key: 'goals', question: 'What are your primary goals? (Select all that apply)', options: ['Automate workflows', 'Improve analytics', 'Build custom software', 'Modernize legacy systems', 'AI integration', 'Cloud migration'], multi: true },
        { key: 'timeline', question: "What's your ideal timeline?", options: ['ASAP', '1-3 months', '3-6 months', '6-12 months', 'Exploring only'] },
        { key: 'budget', question: "What's your budget range?", options: ['<$50K', '$50K-$150K', '$150K-$500K', '$500K+', 'Not defined'] },
      ]
    }),
    promptBuilder: JSON.stringify(cloneDefaults()),
  };

  const insert = db.prepare('INSERT OR IGNORE INTO content (key, value) VALUES (?, ?)');
  for (const [k, v] of Object.entries(toolData)) insert.run(k, v);
}
ensureToolContent();

function upgradePromptBuilderContent() {
  const row = db.prepare("SELECT value FROM content WHERE key = 'promptBuilder'").get();
  if (!row) return;
  try {
    const upgraded = upgradePromptBuilder(JSON.parse(row.value));
    if (upgraded.changed) {
      db.prepare("UPDATE content SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = 'promptBuilder'")
        .run(JSON.stringify(upgraded.value));
    }
  } catch (err) {
    console.warn('[DB] Prompt Builder upgrade skipped:', err.message);
  }
}
upgradePromptBuilderContent();

/* ---- Default site-wide settings ----
   motion:
     'full'                  → all animations (default; honors prefers-reduced-motion user pref)
     'auto-reduce-low-tier'  → automatically reduce on low/mid device tiers (default)
     'always-reduce'         → always reduced, regardless of device
     'off'                   → disable heavy animations entirely (intro overlay, 3D, cursor trails)
   motionReductionLevel: 0-100, how much to reduce when reducing (0=none, 100=maximum)
*/
function seedSettings() {
  const defaults = {
    motion: JSON.stringify({
      mode: 'auto-reduce-low-tier',
      reductionLevel: 50,
    }),
  };
  const insert = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
  for (const [k, v] of Object.entries(defaults)) insert.run(k, v);
}
seedSettings();

module.exports = db;
