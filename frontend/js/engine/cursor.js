/* ============================================================
   CUSTOM CURSOR — dot + ring + fading trail (desktop only)
   ============================================================ */

function initCursor() {
  try {
    if (!window.matchMedia || !matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    if (!document.body) return;
    const cfg = (typeof MotionConfig !== 'undefined') ? MotionConfig : null;
    if (cfg && !cfg.enableCursor) return;
    /* Full fallback: never hide the native cursor unless the custom
       circle is actually created and visible. The CSS only applies
       cursor:none under body.has-custom-cursor. */
  const tier = window._deviceTier || 'high';
  const reducedMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  const dot = document.createElement('div'); dot.className = 'noviq-cursor-dot';
  const ring = document.createElement('div'); ring.className = 'noviq-cursor-ring';
  document.body.append(dot, ring);

  /* Verify the circle actually rendered before hiding the native cursor.
     If anything fails, the class is never added and the normal cursor stays. */
  if (!document.body.contains(dot) || !document.body.contains(ring)) return;
  document.body.classList.add('has-custom-cursor');

  /* Watchdog: if the cursor elements get removed or hidden (ad-block,
     CSS load failure, DOM replacement), restore the native cursor. */
  const restoreIfBroken = () => {
    try {
      if (!document.body.contains(dot) || !document.body.contains(ring)) {
        document.body.classList.remove('has-custom-cursor');
        return true;
      }
      const cs = window.getComputedStyle ? getComputedStyle(ring) : null;
      if (cs && (cs.display === 'none' || cs.visibility === 'hidden')) {
        document.body.classList.remove('has-custom-cursor');
        return true;
      }
    } catch {}
    return false;
  };
  setTimeout(restoreIfBroken, 800);
  setTimeout(restoreIfBroken, 2500);

  const trails = [];
  let trailCount = cfg ? cfg.cursorTrailCount : (tier === 'low' ? 0 : tier === 'mid' ? 2 : 5);
  if (reducedMotion) trailCount = Math.min(trailCount, 1);
  for (let i = 0; i < trailCount; i++) {
    const t = document.createElement('div'); t.className = 'noviq-cursor-trail';
    document.body.appendChild(t);
    trails.push({ el: t, x: 0, y: 0 });
  }

  let mx = 0, my = 0, rx = 0, ry = 0, trailIdx = 0;
  const interactive = 'a, button, input, textarea, .noviq-glass-card, .noviq-project-card, .noviq-stack-chip, .noviq-industry-card';

  document.addEventListener('mousemove', e => {
    mx = e.clientX; my = e.clientY;
    dot.style.left = mx + 'px'; dot.style.top = my + 'px';

    if (trails.length) {
      trails[trailIdx].el.style.left = mx + 'px';
      trails[trailIdx].el.style.top = my + 'px';
      trails[trailIdx].el.style.opacity = '0.25';
      trailIdx = (trailIdx + 1) % trails.length;
    }

    const t = (e.target && e.target.closest) ? e.target.closest(interactive) : null;
    ring.classList.toggle('hover', !!t);
  }, { passive: true });

  document.addEventListener('mousedown', () => ring.classList.add('click'), { passive: true });
  document.addEventListener('mouseup', () => ring.classList.remove('click'), { passive: true });

  let rafId = null;
  function smoothRing() {
    if (document.hidden) { rafId = requestAnimationFrame(smoothRing); return; }
    const lerpFactor = reducedMotion
      ? (tier === 'low' ? 0.18 : 0.08)   /* smoother/slower for reduced-motion */
      : (tier === 'low' ? 0.25 : 0.12);
    rx += (mx - rx) * lerpFactor;
    ry += (my - ry) * lerpFactor;
    ring.style.left = rx + 'px'; ring.style.top = ry + 'px';
    trails.forEach(t => {
      t.el.style.opacity = Math.max(0, parseFloat(t.el.style.opacity || '0.25') - 0.008);
    });
    rafId = requestAnimationFrame(smoothRing);
  }
  smoothRing();

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && !rafId) smoothRing();
  });
  } catch (err) {
    /* Full fallback: on ANY error keep the native cursor visible. */
    try { document.body && document.body.classList.remove('has-custom-cursor'); } catch {}
    console.warn('[cursor] disabled, native cursor kept:', err && err.message);
  }
}

/* ---- Magnetic buttons ---- */
function initMagnetic() {
  try {
    if (!window.matchMedia || !matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  document.querySelectorAll('.noviq-btn-primary, .noviq-btn-secondary, .noviq-footer-col a, .noviq-desktop-nav a').forEach(el => {
    el.addEventListener('mousemove', e => {
      const r = el.getBoundingClientRect();
      const x = e.clientX - r.left - r.width / 2;
      const y = e.clientY - r.top - r.height / 2;
      el.style.transform = `translate(${x * 0.15}px, ${y * 0.15}px)`;
    });
    el.addEventListener('mouseleave', () => { el.style.transform = ''; });
  });
  } catch (err) { console.warn('[magnetic] disabled:', err && err.message); }
}
