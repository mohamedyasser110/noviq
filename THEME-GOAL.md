# Crystal Energy Theme System — Goal Document

## What This Replaces
There is currently NO dark/light mode toggle. The website is purely dark theme. This system adds a continuous "Crystal Energy" theme that replaces the concept of a binary dark/light switch.

## Core Concept
Instead of toggling between "dark" and "light", the user slides through a continuous spectrum of "energy levels" from 0% (Deep Space) to 100% (Pearl White). Every value in between produces a unique atmosphere.

## Files
- `frontend/js/engine/theme-crystal.js` — All JavaScript logic
- `frontend/css/theme-crystal.css` — All styling
- `frontend/styles.css` — Imports theme-crystal.css
- `frontend/index.html` — Loads theme-crystal.js

## How It Works

### Energy Stops (6 stops, 0–100)
| Value | Name | Description |
|-------|------|-------------|
| 0% | Deep Space | Pure dark, deep space atmosphere |
| 20% | Dark Purple | Current dark theme baseline |
| 40% | Royal Purple | Richer purple tones emerge |
| 60% | Soft Violet | Lighter, more violet |
| 80% | Lavender | Lavender tones, lighter backgrounds |
| 100% | Pearl White | Bright futuristic crystal lab |

### CSS Variables Interpolated (on `:root`)
- `--bg` — Page background
- `--surface` — Section backgrounds
- `--card` — Card backgrounds
- `--border` — Border colors
- `--text` — Text color (computed dynamically for contrast)
- `--text-secondary` — Muted text
- `--glass-bg` — Glass transparency
- `--shadow-*` — Shadow intensity
- `--shadow-glow` — Glow intensity

### Text Contrast
Text color is NOT linearly interpolated. Instead:
1. Background luminance is computed
2. A smoothstep function determines if light or dark text is needed
3. This ensures WCAG AA contrast at every energy level

### Persistence
- Saved in `localStorage` under key `noviq-energy-level`
- Default: `15` if system prefers dark, `85` if system prefers light
- Restored on every page load

## UI Components

### 1. Crystal Toggle (in Navbar)
- Small crystal button next to mobile toggle
- 3D crystal shape rotating around Y axis elegantly
- Aura glow that breathes
- Orbiting particles
- Hover: expands glow, speeds rotation
- Click: opens theme panel with FLIP animation

### 2. Theme Panel (Floating)
- Glassmorphism panel centered on screen
- Opened via a FLIP (shared-element) animation from the navbar crystal
- Contains:
  - Large crystal (same 3D design, bigger)
  - Energy slider with node names

### 3. Energy Slider (Custom, Not Native)
- Glowing track with 6 crystal nodes
- Energy flow line that fills as slider moves
- Diamond-shaped handle
- Stage name and percentage display
- Supports: pointer drag, click-to-jump, keyboard arrows, Home/End

## Accessibility
- `role="slider"` with `aria-valuemin/max/now` on handle
- Keyboard navigation (Arrow keys, Home, End)
- `prefers-reduced-motion` disables rotation animations
- Visible focus states
- Text contrast checked at every level

## What the CSS Still Needs (To-Do)
The CSS (`theme-crystal.css`) is outdated and references old class names. The JS has been updated with new class names. The CSS must be rewritten to use these new class names:

### New HTML Structure for Crystal Toggle
```
.crystal-toggle
  .crystal-scene
    .crystal-3d
      .crystal-shard.shard-top
      .crystal-shard.shard-bottom
      .crystal-shine
    .crystal-aura
    .crystal-orbit
      .orbit-particle (×3)
```

### New HTML Structure for Panel Slider
```
.slider-header
  .slider-stage
  .slider-value
.slider-track
  .track-base
  .track-energy
  .track-flow
  .track-node (×6, each with .node-gem + .node-label)
  .track-handle
    .handle-gem
```

### Old Class Names → New Class Names
| Old | New |
|-----|-----|
| `.crystal-core` | `.crystal-3d` |
| `.crystal-face-1/2/3` | `.crystal-shard.shard-top/bottom` + `.crystal-shine` |
| `.crystal-glow` | `.crystal-aura` |
| `.crystal-particles` / `.particle` | `.crystal-orbit` / `.orbit-particle` |
| `.slider-label` | `.slider-header` |
| `.label-name` | `.slider-stage` |
| `.label-percentage` | `.slider-value` |
| `.track-line` | `.track-base` |
| `.track-energy` | `.track-energy` (same) |
| (new) | `.track-flow` |
| `.node-crystal` | `.node-gem` |
| (new) | `.node-label` |
| `.track-handle` | `.track-handle` (same, with `.handle-gem` inside) |

## What the JS Still Uses (Already Updated)
The JS has the new HTML structure but may need verification:
- [ ] `createCrystalToggle()` — uses new `.crystal-scene` structure ✓
- [ ] `createThemePanel()` — uses new slider structure ✓
- [ ] `updateSliderDisplay()` — uses `.slider-stage` and `.slider-value` ✓

## Next Steps
1. Rewrite `theme-crystal.css` to match the new JS HTML structure
2. Test the FLIP animation works correctly
3. Test all energy levels for text contrast
4. Test on mobile and RTL
5. Test with `prefers-reduced-motion`
