/* ============================================================
   NOVIQ API — PUBLIC ROUTES (no auth except where noted)
   health · contact · newsletter · assessment · consultation ·
   solution-builder · content · imagegen
   Contracts: contracts/api/{health,contact,newsletter,assessment,
   consultation,solutionbuilder,content,imagegen}.*
   ============================================================ */
const { Router } = require('express');
const db = require('../db/init');
const { adminAuthMiddleware: authMiddleware } = require('../middleware/auth');
const { notifyNewLead } = require('../lib/mailer');
const { createLimiter } = require('../config/rate-limit');
const { transformPrompt, imageVariants } = require('../services/image-generation');
const config = require('../config');
const { EMAIL_PATTERN, pageParams, getPublicContent, getDictionary, I18N_LOCALES } = require('./_shared');

const router = Router();

/* Image generation is expensive upstream, so it gets its own strict limiter.
   The real limit is configurable at runtime (settings keys `rl_imagegen`); the
   default is 1 request / 60s per IP. */
const imageLimiter = createLimiter('imagegen');

/* ============================================================
   1. HEALTH CHECK
   ============================================================ */

router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

/* ============================================================
   2. CONTACT FORM
   ============================================================ */

/* Phone is optional. Sanitised rather than merely length-checked: the value
   is attacker-controlled free text that ends up in the admin table and in an
   email, so anything that is not a plausible dialling character is dropped.
   That also normalises the "smart quotes / full-width digits / RTL marks"
   that Arabic keyboards and phone apps routinely paste in. */
const MAX_PHONE = 40;
function cleanPhone(raw) {
  if (typeof raw !== 'string') return '';
  return raw.replace(/[^\d+()\-. ]/g, '').replace(/\s+/g, ' ').trim().slice(0, MAX_PHONE);
}

router.post('/contact', (req, res) => {
  const { name, email, company, message, phone } = req.body;

  if (!name || !email || !message) {
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Name, email, and message are required.' } });
  }
  if (!EMAIL_PATTERN.test(email)) {
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid email address.' } });
  }
  if (message.length > 5000) {
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Message too long (max 5000 characters).' } });
  }
  /* Phone is optional and is NEVER a reason to fail the submission. It is
     sanitised to diallable characters and capped; whatever is left is
     stored. A visitor who types "call me" loses the digits, but a visitor
     whose phone field is malformed must NOT lose their message — a 400
     here would discard a real lead over an optional field. The value only
     ever reaches an admin table cell and a tel: href, both escaped, so
     there is nothing to reject for. */
  const phoneValue = cleanPhone(phone);

  try {
    const result = db.prepare(
      'INSERT INTO contacts (name, email, phone, company, message) VALUES (?, ?, ?, ?, ?)'
    ).run(name.trim(), email.trim().toLowerCase(), phoneValue, (company || '').trim(), message.trim());

    notifyNewLead('contact message', { name, email, phone: phoneValue, company, message: message.slice(0, 500) });

    res.status(201).json({
      id: result.lastInsertRowid,
      message: 'Message sent successfully. We will get back to you within one business day.',
    });
  } catch (err) {
    console.error('[Contact] Error:', err.message);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to send message. Please try again.' } });
  }
});

router.get('/contact', authMiddleware, (req, res) => {
  const { status } = req.query;
  const { limit, offset } = pageParams(req);
  let query = 'SELECT * FROM contacts';
  const params = [];

  if (status) {
    query += ' WHERE status = ?';
    params.push(status);
  }

  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  res.json(db.prepare(query).all(...params));
});

router.patch('/contact/:id/status', authMiddleware, (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  const validStatuses = ['new', 'read', 'replied', 'archived'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: `Status must be one of: ${validStatuses.join(', ')}` } });
  }

  const result = db.prepare(
    'UPDATE contacts SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
  ).run(status, id);

  if (result.changes === 0) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Contact not found.' } });
  res.json({ id: parseInt(id), status });
});

router.delete('/contact/:id', authMiddleware, (req, res) => {
  const result = db.prepare('DELETE FROM contacts WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Contact not found.' } });
  res.json({ message: 'Contact deleted.' });
});

