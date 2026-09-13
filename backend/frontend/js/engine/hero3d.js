/* ============================================================
   HERO 3D — Three.js geometric core scene + ambient glow blob
   ============================================================ */

let _hero3dRunning = false;

function _getPixelRatioCap() {
  const dpr = window.devicePixelRatio;
  const tier = window._deviceTier || 'high';
  if (tier === 'low') return Math.min(dpr, 1.0);
  if (tier === 'mid') return Math.min(dpr, 1.5);
  return Math.min(dpr, 2.0);
}

function initHero3D() {
  if (_hero3dRunning) return;

  const mount = document.getElementById("hero-canvas");
  if (!mount || typeof THREE === "undefined") return;
  _hero3dRunning = true;

  const cfg = (typeof MotionConfig !== 'undefined') ? MotionConfig : null;
  if (cfg && !cfg.enableHero3D) return;
  const reducedMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches)
    || (cfg && cfg.isReduced);

  const width  = mount.clientWidth;
  const height = mount.clientHeight;

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x030310, 0.048);

  const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100);
  camera.position.set(0, 0, 8.3);

  const tier = window._deviceTier || 'high';
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: tier !== 'low', alpha: true });
  } catch (e) {
    /* WebGL unavailable (GPU blocked / software rendering disabled) —
       fall back gracefully: no 3D scene, CSS background remains. */
    console.warn('[Noviq] WebGL unavailable — hero 3D disabled', e && e.message);
    return;
  }
  if (!renderer.getContext()) {
    console.warn('[Noviq] WebGL context missing — hero 3D disabled');
    return;
  }
  renderer.setSize(width, height);
  renderer.setPixelRatio(_getPixelRatioCap());
  if (tier !== 'low') {
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.3;
  }
  mount.appendChild(renderer.domElement);

  // ── Lights: dark sphere + pale key light = strong contrast, one family (indigo/violet/ice) ──
  scene.add(new THREE.AmbientLight(0x0a0520, 0.85));
  const keyLight = new THREE.PointLight(0xf1edff, 16, 30); keyLight.position.set(4.5, 3.5, 5.5); scene.add(keyLight); // pale ice key
  const p1 = new THREE.PointLight(0x4f46e5, 7, 24);  p1.position.set(5, 3, 4);   scene.add(p1);  // indigo fill
  const p2 = new THREE.PointLight(0x7c3aed, 6, 22);  p2.position.set(-5, -2, 3); scene.add(p2);  // violet rim
  const p3 = new THREE.PointLight(0x38bdf8, 3, 18);  p3.position.set(0,  5, 4);  scene.add(p3);  // ice-blue top
  const p4 = new THREE.PointLight(0x8b5cf6, 2, 14);  p4.position.set(-2, -4, 6); scene.add(p4);  // soft violet low
  const mouseLight = new THREE.PointLight(0xe6e1ff, 0, 12); mouseLight.position.set(0, 0, 5); scene.add(mouseLight);

  // ── Group & Core ──────────────────────────────────────────
  const group = new THREE.Group();
  scene.add(group);

  const coreSubdiv = tier === 'low' ? 1 : tier === 'mid' ? 2 : 3;
  const coreGeo = new THREE.IcosahedronGeometry(1.72, coreSubdiv);
  const originalPos = coreGeo.attributes.position.array.slice();
  const origInvLen = new Float32Array(originalPos.length / 3);
  for (let i = 0; i < origInvLen.length; i++) {
    const oi = i * 3;
    origInvLen[i] = 1 / Math.sqrt(originalPos[oi]*originalPos[oi] + originalPos[oi+1]*originalPos[oi+1] + originalPos[oi+2]*originalPos[oi+2]);
  }

  // Generate N logo texture for Sprite overlay
  function _createLogoSprite() {
    const size = 512;
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d');
    const scale = size / 90, ox = 8, oy = 8;
    ctx.translate(ox, oy);
    ctx.scale(scale, scale);
    const path = new Path2D('M 28 73 C 28 45, 30 23, 40 23 C 48 23, 48 63, 58 70 C 66 77, 72 61, 72 27');
    ctx.shadowColor = 'rgba(168,85,247,0.95)';
    ctx.shadowBlur = 20;
    ctx.strokeStyle = '#8b5cf6';
    ctx.lineWidth = 18; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.stroke(path);
    ctx.shadowBlur = 8;
    ctx.strokeStyle = '#c4b5fd';
    ctx.lineWidth = 9;
    ctx.stroke(path);
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 3;
    ctx.stroke(path);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const tex = new THREE.CanvasTexture(c);
    tex.needsUpdate = true;
    // Sprite material: bright, transparent background
    const mat = new THREE.SpriteMaterial({
      map: tex, transparent: true, depthTest: false,
      blending: THREE.AdditiveBlending,
      opacity: 0.35,
    });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(3, 3, 1);
    sprite.position.z = 0.2;
    return { sprite, mat };
  }

  const coreMat = tier === 'low'
    ? new THREE.MeshStandardMaterial({
        color: 0x070418, metalness: 0.35, roughness: 0.32,
        emissive: 0x241259, emissiveIntensity: 0.5,
      })
    : new THREE.MeshPhysicalMaterial({
        color:               0x070418,
        metalness:           0.25,
        roughness:           0.16,
        transmission:        0.32,
        clearcoat:           1.0,
        clearcoatRoughness:  0.08,
        emissive:            0x241259,
        emissiveIntensity:   0.5,
        ior:                 1.6,
      });
  const coreMesh = new THREE.Mesh(coreGeo, coreMat);
  group.add(coreMesh);

  // N logo sprite overlay — always readable, additive glow on sphere surface
  const logoSprite = _createLogoSprite();
  group.add(logoSprite.sprite);

  // ── Logo glow burst ──
  let logoGlow = 0;
  let logoGlowTarget = 0;

  // ── Wireframes ────────────────────────────────────────────
  const wireGeo = new THREE.IcosahedronGeometry(2.2, 2);
  const origWire = wireGeo.attributes.position.array.slice();
  const wireMat  = new THREE.MeshBasicMaterial({ color: 0x6366f1, wireframe: true, transparent: true, opacity: 0.10 });
  const wire     = new THREE.Mesh(wireGeo, wireMat);
  group.add(wire);

  const wire2Geo = new THREE.IcosahedronGeometry(2.76, 1);
  const wire2Mat = new THREE.MeshBasicMaterial({ color: 0x0ea5e9, wireframe: true, transparent: true, opacity: 0.02 });
  const wire2    = new THREE.Mesh(wire2Geo, wire2Mat);
  group.add(wire2);

  // ── Holographic quantum orbital rings (Futuristic addition) ──
  const ring1Geo = new THREE.BufferGeometry();
  const ring1Count = tier === 'low' ? 40 : tier === 'mid' ? 80 : 120;
  const ring1Pos = new Float32Array(ring1Count * 3);
  for (let i = 0; i < ring1Count; i++) {
    const angle = (i / ring1Count) * Math.PI * 2;
    ring1Pos[i*3] = Math.cos(angle) * 2.5;
    ring1Pos[i*3+1] = 0;
    ring1Pos[i*3+2] = Math.sin(angle) * 2.5;
  }
  ring1Geo.setAttribute("position", new THREE.BufferAttribute(ring1Pos, 3));
  const ring1Mat = new THREE.PointsMaterial({ color: 0x0ea5e9, size: 0.04, transparent: true, opacity: 0.55 });
  const ring1 = new THREE.Points(ring1Geo, ring1Mat);
  group.add(ring1);

  const ring2Geo = new THREE.BufferGeometry();
  const ring2Count = tier === 'low' ? 60 : tier === 'mid' ? 100 : 160;
  const ring2Pos = new Float32Array(ring2Count * 3);
  for (let i = 0; i < ring2Count; i++) {
    const angle = (i / ring2Count) * Math.PI * 2;
    ring2Pos[i*3] = Math.cos(angle) * 2.9;
    ring2Pos[i*3+1] = 0;
    ring2Pos[i*3+2] = Math.sin(angle) * 2.9;
  }
  ring2Geo.setAttribute("position", new THREE.BufferAttribute(ring2Pos, 3));
  const ring2Mat = new THREE.PointsMaterial({ color: 0xa78bfa, size: 0.035, transparent: true, opacity: 0.50 });
  const ring2 = new THREE.Points(ring2Geo, ring2Mat);
  group.add(ring2);

  // ── Satellites ────────────────────────────────────────────
  const satDefs = tier === 'low'
    ? [
        { geo: new THREE.OctahedronGeometry(0.21), color: 0x818cf8, emissive: 0x4f46e5, radius: 3.05, speed: 0.20, offset: 0, tilt: 0.40 },
        { geo: new THREE.TetrahedronGeometry(0.24), color: 0x34d399, emissive: 0x059669, radius: 3.42, speed: 0.29, offset: Math.PI*0.4, tilt: 0.90 },
      ]
    : [
        { geo: new THREE.OctahedronGeometry(0.21),           color: 0x818cf8, emissive: 0x4f46e5, radius: 3.05, speed: 0.20, offset: 0,             tilt: 0.40 },
        { geo: new THREE.TetrahedronGeometry(0.24),           color: 0x34d399, emissive: 0x059669, radius: 3.42, speed: 0.29, offset: Math.PI*0.4,   tilt: 0.90 }, // emerald
        { geo: new THREE.TorusGeometry(0.20, 0.065, 12, 28), color: 0x38bdf8, emissive: 0x0284c7, radius: 3.65, speed: 0.16, offset: Math.PI,       tilt: 0.55 }, // sky
        { geo: new THREE.OctahedronGeometry(0.16),            color: 0xf472b6, emissive: 0xdb2777, radius: 3.90, speed: 0.25, offset: Math.PI*1.6,   tilt: 1.30 }, // rose
        { geo: new THREE.IcosahedronGeometry(0.14, 0),        color: 0xfbbf24, emissive: 0xd97706, radius: 3.25, speed: 0.37, offset: Math.PI*0.8,   tilt: 0.25 }, // amber
      ];
  const satellites = satDefs.map(def => {
    const mat = tier === 'low'
      ? new THREE.MeshStandardMaterial({
          color: def.color, metalness: 0.3, roughness: 0.4,
          emissive: def.emissive, emissiveIntensity: 0.4,
          transparent: true, opacity: 1.0
        })
      : new THREE.MeshPhysicalMaterial({
          color: def.color, metalness: 0.5, roughness: 0.12,
          emissive: def.emissive, emissiveIntensity: 0.5,
          clearcoat: 0.7,
          transparent: true,
          opacity: 1.0
        });
    const mesh = new THREE.Mesh(def.geo, mat);
    const obj = { mesh, baseRadius: def.radius, currentRadius: def.radius, ...def };
    scene.add(mesh);
    return obj;
  });

  // ── Star fields (spherical distribution) ──────────────────
  function makeStars(count, minR, maxR, size, opacity) {
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi   = Math.acos(2 * Math.random() - 1);
      const r     = minR + Math.random() * (maxR - minR);
      pos[i*3]   = r * Math.sin(phi) * Math.cos(theta);
      pos[i*3+1] = r * Math.sin(phi) * Math.sin(theta);
      pos[i*3+2] = r * Math.cos(phi);
      // Realistic star colours: mostly blue-white, rare warm
      const h = Math.random();
      if (h < 0.08) { col[i*3]=0.9; col[i*3+1]=0.7; col[i*3+2]=0.5; }       // warm orange giant
      else if (h < 0.18) { col[i*3]=0.6; col[i*3+1]=0.7; col[i*3+2]=1.0; }  // blue-white
      else { col[i*3]=col[i*3+1]=col[i*3+2]=0.90+Math.random()*0.10; }        // white
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("color",    new THREE.BufferAttribute(col, 3));
    return new THREE.Points(geo, new THREE.PointsMaterial({ size, transparent: true, opacity, vertexColors: true }));
  }
  const starCountA = tier === 'low' ? 100 : tier === 'mid' ? 200 : 400;
  const starCountB = tier === 'low' ? 150 : tier === 'mid' ? 300 : 600;
  const starsA = makeStars(starCountA, 7,  10, tier === 'low' ? 0.045 : 0.060, tier === 'low' ? 0.70 : 0.85);
  const starsB = makeStars(starCountB, 10, 18, 0.028, tier === 'low' ? 0.40 : 0.50);
  scene.add(starsA);
  scene.add(starsB);

  // ── Interaction state ─────────────────────────────────────
  const mouse = { x: 0, y: 0, tx: 0, ty: 0, raw: { x: 0, y: 0 } };
  let smoothSpeed  = 0;
  let prevMx = 0, prevMy = 0;

  // Drag-to-spin
  const drag = { active: false, lastX: 0, lastY: 0, velX: 0, velY: 0, rotX: 0, rotY: 0 };

  // Idle detection
  let lastMoveTime  = performance.now();
  let idleMode      = false;

  // Explosion state
  let exploding     = 0;   // 0..1, decays
  let explodeTime   = 0;



  window.addEventListener("mousemove", e => {
    const rect = mount.getBoundingClientRect();
    mouse.raw.x = e.clientX - rect.left;
    mouse.raw.y = e.clientY - rect.top;
    mouse.tx =  ((e.clientX - rect.left) / rect.width)  * 2 - 1;
    mouse.ty = -((e.clientY - rect.top)  / rect.height) * 2 + 1;
    lastMoveTime = performance.now();
    idleMode = false;
  }, { passive: true });

  // Drag spin
  mount.addEventListener("mousedown", e => {
    drag.active = true;
    drag.lastX  = e.clientX;
    drag.lastY  = e.clientY;
    drag.velX   = 0;
    drag.velY   = 0;
    mount.style.cursor = "grabbing";
  });
  window.addEventListener("mouseup", () => {
    drag.active = false;
    mount.style.cursor = "grab";
  });
  window.addEventListener("mousemove", e => {
    if (!drag.active) return;
    const dx = e.clientX - drag.lastX;
    const dy = e.clientY - drag.lastY;
    drag.velX  = dx * 0.012;
    drag.velY  = dy * 0.012;
    drag.rotY += drag.velX;
    drag.rotX += drag.velY;
    drag.lastX = e.clientX;
    drag.lastY = e.clientY;
  }, { passive: true });
  mount.style.cursor = "grab";
  mount.addEventListener("mouseleave", () => { mount.style.cursor = ""; });

  // Double-click explosion
  mount.addEventListener("dblclick", () => {
    exploding  = 1.0;
    explodeTime = 0;
  });

  // Zoom with scroll wheel — only steals wheel when already zoomed in/out
  let targetZ = 8.3;
  let zoomActive = false;
  mount.addEventListener("wheel", e => {
    if (!zoomActive) {
      if (Math.abs(targetZ - 8.3) > 0.05) zoomActive = true;
      else return;
    }
    e.preventDefault();
    targetZ = Math.max(4.8, Math.min(10.0, targetZ + e.deltaY * 0.008));
    if (Math.abs(targetZ - 8.3) < 0.01) zoomActive = false;
  }, { passive: false });

  // Touch support (mobile) — passive: true so it never blocks scroll
  let lastTouch = null;
  mount.addEventListener("touchstart", e => { lastTouch = e.touches[0]; }, { passive: true });
  mount.addEventListener("touchmove", e => {
    if (!lastTouch) return;
    const t = e.touches[0];
    drag.velX  = (t.clientX - lastTouch.clientX) * 0.012;
    drag.velY  = (t.clientY - lastTouch.clientY) * 0.012;
    drag.rotY += drag.velX;
    drag.rotX += drag.velY;
    lastTouch = t;
  }, { passive: true });

  let _sceneVisible = true;
  let _animTime = 0;
  let _lastFrameTime = 0;

  // Recover from WebGL context loss
  renderer.domElement.addEventListener('webglcontextlost', e => {
    e.preventDefault();
    _sceneVisible = false;
  });
  renderer.domElement.addEventListener('webglcontextrestored', () => {
    _sceneVisible = true;
  });

  // Prevent idle detection from immediately firing after long background stay
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) lastMoveTime = performance.now();
  }, { capture: true });

  function animate() {
    requestAnimationFrame(animate);
    if (!_sceneVisible || document.hidden) return;
    const now = performance.now();

    // Own time tracking with delta capped at 100ms to prevent jumps after long background
    if (_lastFrameTime) {
      /* Reduced motion: advance time slower so animation is gentler */
      const speedMul = cfg ? cfg.speedMultiplier : 1.0;
      const delta = (now - _lastFrameTime) / 1000;
      _animTime += Math.min(reducedMotion ? delta * 0.5 * speedMul : delta * speedMul, 0.1);
    }
    _lastFrameTime = now;
    const t = _animTime;

    // Idle detection (3 s of no movement)
    if (now - lastMoveTime > 3000) idleMode = true;

    // ── Mouse smooth ──
    mouse.x += (mouse.tx - mouse.x) * 0.032;
    mouse.y += (mouse.ty - mouse.y) * 0.032;

    const dx = mouse.x - prevMx, dy = mouse.y - prevMy;
    const rawSpeed = Math.sqrt(dx * dx + dy * dy) * 60;
    smoothSpeed += (rawSpeed - smoothSpeed) * 0.038;
    smoothSpeed  = Math.min(smoothSpeed, 1.0);
    prevMx = mouse.x;
    prevMy = mouse.y;

    // ── Explosion decay ──
    if (exploding > 0) exploding *= 0.96;

    // ── Entry animation ──
    let entryScale = 1, entryBoost = 0;
    if (t < 2.2) {
      const p = t / 2.2, c1 = 1.70158, c3 = c1 + 1;
      entryScale = 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2);
      if (entryScale < 0) entryScale = 0;
      entryBoost = Math.pow(1 - p, 2) * 8.0;
    }

    // ── Idle "breathing" ──
    const breathe = idleMode ? (Math.sin(t * 0.8) * 0.5 + 0.5) : 0;
    const autoRotY = idleMode ? t * 0.08 : 0;

    // ── Core morphing ──
    const morphAmp = (0.12 + smoothSpeed * 0.10) * (1 + breathe * 0.4) * (1 + exploding * 0.6);
    const mx = mouse.x * 0.7, my = mouse.y * 0.7;
    const posAttr = coreGeo.attributes.position;
    for (let i = 0; i < posAttr.count; i++) {
      const oi = i * 3, ox = originalPos[oi], oy = originalPos[oi+1], oz = originalPos[oi+2];
      const invLen = origInvLen[i];
      const nx = ox * invLen, ny = oy * invLen, nz = oz * invLen;
      const w1 = Math.sin(ox * 1.3 + t * 0.85 + mx) * Math.cos(oy * 1.3 + t * 0.85 + my);
      const w2 = Math.cos(oz * 1.7 - t * 0.60 + mx * 0.4) * 0.55;
      const w3 = Math.sin((ox + oz) * 0.85 + t * 0.45) * 0.3;
      const wave = (w1 + w2 + w3) * morphAmp;
      posAttr.setXYZ(i, ox + nx * wave, oy + ny * wave, oz + nz * wave);
    }
    posAttr.needsUpdate = true;
    coreGeo.computeVertexNormals();

    // ── Wireframe morphing ──
    const wireAmp = (0.18 + smoothSpeed * 0.09) * (1 + exploding * 0.4);
    const wAttr   = wireGeo.attributes.position;
    for (let i = 0; i < wAttr.count; i++) {
      const ox = origWire[i*3], oy = origWire[i*3+1], oz = origWire[i*3+2];
      const len = Math.sqrt(ox*ox + oy*oy + oz*oz);
      const invLen = 1 / len;
      const nx = ox * invLen, ny = oy * invLen, nz = oz * invLen;
      const wave = Math.cos(ox * 1.1 - t * 0.65 - mx*0.4) * Math.sin(oz * 1.1 - t * 0.65 - my*0.4) * wireAmp;
      wAttr.setXYZ(i, ox + nx*wave, oy + ny*wave, oz + nz*wave);
    }
    wAttr.needsUpdate = true;

    // ── Logo glow burst ──
    const burstPhase = (Math.sin(t * 0.053 + Math.sin(t * 0.017) * 3) + 1) * 0.5;
    logoGlowTarget = burstPhase > 0.97 ? (burstPhase - 0.97) / 0.03 * 0.95 : logoGlowTarget * 0.998;
    logoGlow += (logoGlowTarget - logoGlow) * 0.04;
    logoSprite.mat.opacity = 0.3 + logoGlow + smoothSpeed * 0.2;

    // Wireframe stays in the indigo→violet family (no teal drift)
    wireMat.color.setHSL(0.70 - smoothSpeed * 0.04, 0.85, 0.62);
    wireMat.opacity = 0.16 + Math.sin(t * 0.5) * 0.03 + smoothSpeed * 0.14;

    // ── Lights ──
    p1.position.set(5 + mouse.x * 2, 3 + mouse.y * 2, 4);
    p1.intensity = 8 + Math.sin(t * 0.9) * 1.8 + smoothSpeed * 2;

    p2.position.set(-5 - mouse.x * 1.5, -2 - mouse.y * 1.5, 3);
    p2.intensity = 6 + Math.cos(t * 0.7) * 1.4;

    p3.position.set(Math.sin(t * 0.35) * 4, 5 + Math.cos(t * 0.28) * 2, 4);
    p3.intensity = 3 + Math.sin(t * 0.9) * 0.9 + breathe * 1.5;

    p4.intensity = 1.5 + Math.sin(t * 1.1 + 1) * 0.7;

    mouseLight.position.set(mouse.x * 4, mouse.y * 4, 5);
    mouseLight.intensity = smoothSpeed * 5.5 + exploding * 8;
    mouseLight.color.setHSL(0.72, 0.55, 0.88); // pale lavender-white, always harmonious

    // Material live updates
    coreMat.emissiveIntensity = 0.45 + Math.sin(t * 0.6) * 0.12 + smoothSpeed * 0.4 + breathe * 0.3 + exploding * 0.5;
    if (coreMat.iridescenceThicknessRange) coreMat.iridescenceThicknessRange = [100 + mouse.x * 80, 400 + mouse.y * 100];

    // Harmonious aura: deep violet breathing (indigo family only — no rainbow drift)
    const auraPulse = 0.5 + Math.sin(t * 0.6) * 0.5;
    if (coreMat.emissive) {
      coreMat.emissive.setHSL(0.74 + Math.sin(t * 0.23) * 0.02, 0.72, 0.16 + auraPulse * 0.05);
    }
    if (coreMat.attenuationColor) {
      coreMat.attenuationColor.setHSL(0.70, 0.75, 0.32);
    }

    // ── Drag spin inertia & Active decay ──
    if (drag.active) {
      drag.velX *= 0.85;
      drag.velY *= 0.85;
    } else {
      drag.velX *= 0.93;
      drag.velY *= 0.93;
    }
    drag.rotY += drag.velX;
    drag.rotX += drag.velY;

    // ── Transforms ──
    group.scale.setScalar(entryScale * (1 + breathe * 0.04));

    // Combine auto-rotate, drag spin, and mouse parallax
    const targetRotY = autoRotY + drag.rotY + mouse.x * 0.45;
    const targetRotX = drag.rotX - mouse.y * 0.32;
    group.rotation.y += (targetRotY - group.rotation.y) * 0.05;
    group.rotation.x += (targetRotX - group.rotation.x) * 0.05;

    coreMesh.rotation.y =  t * 0.13 + entryBoost;
    coreMesh.rotation.x =  t * 0.08 + entryBoost * 0.5;
    wire.rotation.y     = -t * 0.09 - entryBoost;
    wire.rotation.x     =  t * 0.06 + entryBoost * 0.3;
    wire2.rotation.y    =  t * 0.06 + autoRotY * 0.3;
    wire2.rotation.z    = -t * 0.04;

    // Rotate holographic quantum orbital rings (Futuristic addition)
    if (typeof ring1 !== "undefined") {
      ring1.rotation.y =  t * 0.28;
      ring1.rotation.x =  0.4;
    }
    if (typeof ring2 !== "undefined") {
      ring2.rotation.y = -t * 0.18;
      ring2.rotation.z =  0.6;
    }

    // ── Satellites ──
    satellites.forEach((s, idx) => {
      // Explosion pushes radius outward then springs back
      const explosionR = exploding * 1.8;
      s.currentRadius += ((s.baseRadius + explosionR) - s.currentRadius) * 0.04;

      const angle  = t * s.speed + s.offset;
      const tiltX  = s.tilt + mouse.y * 0.25;
      const r      = s.currentRadius * entryScale;

      // Subtle magnetic pull toward mouse
      const pullX = mouse.x * 0.15;
      const pullY = mouse.y * 0.15;

      s.mesh.position.set(
        Math.cos(angle) * r + pullX,
        Math.sin(angle) * r * Math.sin(tiltX) + pullY,
        Math.sin(angle) * r * Math.cos(tiltX + mouse.x * 0.15)
      );
      s.mesh.rotation.x = t * 0.60 + mouse.y * 0.5;
      s.mesh.rotation.y = t * 0.42 + mouse.x * 0.5;
      s.mesh.scale.setScalar(entryScale * (1 + exploding * 0.4));
      
      // Satellites keep their own brand-color emissive (no hue cycling — harmony kept);
      // energy is expressed through emissiveIntensity below, not color drift.

      // Fade out as they get further from center to prevent edge clipping (revealing the square boundary)
      const maxRadius = 4.2;
      const fadeDist = 1.0;
      s.mesh.material.opacity = Math.max(0, Math.min(1, (maxRadius - s.currentRadius) / fadeDist));
      s.mesh.material.emissiveIntensity = (0.4 + smoothSpeed * 0.6 + breathe * 0.4) * s.mesh.material.opacity;
    });

    // ── Stars ──
    starsA.rotation.y =  t * 0.005 + mouse.x * 0.035;
    starsA.rotation.x =  mouse.y * 0.025;
    starsB.rotation.y = -t * 0.003 - mouse.x * 0.018;
    starsB.rotation.x = -mouse.y * 0.012;

    // ── Camera zoom + parallax ──
    camera.position.z += (targetZ - camera.position.z) * 0.04;
    camera.position.x += (mouse.x * 0.85 - camera.position.x) * 0.022;
    camera.position.y += (mouse.y * 0.65 - camera.position.y) * 0.022;
    camera.lookAt(0, 0, 0);

    renderer.render(scene, camera);
  }
  animate();

  const heroObs = new IntersectionObserver(entries => {
    entries.forEach(e => { _sceneVisible = e.isIntersecting; });
  }, { threshold: 0 });
  heroObs.observe(mount);

  window.addEventListener("resize", () => {
    const w = mount.clientWidth, h = mount.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }, { passive: true });
}

