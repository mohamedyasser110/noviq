const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const config = require('../config');
const { cloneDefaults, upgradePromptBuilder } = require('../config/prompt-builder');

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

/* One-time migration: move the old frontend-coupled DB into the backend.

   The existsSync calls are wrapped because under a restricted filesystem
   (Node's --permission model, some sandboxes, a locked-down container)
   existsSync THROWS instead of returning false. A convenience migration
   must never be able to stop the server from booting, so any error here
   is treated the same as "there is no legacy database". */
const LEGACY_DB = path.join(__dirname, '..', '..', 'frontend', 'data', 'noviq.db');
try {
  if (!fs.existsSync(DB_PATH) && fs.existsSync(LEGACY_DB)) {
    try {
      fs.copyFileSync(LEGACY_DB, DB_PATH);
      console.log('[DB] Migrated legacy database into server/data/');
    } catch (err) {
      console.warn('[DB] Legacy migration skipped: ' + err.message);
    }
  }
} catch (err) {
  /* Cannot even look at the legacy path — normal under a sandbox. */
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
      phone TEXT DEFAULT '',
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
      /* Profile photo (relative uploads path) + contact phone — both edited
         by the client from the dashboard profile card. */
      avatar TEXT DEFAULT '',
      phone TEXT DEFAULT '',
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

    /* The chatbot_replies table was removed here on 2026-09-27 with the
       chatbot itself (module, routes, dashboard page and contracts), and the
       leftover table was then dropped from existing databases at the owner's
       request — it held 0 rows and nothing read it. chat_messages is NOT
       touched: the admin's chat log is a separate, still-active feature. */

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

    /* The chat_messages table is no longer created: the Chat Logs page and its
       admin endpoints were removed on 2026-09-27 along with the chat feature,
       and nothing writes to it now. An existing database keeps the table and
       its history — it is simply inert. Delete it by hand
       (DROP TABLE chat_messages) if the transcripts are not wanted. */

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

  /* The chatbot_replies table and its column migration were both removed on
     2026-09-27 — see the note where it used to be created. */

  /* The contact form now collects a phone number.
     The CREATE TABLE IF NOT EXISTS above only covers FRESH installs, so an
     existing database needs the column added — otherwise the INSERT fails
     with "table contacts has no column named phone" and every submission
     500s while the form silently reports "failed to send".
     Idempotent: guarded by PRAGMA, a no-op once the column exists. */
  try {
    const contactCols = db.prepare('PRAGMA table_info(contacts)').all().map((c) => c.name);
    if (!contactCols.includes('phone')) {
      db.exec("ALTER TABLE contacts ADD COLUMN phone TEXT DEFAULT ''");
      console.log('[DB] contacts: added phone column');
    }
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
    testimonialsHeader: JSON.stringify({ eyebrow: "Client Voices", title: "What Our Partners Say", desc: "Six teams on what actually changed after shipping with Noviq.", eyebrowAr: "آراء العملاء", titleAr: "أصوات عملائنا", descAr: "ستة فرق تحكي ماذا تغيّر فعلياً بعد العمل مع نوفيك." }),
    stackHeader: JSON.stringify({ eyebrow: "Our Toolkit", title: "Technology We Trust" }),
    contact: JSON.stringify({ eyebrow: "Get In Touch", title: "Let's Build Something Exceptional", desc: "Tell us about your project and we'll get back to you within one business day.", ctaLabel: "Send Message", successMessage: "We'll be in touch within one business day.", phone: "Phone", phonePlaceholder: "+1 415 555 0182", phonePlaceholderAr: "‎+1 415 555 0182", phoneAr: "الهاتف", optional: "(optional)", optionalAr: "(اختياري)", name: "Full Name", namePlaceholder: "Your name", email: "Work Email", emailPlaceholder: "Work email", company: "Company", companyPlaceholder: "Your company", message: "Tell us about your project", messagePlaceholder: "Tell us about your project", sending: "Sending...", sent: "Message Sent!", error: "Failed to send. Please try again." }),
    footer: JSON.stringify({ tagline: "Global software and AI engineering for ambitious, growth-minded businesses.", linkColumns: [{ id: "company", hrefs: ["/about", "/careers", "/contact", "/why"] }, { id: "services", hrefs: ["/services", "/solutions", "/industries", "/portfolio"] }], columns: [{ title: "Company", links: ["About", "Careers", "Contact", "Press"] }, { title: "Services", links: ["AI Solutions", "Custom Software", "Cloud", "Mobile Apps"] }, { title: "Resources", links: ["Case Studies", "Blog", "Documentation", "Support"] }], social: ["LinkedIn", "X", "GitHub"], copyright: "© 2026 Noviq Solutions. All rights reserved." }),
  };

  const arraysData = {
    nav: JSON.stringify([{ label: "Home", href: "#home" }, { label: "Solutions", href: "#solutions" }, { label: "Industries", href: "#industries" }, { label: "Portfolio", href: "#portfolio" }, { label: "About", href: "#about" }, { label: "Contact", href: "#contact" }]),
    stats: JSON.stringify([{ to: 480, suffix: "+", label: "Projects Delivered" }, { to: 32, suffix: "", label: "Countries Served" }, { to: 140, suffix: "+", label: "Enterprise Clients" }, { to: 12, suffix: "+", label: "Years of Experience" }]),
    services: JSON.stringify([{ icon: "brain", title: "AI Solutions", desc: "Custom AI models, LLM integrations, and intelligent automation built for real business outcomes." }, { icon: "code-2", title: "Custom Software", desc: "Bespoke systems engineered around your workflows, not the other way around." }, { icon: "layers", title: "ERP Systems", desc: "Unified operations platforms that connect finance, inventory, and people in one place." }, { icon: "users", title: "CRM Platforms", desc: "Sales and support tooling that gives every team a single source of truth." }, { icon: "cloud", title: "Cloud Solutions", desc: "Resilient, auto-scaling infrastructure across AWS, Azure, and Google Cloud." }, { icon: "sparkles", title: "SaaS Development", desc: "Multi-tenant products built to scale from first customer to first million." }, { icon: "globe", title: "Web Applications", desc: "Fast, accessible, pixel-perfect interfaces engineered for growth." }, { icon: "smartphone", title: "Mobile Applications", desc: "Native-feel iOS and Android apps from a single, maintainable codebase." }, { icon: "plug", title: "API Development", desc: "Documented, versioned, secure APIs that your partners actually enjoy integrating." }, { icon: "settings", title: "Automation", desc: "Workflow and process automation that removes manual work at the root." }, { icon: "compass", title: "Digital Transformation", desc: "End-to-end modernization strategy paired with the engineering to execute it." }]),
    why: JSON.stringify([{ icon: "sparkles", title: "Innovation", desc: "We ship what's next, not what's already common." }, { icon: "target", title: "Precision", desc: "Every detail engineered with intent, nothing left to chance." }, { icon: "gauge", title: "Scalability", desc: "Architecture built to grow with your business, not against it." }, { icon: "rocket", title: "Performance", desc: "Sub-second load times and infrastructure that never blinks." }, { icon: "shield-check", title: "Security", desc: "Enterprise-grade protection baked in from day one." }, { icon: "award", title: "Reliability", desc: "99.9% uptime backed by real operational discipline." }, { icon: "globe", title: "Global Standards", desc: "Compliant, accessible, and built for international scale." }, { icon: "brain", title: "Expert Engineers", desc: "Senior talent only — no learning on your budget." }]),
    industries: JSON.stringify([{ icon: "building-2", title: "Healthcare" }, { icon: "factory", title: "Manufacturing" }, { icon: "graduation-cap", title: "Education" }, { icon: "landmark", title: "Real Estate" }, { icon: "wallet", title: "Finance" }, { icon: "shopping-bag", title: "Retail" }, { icon: "scale", title: "Government" }, { icon: "truck", title: "Logistics" }]),
    projects: JSON.stringify([{ tag: "AI Platform", title: "Predictive Ops for a Logistics Network", desc: "A demand-forecasting engine that cut idle fleet time by 31% across six countries.", img: "images/project-ai.png" }, { tag: "FinTech", title: "Unified Ledger for a Digital Bank", desc: "Real-time reconciliation infrastructure processing 4M+ transactions daily.", img: "images/project-fintech.png" }, { tag: "Healthcare", title: "Patient Intelligence Suite", desc: "A HIPAA-compliant platform connecting 200+ clinics on one care record.", img: "images/project-healthcare.png" }, { tag: "Retail", title: "Omnichannel Commerce Engine", desc: "Inventory and CRM unification behind a single storefront experience.", img: "images/project-retail.png" }]),
    process: JSON.stringify([{ icon: "search", title: "Discovery", desc: "We study your business, users, and constraints before writing a line of code." }, { icon: "pen-tool", title: "Planning", desc: "Scope, architecture, and roadmap defined with full transparency." }, { icon: "layers", title: "UI/UX", desc: "Interfaces designed around clarity, speed, and real user behavior." }, { icon: "hammer", title: "Development", desc: "Agile sprints with weekly demos and continuous integration." }, { icon: "bug", title: "Testing", desc: "Automated and manual QA across every device and edge case." }, { icon: "upload-cloud", title: "Deployment", desc: "Zero-downtime releases into hardened, monitored infrastructure." }, { icon: "life-buoy", title: "Support", desc: "Ongoing optimization, monitoring, and a team that stays reachable." }]),
    testimonials: JSON.stringify([
      { quote: "Noviq rebuilt our core platform in four months and it hasn't gone down once since launch.", quoteAr: "نجحت نوفيك في إعادة تطوير منصتنا الرئيسية في وقت قياسي، والنتيجة أداء استثنائي واستقرار تام منذ اليوم الأول.", name: "Elena Ruiz", nameAr: "إيلينا رويز", role: "CTO, Meridian Health", roleAr: "المديرة التقنية، Meridian Health", img: "images/testimonials/elena-ruiz.svg" },
      { quote: "The AI system they built now handles forecasting that used to take our team a full week.", quoteAr: "أنظمة الذكاء الاصطناعي التي طوروها اختصرت التحليلات التنبؤية من أسابيع إلى ثوانٍ معدودة بكفاءة مذهلة.", name: "James Whitfield", nameAr: "جيمس ويتفيلد", role: "COO, Arkline Logistics", roleAr: "مدير العمليات، Arkline Logistics", img: "images/testimonials/james-whitfield.svg" },
      { quote: "Best engineering partner we've worked with — precise, fast, and genuinely invested in outcomes.", quoteAr: "نوفيك شريك تقني استثنائي: احترافية عالية، سرعة إنجاز، واهتمام حقيقي بتحقيق نتائج ملموسة.", name: "Priya Nandakumar", nameAr: "بريا نانداكومار", role: "VP Product, Solace Finance", roleAr: "نائبة رئيس المنتج، Solace Finance", img: "images/testimonials/priya-nandakumar.svg" },
      { quote: "They took over a codebase two other vendors had abandoned and had it in production inside a quarter.", quoteAr: "استلموا كوداً تخلّى عنه مقاولان سابقان وأصبح جاهزاً للإنتاج خلال أقل من ثلاثة أشهر.", name: "Daniel Okafor", nameAr: "دانيال أوكافور", role: "VP Engineering, Vertex Retail", roleAr: "نائب رئيس الهندسة، Vertex Retail", img: "images/testimonials/daniel-okafor.svg" },
      { quote: "The first discovery call was sharper than any briefing we had written ourselves.", quoteAr: "جلست الاستكشاف الأولى كانت أدق من أي موجز قمنا نحن بكتابته.", name: "Sara Lindqvist", nameAr: "سارة ليندكفيست", role: "Chief Product Officer, Nimbus Cloud", roleAr: "رئيسة المنتجات، Nimbus Cloud", img: "images/testimonials/sara-lindqvist.svg" },
      { quote: "Sixteen campuses, one platform, zero outages. Their team still trains ours.", quoteAr: "ستة عشر حرماً جامعياً، منصة واحدة، دون أي انقطاع. وفريقهم ما زال يدرب فريقنا.", name: "Omar Haddad", nameAr: "عمر حداد", role: "Managing Director, Orbit Education", roleAr: "المدير التنفيذي، Orbit Education", img: "images/testimonials/omar-haddad.svg" },
      { quote: "They argued us out of a feature we asked for, and they were right.", quoteAr: "ناقشونا وأقنعونا بعدم تنفيذ ميزة طلبناها، وكانوا على حق.", name: "Aisha Rahman", nameAr: "عائشة رحمن", role: "Director of Digital, Pulse Media", roleAr: "مديرة التحول الرقمي، Pulse Media", img: "images/testimonials/aisha-rahman.svg" },
      { quote: "Migration weekend, zero factory downtime. I have never seen that happen.", quoteAr: "عطلة ترحيل كاملة دون أي توقّف في المصنع. لم أشهد مثل هذا من قبل.", name: "Lucas Moreau", nameAr: "لوكاس مورو", role: "Head of Platform, Helix Manufacturing", roleAr: "رئيس المنصة، Helix Manufacturing", img: "images/testimonials/lucas-moreau.svg" },
      { quote: "They rebuilt our ledger and passed every audit on the first submission.", quoteAr: "أعادوا بناء دفتر حساباتنا واجتازوا كل التدقيقات من أول تقديم.", name: "Mei Tanaka", nameAr: "mei تاناكا", role: "CTO, Solace Finance", roleAr: "المديرة التقنية، Solace Finance", img: "images/testimonials/mei-tanaka.svg" },
    ]),
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
      /* Seeded into the CMS, not into the page: every field below is
         editable from the admin dashboard and the public page only ever
         renders what is stored here. `status: 'published'` items appear
         publicly; drafts are invisible until an admin publishes them. */
      items: {
        news: [
          {
            id: 'news-noviq-expands-logistics',
            title: { en: 'Noviq expands logistics platform delivery to six new markets', ar: 'نوفيك توسّع منصة الخدمات اللوجستية إلى ستة أسواق جديدة' },
            excerpt: {
              en: 'Demand-forecasting deployments now run in twelve countries, with a regional delivery team based in Rotterdam.',
              ar: 'بدأت أنظمة التنبؤ بالطلب بال العمل في اثني عشر بلدًا، مع فريق إقليمي للتسليم مقرّه روتردام.',
            },
            content: {
              en: 'Noviq today announced the expansion of its logistics forecasting platform into six additional markets across Northern Europe and the Gulf. The platform processes fleet telemetry, order history, and seasonal signals to produce a rolling thirteen-week demand forecast, and is now used to plan capacity across more than 4,000 vehicles.',
              ar: 'أعلنت نوفيك اليوم عن توسيع منصة التنبؤ بالطلب الخاصة بها إلى ستة أسواق إضافية في شمال أوروبا والخليج. تعالج المنصة بيانات الأسطول وسجل الطلبات والإشارات الموسمية لإنتاج توقعات طلبات متجددة لمدة ثلاثة عشر أسبوعًا، وتُستخدم الآن لتخطيط السعة عبر أكثر من 4000 مركبة.',
            },
            cat: { en: 'Company News', ar: 'أخبار الشركة' },
            image: 'images/project-ai.png',
            status: 'published',
            featured: true,
          },
          {
            id: 'news-ai-practice-certification',
            title: { en: 'Noviq achieves ISO 42001 certification for its AI delivery practice', ar: 'نوفيك تحصل على شهادة ISO 42001 لممارسة تسليم خدمات الذكاء الاصطناعي' },
            excerpt: {
              en: 'The certification covers model risk management, human oversight, and post-deployment monitoring across client engagements.',
              ar: 'تغطي الشهادة إدارة مخاطر النماذج والإشراف البشري والمراقبة بعد النشر عبر مشاريع العملاء.',
            },
            content: {
              en: 'Our AI practice has been certified against ISO 42001, the international standard for AI management systems. The audit examined how model risk is assessed before deployment, how human review is built into decision workflows, and how drift is monitored after release. Certification is reviewed annually.',
              ar: 'حصلت ممارسة الذكاء الاصطناعي لدينا على شهادة ISO 42001، المعيار الدولي لأنظمة إدارة الذكاء الاصطناعي. فحص التدقيق كيفية تقييم مخاطر النماذج قبل النشر، وإدماج المراجعة البشرية في تدفقات القرار، وكيفية مراقبة الانحراف بعد الإطلاق. تتم مراجعة الشهادة سنويًا.',
            },
            cat: { en: 'Company News', ar: 'أخبار الشركة' },
            image: 'images/project-healthcare.png',
            status: 'published',
            featured: false,
          },
          {
            id: 'news-partnership-meridian',
            title: { en: 'Meridian Health extends Noviq patient platform to 200 clinics', ar: 'منصة مرidian الصحية تمتد noviq لمريضين إلى 200 عيادة' },
            excerpt: {
              en: 'The rollout unifies clinical records across 200 sites onto a single HIPAA-compliant care record.',
              ar: 'يوحّد التوسع السجلات السريرية عبر 200 موقع على سجل رعاية واحد متوافق مع HIPAA.',
            },
            content: {
              en: 'Meridian Health has completed the second phase of its patient intelligence programme, connecting 200 clinics to a unified care record. Clinicians now see a single patient timeline regardless of which site the encounter occurred at, and referral data no longer has to be re-keyed between systems.',
              ar: 'أكملت Meridian Health المرحلة الثانية من برنامج ذكاء الرعاية، حيث ربطت 200 عيادة بسجل رعاية موحد. يرى الأطباء الآن سجلًا واحدًا للمريض بغض النظر عن الموقع الذي تم فيه اللقاء، ولم يعد يلزم إعادة إدخال بيانات الإحالة بين الأنظمة.',
            },
            cat: { en: 'Partnerships', ar: 'الشراكات' },
            image: 'images/project-healthcare.png',
            status: 'published',
            featured: false,
          },
        ],
        blog: [
          {
            id: 'blog-llm-cost-control',
            title: { en: 'What actually drives the cost of an LLM feature', ar: 'ما الذي يحكم فعليًا تكلفة ميزة تعتمد على نموذج لغوي' },
            excerpt: {
              en: 'Token price is the least interesting number. Prompt structure, retrieval quality, and cache hit rate dominate real spend.',
              ar: 'سعر الرمز هو الرقم الأقل أهمية. بنية الطلب وجودة الاسترجاع ومعدل إصابة الذاكرة هي ما يهيمن على الإنفاق الحقيقي.',
            },
            content: {
              en: 'Teams planning an LLM feature usually benchmark cost by token price alone, then get surprised by the invoice. In practice three factors dominate: how much context you send on every call, whether retrieval returns passages that actually answer the question, and how often a repeated request is served from cache. Shrinking the prompt and improving retrieval typically beats switching models, and both are under the engineering team’s control rather than a vendor negotiation.',
              ar: 'عادة ما تقيس الفرق التي تخطط لميزة تعتمد على نموذج لغوي التكلفة عبر سعر الرمز وحده، ثم تُفاجأ بالفاتورة. عمليًاهناك ثلاثة عوامل مهيمنة: حجم السياق الذي ترسله في كل نداء، وما إذا كان الاسترجاع يُعيد مقاطع تجيب فعلًا عن السؤال، وكم مرة يُقدَّم الطلب المتكرر من الذاكرة المؤقتة. تصغير الطلب وتحسين الاسترجاع يتفوقان عادة على تبديل النماذج، وكلاهما تحت سيطرة فريق الهندسة لا تفاوض مع مورد.',
            },
            cat: { en: 'AI Engineering', ar: 'هندسة الذكاء الاصطناعي' },
            image: 'images/project-ai.png',
            status: 'published',
            featured: true,
          },
          {
            id: 'blog-erp-integration-order',
            title: { en: 'The order you integrate an ERP in matters more than the tool you pick', ar: 'ترتيب دمج نظام تخطيط الموارد أهم من الأداة التي تختارها' },
            excerpt: {
              en: 'Most failed ERP programmes are sequencing failures, not product failures. Start with the record you get wrong most often.',
              ar: 'معظم برامج تخطيط الموارد الفاشلة هي أخطاء في التسلسل لا في المنتج. ابدأ بالسجل الذي تُدخله خطأً أكثر من غيره.',
            },
            content: {
              en: 'When an ERP rollout stalls, the instinct is to blame the platform. More often the cause is ordering: the team migrated the cleanest data first, deferred the messy operational records, and discovered the reconciliation gap during go-live. A better sequence starts with the record that causes the most manual correction, because that is where integration pays for itself first.',
              ar: 'حين يتعثر تنفيذ نظام تخطيط الموارد، يميل الفريق إلى لوم المنصة. والسبب غالبًا هو الترتيب: نقل الفريق البيانات الأنظف أولًا، وأجّل السجلات التشغيلية الفوضوية، ثم اكتشف فجوة التسوية أثناء الإطلاق. الترتيب الأفضل يبدأ بالسجل الذي يسبب أكثر تصحيح يدوي، لأن هناك يكون العائد من الدمج أولًا.',
            },
            cat: { en: 'Architecture', ar: 'البنية التحتية' },
            image: 'images/project-fintech.png',
            status: 'published',
            featured: false,
          },
          {
            id: 'blog-accessibility-default',
            title: { en: 'Treat accessibility as a default, not a review gate', ar: 'تعامل مع إمكانية الوصول كإعداد افتراضي لا كبوابة مراجعة' },
            excerpt: {
              en: 'Semantic HTML and visible focus cost nothing at the start and are expensive to retrofit.',
              ar: 'HTML الدلالي ووضوح التركيز لا يكلّفان شيئًا في البداية، وإضافتهما لاحقًا مكلفة.',
            },
            content: {
              en: 'Accessibility work is expensive when it happens after features ship, because the markup has to be unwound and rebuilt. Semantic elements, a visible focus ring, and a real heading order are decisions made once at the start. Teams that treat them as defaults ship accessible software without a separate audit phase; teams that treat them as a gate discover the cost at the worst possible time.',
              ar: 'يصبح عمل إمكانية الوصول مكلفًا إذا حدث بعد إطلاق الميزات، لأن البنية تحتاج إلى فك وإعادة بناء. العناصر الدلالية وحلقة تركيز واضحة وترتيب عناوين صحيح هي قرارات تُتخذ مرة واحدة في البداية. الفرق التي تعاملها كإعدادات افتراضية تسلّم برمجيات قابلة للوصول دون مرحلة تدقيق منفصلة، بينما التي تعاملها كبوابة تكتشف التكلفة في أسوأ وقت.',
            },
            cat: { en: 'Frontend', ar: 'الواجهات الأمامية' },
            image: 'images/project-retail.png',
            status: 'published',
            featured: false,
          },
        ],
        whitepapers: [
          {
            id: 'wp-ai-readiness',
            title: { en: 'The AI Readiness Assessment', ar: 'تقييم الجاهزية للذكاء الاصطناعي' },
            excerpt: {
              en: 'A structured framework for judging whether an organisation is ready to move an AI workload into production.',
              ar: 'إطار منظم لقياس جاهزية أي منظمة لنقل عبء عمل ذكاء اصطناعي إلى بيئة الإنتاج.',
            },
            content: {
              en: 'This assessment scores an organisation across four dimensions: data readiness, model fit, operational maturity, and governance. Each dimension carries a set of evidence-based questions, and the output is a prioritised list of gaps rather than a single score. It has been run with mid-market and enterprise clients across finance, healthcare, and logistics.',
              ar: 'يقيّم هذا التقييم المنشأة عبر أربعة أبعاد: جاهزية البيانات، ملاءمة النموذج، نضج العمليات، والحوكمة. يحمل كل بُعد مجموعة من الأسئلة القائمة على الأدلة، والمخرج قائمة مرتبة بالفجوات بدل درجة واحدة. تم تطبيقه مع عملاء من السوق المتوسط والمؤسسات في التمويل والرعاية الصحية والخدمات اللوجستية.',
            },
            cat: { en: 'Framework', ar: 'إطار عمل' },
            image: '',
            file: 'images/uploads/1789245338492-screenshot2026-09-12223520.webp',
            status: 'published',
            featured: true,
          },
          {
            id: 'wp-legacy-modernisation',
            title: { en: 'Modernising Legacy Systems Without a Rewrite', ar: 'تحديث الأنظمة القديمة دون إعادة كتابة' },
            excerpt: {
              en: 'A strangler-fig approach applied to three real modernisation programmes, with the trade-offs written down.',
              ar: 'تطبيق منهج الخنق على ثلاثة برامج تحديث حقيقية، مع تدوين المقايضات.',
            },
            content: {
              en: 'A rewrite carries a risk that rarely appears in the proposal: the old system keeps earning money for the whole duration, and the new one is not ready until the end. The strangler approach routes traffic incrementally and lets each slice be cancelled if it underperforms. We document three programmes where the incremental path delivered sooner and cost less than the rewrite estimate.',
              ar: 'تنطوي إعادة الكتابة على مخاطرة نادرًا ما تظهر في العرض: النظام القديم يواصل تحقيق الدخل طوال المدة، والجديد لا يصبح جاهزًا إلا في النهاية. يوجّه منهج الخنق الحركة تدريجيًا ويتيح إلغاء كل شريحة إذا كانت أقل من المتوقع. نوثّق ثلاثة برامج جعلها المسار التدريجي أسرع وأقل تكلفة من تقدير إعادة الكتابة.',
            },
            cat: { en: 'Architecture', ar: 'البنية التحتية' },
            image: '',
            file: 'images/uploads/1789245338492-screenshot2026-09-12223520.webp',
            status: 'published',
            featured: false,
          },
        ],
        downloads: [
          {
            id: 'download-ai-cost-calculator',
            title: { en: 'LLM Cost Calculator Spreadsheet', ar: 'حاسبة تكلفة النماذج اللغوية' },
            excerpt: {
              en: 'Model token pricing, context size, and cache hit rate in one sheet, so you can size a feature before writing it.',
              ar: 'أسعار رموز النماذج وحجم السياق ومعدل إصابة الذاكرة في ورقة واحدة، لتقدير حجم الميزة قبل كتابتها.',
            },
            content: {
              en: 'A working spreadsheet that turns a feature description into a monthly token bill. Enter the model, the context you intend to send, expected request volume, and realistic cache hit rate; it returns per-request cost, monthly cost, and the break-even point where caching pays for the engineering it costs.',
              ar: 'ورقة عمل عملية تحوّل وصف الميزة إلى فاتورة رموز شهرية. أدخل النموذج وحجم السياق الذي تنوي إرساله وحجم الطلبات المتوقع ومعدل إصابة الذاكرة الواقعي؛ لتعرض لك تكلفة الطلب الواحد والتكلفة الشهرية ونقطة التعادل التي يصبح عندها التخزين المؤقت يستحق هندسته.',
            },
            cat: { en: 'Toolkit', ar: 'أدوات' },
            image: '',
            file: 'images/uploads/1785011997196-screenshot2026-07-25233931.webp',
            status: 'published',
            featured: true,
          },
          {
            id: 'download-ai-readiness-checklist',
            title: { en: 'AI Readiness Checklist', ar: 'قائمة جاهزية الذكاء الاصطناعي' },
            excerpt: {
              en: 'The forty questions we ask before scoping an AI engagement, in a form you can run internally first.',
              ar: 'الأربعون سؤالًا التي نسألها قبل تحديد نطاق مشروع ذكاء اصطناعي، بصيغة يمكنك تشغيلها داخليًا أولًا.',
            },
            content: {
              en: 'Every AI engagement we scope starts with the same assessment. This checklist is that assessment, formatted so an internal team can run it and arrive at a defensible answer before a conversation with us. It is organised by the same four dimensions as the readiness whitepaper.',
              ar: 'يبدأ كل مشروع ذكاء اصطناعي نحدد نطاقه بالتقييم نفسه. هذه القائمة هي ذلك التقييم، مصاغة ليلتزم بها فريق داخلي وينفذها ليصل إلى إجابة قابلة للدفاع قبل الحديث إلينا. وهي منظمة حسب الأبعاد الأربعة نفسها في بحث الجاهزية.',
            },
            cat: { en: 'Toolkit', ar: 'أدوات' },
            image: '',
            file: 'images/uploads/1785011997196-screenshot2026-07-25233931.webp',
            status: 'published',
            featured: false,
          },
        ],
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
      { icon: 'stethoscope', title: 'Clinic Management', desc: 'Complete practice management with appointments, EHR, billing, and lab integration.', price: '$249/year' },
      { icon: 'graduation-cap', title: 'School ERP', desc: 'Student records, attendance, grades, scheduling, and parent communication.', price: '$299/year' },
      { icon: 'users', title: 'HR & Payroll', desc: 'Employee database, payroll processing, leave management, and performance tracking.', price: '$199/year' },
      { icon: 'package', title: 'Inventory System', desc: 'Real-time stock tracking, purchase orders, warehousing, and supplier management.', price: '$179/year' },
      { icon: 'shopping-cart', title: 'POS System', desc: 'Point of sale with order management, payments, receipts, and sales analytics.', price: '$149/year' },
      { icon: 'truck', title: 'Fleet Management', desc: 'Vehicle tracking, fuel management, maintenance scheduling, and driver logs.', price: '$279/year' },
    ]),
    pricing: JSON.stringify({
      eyebrow: { en: 'Pricing', ar: 'الأسعار' },
      title: { en: 'Transparent Pricing', ar: 'أسعار بسيطة وشفافة' },
      description: { en: 'No hidden fees. No surprises. Just great software.', ar: 'لا رسوم خفية. لا مفاجآت. فقط برمجيات رائعة.' },
      plans: [
        { id: 'starter', name: { en: 'Starter', ar: 'البدء' }, price: { en: '$150', ar: '$150' }, desc: { en: 'For small businesses & initial projects', ar: 'للشركات الصغيرة والمبادرات الأولية' }, features: { en: ['Up to 5 users', 'Email support', '1 database', 'Weekly reports'], ar: ['حتى 5 مستخدمين', 'دعم عبر البريد', 'قاعدة بيانات واحدة', 'تقارير أسبوعية'] }, popular: false, cta: { en: 'Get Started', ar: 'ابدأ الآن' } },
        { id: 'professional', name: { en: 'Professional', ar: 'محترف' }, price: { en: '$199', ar: '$199' }, desc: { en: 'For medium businesses & advanced solutions', ar: 'للشركات المتوسطة والحلول المتقدمة' }, features: { en: ['Up to 50 users', '24/7 support', 'Unlimited databases', 'Custom reports', 'Full API'], ar: ['حتى 50 مستخدمًا', 'دعم 24/7', 'قواعد بيانات غير محدودة', 'تقارير مخصصة', 'API متكامل'] }, popular: true, cta: { en: 'Get Started', ar: 'ابدأ الآن' } },
        { id: 'enterprise', name: { en: 'Enterprise', ar: 'مؤسسي' }, price: { en: '$250', ar: '$250' }, desc: { en: 'For enterprises & complex solutions', ar: 'للشركات الكبرى والحلول المعقدة' }, features: { en: ['Bespoke', 'Dedicated engineer', 'Flexible architecture', 'Premium support', 'Custom features', 'SLA guaranteed'], ar: ['خاص بك', 'مهندس مخصص', 'بنية مرنة', 'دعم متميز', 'ميزات مخصصة', 'ضمانات سحبية'] }, popular: false, cta: { en: 'Get Started', ar: 'ابدأ الآن' } },
      ],
    }),
    faq: JSON.stringify({
      eyebrow: { en: 'FAQ', ar: 'الأسئلة الشائعة' },
      title: { en: 'Frequently Asked Questions', ar: 'الأسئلة الشائعة' },
      description: { en: 'Everything you need to know about working with Noviq.', ar: 'كل ما تحتاج معرفته للعمل مع نوفيك.' },
      items: [
        { id: 'faq-tech', q: { en: 'What technologies does Noviq use?', ar: 'ما التقنيات التي تستخدمها نوفيك؟' }, a: { en: 'We work with React, Next.js, Node.js, TypeScript, Python, .NET, Docker, Kubernetes, AWS, Azure, Google Cloud, PostgreSQL, MongoDB, Redis, TensorFlow, PyTorch, and OpenAI.', ar: 'نعمل مع React وNext.js وNode.js وTypeScript وPython و.NET وDocker وKubernetes وAWS وAzure وGoogle Cloud وPostgreSQL وMongoDB وRedis وTensorFlow وPyTorch وOpenAI.' } },
        { id: 'faq-duration', q: { en: 'How long does a typical project take?', ar: 'كم تستغرق المشاريع عادةً؟' }, a: { en: 'Landing pages take 2-4 weeks, web or mobile MVPs take 6-12 weeks, and full ERP/CRM systems take 3-6 months.', ar: 'صفحات هبوط تأخذ 2-4 أسابيع، MVP ويب أو موبايل 6-12 أسبوعاً، وأنظمة ERP/CRM الكاملة 3-6 أشهر.' } },
        { id: 'faq-pricing', q: { en: 'What is your pricing model?', ar: 'ما نموذج التسعير لديكم؟' }, a: { en: 'Pricing depends on project scope with plans from Starter through Growth to Enterprise. We support milestone-based payments.', ar: 'يعتمد التسعير على نطاق المشروع مع خطط تبدأ من المبتدئين عبر النمو إلى المؤسسات.' } },
        { id: 'faq-support', q: { en: 'Do you offer post-launch support?', ar: 'هل تقدمون دعماً بعد الإطلاق؟' }, a: { en: 'Yes — ongoing support includes monitoring, bug fixes, updates, and upgrades, with SLAs up to 24/7 support.', ar: 'نعم — الدعم المستمر يشمل المراقبة وإصلاح الأخطاء والتحديثات، بعقود تصل إلى دعم 24/7.' } },
        { id: 'faq-team', q: { en: 'Can you work with our existing team?', ar: 'هل يمكنكم العمل مع فريقنا الحالي؟' }, a: { en: 'Absolutely. We offer dedicated teams and staff augmentation, and regularly integrate with in-house engineering teams.', ar: 'بالتأكيد. نقدم فرق مخصصة وتعزيزات، ونتكامل بانتظام مع فرق التكنولوجيا في العملاء.' } },
      ],
    }),
    careers: JSON.stringify({
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
    }),
    about: JSON.stringify({
      eyebrow: { en: 'About Noviq', ar: 'عن نوفيك' },
      title: { en: 'Engineering the Future Through Technology', ar: 'هندسة المستقبل بالتقنية' },
      description: { en: 'Global software & AI engineering company helping ambitious businesses grow since 2014.', ar: 'شركة برمجيات وذكاء اصطناعي عالمية تساعد الأعمال الطموحة على النمو منذ 2014.' },
      mission: { en: 'Ship software that moves business metrics.', ar: 'نسلّم برمجيات تحرّك مؤشرات الأعمال.' },
      vision: { en: 'A world where ambitious teams ship world-class software.', ar: 'عالم تطلق فيه الفرق الطموحة برمجيات عالمية المستوى.' },
      valuesEyebrow: { en: 'What we stand for', ar: 'مبادئنا وقيمنا' },
      valuesTitle: { en: 'Our Values', ar: 'قيمنا الجوهرية' },
      values: [
        { id: 'value-innovation', title: { en: 'Innovation First', ar: 'الابتكار أولاً' }, desc: { en: 'We engineer cutting-edge AI and software solutions that define what comes next.', ar: 'نبتكر حلول ذكاء اصطناعي وبرمجيات متقدمة تصنع المستقبل وتسبق العصر.' } },
        { id: 'value-quality', title: { en: 'Quality Obsession', ar: 'هاجس الجودة' }, desc: { en: 'Every line of code and architectural decision is engineered to the highest global standards.', ar: 'كل سطر برمجي وكل قرار معماري مصمم وفق أرقى المعايير العالمية.' } },
        { id: 'value-speed', title: { en: 'Speed & Precision', ar: 'السرعة والدقة' }, desc: { en: 'Rapid execution without compromise. We transform ambitious ideas into production platforms.', ar: 'سرعة في التنفيذ دون مساومة، محولين الأفكار الطموحة لمنصات إنتاجية متكاملة.' } },
        { id: 'value-client', title: { en: 'Client Impact', ar: 'أثر العميل والنتائج' }, desc: { en: 'We partner deeply with our clients to deliver measurable business impact and real ROI.', ar: 'نعمل كشركاء حقيقيين مع عملائنا لتحقيق عائد استثماري وأثر ملموس على الأعمال.' } },
        { id: 'value-scale', title: { en: 'Scalability & Resilience', ar: 'المرونة وقابلية التوسع' }, desc: { en: 'Enterprise cloud architectures engineered to support millions of users securely.', ar: 'بنية تحتية سحابية ومعمارية مؤسسية مصممة لتحمّل ملايين المستخدمين بأمان فائق.' } },
        { id: 'value-trust', title: { en: 'Transparency & Trust', ar: 'الشفافية والموثوقية' }, desc: { en: 'Clear communication, predictable delivery, and uncompromising security at every stage.', ar: 'تواصل شفاف، تسليم منضبط، والتزام صارم بأعلى معايير حماية البيانات والأمان.' } },
      ],
      sinceEyebrow: { en: 'Since 2014', ar: 'منذ عام 2014' },
      journeyTitle: { en: 'Our Journey', ar: 'محطات رحلتنا' },
      milestones: [
        { year: '2014', text: { en: 'Noviq founded as an elite software engineering studio focusing on high-performance web systems.', ar: 'تأسست نوفيك كاستوديو هندسي متخصص في بناء الأنظمة الرقمية عالية الأداء.' } },
        { year: '2016', text: { en: 'Expanded into custom enterprise ERP & CRM architectures for regional industry leaders.', ar: 'التوسع نحو بناء أنظمة ERP و CRM سحابية مخصصة لكبرى الشركات الإقليمية.' } },
        { year: '2018', text: { en: 'Passed 100 successful projects and established our dedicated AI & Machine Learning lab.', ar: 'تجاوز حاجز 100 مشروع ناجح وإطلاق مختبر الذكاء الاصطناعي وتعلّم الآلة المتخصص.' } },
        { year: '2021', text: { en: 'Pioneered automated multi-agent AI ecosystems and advanced cloud-native architectures.', ar: 'ابتكار بيئات عمل تعتمد على وكلاء الذكاء الاصطناعي والبنى السحابية الحديثة.' } },
        { year: '2023', text: { en: 'Expanded footprint across 32 countries with distributed engineering teams on three continents.', ar: 'توسيع النطاق العالمي للعمل عبر 32 دولة مع فرق هندسية متخصصة في ثلاث قارات.' } },
        { year: '2026', text: { en: '480+ enterprise projects delivered, 140+ long-term partners, driving the future of tech.', ar: 'أكثر من 480 مشروعاً مسلماً و140+ شريكاً استراتيجياً يقودون المستقبل بالتقنية.' } },
      ],
    }),
    pages: JSON.stringify({
      home: { enabled: true, labelEn: 'Home', labelAr: 'الرئيسية' },
      services: { enabled: true, labelEn: 'Services', labelAr: 'الخدمات' },
      industries: { enabled: true, labelEn: 'Industries', labelAr: 'القطاعات' },
      solutions: { enabled: true, labelEn: 'Solutions', labelAr: 'الحلول' },
      portfolio: { enabled: true, labelEn: 'Portfolio', labelAr: 'أعمالنا' },
      team: { enabled: true, labelEn: 'Our Team', labelAr: 'فريقنا' },
      about: { enabled: true, labelEn: 'About', labelAr: 'من نحن' },
      contact: { enabled: true, labelEn: 'Contact', labelAr: 'تواصل معنا' },
      pricing: { enabled: true, labelEn: 'Pricing', labelAr: 'الأسعار' },
      resources: { enabled: true, labelEn: 'Resources', labelAr: 'الموارد' },
      careers: { enabled: true, labelEn: 'Careers', labelAr: 'الوظائف' },
      faq: { enabled: true, labelEn: 'FAQ', labelAr: 'الأسئلة الشائعة' },
      why: { enabled: true, labelEn: 'Why Noviq', labelAr: 'لماذا نوفيك' },
      toolkit: { enabled: true, labelEn: 'Toolkit', labelAr: 'الأدوات' },
      builder: { enabled: true, labelEn: 'Solution Builder', labelAr: 'منشئ الحلول' },
      resource: { enabled: true, labelEn: 'API Docs', labelAr: 'وثائق API' },
      'ai-lab': { enabled: false, labelEn: 'AI Lab', labelAr: 'مختبر الذكاء الاصطناعي', note: 'Closed — retired from the site' },
      clients: { enabled: true, labelEn: 'Our Clients', labelAr: 'عملاؤنا' },
    }),
    typewriter: JSON.stringify({
      en: ['New Designs, Built to Impress', 'Next-Gen AI Platforms', 'Novel Software Engineering', 'No-Compromise Performance', 'Navigating Digital Futures', 'Nurturing Ideas Into Products', 'Network-Ready Enterprise Systems', 'Non-Stop Innovation Pipeline', 'Next-Level Cloud Architecture', 'Noviq — Engineering the Future', 'Native Intelligence, Deployed Fast'],
      ar: ['نصنع المستقبل بالتقنية', 'حلول ذكاء اصطناعي متقدمة', 'برمجيات مؤسسية موثوقة', 'تحول رقمي شامل', 'نوفيك — هندسة المستقبل', 'ابتكار بلا توقف', 'جودة عالمية بمعايير مؤسسية'],
    }),
    /* Hero visuals. Seeded with the values that were hardcoded in the
       components, so adding these keys changed nothing about the picture —
       it only moved where those numbers live.

       spinSpeed 0.115 is the value Hero.tsx passed explicitly. That is the
       one that was actually rendering: the component's own default was a
       different number and the explicit prop silently won, which is exactly
       why there were two sources of truth for the same dial. */
    heroBlackhole: JSON.stringify({
      spinSpeed: 0.115,
      orbitSpeed: 0,
      distance: 24,
      elevation: -5.5,
      roll: -20,
      fov: 42,
      diskInner: 3,
      diskOuter: 15,
      diskThickness: 0.26,
      diskDensity: 1,
      brightness: 2,
      glow: 1.72,
      exposure: 1.12,
      vignette: 0,
      doppler: 0.35,
      grain: 0.48,
      starBrightness: 0,
      hotColor: '#6AB8FF',
      midColor: '#FF8A1F',
      coolColor: '#7A2E06',
      spaceColor: '#122548',
      spaceColorDark: '#091122',
      steps: 260,
      resolution: 0.7,
      maxDpr: 1.5,
    }),
    /* Header + footer logo. `morph` is the behaviour that shipped: wordmark on
       load, collapsing to the mark 2.8s in, on desktop only.

       The artwork and sizes were also hardcoded — two paths and four pixel
       values, in the navbar and again in the footer — so they are seeded here
       with the values that were actually rendering. Paths are root-relative
       because the CMS stores uploads without a leading slash and a relative
       path resolves against the current route. */
    logo: JSON.stringify({
      wordmarkSrc: '/logo/noviq-wordmark.webp',
      markSrc: '/logo/noviq-icon.webp',
      wordmarkAlt: 'Noviq',
      markAlt: 'Noviq',
      showWordmarkDesktop: true,
      showMarkMobile: true,
      desktopEn: {
        mode: 'morph', morphAfterMs: 2800,
        wordmarkHeight: 56, markHeight: 40, maxWidth: 220,
        align: 'start', offsetX: 0,
      },
      /* Independent from English from the first day: same values, so the
         split changes nothing visually until someone picks otherwise. */
      desktopAr: {
        mode: 'morph', morphAfterMs: 2800,
        wordmarkHeight: 56, markHeight: 40, maxWidth: 220,
        align: 'start', offsetX: 0,
      },
      mobileEn: {
        mode: 'icon', morphAfterMs: 2800,
        wordmarkHeight: 56, markHeight: 40, maxWidth: 160,
        align: 'center', offsetX: 0,
      },
      mobileAr: {
        mode: 'icon', morphAfterMs: 2800,
        wordmarkHeight: 56, markHeight: 40, maxWidth: 160,
        align: 'center', offsetX: 0,
      },
      showInFooter: true,
      footerVariant: 'wordmark',
      footerHeight: 56,
      footerAlign: 'center',
      footerMaxWidth: 320,
      footerOffsetX: 0,
    }),
  };
  const insert = db.prepare('INSERT OR IGNORE INTO content (key, value) VALUES (?, ?)');
  for (const [k, v] of Object.entries(newKeys)) insert.run(k, v);

  /* Merge new default page slugs into an existing pages map so freshly
     added pages (e.g. clients) appear in the admin visibility table
     without wiping the admin's current on/off choices. */
  try {
    const pagesRow = db.prepare("SELECT value FROM content WHERE key = 'pages'").get();
    if (pagesRow) {
      const stored = JSON.parse(pagesRow.value);
      const seedPages = JSON.parse(newKeys.pages);
      let changed = false;
      for (const [slug, entry] of Object.entries(seedPages)) {
        if (!stored[slug]) { stored[slug] = entry; changed = true; }
      }
      if (changed) {
        db.prepare("UPDATE content SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = 'pages'").run(JSON.stringify(stored));
        console.log('[DB] Merged new pages into visibility map');
      }
    }
  } catch {}

  /* Migration: fill in settings keys that gained fields after they shipped.

     The seeds above use INSERT OR IGNORE, so a row that already exists is
     left exactly as it is. That is right for content the admin owns — it must
     never be overwritten — but wrong for a key that later grew a NEW field:
     the row simply never receives it. The site kept working because the
     frontend falls back to its own defaults, which hid the fact that the
     stored config was a partial description of what was actually rendering.

     So for the visual settings keys, add only the fields that are ABSENT.
     Nothing an admin has set is touched. */
  try {
    const additions = {
      heroBlackhole: {
        spinSpeed: 0.115, orbitSpeed: 0, distance: 24, elevation: -5.5, roll: -20,
        fov: 42, diskInner: 3, diskOuter: 15, diskThickness: 0.26, diskDensity: 1,
        brightness: 2, glow: 1.72, exposure: 1.12, vignette: 0, doppler: 0.35,
        grain: 0.48, starBrightness: 0,
        hotColor: '#6AB8FF', midColor: '#FF8A1F', coolColor: '#7A2E06',
        spaceColor: '#122548', spaceColorDark: '#091122',
        steps: 260, resolution: 0.7, maxDpr: 1.5,
      },
      logo: {
        showWordmarkDesktop: true, showMarkMobile: true,
        wordmarkSrc: '/logo/noviq-wordmark.webp', markSrc: '/logo/noviq-icon.webp',
        wordmarkAlt: 'Noviq', markAlt: 'Noviq',
        showInFooter: true, footerVariant: 'wordmark', footerHeight: 56,
        footerAlign: 'center', footerMaxWidth: 320, footerOffsetX: 0,
      },
    };
    for (const [key, defaults] of Object.entries(additions)) {
      const row = db.prepare('SELECT value FROM content WHERE key = ?').get(key);
      if (!row) continue;
      let stored;
      try { stored = JSON.parse(row.value); } catch { continue; }
      if (!stored || typeof stored !== 'object' || Array.isArray(stored)) continue;
      const missing = Object.keys(defaults).filter((k) => stored[k] === undefined);
      if (!missing.length) continue;
      for (const k of missing) stored[k] = defaults[k];
      db.prepare('UPDATE content SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?')
        .run(JSON.stringify(stored), key);
      console.log(`[DB] Added ${missing.length} missing field(s) to ${key}: ${missing.join(', ')}`);
    }
  } catch {}

  /* Migration: logo split into four independent contexts
     (desktopEn/desktopAr/mobileEn/mobileAr).

     Rows saved before the split hold one shared header plus Arabic/mobile
     extras. The conversion below bakes the EFFECTIVE values into independent
     slots — the same mapping as logoFromLegacy() in
     frontend/lib/hero-visual-content.ts, which is the renderer's source of
     truth (a test feeds both the same fixture). Anything the admin set is
     preserved; only absent pieces are filled, never overwritten. */
  try {
    const row = db.prepare("SELECT value FROM content WHERE key = 'logo'").get();
    if (row) {
      let stored = null;
      try { stored = JSON.parse(row.value); } catch { stored = null; }
      if (stored && typeof stored === 'object' && !Array.isArray(stored)) {
        const num = (v, fb) => (typeof v === 'number' && Number.isFinite(v) ? v : fb);
        const alignOf = (v, fb) => (v === 'center' || v === 'end' ? v : fb);
        const changed = [];
        const slotDefaults = {
          desktopEn: { mode: 'morph', morphAfterMs: 2800, wordmarkHeight: 56, markHeight: 40, maxWidth: 220, align: 'start', offsetX: 0 },
          desktopAr: { mode: 'morph', morphAfterMs: 2800, wordmarkHeight: 56, markHeight: 40, maxWidth: 220, align: 'start', offsetX: 0 },
          mobileEn: { mode: 'icon', morphAfterMs: 2800, wordmarkHeight: 56, markHeight: 40, maxWidth: 160, align: 'center', offsetX: 0 },
          mobileAr: { mode: 'icon', morphAfterMs: 2800, wordmarkHeight: 56, markHeight: 40, maxWidth: 160, align: 'center', offsetX: 0 },
        };
        /* From the legacy flat keys, exactly like the frontend converter —
           including its 56px wordmark bump (pre-split rows always rendered
           through a floored slot, so the bump preserves the look). */
        const legacyEn = {
          mode: ['wordmark', 'icon', 'morph'].includes(stored.mode) ? stored.mode : 'morph',
          morphAfterMs: num(stored.morphAfterMs, 2800),
          wordmarkHeight: Math.max(56, num(stored.headerWordmarkHeight, 40)),
          markHeight: num(stored.headerMarkHeight, 40),
          maxWidth: num(stored.headerMaxWidth, 220),
          align: alignOf(stored.headerAlign, 'start'),
          offsetX: num(stored.headerOffsetX, 0),
        };
        const legacyArAlign = ['start', 'center', 'end'].includes(stored.headerAlignAr)
          ? stored.headerAlignAr
          : legacyEn.align;
        const legacyAr = {
          ...legacyEn,
          align: legacyArAlign,
          offsetX: legacyEn.offsetX + num(stored.headerOffsetXAr, 0),
        };
        const legacyMobileBase = {
          mode: 'icon', morphAfterMs: legacyEn.morphAfterMs,
          wordmarkHeight: legacyEn.wordmarkHeight, markHeight: legacyEn.markHeight,
          maxWidth: 160, align: 'center', offsetX: 0,
        };
        const legacySlots = {
          desktopEn: legacyEn,
          desktopAr: legacyAr,
          mobileEn: { ...legacyMobileBase, offsetX: legacyEn.offsetX + num(stored.mobileOffsetX, 0) },
          mobileAr: { ...legacyMobileBase, offsetX: legacyAr.offsetX + num(stored.mobileOffsetX, 0) },
        };
        for (const ck of Object.keys(slotDefaults)) {
          if (stored[ck] === undefined || typeof stored[ck] !== 'object' || stored[ck] === null) {
            stored[ck] = legacySlots[ck];
            changed.push(ck);
          } else {
            for (const sk of Object.keys(slotDefaults[ck])) {
              if (stored[ck][sk] === undefined) {
                stored[ck][sk] = slotDefaults[ck][sk];
                changed.push(`${ck}.${sk}`);
              }
            }
          }
        }
        /* Pre-split rows always rendered through a 56px-floored slot, so a
           stored wordmark height below 56 painted 56. Bumping preserves the
           rendered look exactly — without it the split would visibly shrink
           those logos the moment the floor is removed from the frontend.

           This applies ONLY to rows that still carry the legacy flat keys: a
           value saved by the new editor is already exact and must never be
           touched. The flat keys are deleted afterwards, so the bump runs
           exactly once per row and can never override a deliberate choice. */
        const LEGACY_KEYS = ['mode', 'morphAfterMs', 'headerWordmarkHeight', 'headerMarkHeight',
          'headerAlign', 'headerMaxWidth', 'headerOffsetX',
          'headerAlignAr', 'headerOffsetXAr', 'mobileOffsetX'];
        const hadLegacy = LEGACY_KEYS.some((k) => stored[k] !== undefined);
        if (hadLegacy) {
          for (const ck of Object.keys(slotDefaults)) {
            if (stored[ck] && typeof stored[ck] === 'object' &&
                typeof stored[ck].wordmarkHeight === 'number' && stored[ck].wordmarkHeight < 56) {
              stored[ck].wordmarkHeight = 56;
              changed.push(`${ck}.wordmarkHeight→56`);
            }
          }
          for (const k of LEGACY_KEYS) delete stored[k];
          changed.push('legacy-flat-keys-removed');
        }
        if (changed.length) {
          db.prepare('UPDATE content SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?')
            .run(JSON.stringify(stored), 'logo');
          console.log(`[DB] Logo split migration: ${changed.join(', ')}`);
        }
      }
    }
  } catch {}

  /* Migration: footer link columns.
     The footer used to render two hardcoded columns; the CMS row still
     carries the retired `columns`/`social` arrays from that era, which
     nothing reads. `linkColumns` (added only when absent) describes the same
     two columns the site already renders, so the footer editor — and the
     site — change nothing until an admin rearranges them. The retired arrays
     are left exactly as they are. */
  try {
    const row = db.prepare("SELECT value FROM content WHERE key = 'footer'").get();
    if (row) {
      let stored = null;
      try { stored = JSON.parse(row.value); } catch { stored = null; }
      if (stored && typeof stored === 'object' && !Array.isArray(stored) && stored.linkColumns === undefined) {
        stored.linkColumns = [
          { id: 'company', hrefs: ['/about', '/careers', '/contact', '/why'] },
          { id: 'services', hrefs: ['/services', '/solutions', '/industries', '/portfolio'] },
        ];
        db.prepare('UPDATE content SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?')
          .run(JSON.stringify(stored), 'footer');
        console.log('[DB] Footer linkColumns added (columns/social legacy arrays kept)');
      }
    }
  } catch {}

  /* Migration: admin email column (admin login by username OR email) */
  try {
    const cols = db.prepare('PRAGMA table_info(admin_users)').all().map(c => c.name);
    if (!cols.includes('email')) {
      db.exec("ALTER TABLE admin_users ADD COLUMN email TEXT DEFAULT ''");
      console.log('[DB] Added email column to admin_users');
    }
  } catch {}

  /* Migration: client phone column (the dashboard profile editor writes it;
     older installs have the users table without it) */
  try {
    const cols = db.prepare('PRAGMA table_info(users)').all().map(c => c.name);
    if (!cols.includes('phone')) {
      db.exec("ALTER TABLE users ADD COLUMN phone TEXT DEFAULT ''");
      console.log('[DB] Added phone column to users');
    }
  } catch {}

  /* Migration: client avatar column (profile photo, relative uploads path) */
  try {
    const cols = db.prepare('PRAGMA table_info(users)').all().map(c => c.name);
    if (!cols.includes('avatar')) {
      db.exec("ALTER TABLE users ADD COLUMN avatar TEXT DEFAULT ''");
      console.log('[DB] Added avatar column to users');
    }
  } catch {}

  /* Migration: contract attachment column (scan/photo of the signed paper,
     uploaded through POST /admin/upload and picked in Client Projects) */
  try {
    const cols = db.prepare('PRAGMA table_info(contracts)').all().map(c => c.name);
    if (!cols.includes('file')) {
      db.exec("ALTER TABLE contracts ADD COLUMN file TEXT DEFAULT ''");
      console.log('[DB] Added file column to contracts');
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

/* ============================================================
   TESTIMONIALS — avatar support + Arabic + a fuller default set.

   Why this is a migration and not another `seedData` entry:
   `seedContent()` returns early on any non-empty `content` table, so
   changing the seed block above would only ever reach brand-new
   installs. Existing databases need the shape lifted in place.

   Both steps are NON-DESTRUCTIVE and idempotent:
     1. `testimonialsHeader` gains the missing keys only. A value the
        admin already typed is never overwritten.
     2. `testimonials` items gain an `img` key when they lack one.
        `img` is the exact key the admin media widget recognises
        (IMAGE_FIELD = /^(img|image|logo|photo|src|avatar)$/i), so once
        the key exists the dashboard renders an Upload button for the
        speaker's photo with no admin-panel change at all.
     3. The six extra quotes are appended ONLY while the array is still
        the original three seeded records, so a customised list is
        left alone. Re-running the migration is a no-op.
   ============================================================ */
const TESTIMONIAL_AVATARS = {
  'Elena Ruiz': 'images/testimonials/elena-ruiz.svg',
  'James Whitfield': 'images/testimonials/james-whitfield.svg',
  'Priya Nandakumar': 'images/testimonials/priya-nandakumar.svg',
};

const TESTIMONIAL_EXTRA = [
  {
    quote: 'They took over a codebase two other vendors had abandoned and had it in production inside a quarter.',
    quoteAr: 'استلموا كوداً تخلّى عنه مقاولان سابقان وأصبح جاهزاً للإنتاج خلال أقل من ثلاثة أشهر.',
    name: 'Daniel Okafor', nameAr: 'دانيال أوكافور',
    role: 'VP Engineering, Vertex Retail', roleAr: 'نائب رئيس الهندسة، Vertex Retail',
    img: 'images/testimonials/daniel-okafor.svg',
  },
  {
    quote: 'The first discovery call was sharper than any briefing we had written ourselves.',
    quoteAr: 'جلست الاستكشاف الأولى كانت أدق من أي موجز قمنا نحن بكتابته.',
    name: 'Sara Lindqvist', nameAr: 'سارة ليندكفيست',
    role: 'Chief Product Officer, Nimbus Cloud', roleAr: 'رئيسة المنتجات، Nimbus Cloud',
    img: 'images/testimonials/sara-lindqvist.svg',
  },
  {
    quote: 'Sixteen campuses, one platform, zero outages. Their team still trains ours.',
    quoteAr: 'ستة عشر حرماً جامعياً، منصة واحدة، دون أي انقطاع. وفريقهم ما زال يدرب فريقنا.',
    name: 'Omar Haddad', nameAr: 'عمر حداد',
    role: 'Managing Director, Orbit Education', roleAr: 'المدير التنفيذي، Orbit Education',
    img: 'images/testimonials/omar-haddad.svg',
  },
  {
    quote: 'They argued us out of a feature we asked for, and they were right.',
    quoteAr: 'ناقشونا وأقنعونا بعدم تنفيذ ميزة طلبناها، وكانوا على حق.',
    name: 'Aisha Rahman', nameAr: 'عائشة رحمن',
    role: 'Director of Digital, Pulse Media', roleAr: 'مديرة التحول الرقمي، Pulse Media',
    img: 'images/testimonials/aisha-rahman.svg',
  },
  {
    quote: 'Migration weekend, zero factory downtime. I have never seen that happen.',
    quoteAr: 'عطلة ترحيل كاملة دون أي توقّف في المصنع. لم أشهد مثل هذا من قبل.',
    name: 'Lucas Moreau', nameAr: 'لوكاس مورو',
    role: 'Head of Platform, Helix Manufacturing', roleAr: 'رئيس المنصة، Helix Manufacturing',
    img: 'images/testimonials/lucas-moreau.svg',
  },
  {
    quote: 'They rebuilt our ledger and passed every audit on the first submission.',
    quoteAr: 'أعادوا بناء دفتر حساباتنا واجتازوا كل التدقيقات من أول تقديم.',
    name: 'Mei Tanaka', nameAr: 'mei تاناكا',
    role: 'CTO, Solace Finance', roleAr: 'المديرة التقنية، Solace Finance',
    img: 'images/testimonials/mei-tanaka.svg',
  },
];

const TESTIMONIAL_SEED_NAMES = ['Elena Ruiz', 'James Whitfield', 'Priya Nandakumar'];

function migrateTestimonials() {
  try {
    /* --- 1. Header: fill the gaps the admin could never reach --- */
    const hRow = db.prepare('SELECT value FROM content WHERE key = ?').get('testimonialsHeader');
    if (hRow) {
      let header = {};
      try { header = JSON.parse(hRow.value) || {}; } catch { header = {}; }
      const headerFill = {
        desc: 'Six teams on what actually changed after shipping with Noviq.',
        descAr: 'ستة فرق تحكي ماذا تغيّر فعلياً بعد العمل مع نوفيك.',
        eyebrowAr: 'آراء العملاء',
        titleAr: 'أصوات عملائنا',
      };
      let headerChanged = false;
      for (const [k, v] of Object.entries(headerFill)) {
        if (typeof header[k] !== 'string' || !header[k].trim()) {
          header[k] = v;
          headerChanged = true;
        }
      }
      if (headerChanged) {
        db.prepare("UPDATE content SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = 'testimonialsHeader'")
          .run(JSON.stringify(header));
        console.log('[DB] testimonialsHeader: added desc + Arabic siblings');
      }
    }

    /* --- 2 & 3. List: avatar key, then the extra default quotes --- */
    const tRow = db.prepare('SELECT value FROM content WHERE key = ?').get('testimonials');
    if (!tRow) return;
    let list = [];
    try { list = JSON.parse(tRow.value) || []; } catch { return; }
    if (!Array.isArray(list) || !list.length) return;

    let changed = false;

    for (const item of list) {
      if (!item || typeof item !== 'object') continue;
      if (!('img' in item)) {
        item.img = TESTIMONIAL_AVATARS[item.name] || '';
        changed = true;
      }
    }

    const stillPristine = list.length === TESTIMONIAL_SEED_NAMES.length
      && TESTIMONIAL_SEED_NAMES.every((n, i) => list[i] && list[i].name === n);
    if (stillPristine) {
      for (const extra of TESTIMONIAL_EXTRA) {
        list.push({ quote: extra.quote, name: extra.name, role: extra.role, img: extra.img, quoteAr: extra.quoteAr, nameAr: extra.nameAr, roleAr: extra.roleAr });
      }
      changed = true;
    }

    if (changed) {
      db.prepare("UPDATE content SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = 'testimonials'")
        .run(JSON.stringify(list));
      console.log('[DB] testimonials: avatar field added' + (stillPristine ? ' + 6 default quotes appended' : ''));
    }
  } catch (err) {
    console.error('[DB] migrateTestimonials failed (content left untouched): ' + err.message);
  }
}
migrateTestimonials();

/* The contact form gained a phone input, so the `contact` document needs the
   label + placeholder keys before the admin can edit them — the object
   editor renders fields from Object.entries(), so a key that is not in the
   document has no input box at all. Fills gaps only; anything the admin has
   already written is left untouched. */
function migrateContactPhoneFields() {
  try {
    const row = db.prepare('SELECT value FROM content WHERE key = ?').get('contact');
    if (!row) return;
    let contact = {};
    try { contact = JSON.parse(row.value) || {}; } catch { return; }

    const fill = {
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
    };
    let changed = false;
    for (const [k, v] of Object.entries(fill)) {
      if (typeof contact[k] !== 'string' || !contact[k].trim()) {
        contact[k] = v;
        changed = true;
      }
    }
    if (changed) {
      db.prepare("UPDATE content SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = 'contact'")
        .run(JSON.stringify(contact));
      console.log('[DB] contact: added phone label/placeholder + form field labels');
    }
  } catch (err) {
    console.error('[DB] migrateContactPhoneFields failed (content left untouched): ' + err.message);
  }
}
migrateContactPhoneFields();

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

/* ---- Pricing + solutions catalogue refresh (2026-10) ----
   Plans move to the $150–$250 band and ready-made solutions switch from
   monthly to yearly billing. Runs ONLY when the stored rows still carry
   the previous defaults byte-for-byte: any admin customization (or a
   fresh seed, which already has the new values) is left untouched, so
   this can never overwrite a human edit. INSERT OR IGNORE means new
   installs never reach this code with stale data. */
function upgradeCataloguePricing() {
  try {
    const pricingRow = db.prepare("SELECT value FROM content WHERE key = 'pricing'").get();
    if (pricingRow) {
      const v = JSON.parse(pricingRow.value);
      const oldPrices = (v.plans || []).map((p) => p.price && p.price.en);
      if (JSON.stringify(oldPrices) === JSON.stringify(['$499', '$1,999', 'Custom'])) {
        const next = { $499: '$150', '$1,999': '$199', Custom: '$250' };
        for (const p of v.plans) {
          if (next[p.price.en]) { p.price.en = next[p.price.en]; p.price.ar = next[p.price.en]; }
          if (p.id === 'enterprise') { p.cta = { en: 'Get Started', ar: 'ابدأ الآن' }; }
        }
        db.prepare("UPDATE content SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = 'pricing'")
          .run(JSON.stringify(v));
        console.log('[DB] Migrated pricing plans to the $150–$250 band');
      }
    }
  } catch {}
  try {
    const solutionsRow = db.prepare("SELECT value FROM content WHERE key = 'solutions'").get();
    if (solutionsRow) {
      const arr = JSON.parse(solutionsRow.value);
      const oldPrices = arr.map((s) => s.price);
      if (JSON.stringify(oldPrices) === JSON.stringify(['$299/mo', '$399/mo', '$249/mo', '$199/mo', '$149/mo', '$349/mo'])) {
        const next = ['$249/year', '$299/year', '$199/year', '$179/year', '$149/year', '$279/year'];
        arr.forEach((s, i) => { s.price = next[i]; });
        db.prepare("UPDATE content SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = 'solutions'")
          .run(JSON.stringify(arr));
        console.log('[DB] Migrated solutions catalogue to yearly billing');
      }
    }
  } catch {}
}
upgradeCataloguePricing();

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

/* ---- Client portal (signed-in dashboard) ----
   projects / milestones / contracts / notifications for the signed-in
   client area. Defined in scripts/create-client-portal-schema.js because it
   is large enough to read on its own; the statement order matters — it runs
   AFTER seedSettings() so FK targets (users) already exist on a fresh
   database, and it is idempotent so a redeploy is a no-op.
   See that file for why these are new tables rather than columns on the
   existing lead-capture tables. */
try {
  require('../scripts/create-client-portal-schema').createPortalSchema(db);
} catch (err) {
  /* Must not take the whole server down: the portal degrades to "no data"
     and the public site keeps working. Log loudly so it is diagnosable. */
  console.warn('[DB] Client portal schema skipped:', err.message);
}

module.exports = db;
