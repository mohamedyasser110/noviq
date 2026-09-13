/* ============================================================
   INTRO SEQUENCE — Canvas particle timeline for the entrance
   ============================================================ */

const _introTier = window._deviceTier || 'high';
const _cfg = (typeof MotionConfig !== 'undefined') ? MotionConfig : null;
const _reducedMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
const _factor = _cfg ? _cfg.particleFactor : 1.0;
const _particleCount = (_reducedMotion || (_cfg && _cfg.isReduced))
  ? (_introTier === 'low' ? 80 : _introTier === 'mid' ? 150 : 250)   /* gentler */
  : (_introTier === 'low' ? 200 : _introTier === 'mid' ? 400 : 600);
const _particleCountFinal = Math.max(_cfg && _cfg.isOff ? 0 : 1, Math.round(_particleCount * _factor));
const rand = mulberry32(20260709);
const PARTICLES = Array.from({ length: _particleCountFinal }, () => ({
  x: rand() * 1920, y: rand() * 1080,
  r: 0.3 + rand() * 1.4,
  depth: 0.15 + rand() * 0.85,
  phase: rand() * Math.PI * 2,
  speed: 4 + rand() * 18,
  sway: 8 + rand() * 22,
  hue: rand(),
  twinkleSpeed: 1.0 + rand() * 3.0,
}));

/* Helper for cubic bezier calculation */
function getCubicBezierPoint(t, p0, p1, p2, p3) {
  const mt = 1 - t;
  const mt2 = mt * mt;
  const mt3 = mt2 * mt;
  const t2 = t * t;
  const t3 = t2 * t;
  return [
    mt3 * p0[0] + 3 * mt2 * t * p1[0] + 3 * mt * t2 * p2[0] + t3 * p3[0],
    mt3 * p0[1] + 3 * mt2 * t * p1[1] + 3 * mt * t2 * p2[1] + t3 * p3[1]
  ];
}

/* ── Bezier-based sampling of the curvy N logo path ───────── */
function pointOnN(s) {
  const p0 = [28, 73], p1 = [28, 45], p2 = [30, 23], p3 = [40, 23];     // left curve
  const p4 = [48, 23], p5 = [48, 63], p6 = [58, 70];                     // diagonal bend
  const p7 = [66, 77], p8 = [72, 61], p9 = [72, 27];                     // right curve

  let pt, segIdx, localT;
  if (s < 0.33) {
    localT = s / 0.33;
    pt = getCubicBezierPoint(localT, p0, p1, p2, p3);
    segIdx = 0;
  } else if (s < 0.66) {
    localT = (s - 0.33) / 0.33;
    pt = getCubicBezierPoint(localT, p3, p4, p5, p6);
    segIdx = 1;
  } else {
    localT = (s - 0.66) / 0.34;
    pt = getCubicBezierPoint(localT, p6, p7, p8, p9);
    segIdx = 2;
  }
  return [pt[0], pt[1], localT, segIdx];
}

/* ── Build FORM_DOTS with segment-aware colour ─────────────── */
const formRand = mulberry32(99123);
const N_COUNT_BASE = (_reducedMotion || (_cfg && _cfg.isReduced))
  ? (_introTier === 'low' ? 150 : _introTier === 'mid' ? 300 : 500)
  : (_introTier === 'low' ? 400 : _introTier === 'mid' ? 700 : 1200);
const N_COUNT = Math.max(_cfg && _cfg.isOff ? 0 : 1, Math.round(N_COUNT_BASE * _factor));
const FORM_DOTS = Array.from({ length: N_COUNT }, (_, i) => {
  const s = i / (N_COUNT - 1);
  const [txVal, tyVal, segT, segIdx] = pointOnN(s);

  // Tiny organic jitter so it looks like a glowing liquid stroke, not a thin wire
  const tx = txVal + (formRand() - 0.5) * 2.0;
  const ty = tyVal + (formRand() - 0.5) * 2.0;

  const isHero = formRand() < 0.14;
  const delay = 0.05 + formRand() * 0.9;

  return {
    tx, ty, isHero, segIdx, segT, s,
    sx: formRand() * 1920,
    sy: formRand() * 1080,
    delay,
    dur: 1.2 + formRand() * 0.7,
    r: isHero ? (1.8 + formRand() * 2.2) : (0.5 + formRand() * 1.1),
    swirl: (formRand() - 0.5) * 140,
    phase: formRand() * Math.PI * 2,
    hue: formRand(),
    twinkleSpeed: 1.0 + formRand() * 3.0,
    cx: undefined, cy: undefined,
  };
});