/* ── Glow blob ───────────────────────────────────────────── */
let _glowBlobRunning = false;

function initGlowBlob() {
  if (_glowBlobRunning) return;
  _glowBlobRunning = true;
  const _blobTier = window._deviceTier || 'high';

  const blob = document.querySelector(".noviq-glow-blob");
  if (!blob) return;
  blob.style.opacity = "1";

  let tx = 0, ty = 0, cx = 0, cy = 0;

  window.addEventListener("mousemove", e => {
    tx = (e.clientX / window.innerWidth  - 0.5) * 100;
    ty = (e.clientY / window.innerHeight - 0.5) * 100;
  }, { passive: true });

  const t0 = performance.now();
  let _blobFrame = 0;

  function update(now) {
    if (!_glowBlobRunning) return;
    /* Keep the loop alive while hidden — killing it here meant the blob
       froze forever after tab switches / idle (visibility throttling). */
    if (document.hidden) { requestAnimationFrame(update); return; }
    _blobFrame++;
    const skip = _blobTier === 'low' ? 2 : 1;

    const elapsed = (now - t0) / 1000;

    let base = 1;
    if (elapsed < 2.2) {
      const p = elapsed / 2.2, c1 = 1.70158, c3 = c1 + 1;
      base = 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2);
      if (base < 0) base = 0;
    }

    cx += (tx - cx) * 0.052;
    cy += (ty - cy) * 0.052;

    if (_blobFrame % skip === 0) {
      const pulse = Math.sin(elapsed * 1.1) * 0.06;
      blob.style.transform = `translate(calc(-50% + ${cx}px), calc(-50% + ${cy}px)) scale(${base * (1 + pulse)})`;
    }
    requestAnimationFrame(update);
  }

  requestAnimationFrame(update);
}
