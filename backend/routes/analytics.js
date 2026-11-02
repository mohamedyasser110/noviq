/* ============================================================
   NOVIQ API — VISIT ANALYTICS + LIVE SITE MONITOR
   Contracts: contracts/api/analytics.* + sitemonitor.get
   ============================================================ */
const { Router } = require('express');
const db = require('../db/init');
const { adminAuthMiddleware: authMiddleware } = require('../middleware/auth');
const siteMonitor = require('../services/site-monitor');

const router = Router();

router.post('/analytics/visit', (req, res) => {
  const visitPath = String(req.body.path || '/').slice(0, 100);
  const language = String(req.body.language || 'en').slice(0, 5);
  const visitorId = String(req.body.visitorId || '').slice(0, 64);
  const day = new Date().toISOString().slice(0, 10);
  /* persistent daily aggregate (unchanged) */
  db.prepare(`
    INSERT INTO visits (day, path, language, count) VALUES (?, ?, ?, 1)
    ON CONFLICT(day, path, language) DO UPDATE SET count = count + 1
  `).run(day, visitPath, language);
  /* live in-memory traffic monitor (public + admin views) */
  siteMonitor.recordVisit(visitorId, visitPath, language);
  res.json({ ok: true });
});

/* Public live traffic — feeds the site's #/monitor page (sanitized) */

router.get('/analytics/live', (req, res) => {
  res.json(siteMonitor.snapshotPublic());
});

/* Admin live traffic — richer snapshot (auth only) */

router.get('/admin/site-monitor', authMiddleware, (req, res) => {
  res.json(siteMonitor.snapshotAdmin());
});

/* ============================================================
   ADMIN — SYSTEM LOG (separate from chat log; export/delete)
   ------------------------------------------------------------
   GET    /api/admin/logs          → recent entries
   GET    /api/admin/logs/export   → CSV download
   DELETE /api/admin/logs          → clear all
   DELETE /api/admin/logs/:id      → delete one
   ============================================================ */

module.exports = router;