/* ============================================================
   3. NEWSLETTER
   ============================================================ */

router.post('/newsletter/subscribe', (req, res) => {
  const { email } = req.body;

  if (!email) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Email is required.' } });
  if (!EMAIL_PATTERN.test(email)) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid email address.' } });

  try {
    const existing = db.prepare('SELECT id, active FROM newsletter WHERE email = ?').get(email.trim().toLowerCase());

    if (existing) {
      if (existing.active) return res.json({ message: 'Already subscribed.', subscribed: true });
      db.prepare('UPDATE newsletter SET active = 1, subscribed_at = CURRENT_TIMESTAMP WHERE id = ?').run(existing.id);
      return res.json({ message: 'Re-subscribed successfully.', subscribed: true });
    }

    const result = db.prepare('INSERT INTO newsletter (email) VALUES (?)').run(email.trim().toLowerCase());
    res.status(201).json({ id: result.lastInsertRowid, message: 'Subscribed successfully.', subscribed: true });
  } catch (err) {
    console.error('[Newsletter] Error:', err.message);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to subscribe. Please try again.' } });
  }
});

router.post('/newsletter/unsubscribe', (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Email is required.' } });

  const result = db.prepare('UPDATE newsletter SET active = 0 WHERE email = ?').run(email.trim().toLowerCase());
  if (result.changes === 0) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Email not found.' } });
  res.json({ message: 'Unsubscribed successfully.', subscribed: false });
});

router.get('/newsletter', authMiddleware, (req, res) => {
  const { active } = req.query;
  const { limit, offset } = pageParams(req);
  let query = 'SELECT * FROM newsletter';
  const params = [];

  if (active !== undefined) {
    query += ' WHERE active = ?';
    params.push(parseInt(active));
  }

  query += ' ORDER BY subscribed_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  res.json(db.prepare(query).all(...params));
});

router.delete('/newsletter/:id', authMiddleware, (req, res) => {
  const result = db.prepare('DELETE FROM newsletter WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Subscriber not found.' } });
  res.json({ message: 'Subscriber deleted.' });
});

/* ============================================================
   4. ASSESSMENT QUIZ
   ============================================================ */

router.post('/assessment', (req, res) => {
  const { name, email, company, answers, score, level } = req.body;
  if (!answers) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Answers are required.' } });

  try {
    const answersStr = typeof answers === 'object' ? JSON.stringify(answers) : answers;
    const result = db.prepare(
      'INSERT INTO assessments (name, email, company, answers, score, level) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(
      (name || '').trim(),
      (email || '').trim(),
      (company || '').trim(),
      answersStr,
      score || 0,
      level || ''
    );

    res.status(201).json({
      id: result.lastInsertRowid,
      score: score || 0,
      level: level || '',
      message: 'Assessment submitted successfully.',
    });
  } catch (err) {
    console.error('[Assessment] Error:', err.message);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to submit assessment.' } });
  }
});

router.get('/assessment', authMiddleware, (req, res) => {
  const { limit, offset } = pageParams(req);
  res.json(db.prepare(
    'SELECT * FROM assessments ORDER BY created_at DESC LIMIT ? OFFSET ?'
  ).all(limit, offset));
});

router.get('/assessment/:id', authMiddleware, (req, res) => {
  const assessment = db.prepare('SELECT * FROM assessments WHERE id = ?').get(req.params.id);
  if (!assessment) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Assessment not found.' } });
  res.json(assessment);
});

/* ============================================================
   5. CONSULTATION REQUESTS
   ============================================================ */

router.post('/consultation', (req, res) => {
  const { name, email, company, industry, budget, timeline, message } = req.body;
  if (!name || !email) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Name and email are required.' } });

  try {
    const result = db.prepare(
      'INSERT INTO consultations (name, email, company, industry, budget, timeline, message) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(
      name.trim(),
      email.trim().toLowerCase(),
      (company || '').trim(),
      (industry || '').trim(),
      (budget || '').trim(),
      (timeline || '').trim(),
      (message || '').trim()
    );

    res.status(201).json({
      id: result.lastInsertRowid,
      message: 'Consultation request submitted. We will contact you shortly.',
    });
  } catch (err) {
    console.error('[Consultation] Error:', err.message);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to submit consultation request.' } });
  }
});

