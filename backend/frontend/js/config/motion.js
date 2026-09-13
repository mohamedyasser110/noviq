/* ============================================================
   NOVIQ MOTION CONFIG — admin-controlled animation policy
   ------------------------------------------------------------
   Reads settings injected by backend into window.NOVIQ_SETTINGS
   and resolves a single effective motion profile used across
   the engine files (cursor, intro, hero3d, reveal, ...).

   Modes:
     'full'                  → all animations enabled
     'auto-reduce-low-tier'  → reduce on low/mid device tiers
     'always-reduce'         → force reduced motion everywhere
     'off'                   → disable heavy animations entirely
   reductionLevel: 0-100 (how aggressive the reduction is)
   ============================================================ */

const MotionConfig = (() => {
  const settings = (typeof window !== 'undefined' && window.NOVIQ_SETTINGS && window.NOVIQ_SETTINGS.motion) || {};
  const mode = settings.mode || 'auto-reduce-low-tier';
  const reductionLevel = Math.min(100, Math.max(0, parseInt(settings.reductionLevel, 10) || 50));

  /* User OS preference (prefers-reduced-motion) */
  const userPrefersReduced = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  /* Device tier (set by utils.js or default 'high') */
  const tier = (typeof window !== 'undefined' && window._deviceTier) || 'high';
  const isLowTier = tier === 'low';
  const isMidTier = tier === 'mid';

  /* Resolve effective state */
  let effectiveMode = mode;
  if (mode === 'auto-reduce-low-tier' && (isLowTier || isMidTier)) {
    effectiveMode = 'reduced';
  } else if (mode === 'always-reduce') {
    effectiveMode = 'reduced';
  } else if (mode === 'off') {
    effectiveMode = 'off';
  } else if (mode === 'full') {
    effectiveMode = userPrefersReduced ? 'reduced' : 'full';
  }

  /* If user explicitly prefers reduced motion at OS level, respect it
     even in 'full' or 'auto-reduce-low-tier' modes. */
  if (userPrefersReduced && effectiveMode === 'full') {
    effectiveMode = 'reduced';
  }

  /* reductionLevel 0-100 → speed multiplier 1.0 down to 0.2 */
  const speedMultiplier = effectiveMode === 'reduced'
    ? (1.0 - (reductionLevel / 100) * 0.8)
    : 1.0;

  /* Particle count factor: 1.0 (full) down to 0.1 (max reduction) */
  const particleFactor = effectiveMode === 'reduced'
    ? Math.max(0.1, 1.0 - (reductionLevel / 100) * 0.7)
    : (effectiveMode === 'off' ? 0 : 1.0);

  return {
    mode,
    reductionLevel,
    effectiveMode,        /* 'full' | 'reduced' | 'off' */
    userPrefersReduced,
    tier,
    speedMultiplier,      /* animations run at this fraction of normal speed */
    particleFactor,       /* scale particle counts by this */
    isReduced: effectiveMode === 'reduced',
    isOff: effectiveMode === 'off',
    /* Convenience flags per system */
    enableCursor: effectiveMode !== 'off',
    cursorTrailCount: effectiveMode === 'off' ? 0
      : effectiveMode === 'reduced' ? Math.max(0, Math.round((tier === 'high' ? 5 : tier === 'mid' ? 2 : 0) * particleFactor))
      : (tier === 'high' ? 5 : tier === 'mid' ? 2 : 0),
    enableIntro: effectiveMode !== 'off',
    enableHero3D: effectiveMode !== 'off',
    enableReveal: effectiveMode !== 'off',
    enableParallax: effectiveMode !== 'off',
    enableGlowBlob: effectiveMode !== 'off',
  };
})();

if (typeof window !== 'undefined') window.MotionConfig = MotionConfig;