/* ── Violet-chrome particle colour spectrum ─────────────────── */
function segColor(segIdx, segT) {
  const globalT = (segIdx + segT) / 3;
  if (globalT < 0.33) {
    const f = globalT / 0.33;
    // Deep indigo → bright violet
    return `${Math.round(lerp(79, 168, f))},${Math.round(lerp(38, 85, f))},${Math.round(lerp(180, 247, f))}`;
  } else if (globalT < 0.66) {
    const f = (globalT - 0.33) / 0.33;
    // Bright violet → metallic silver-white
    return `${Math.round(lerp(168, 230, f))},${Math.round(lerp(85, 220, f))},${Math.round(lerp(247, 255, f))}`;
  } else {
    const f = (globalT - 0.66) / 0.34;
    // Silver-white → deep purple/mauve
    return `${Math.round(lerp(230, 139, f))},${Math.round(lerp(220, 92, f))},${Math.round(lerp(255, 246, f))}`;
  }
}

/* ── Device-aware render scale ─────────────────────────────── */
function _getIntroRenderScale() {
  const tier = window._deviceTier || 'high';
  if (tier === 'low') return 0.5;
  if (tier === 'mid') return 0.75;
  return 1.0;
}

/* ── Main ───────────────────────────────────────────────────── */
function initIntro() {
  const cfg = (typeof MotionConfig !== 'undefined') ? MotionConfig : null;
  /* If motion is off entirely, skip intro */
  if (cfg && cfg.isOff) {
    const overlay = document.getElementById('noviq-intro-overlay');
    if (overlay) overlay.remove();
    document.body.classList.remove('intro-active');
    return;
  }
  /* Honor reduced-motion (OS pref or admin setting): fewer particles, faster fade */
  const reducedMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches)
    || (cfg && cfg.isReduced);
  if (reducedMotion) {
    const overlay = document.getElementById('noviq-intro-overlay');
    if (overlay) {
      overlay.style.transition = 'opacity 0.6s ease';
      setTimeout(() => {
        overlay.classList.add('fade-out');
        document.body.classList.remove('intro-active');
        setTimeout(() => overlay.remove(), 600);
      }, 800);
    }
    return;
  }
  document.body.classList.add("intro-active");

  /* Theme-aware particle palette: on bright backgrounds use dark-violet
     particles instead of white so the starfield stays visible at every
     energy level. Falls back to localStorage so the intro paints correctly
     before the crystal theme has had a chance to set its data attribute. */
  let lightIntro = false;
  try {
    const saved = parseFloat(localStorage.getItem('noviq-energy-level'));
    lightIntro = document.documentElement.dataset.themeTone === 'light' || (!isNaN(saved) && saved >= 70);
  } catch (e) {}
  const CORE = lightIntro ? '30,15,65' : '255,255,255';

  const nIcon = document.querySelector(".intro-n-icon");
  if (nIcon) {
    let layersHtml = "";
    // Depth layers: extrude only the organic N curve
    for (let i = 0; i < 9; i++) {
      const r = 52 - i * 3, g = 18 - i, b = 120 - i * 9;
      layersHtml += `
        <svg class="n-layer n-layer-depth" viewBox="0 0 100 100" style="transform:translateZ(${-(i+1)*7}px);opacity:0;">
          <path d="M 28 73 C 28 45, 30 23, 40 23 C 48 23, 48 63, 58 70 C 66 77, 72 61, 72 27" stroke="rgba(${r},${g},${b},1)" stroke-width="13" stroke-linecap="round" stroke-linejoin="round" fill="none"></path>
        </svg>`;
    }
    // Face layer: contains liquid metal layered strokes and shiny highlight
    layersHtml += `
      <svg class="n-layer n-layer-face" viewBox="0 0 100 100" fill="none" style="opacity:0;overflow:visible;">
        <defs>
          <!-- Deep shadow with violet tint -->
          <linearGradient id="liquidBaseIntro" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#0d0620" />
            <stop offset="25%" stop-color="#2e1065" />
            <stop offset="50%" stop-color="#1e1b4b" />
            <stop offset="75%" stop-color="#4c1d95" />
            <stop offset="100%" stop-color="#1a0d3a" />
          </linearGradient>
          <!-- Violet-chrome mid-tone reflections -->
          <linearGradient id="liquidChromeIntro" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#6d28d9" />
            <stop offset="20%" stop-color="#c4b5fd" />
            <stop offset="38%" stop-color="#4c1d95" />
            <stop offset="50%" stop-color="#1e1b4b" />
            <stop offset="62%" stop-color="#a78bfa" />
            <stop offset="80%" stop-color="#ddd6fe" />
            <stop offset="100%" stop-color="#7c3aed" />
          </linearGradient>
          <!-- Specular highlight — pure white with violet edge -->
          <linearGradient id="specularGlowIntro" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#ede9fe" stop-opacity="0.95" />
            <stop offset="50%" stop-color="#ffffff" stop-opacity="1.0" />
            <stop offset="100%" stop-color="#c4b5fd" stop-opacity="0.6" />
          </linearGradient>
          <filter id="ngGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2.5" result="blur"/>
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>
        <g filter="url(#ngGlow)">
          <path d="M 28 73 C 28 45, 30 23, 40 23 C 48 23, 48 63, 58 70 C 66 77, 72 61, 72 27" stroke="url(#liquidBaseIntro)" stroke-width="15" stroke-linecap="round" stroke-linejoin="round" />
          <path d="M 28 73 C 28 45, 30 23, 40 23 C 48 23, 48 63, 58 70 C 66 77, 72 61, 72 27" stroke="url(#liquidChromeIntro)" stroke-width="10" stroke-linecap="round" stroke-linejoin="round" opacity="0.95" />
          <path d="M 28 73 C 28 45, 30 23, 40 23 C 48 23, 48 63, 58 70 C 66 77, 72 61, 72 27" stroke="url(#specularGlowIntro)" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" />
        </g>
      </svg>`;
    nIcon.innerHTML = `<div class="n-layer-container">${layersHtml}</div>`;
  }

  const canvas  = document.getElementById("intro-canvas");
  if (!canvas) return;
  const ctx     = canvas.getContext("2d");
  const resScale = _getIntroRenderScale();
  if (resScale < 1) {
    canvas.width  = 1920 * resScale;
    canvas.height = 1080 * resScale;
    ctx.scale(resScale, resScale);
  }
  const lockup  = document.querySelector(".intro-lockup");
  const underline = document.querySelector(".intro-underline");
  const tagline   = document.querySelector(".intro-tagline");
  const overlay   = document.getElementById("noviq-intro-overlay");

  let introInner = document.querySelector(".intro-inner");
  if (!introInner && overlay) {
    introInner = document.createElement("div");
    introInner.className = "intro-inner";
    while (overlay.firstChild) introInner.appendChild(overlay.firstChild);
    overlay.appendChild(introInner);
  }

  function resizeLockup() {
    const w = window.innerWidth, h = window.innerHeight;
    const scale = Math.min(w / 1920, h / 1080);
    if (lockup) lockup.style.transform = `translate(-50%,-50%) scale(${scale})`;
    if (canvas) {
      const cs = Math.max(w / 1920, h / 1080);
      canvas.style.transform = `translate(-50%,-50%) scale(${Math.max(scale, cs)})`;
    }
  }
  window.addEventListener("resize", resizeLockup);
  resizeLockup();

  /* ── drawStar ─────────────────────────────────────────────── */
  const starBrightness = lightIntro ? 1.4 : 1.0;
  function drawStar(cx, cy, r, opacity, colorStr, phase) {
    // Core glow
    const cg = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 0.7);
    cg.addColorStop(0,   `rgba(${CORE},${Math.min(opacity * 1.8 * starBrightness, 1)})`);
    cg.addColorStop(0.4, `rgba(${colorStr},${opacity * starBrightness})`);
    cg.addColorStop(1,   `rgba(${colorStr},0)`);
    ctx.fillStyle = cg;
    ctx.beginPath(); ctx.arc(cx, cy, r * 0.7 + 1, 0, Math.PI * 2); ctx.fill();

    // Spike rays
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(phase * 0.25);
    ctx.globalAlpha = opacity * 0.65 * starBrightness;
    const rl = r * 3.8, rw = r * 0.3;
    for (let i = 0; i < 4; i++) {
      ctx.save(); ctx.rotate((Math.PI / 2) * i);
      const rg = ctx.createLinearGradient(0, 0, rl, 0);
      rg.addColorStop(0,   `rgba(${CORE},${Math.min(opacity * 1.3 * starBrightness, 1)})`);
      rg.addColorStop(0.3, `rgba(${colorStr},${opacity * 0.5 * starBrightness})`);
      rg.addColorStop(1,   `rgba(${colorStr},0)`);
      ctx.fillStyle = rg;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(rl, -rw * 0.14);
      ctx.lineTo(rl,  rw * 0.14);
      ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    ctx.globalAlpha = 1; ctx.restore();

    // Halo
    const hg = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 4.5);
    hg.addColorStop(0, `rgba(${colorStr},${opacity * 0.2 * starBrightness})`);
    hg.addColorStop(1, `rgba(${colorStr},0)`);
    ctx.fillStyle = hg;
    ctx.beginPath(); ctx.arc(cx, cy, r * 4.5, 0, Math.PI * 2); ctx.fill();
  }

  /* ── Timing ───────────────────────────────────────────────── */
  const startTime = performance.now();
  let lastTime = startTime, starTime = 0;
  let animationFrameId = null, finished = false;

  function easeInQuad(t)  { return t * t; }
  function easeOutQuad(t) { return t * (2 - t); }
  function easeInCubic(t) { return t * t * t; }

  /* N centre in canvas space — must match SVG nIcon starting position */
  /* nIcon starts at left=(1920/2-210), top=(1080/2-240), SVG units × 4.2 */
  const N_CX   = 1920 / 2 - 210;
  const N_CY   = 315;
  const N_SCALE = 4.2;

  /* ── tick ────────────────────────────────────────────────── */
  const neb1 = document.querySelector(".nebula-1");
  const neb2 = document.querySelector(".nebula-2");
  const nDepthLayers = document.querySelectorAll(".n-layer-depth");
  const nFaceLayer = document.querySelector(".n-layer-face");
  const nLetterEls = document.querySelectorAll(".intro-letter");
  const container = document.querySelector(".n-layer-container");

  function tick() {
    const now   = performance.now();
    const dt    = (now - lastTime) / 1000;
    lastTime    = now;
    const elapsed = (now - startTime) / 1000;
    const t     = Math.min(elapsed, 5.5);

    /* Warp speed: background stars rush toward camera during gather */
    let warpFactor = 1.0;
    if (t > 1.0 && t < 2.1) {
      warpFactor = lerp(1.0, 6.0, easeInQuad((t - 1.0) / 1.1));
    } else if (t >= 2.1 && t < 3.2) {
      warpFactor = lerp(6.0, 1.0, easeOutQuad((t - 2.1) / 1.1));
    }
    starTime += dt * warpFactor;

    ctx.clearRect(0, 0, 1920, 1080);

    /* ─ Background starfield ─────────────────────────────── */
    PARTICLES.forEach(p => {
      const y = ((p.y - starTime * p.speed * p.depth) % (1080 + 60) + (1080 + 60)) % (1080 + 60) - 30;
      const x = p.x + Math.sin(t * 0.55 + p.phase) * p.sway * p.depth;
      const tw = 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(t * p.twinkleSpeed + p.phase * 3));
      const opacity = (0.35 + 0.65 * p.depth) * tw;
      const r = p.r * p.depth;
      const colorStr = p.hue < 0.4 ? '168,85,247' : p.hue < 0.75 ? '139,92,246' : '255,255,255';

      if (p.depth > 0.55) {
        drawStar(x, y, r, opacity, colorStr, p.phase + t * p.twinkleSpeed);
      } else {
        const dg = ctx.createRadialGradient(x, y, 0, x, y, r + 1.5);
        dg.addColorStop(0,   `rgba(${CORE},${Math.min(opacity * 1.4, 1)})`);
        dg.addColorStop(0.5, `rgba(${colorStr},${opacity * 0.6})`);
        dg.addColorStop(1,   `rgba(${colorStr},0)`);
        ctx.fillStyle = dg;
        ctx.beginPath(); ctx.arc(x, y, r + 1.5, 0, Math.PI * 2); ctx.fill();
      }
    });

    /* ─ N formation (t: 0 → 3.4) ─────────────────────────── */
    if (t < 3.4) {
      /*  Phase A  0.0–0.8  : particles orbit a central attractor  */
      /*  Phase B  0.6–2.6  : converge onto N (staggered by delay) */
      /*  Phase C  2.3–3.4  : hold and sparkle before SVG takes over */

      const phaseB_start = 0.6;

      FORM_DOTS.forEach((p, i) => {
        const rawP = (t - p.delay) / p.dur;
        const e    = easeInOutQuart(clamp(rawP, 0, 1));
        const melt = 1 - clamp((t - (p.delay + p.dur)) / 0.55, 0, 1);
        if (melt <= 0) { p.cx = undefined; p.cy = undefined; return; }

        const gx = N_CX + p.tx * N_SCALE;
        const gy = N_CY + p.ty * N_SCALE;

        /* Particles fly in from random screen positions with a swirl arc */
        const swirl = Math.sin(e * Math.PI) * p.swirl;
        const x = p.sx + (gx - p.sx) * e + Math.cos(p.phase) * swirl * (1 - e);
        const y = p.sy + (gy - p.sy) * e + Math.sin(p.phase) * swirl * (1 - e);

        p.cx = x; p.cy = y;

        const tw      = 0.55 + 0.45 * Math.sin(t * p.twinkleSpeed + p.phase * 4);
        const fadeIn  = clamp(t / 0.4, 0, 1);
        const opacity = fadeIn * tw * melt * clamp(rawP + 0.6, 0, 1);
        if (opacity < 0.01) return;

        const size = p.r * (1 - 0.35 * e);

        /* Constellation lines between nearby settled particles */
        if (_introTier !== 'low' && i > 0 && e > 0.65 && melt > 0.5) {
          const prev = FORM_DOTS[i - 1];
          if (prev.cx !== undefined) {
            const dx = x - prev.cx, dy = y - prev.cy;
            const d2 = dx * dx + dy * dy;
            if (d2 < 200) {
              const lo = (1 - Math.sqrt(d2) / 14.2) * 0.16 * Math.min(e, melt);
              ctx.strokeStyle = `rgba(168,85,247,${lo})`;
              ctx.lineWidth   = 0.45;
              ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(prev.cx, prev.cy); ctx.stroke();
            }
          }
        }

        const colorStr = segColor(p.segIdx, p.segT);
        if (p.isHero) {
          if (_introTier === 'low') {
            const dg = ctx.createRadialGradient(x, y, 0, x, y, size + 1.5);
            dg.addColorStop(0, `rgba(${CORE},${Math.min(opacity * 1.4, 1)})`);
            dg.addColorStop(0.5, `rgba(${colorStr},${opacity * 0.6})`);
            dg.addColorStop(1, `rgba(${colorStr},0)`);
            ctx.fillStyle = dg;
            ctx.beginPath(); ctx.arc(x, y, size + 1.5, 0, Math.PI * 2); ctx.fill();
          } else {
            drawStar(x, y, size, opacity, colorStr, p.phase + t * 0.4);
          }
        } else {
          const cr = size * 0.7;
          const cg = ctx.createRadialGradient(x, y, 0, x, y, cr + 1.1);
          cg.addColorStop(0,   `rgba(${CORE},${Math.min(opacity * 1.6 * starBrightness, 1)})`);
          cg.addColorStop(0.4, `rgba(${colorStr},${opacity * starBrightness})`);
          cg.addColorStop(1,   `rgba(${colorStr},0)`);
          ctx.fillStyle = cg;
          ctx.beginPath(); ctx.arc(x, y, cr + 1.1, 0, Math.PI * 2); ctx.fill();
        }
      });
    }

    /* ─ Nebulae breathe ──────────────────────────────────── */
    if (_introTier !== 'low') {
      if (neb1) neb1.style.transform = `scale(${0.9 + 0.1 * Math.sin(t * 0.7)})`;
      if (neb2) neb2.style.transform = `scale(${0.9 + 0.1 * Math.sin(t * 0.9 + 2)})`;
    }

    /* ─ Camera zoom ──────────────────────────────────────── */
    let cam = 1.0;
    if      (t < 2.8) cam = lerp(1.04, 1.09, easeInOutQuad(t / 2.8));
    else if (t < 3.6) cam = lerp(1.09, 1.0,  easeInOutQuad((t - 2.8) / 0.8));
    else               cam = lerp(1.0,  1.02, easeInOutQuad((t - 3.6) / 1.4));

    /* Camera shake at N coalescence moment (t≈2.1) */
    let shakeX = 0, shakeY = 0;
    if (t > 2.05 && t < 2.45) {
      const sp = (t - 2.05) / 0.4;
      const sv = Math.sin(sp * Math.PI) * 3.5;
      shakeX = Math.sin(t * 137.5) * sv;
      shakeY = Math.cos(t * 97.3) * sv;
    }
    if (introInner) introInner.style.transform = `scale(${cam}) translate(${shakeX}px,${shakeY}px)`;

    /* ─ SVG N icon ───────────────────────────────────────── */
    const seat   = easeInOutQuart(clamp((t - 2.9) / 0.55, 0, 1));
    const nX     = lerp(1920 / 2 - 210, 497, seat);
    const nScale = lerp(1, 0.62, seat);

    let rotY = 0, rotX = 0;
    if (t > 2.65) {
      const er = easeInOutQuad(clamp((t - 2.65) / 0.85, 0, 1));
      rotY = lerp(0, 8, er); rotX = lerp(0, -4, er);
    }

    let pulseScale = 1.0;
    if (t >= 2.3 && t < 2.7)  pulseScale = lerp(1.0, 1.05, easeInOutQuad((t - 2.3) / 0.4));
    else if (t >= 2.7 && t < 3.1) pulseScale = lerp(1.05, 1.0, easeInOutQuad((t - 2.7) / 0.4));

    const idleY = t > 3.1 ? Math.sin((t - 3.1) * 1.7) * 5 : 0;

    const faceOp  = clamp((t - 2.0)  / 0.7,  0, 1);
    const depthOp = clamp((t - 2.45) / 0.45, 0, 1);
    const glowOn  = clamp((t - 2.1)  / 0.55, 0, 1);
    const burst   = (t > 2.05 && t < 2.85) ? Math.sin(((t - 2.05) / 0.8) * Math.PI) : 0;

    if (nIcon) {
      nIcon.style.left      = `${nX}px`;
      nIcon.style.top       = `315px`;
      nIcon.style.transform = `scale(${nScale})`;
    }

    if (container) {
      container.style.transform = `translateY(${idleY}px) rotateY(${rotY}deg) rotateX(${rotX}deg) scale(${pulseScale})`;
    }

    nDepthLayers.forEach((layer, i) => {
      layer.style.opacity = depthOp * (0.9 - i * 0.09);
    });

    if (nFaceLayer) {
      nFaceLayer.style.opacity = faceOp;
      nFaceLayer.style.filter = `drop-shadow(0 0 ${30 * glowOn + 40 * burst}px rgba(139,92,246,${0.7 * glowOn + 0.45 * burst})) drop-shadow(0 0 ${10 * glowOn}px rgba(196,181,253,${0.5 * glowOn}))`;
    }

    /* ─ Letters slide in ─────────────────────────────────── */
    nLetterEls.forEach((letter, i) => {
      const start = 3.5 + i * 0.09;
      const p  = clamp((t - start) / 0.52, 0, 1);
      const e  = easeOutQuart(p);
      letter.style.transform = `perspective(900px) translateX(${(1 - e) * -620}px) rotateY(${(1 - e) * -38}deg)`;
      letter.style.opacity   = clamp(p * 2.5, 0, 1);
    });

    if (underline) {
      const lp = easeOutQuart(clamp((t - 4.1) / 0.65, 0, 1));
      underline.style.left    = `${960 - 350 * lp}px`;
      underline.style.width   = `${700 * lp}px`;
      underline.style.opacity = lp;
    }

    if (tagline) {
      const tp = clamp((t - 4.3) / 0.52, 0, 1);
      tagline.style.opacity   = tp;
      tagline.style.transform = `translateY(${(1 - easeOutCubic(tp)) * 26}px)`;
    }

    /* ─ Finish ───────────────────────────────────────────── */
    if (elapsed >= 5.5 && !finished) {
      finished = true;
      if (overlay) overlay.classList.add("fade-out");
      document.body.classList.remove("intro-active");
      try { initGlowBlob(); } catch(e) {}
      try { initHero3D(); } catch(e) {}
      try { initReveal(); } catch(e) {}
      try { initTilt(); } catch(e) {}
      try { initCounters(); } catch(e) {}
      window.removeEventListener("resize", resizeLockup);
      setTimeout(() => { cancelAnimationFrame(animationFrameId); if (overlay) overlay.remove(); }, 1000);
      return;
    }

    animationFrameId = requestAnimationFrame(tick);
  }

  animationFrameId = requestAnimationFrame(tick);
}
