/* ============================================================
   NOVIQ API — ROUTE REGISTRY (mount-only, no handlers here)
   ------------------------------------------------------------
   Was ONE 1577-line file; split 2026-09-25 (contract-first arch pass)
   into one module per area. Every endpoint keeps its exact method +
   path (verified 79/79 against contracts/api/*.json). Mount order
   matches the original registration order; overlapping patterns
   (chats-export before chats/:sessionId, content/keys before
   content/:key) stay inside the same module in original order.
   app.js mounts this file once under /api.
   ============================================================ */
const { Router } = require('express');

const publicRoutes = require('./public');
const authRoutes = require('./auth');
const analyticsRoutes = require('./analytics');
const adminRoutes = require('./admin');
const portalRoutes = require('./portal');

/* The chatbot was removed from the site on 2026-09-27 and its module deleted
   with it, so it is no longer mounted. The public surface is now
   public → auth → analytics → admin → portal. The chat LOGS endpoints
   (/admin/chats*) are unaffected: they live in admin.js and are a separate
   admin feature, not the chatbot. */
const router = Router();
router.use(publicRoutes);
router.use(authRoutes);
router.use(analyticsRoutes);
router.use(adminRoutes);
/* Mounted AFTER adminRoutes on purpose: both define /admin/* paths, and
   Express takes the first match. Nothing here overlaps admin.js today, but
   ordering it last means a future collision degrades to "admin wins" rather
   than silently shadowing an admin route with a portal one. */
router.use(portalRoutes);

module.exports = router;