router.get('/consultation', authMiddleware, (req, res) => {
  const { status } = req.query;
  const { limit, offset } = pageParams(req);
  let query = 'SELECT * FROM consultations';
  const params = [];

  if (status) {
    query += ' WHERE status = ?';
    params.push(status);
  }

  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  res.json(db.prepare(query).all(...params));
});

router.patch('/consultation/:id/status', authMiddleware, (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  const validStatuses = ['new', 'contacted', 'scheduled', 'completed', 'archived'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: `Status must be one of: ${validStatuses.join(', ')}` } });
  }

  const result = db.prepare('UPDATE consultations SET status = ? WHERE id = ?').run(status, id);
  if (result.changes === 0) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Consultation not found.' } });
  res.json({ id: parseInt(id), status });
});

/* ============================================================
   6. SOLUTION BUILDER
   ============================================================ */

router.post('/solution-builder', (req, res) => {
  const { name, email, company, steps, summary } = req.body;
  if (!steps) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Steps data is required.' } });

  try {
    const stepsStr = typeof steps === 'object' ? JSON.stringify(steps) : steps;
    const result = db.prepare(
      'INSERT INTO solution_builds (name, email, company, steps, summary) VALUES (?, ?, ?, ?, ?)'
    ).run(
      (name || '').trim(),
      (email || '').trim(),
      (company || '').trim(),
      stepsStr,
      (summary || '').trim()
    );

    res.status(201).json({
      id: result.lastInsertRowid,
      message: 'Solution build saved successfully.',
    });
  } catch (err) {
    console.error('[SolutionBuilder] Error:', err.message);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to save solution build.' } });
  }
});

router.get('/solution-builder', authMiddleware, (req, res) => {
  const { limit, offset } = pageParams(req);
  res.json(db.prepare(
    'SELECT * FROM solution_builds ORDER BY created_at DESC LIMIT ? OFFSET ?'
  ).all(limit, offset));
});

router.get('/solution-builder/:id', authMiddleware, (req, res) => {
  const build = db.prepare('SELECT * FROM solution_builds WHERE id = ?').get(req.params.id);
  if (!build) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Solution build not found.' } });
  res.json(build);
});

/* ============================================================
   7. PUBLIC SITE CONTENT
   ============================================================ */

router.get('/content', (req, res) => {
  try { res.json(getPublicContent()); }
  catch (err) {
    console.error('[Content API] Error:', err.message);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to load content.' } });
  }
});

