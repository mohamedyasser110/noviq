/* ============================================================
   CRYSTAL ENERGY THEME SYSTEM
   Continuous theme interpolation from Deep Space (0%) to Crystal Lab (100%)
   ============================================================ */

(function() {
  'use strict';

  /* ============================================================
     CONFIGURATION
     ============================================================ */

  const STORAGE_KEY = 'noviq-energy-level';
  const root = document.documentElement;
  const DEFAULT_ENERGY = () => {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    return prefersDark ? 15 : 70; // Dark mode -> low energy, Light mode -> 70% default
  };

  /* ============================================================
     ENERGY STOPS (0-100 scale)
     ============================================================ */

  const STOPS = [
    { value: 0, name: 'Deep Space', nameAr: 'داكن عميق', bg: '#03020A', surface: '#080512', card: '#0D0A1E', border: '#211847' },
    { value: 20, name: 'Night Violet', nameAr: 'بنفسجي ليلي', bg: '#0B0817', surface: '#120D20', card: '#19132C', border: '#2C2253' },
    { value: 40, name: 'Royal Purple', nameAr: 'بنفسجي ملكي', bg: '#160D2A', surface: '#21163B', card: '#2A1E49', border: '#403267' },
    { value: 60, name: 'Soft Violet', nameAr: 'بنفسجي هادئ', bg: '#30234A', surface: '#3B2E57', card: '#463862', border: '#655777' },
    { value: 80, name: 'Lavender Mist', nameAr: 'ضباب اللافندر', bg: '#A99BC2', surface: '#B9ADCE', card: '#C8BED8', border: '#9586AD' },
    { value: 100, name: 'Pearl White', nameAr: 'نهاري ناصع', bg: '#F7F5FC', surface: '#FCFBFF', card: '#FFFFFF', border: '#D9D4E5' }
  ];

  /* ============================================================
     COLOR INTERPOLATION
     ============================================================ */

  function hexToRgb(hex) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return { r, g, b };
  }

  function rgbToHex(r, g, b) {
    return '#' + [r, g, b].map(x => Math.round(x).toString(16).padStart(2, '0')).join('');
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function interpolateColor(color1, color2, t) {
    const c1 = hexToRgb(color1);
    const c2 = hexToRgb(color2);
    const r = Math.round(lerp(c1.r, c2.r, t));
    const g = Math.round(lerp(c1.g, c2.g, t));
    const b = Math.round(lerp(c1.b, c2.b, t));
    return rgbToHex(r, g, b);
  }

  function getStopIndex(energy) {
    for (let i = STOPS.length - 1; i >= 0; i--) {
      if (energy >= STOPS[i].value) return i;
    }
    return 0;
  }

  function getInterpolationT(energy, lowerStop, upperStop) {
    if (lowerStop.value === upperStop.value) return 0;
    return (energy - lowerStop.value) / (upperStop.value - lowerStop.value);
  }

  function getInterpolatedColor(energy, colorKey) {
    const idx = getStopIndex(energy);
    const lower = STOPS[Math.min(idx, STOPS.length - 2)];
    const upper = STOPS[Math.min(idx + 1, STOPS.length - 1)];
    const t = getInterpolationT(energy, lower, upper);
    return interpolateColor(lower[colorKey], upper[colorKey], t);
  }

  /* ============================================================
     RELATIVE LUMINANCE & TEXT CONTRAST
     ============================================================ */

  function getRelativeLuminance(hex) {
    const { r, g, b } = hexToRgb(hex);
    const rsrgb = r / 255 <= 0.03928 ? r / 255 / 12.92 : Math.pow((r / 255 + 0.055) / 1.055, 2.4);
    const gsrgb = g / 255 <= 0.03928 ? g / 255 / 12.92 : Math.pow((g / 255 + 0.055) / 1.055, 2.4);
    const bsrgb = b / 255 <= 0.03928 ? b / 255 / 12.92 : Math.pow((b / 255 + 0.055) / 1.055, 2.4);
    return 0.2126 * rsrgb + 0.7152 * gsrgb + 0.0722 * bsrgb;
  }

  function getContrastRatio(color1, color2) {
    const l1 = getRelativeLuminance(color1);
    const l2 = getRelativeLuminance(color2);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  }

  function getTextColor(bgHex, lightText = '#FAF9FF', darkText = '#171121') {
    return getContrastRatio(bgHex, darkText) >= getContrastRatio(bgHex, lightText)
      ? darkText
      : lightText;
  }

  function toRgbChannels(hex) {
    const { r, g, b } = hexToRgb(hex);
    return `${r}, ${g}, ${b}`;
  }

  function getMutedTextColor(background, foreground, maxMix, minimumContrast) {
    let readableMix = 0;
    let unreadableMix = maxMix;

    for (let i = 0; i < 9; i++) {
      const mix = (readableMix + unreadableMix) / 2;
      const candidate = interpolateColor(foreground, background, mix);
      if (getContrastRatio(background, candidate) >= minimumContrast) {
        readableMix = mix;
      } else {
        unreadableMix = mix;
      }
    }

    return interpolateColor(foreground, background, readableMix);
  }

  function isArabic() {
    return document.documentElement.lang.toLowerCase().startsWith('ar');
  }

  function getStopName(stop) {
    return isArabic() ? stop.nameAr : stop.name;
  }

  /* ============================================================
     UPDATE THEME
     ============================================================ */

  let currentEnergy = DEFAULT_ENERGY();

  function updateTheme(energy) {
    const parsedEnergy = Number(energy);
    currentEnergy = Math.max(0, Math.min(100, Number.isFinite(parsedEnergy) ? parsedEnergy : 0));

    const bg = getInterpolatedColor(currentEnergy, 'bg');
    const surface = getInterpolatedColor(currentEnergy, 'surface');
    const card = getInterpolatedColor(currentEnergy, 'card');
    const border = getInterpolatedColor(currentEnergy, 'border');
    const text = getTextColor(surface);
    const usesDarkText = text === '#171121';
    const textSecondary = getMutedTextColor(surface, text, 0.34, 4.5);
    const textTertiary = getMutedTextColor(surface, text, 0.5, 3.2);
    const inverseText = usesDarkText ? '#FAF9FF' : '#171121';
    const progress = currentEnergy / 100;
    const primary = interpolateColor('#7C3AED', '#5B21B6', progress);
    const secondary = interpolateColor('#B79CFF', '#632AC7', progress);
    const accent = interpolateColor('#C47BFF', '#7726BE', progress);
    const accent2 = interpolateColor('#D7ACFF', '#8B35C8', progress);

    root.dataset.themeTone = usesDarkText ? 'light' : 'dark';
    root.style.colorScheme = usesDarkText ? 'light' : 'dark';
    root.style.setProperty('--energy-level', currentEnergy + '%');
    root.style.setProperty('--energy-progress', progress.toFixed(3));
    root.style.setProperty('--bg', bg);
    root.style.setProperty('--surface', surface);
    root.style.setProperty('--card', card);
    root.style.setProperty('--border', border);
    root.style.setProperty('--text', text);
    root.style.setProperty('--text-secondary', textSecondary);
    root.style.setProperty('--text-tertiary', textTertiary);
    root.style.setProperty('--text-inverse', inverseText);
    root.style.setProperty('--primary', primary);
    root.style.setProperty('--secondary', secondary);
    root.style.setProperty('--accent', accent);
    root.style.setProperty('--accent-2', accent2);
    root.style.setProperty('--bg-rgb', toRgbChannels(bg));
    root.style.setProperty('--surface-rgb', toRgbChannels(surface));
    root.style.setProperty('--card-rgb', toRgbChannels(card));
    root.style.setProperty('--text-rgb', toRgbChannels(text));
    root.style.setProperty('--text-inverse-rgb', toRgbChannels(inverseText));

    const glassAlpha = lerp(0.48, 0.8, progress);
    const glassRgb = hexToRgb(card);
    root.style.setProperty('--glass-bg', `rgba(${glassRgb.r}, ${glassRgb.g}, ${glassRgb.b}, ${glassAlpha})`);
    root.style.setProperty('--glass-bg-deep', `rgba(${glassRgb.r}, ${glassRgb.g}, ${glassRgb.b}, ${lerp(0.38, 0.68, progress)})`);
    root.style.setProperty('--glass-bg-light', `rgba(${glassRgb.r}, ${glassRgb.g}, ${glassRgb.b}, ${lerp(0.62, 0.9, progress)})`);
    root.style.setProperty('--glass-border', `rgba(${toRgbChannels(text)}, ${lerp(0.12, 0.15, progress)})`);
    root.style.setProperty('--nav-bg', `rgba(${toRgbChannels(bg)}, ${lerp(0.78, 0.88, progress)})`);
    root.style.setProperty('--menu-bg', `rgba(${toRgbChannels(bg)}, ${lerp(0.96, 0.98, progress)})`);
    root.style.setProperty('--popup-bg', `rgba(${toRgbChannels(card)}, ${lerp(0.94, 0.98, progress)})`);
    root.style.setProperty('--input-bg', `rgba(${toRgbChannels(card)}, ${lerp(0.7, 0.92, progress)})`);
    root.style.setProperty('--modal-backdrop', `rgba(10, 6, 20, ${lerp(0.62, 0.34, progress)})`);

    const shadowAlpha = lerp(0.28, 0.08, progress);
    root.style.setProperty('--shadow-sm', `0 8px 30px rgba(13,6,31,${shadowAlpha})`);
    root.style.setProperty('--shadow-md', `0 18px 54px rgba(73,35,130,${lerp(0.24, 0.13, progress)})`);
    root.style.setProperty('--shadow-lg', `0 28px 72px rgba(48,25,85,${lerp(0.24, 0.12, progress)})`);

    const glowIntensity = lerp(0.5, 0.28, progress);
    root.style.setProperty('--shadow-glow', `0 8px 32px rgba(109,40,255,${glowIntensity})`);
    root.style.setProperty('--shadow-glow-strong', `0 16px 42px rgba(109,40,255,${lerp(0.5, 0.34, progress)})`);

    const themeColorMeta = document.querySelector('meta[name="theme-color"]');
    if (themeColorMeta) themeColorMeta.setAttribute('content', bg);

    try { localStorage.setItem(STORAGE_KEY, currentEnergy.toFixed(1)); } catch (e) {}

    updateSliderDisplay();
    updateCrystalTokens(); // NEW: drive CSS design tokens
  }

  /* ============================================================
     CRYSTAL TOKENS — Update CSS custom properties from energy level
     ============================================================ */

  function updateCrystalTokens() {
    const p = currentEnergy / 100;
    
    const stops = [
      { v: 0,   c: '#0d0620' },
      { v: 0.1, c: '#140933' },
      { v: 0.2, c: '#1e0d4a' },
      { v: 0.3, c: '#280f5d' },
      { v: 0.4, c: '#351270' },
      { v: 0.5, c: '#4c1d95' },
      { v: 0.6, c: '#6d28d9' },
      { v: 0.7, c: '#8b5cf6' },
      { v: 0.8, c: '#a855f7' },
      { v: 0.9, c: '#c4b5fd' },
      { v: 1,   c: '#e9dbff' }
    ];

    function interpolate(c1, c2, t) {
      const r1 = parseInt(c1.slice(1,3),16), g1 = parseInt(c1.slice(3,5),16), b1 = parseInt(c1.slice(5,7),16);
      const r2 = parseInt(c2.slice(1,3),16), g2 = parseInt(c2.slice(3,5),16), b2 = parseInt(c2.slice(5,7),16);
      const r = Math.round(r1 + (r2-r1)*t);
      const g = Math.round(g1 + (g2-g1)*t);
      const b = Math.round(b1 + (b2-b1)*t);
      return '#'+r.toString(16).padStart(2,'0')+g.toString(16).padStart(2,'0')+b.toString(16).padStart(2,'0');
    }

    function getColor(energy) {
      if (energy <= 0) return stops[0].c;
      if (energy >= 1) return stops[stops.length-1].c;
      for (let i = 0; i < stops.length-1; i++) {
        if (energy >= stops[i].v && energy <= stops[i+1].v) {
          const t = (energy - stops[i].v) / (stops[i+1].v - stops[i].v);
          return interpolate(stops[i].c, stops[i+1].c, t);
        }
      }
      return stops[stops.length-1].c;
    }

    // Set 6 gradient stops that shift with energy
    const s = [
      Math.max(0, p - 0.4),
      Math.max(0, p - 0.3),
      Math.max(0, p - 0.15),
      p,
      Math.min(1, p + 0.3),
      Math.min(1, p + 0.5)
    ];

    root.style.setProperty('--crystal-s0', getColor(s[0]));
    root.style.setProperty('--crystal-s1', getColor(s[1]));
    root.style.setProperty('--crystal-s2', getColor(s[2]));
    root.style.setProperty('--crystal-s3', getColor(s[3]));
    root.style.setProperty('--crystal-s4', getColor(s[4]));
    root.style.setProperty('--crystal-s5', getColor(s[5]));
    root.style.setProperty('--energy-progress', p.toFixed(3));
  }

  /* ============================================================
     CRYSTAL TOGGLE (navbar)
     ============================================================ */

  function createCrystalToggle() {
    const navbar = document.getElementById('navbar');
    if (!navbar) return;

    const existingToggle = document.getElementById('theme-crystal-toggle');
    if (existingToggle) return;

    const toggleLabel = isArabic() ? 'تخصيص مظهر الموقع' : 'Adjust visual theme';
    const crystal = document.createElement('button');
    crystal.id = 'theme-crystal-toggle';
    crystal.className = 'noviq-crystal-toggle';
    crystal.type = 'button';
    crystal.setAttribute('aria-label', toggleLabel);
    crystal.setAttribute('aria-controls', 'theme-crystal-panel');
    crystal.setAttribute('aria-expanded', 'false');
    crystal.setAttribute('title', toggleLabel);

    // Premium crystal scene
    crystal.innerHTML = `
      <span class="crystal-scene sm" aria-hidden="true">
        <span class="crystal-aura"></span>
        <span class="crystal-gem"></span>
      </span>
    `;

    const mobileToggle = document.getElementById('mobile-toggle');
    if (mobileToggle) {
      mobileToggle.before(crystal);
    } else {
      navbar.appendChild(crystal);
    }

    crystal.addEventListener('click', openThemePanel);
  }

  /* ============================================================
     THEME PANEL
     ============================================================ */

  let panel = null;
  let panelCrystal = null;
  let sliderTrack = null;
  let sliderHandle = null;
  let sliderNodes = [];
  let previouslyFocused = null;
  let closeTimer = null;

  function createThemePanel() {
    if (panel) return;

    const ar = isArabic();
    const copy = {
      dialogLabel: ar ? 'تخصيص مظهر الموقع' : 'Theme Settings',
      close: ar ? 'إغلاق اللوحة' : 'Close panel',
      kicker: ar ? 'مظهر الواجهة' : 'Visual Theme',
      title: ar ? 'نمط الإضاءة والألوان' : 'Color & Ambient Control',
      description: ar
        ? 'تحكّم في مستوى السطوع والتباين بما يناسب عينيك أثناء التصفح.'
        : 'Adjust contrast and brightness to match your preferred reading environment.',
      sliderLabel: ar ? 'درجة السطوع' : 'Theme brightness',
      deep: ar ? 'داكن' : 'Deep',
      light: ar ? 'فاتح' : 'Light'
    };

    panel = document.createElement('div');
    panel.id = 'theme-crystal-panel';
    panel.className = 'noviq-theme-panel hidden';
    panel.setAttribute('aria-hidden', 'true');
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-label', copy.dialogLabel);

    panel.innerHTML = `
      <div class="panel-backdrop"></div>
      <div class="panel-container" role="document" tabindex="-1">
        <button class="panel-close" aria-label="${copy.close}">
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
        </button>
        <div class="panel-copy">
          <span class="panel-kicker">${copy.kicker}</span>
          <h2 id="theme-panel-title">${copy.title}</h2>
          <p>${copy.description}</p>
        </div>
        <div class="panel-crystal-container">
          <div class="panel-crystal">
            <div class="crystal-scene lg" aria-hidden="true">
              <span class="crystal-aura"></span>
              <span class="crystal-gem"></span>
            </div>
          </div>
        </div>
        <div class="panel-slider">
          <div class="slider-header">
            <span class="slider-stage">${getStopName(STOPS[0])}</span>
            <output class="slider-value">0%</output>
          </div>
          <div class="slider-track">
            <div class="track-base"></div>
            <div class="track-energy"></div>
            <div class="track-flow"></div>
            ${STOPS.map(stop => `
              <button type="button" class="track-node" data-value="${stop.value}" aria-label="${getStopName(stop)}: ${stop.value}%" style="--node-position: ${stop.value}%">
                <span class="node-gem" aria-hidden="true"></span>
                <span class="node-label">${getStopName(stop)}</span>
              </button>
            `).join('')}
            <div class="track-handle" role="slider" tabindex="0" aria-label="${copy.sliderLabel}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" aria-valuetext="${getStopName(STOPS[0])}, 0%">
              <span class="handle-gem" aria-hidden="true"></span>
            </div>
          </div>
          <div class="slider-extremes" aria-hidden="true">
            <span>${copy.deep}</span>
            <span>${copy.light}</span>
          </div>
        </div>
      </div>
    `;

    panel.querySelector('.panel-container').setAttribute('aria-labelledby', 'theme-panel-title');

    document.body.appendChild(panel);

    // Cache elements
    panelCrystal = panel.querySelector('.panel-crystal');
    sliderTrack = panel.querySelector('.slider-track');
    sliderHandle = panel.querySelector('.track-handle');
    sliderNodes = Array.from(panel.querySelectorAll('.track-node'));
    const closeBtn = panel.querySelector('.panel-close');
    const backdrop = panel.querySelector('.panel-backdrop');

    // Close handlers
    closeBtn.addEventListener('click', closeThemePanel);
    backdrop.addEventListener('click', closeThemePanel);

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && panel && !panel.classList.contains('hidden')) {
        closeThemePanel();
      }
    });

    panel.addEventListener('keydown', (e) => {
      if (e.key !== 'Tab') return;
      const focusable = Array.from(panel.querySelectorAll('button:not([disabled]), [tabindex="0"]'));
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    });

    // Slider interaction
    setupSlider();
    
    // Initialize
    updateSliderDisplay();
    updatePanelCrystal();
  }

  function updateSliderDisplay() {
    const stop = STOPS.reduce((closest, candidate) =>
      Math.abs(candidate.value - currentEnergy) < Math.abs(closest.value - currentEnergy)
        ? candidate
        : closest
    );
    const stageLabel = panel?.querySelector('.slider-stage');
    const valueLabel = panel?.querySelector('.slider-value');

    if (stageLabel) stageLabel.textContent = getStopName(stop);
    if (valueLabel) valueLabel.textContent = Math.round(currentEnergy) + '%';

    if (sliderHandle) {
      sliderHandle.style.setProperty('--slider-position', currentEnergy + '%');
      sliderHandle.setAttribute('aria-valuenow', Math.round(currentEnergy).toString());
      sliderHandle.setAttribute('aria-valuetext', `${getStopName(stop)}, ${Math.round(currentEnergy)}%`);
    }

    const energyBar = panel?.querySelector('.track-energy');
    if (energyBar) {
      energyBar.style.setProperty('--slider-position', currentEnergy + '%');
    }

    sliderNodes.forEach(node => {
      const value = parseFloat(node.dataset.value);
      const isActive = value === stop.value;
      node.classList.toggle('active', isActive);
      node.classList.toggle('passed', value <= currentEnergy);
      if (isActive) node.setAttribute('aria-current', 'true');
      else node.removeAttribute('aria-current');
    });

    updatePanelCrystal();
  }

  function updatePanelCrystal() {
    if (!panelCrystal) return;
    const p = currentEnergy / 100;
    panelCrystal.style.setProperty('--crystal-brightness', lerp(0.3, 1, p).toFixed(3));
    panelCrystal.style.setProperty('--energy-progress', p.toFixed(3));
    
    // Update navbar toggle tokens too
    document.documentElement.style.setProperty('--energy-progress', p.toFixed(3));
  }

  function setupSlider() {
    if (!sliderTrack || !sliderHandle) return;

    let activePointerId = null;

    function updateFromPointer(clientX) {
      const rect = sliderTrack.getBoundingClientRect();
      let percentage = ((clientX - rect.left) / rect.width) * 100;
      if (getComputedStyle(sliderTrack).direction === 'rtl') percentage = 100 - percentage;
      updateTheme(Math.max(0, Math.min(100, percentage)));
    }

    sliderTrack.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      activePointerId = e.pointerId;
      sliderTrack.setPointerCapture(e.pointerId);
      sliderHandle.classList.add('dragging');
      document.body.style.userSelect = 'none';
      updateFromPointer(e.clientX);
    });

    sliderTrack.addEventListener('pointermove', (e) => {
      if (activePointerId !== e.pointerId) return;
      e.preventDefault();
      updateFromPointer(e.clientX);
    });

    function finishDrag(e) {
      if (activePointerId !== e.pointerId) return;
      activePointerId = null;
      sliderHandle.classList.remove('dragging');
      document.body.style.userSelect = '';
      sliderHandle.focus({ preventScroll: true });
    }

    sliderTrack.addEventListener('pointerup', finishDrag);
    sliderTrack.addEventListener('pointercancel', finishDrag);

    sliderNodes.forEach(node => {
      node.addEventListener('click', (e) => {
        e.stopPropagation();
        updateTheme(parseFloat(node.dataset.value));
        sliderHandle.focus({ preventScroll: true });
      });
    });

    // Keyboard support
    sliderHandle.addEventListener('keydown', (e) => {
      const step = e.shiftKey ? 10 : 2;
      let newValue = currentEnergy;

      const isRtl = getComputedStyle(sliderTrack).direction === 'rtl';
      switch (e.key) {
        case 'ArrowLeft':
          newValue = currentEnergy + (isRtl ? step : -step);
          e.preventDefault();
          break;
        case 'ArrowRight':
          newValue = currentEnergy + (isRtl ? -step : step);
          e.preventDefault();
          break;
        case 'ArrowDown':
          newValue = currentEnergy - step;
          e.preventDefault();
          break;
        case 'ArrowUp':
          newValue = currentEnergy + step;
          e.preventDefault();
          break;
        case 'Home':
          newValue = 0;
          e.preventDefault();
          break;
        case 'End':
          newValue = 100;
          e.preventDefault();
          break;
      }
      
      if (newValue !== currentEnergy) {
        newValue = Math.max(0, Math.min(100, newValue));
        updateTheme(newValue);
      }
    });
  }

  /* ============================================================
     FLIP ANIMATION
     ============================================================ */

  function openThemePanel() {
    if (document.body.classList.contains('intro-active')) return;

    if (!panel) createThemePanel();
    if (!panel.classList.contains('hidden')) return;

    clearTimeout(closeTimer);
    previouslyFocused = document.activeElement;
    panel.classList.remove('hidden');
    document.body.classList.add('theme-panel-open');
    document.getElementById('theme-crystal-toggle')?.setAttribute('aria-expanded', 'true');
    panel.setAttribute('aria-hidden', 'false');

    requestAnimationFrame(() => {
      panel.classList.add('visible');
    });

    setTimeout(() => {
      panel.querySelector('.track-handle')?.focus({ preventScroll: true });
    }, 320);
  }

  function closeThemePanel() {
    if (!panel || panel.classList.contains('hidden')) return;

    panel.classList.remove('visible');
    panel.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('theme-panel-open');
    document.getElementById('theme-crystal-toggle')?.setAttribute('aria-expanded', 'false');

    closeTimer = setTimeout(() => {
      panel.classList.add('hidden');
    }, 280);

    if (previouslyFocused instanceof HTMLElement) {
      previouslyFocused.focus({ preventScroll: true });
    }
  }

  /* ============================================================
     REDUCED MOTION
     ============================================================ */

  function handleReducedMotion() {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    document.documentElement.style.setProperty('--crystal-animation', prefersReduced ? 'none' : 'gemFloat 5.5s ease-in-out infinite');
  }

  /* ============================================================
     INITIALIZE
     ============================================================ */

  function init() {
    // Load saved energy or default
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved !== null) {
        currentEnergy = parseFloat(saved);
      }
    } catch (e) {}
    
    // Clamp to 0-100
    currentEnergy = Math.max(0, Math.min(100, currentEnergy));
    
    // Apply initial theme
    updateTheme(currentEnergy);
    
    // Create UI
    createCrystalToggle();
    createThemePanel();
    
    // Handle reduced motion
    handleReducedMotion();
    window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', handleReducedMotion);
    
    // Close on outside click
    document.addEventListener('click', (e) => {
      if (panel && !panel.classList.contains('hidden')) {
        if (!panel.contains(e.target) && !e.target.closest('#theme-crystal-toggle')) {
          closeThemePanel();
        }
      }
    });
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Expose API
  window.CrystalTheme = { update: updateTheme, getEnergy: () => currentEnergy };
})();