router.get('/content/services', (req, res) => {
  try { res.json(getPublicContent().services || []); } catch { res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to load services.' } }); }
});

router.get('/content/industries', (req, res) => {
  try { res.json(getPublicContent().industries || []); } catch { res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to load industries.' } }); }
});

router.get('/content/projects', (req, res) => {
  try { res.json(getPublicContent().projects || []); } catch { res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to load projects.' } }); }
});

router.get('/content/testimonials', (req, res) => {
  try { res.json(getPublicContent().testimonials || []); } catch { res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to load testimonials.' } }); }
});

router.get('/content/stats', (req, res) => {
  try { res.json(getPublicContent().stats || []); } catch { res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to load stats.' } }); }
});

router.get('/content/brand', (req, res) => {
  try { res.json(getPublicContent().brand || {}); } catch { res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to load brand.' } }); }
});

router.get('/content/hero', (req, res) => {
  try { res.json(getPublicContent().hero || {}); } catch { res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to load hero.' } }); }
});

router.get('/content/team', (req, res) => {
  try { res.json(getPublicContent().team || {}); } catch { res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to load team.' } }); }
});

/* Resources — the Knowledge Hub. Same shape the admin editor writes:
   { hero, tabs[], items{ [tabId]: [...] } }. The public site does its own
   draft filtering and localization, so the raw CMS document is served as-is
   (same contract as /content/team). */
router.get('/content/resources', (req, res) => {
  try { res.json(getPublicContent().resources || {}); } catch { res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to load resources.' } }); }
});

/* CMS-driven pages (pricing / faq / careers / about) + site page visibility.
   Raw CMS documents served as-is; the Next.js libs do localization and
   fallback to the static seed when the API is offline. */
router.get('/content/pricing', (req, res) => {
  try { res.json(getPublicContent().pricing || {}); } catch { res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to load pricing.' } }); }
});

router.get('/content/faq', (req, res) => {
  try { res.json(getPublicContent().faq || {}); } catch { res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to load faq.' } }); }
});

router.get('/content/careers', (req, res) => {
  try { res.json(getPublicContent().careers || {}); } catch { res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to load careers.' } }); }
});

router.get('/content/about', (req, res) => {
  try { res.json(getPublicContent().about || {}); } catch { res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to load about.' } }); }
});

/* Login / signup copy. Flat `field` + `fieldAr` pairs, like the other
   bilingual CMS blocks, so the admin owns every string on those two pages
   instead of them living in the page source. */
router.get('/content/auth', (req, res) => {
  try { res.json(getPublicContent().auth || {}); } catch { res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to load auth copy.' } }); }
});

router.get('/content/solutions', (req, res) => {
  try { res.json(getPublicContent().solutions || []); } catch { res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to load solutions.' } }); }
});


router.get('/content/contact', (req, res) => {
  try { res.json(getPublicContent().contact || {}); } catch { res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to load contact.' } }); }
});

router.get('/content/footer', (req, res) => {
  try { res.json(getPublicContent().footer || {}); } catch { res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to load footer.' } }); }
});

router.get('/content/pages', (req, res) => {
  try { res.json(getPublicContent().pages || {}); } catch { res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to load pages.' } }); }
});

router.get('/content/typewriter', (req, res) => {
  try { res.json(getPublicContent().typewriter || {}); } catch { res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to load typewriter.' } }); }
});

/* Hero visuals. Public by necessity, not by accident: the black hole is a
   dynamic import with ssr:false, so it is configured from the browser, and
   the logo decides the header layout before anything is painted. Neither
   key holds anything private — they are numbers and colour codes the admin
   already set in a public-facing dashboard.

   Values are still clamped on read in the frontend
   (lib/hero-visual-content.ts), so a row that somehow got stored out of
   range cannot reach the shader. */
router.get('/content/heroBlackhole', (req, res) => {
  try { res.json(getPublicContent().heroBlackhole || {}); } catch { res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to load hero visual settings.' } }); }
});

router.get('/content/logo', (req, res) => {
  try { res.json(getPublicContent().logo || {}); } catch { res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to load logo settings.' } }); }
});

/* The origin of the Next app.
   The CMS stores logo artwork as a path on the FRONTEND (/logo/…, or
   images/uploads/…), but the admin panel is served from this API origin and
   /logo/… 404s here — so the artwork preview showed an empty box and a
   paragraph explaining why, which is a poor way to discover what the current
   logo looks like.

   The backend already knows this origin: FRONTEND_REVALIDATE_URL is where it
   pings after every content save, and CORS_ORIGINS is derived from
   FRONTEND_URL. It is not secret — it is the public website address — so it is
   safe to hand to the dashboard, and doing so is what lets a relative path
   resolve to a real image instead of a dead one. */
router.get('/site-config', (req, res) => {
  res.json({
    frontendOrigin: config.FRONTEND_REVALIDATE_URL,
    /* Anything else the dashboard needs to resolve a stored asset. */
    uploadsPath: 'images/uploads',
  });
});

/* ============================================================
   RUNTIME TRANSLATIONS (public, no auth)
   ------------------------------------------------------------
   Serves the live dictionary the admin Translations tab writes, straight from
   the `content` table through the shared getDictionary() helper in
   routes/_shared.js — the same helper PUT /api/admin/i18n/:locale writes
   through, so reader and writer cannot drift apart.

   Because the dictionary now lives in the database, this endpoint also works
   on an API-only host with no frontend checkout: the old 501 "translations
   live in the frontend folder" failure mode is gone.

   Unauthenticated on purpose — it is the site reading its own dictionary, so
   a save shows up within the frontend's revalidate window (or immediately: an
   admin save also pings /api/revalidate) instead of needing a rebuild.

   No Cache-Control header is set here: the frontend owns its own revalidate
   window and a cached copy would serve stale copy.

   Contract:
     GET /api/content/i18n/en  -> 200 { locale, value }
     GET /api/content/i18n/fr  -> 400 VALIDATION_ERROR
     nothing stored at all     -> 404 NOT_FOUND
     unreadable                -> 500 INTERNAL_ERROR
   ============================================================ */

router.get('/content/i18n/:locale', (req, res) => {
  const locale = String(req.params.locale || '').toLowerCase();
  if (!I18N_LOCALES.has(locale)) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Locale must be en or ar.' } });
  try {
    const value = getDictionary(locale);
    if (!value) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'No dictionary stored for this locale.' } });
    res.json({ locale, value });
  } catch (err) {
    /* Log the cause server-side, but return the same clean message the
       other content routes use — raw DB/JSON errors must not reach a
       public endpoint. */
    console.error('[i18n] Failed to read ' + locale + ': ' + err.message);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to load translations.' } });
  }
});

/* Aggregated homepage bundle — one round-trip for the whole landing page.
   Raw CMS documents served as-is; the Next.js home-content lib resolves
   locale + fallbacks. Keys: brand, hero, nav, servicesHeader, services,
   whyHeader, why, industriesHeader, industries, portfolioHeader, projects,
   processHeader, process, testimonialsHeader, testimonials, stats,
   clientsHeader, clients, stackHeader, contact, footer. */
router.get('/content/home', (req, res) => {
  try {
    const all = getPublicContent();
    const pick = (k) => (all[k] !== undefined ? all[k] : null);
    res.json({
      brand: pick('brand'),
      hero: pick('hero'),
      servicesHeader: pick('servicesHeader'),
      services: pick('services'),
      whyHeader: pick('whyHeader'),
      why: pick('why'),
      industriesHeader: pick('industriesHeader'),
      industries: pick('industries'),
      portfolioHeader: pick('portfolioHeader'),
      projects: pick('projects'),
      processHeader: pick('processHeader'),
      process: pick('process'),
      testimonialsHeader: pick('testimonialsHeader'),
      testimonials: pick('testimonials'),
      stats: pick('stats'),
      clientsHeader: pick('clientsHeader'),
      clients: pick('clients'),
      contact: pick('contact'),
      footer: pick('footer'),
      typewriter: pick('typewriter'),
    });
  } catch { res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to load home content.' } }); }
});

/* ============================================================
   8. USER AUTH — register / login / password reset
   ============================================================ */

router.get('/imagegen', imageLimiter, async (req, res) => {
  const q = String(req.query.prompt || '').trim().slice(0, 480);
  if (!q) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Prompt is required.' } });
  const transformed = transformPrompt(q);
  if (!transformed) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Prompt contains blocked content.' } });

  const seed = parseInt(req.query.seed, 10) || Math.floor(Math.random() * 99999);

  const variants = imageVariants(transformed, seed);

  for (const v of variants) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), v.timeout);
    try {
      const upstream = await fetch(v.url, {
        signal: controller.signal,
        headers: { 'User-Agent': 'noviq-backend/1.0' },
      });
      clearTimeout(timer);
      if (!upstream.ok) continue;

      const type = upstream.headers.get('content-type') || '';
      if (!type.startsWith('image/')) continue;

      const buffer = Buffer.from(await upstream.arrayBuffer());
      if (buffer.length < 1024) continue;

      res.setHeader('Content-Type', type);
      res.setHeader('Cache-Control', 'public, max-age=86400');
      return res.send(buffer);
    } catch (err) {
      clearTimeout(timer);
      console.warn('[ImageGen] Variant failed:', err.name === 'AbortError' ? 'timeout' : err.message);
    }
  }

  res.status(502).json({ error: { code: 'UPSTREAM_ERROR', message: 'Image generation failed upstream. Try again shortly.' } });
});

/* ============================================================
   12. ADMIN — SESSION (login / logout / me / password)
   ============================================================ */

module.exports = router;
