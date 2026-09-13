# Noviq Solutions — Design System & Brand Identity

---

## Table of Contents

- [1. Brand Overview](#1-brand-overview)
- [2. Visual Style](#2-visual-style)
- [3. Color Palette](#3-color-palette)
- [4. Typography](#4-typography)
- [5. Logo Guidelines](#5-logo-guidelines)
- [6. UI Design Style](#6-ui-design-style)
- [7. Glassmorphism & Liquid Glass](#7-glassmorphism--liquid-glass-core-visual)
- [8. Animation Philosophy](#8-animation-philosophy)
- [9. Intro Animation](#9-intro-animation)
- [10. Section Breakdown](#10-section-breakdown)
- [11. Component Library](#11-component-library)
- [12. Micro-Interactions](#12-micro-interactions)
- [13. Photography & Illustration](#13-photography--illustration-style)
- [14. Voice & Messaging](#14-voice--messaging)
- [15. Layout & Responsiveness](#15-layout--responsiveness)
- [16. Accessibility](#16-accessibility)
- [17. File Structure](#17-file-structure)
- [18. Future Improvements](#18-future-improvements)

---

## 1. Brand Overview

| Attribute           | Value                          |
| ------------------- | ------------------------------ |
| **Company Name**    | Noviq Solutions                |
| **Short Name**      | Noviq                          |
| **Industry**        | Software, AI, ERP, CRM, SaaS   |
| **Tagline**         | *Engineering the Future Through Technology* |
| **Brand Feel**      | Stripe × Linear × Vercel × Notion × Apple |

### Brand Personality
Premium · Modern · Intelligent · Innovative · Scalable · Reliable · Professional · Global · Minimalist · Future-Oriented

### Brand Keywords
Innovation · Intelligence · Technology · Precision · Trust · Growth · Performance · Scalability · Simplicity

### Tone of Voice
Professional · Confident · Modern · Clear · Direct

> "We build smart digital solutions."
> "Engineering the future through technology."
> "Scalable software for ambitious businesses."
> "Transforming ideas into powerful digital products."

---

## 2. Visual Style

Premium SaaS company — dark mode only — minimalistic — luxury aesthetic — **glassmorphism** — soft purple ambient glow — large whitespace — 20–24px rounded corners — smooth gradients — floating UI elements — elegant depth — clean grid — professional corporate feel — extremely polished.

### Design References
| Reference  | Influence                          |
| ---------- | ---------------------------------- |
| Stripe     | Enterprise trust, clean layouts    |
| Linear     | Clean minimalism, smooth UX        |
| Vercel     | Developer focus, technical polish  |
| Notion     | Spacious typography, simplicity    |
| Apple      | Precision & polish, premium feel   |
| Framer     | Smooth motion, micro-interactions  |

---

## 3. Color Palette

### Core Colors

| Token             | Hex       | Usage                               |
| ----------------- | --------- | ----------------------------------- |
| `--primary`       | `#6D28FF` | Buttons, gradients, key accents      |
| `--secondary`     | `#8B5CF6` | Secondary text, hover states         |
| `--accent`        | `#A855F7` | Gradient highlights, glow effects    |
| `--bg`            | `#0B0817` | Page background (deep space)         |
| `--surface`       | `#151028` | Section alt backgrounds              |
| `--card`          | `#1B1533` | Card / panel backgrounds             |
| `--border`        | `#2A224D` | Subtle borders                       |

### Text Colors

| Token             | Hex       | Usage                               |
| ----------------- | --------- | ----------------------------------- |
| `--text`          | `#FFFFFF` | Primary text                         |
| `--text-secondary`| `#B8B8C7` | Secondary / muted text               |

### State Colors

| Token             | Hex       | Usage                               |
| ----------------- | --------- | ----------------------------------- |
| `--success`       | `#22C55E` | Success states, checkmarks           |
| `--warning`       | `#F59E0B` | Warning states, alerts               |
| `--danger`        | `#EF4444` | Error states, validation             |

### Gradients

| Gradient          | Stops                             |
| ----------------- | --------------------------------- |
| Primary Linear    | `#6D28FF → #8B5CF6 → #A855F7`   |
| Dark Section      | `#0B0817 → #151028`              |
| Purple Glow       | radial + linear blends throughout  |
| Text Gradient     | `#C08CFF → #A855F7 → #6D28FF`    |
| Glass Border      | `rgba(109,40,255,0.3) → rgba(168,85,247,0.5)` |

---

## 4. Typography

### Font Stack

| Role          | Font              | Weight     | Fallback              |
| ------------- | ----------------- | ---------- | --------------------- |
| **Headings**  | Space Grotesk     | 600–700    | sans-serif            |
| **Body**      | Inter             | 300–600    | sans-serif            |
| **Alternatives** | General Sans, Satoshi, Plus Jakarta Sans | — | — |

### Type Scale

| Token                 | Size                            | Usage                     |
| --------------------- | ------------------------------- | ------------------------- |
| `--text-hero`         | `clamp(42px, 6.5vw, 96px)`     | Hero headline             |
| `--text-h2`           | `clamp(28px, 4.2vw, 56px)`     | Section titles            |
| `--text-h3`           | `clamp(20px, 2.2vw, 30px)`     | Card titles               |
| `--text-body`         | `clamp(15px, 1.4vw, 18px)`     | Body text                 |
| `--text-small`        | `clamp(13px, 1vw, 15px)`       | Labels, captions          |

- All text uses fluid `clamp()` scaling for responsiveness
- Line-height: headings 1.1, body 1.6
- Letter-spacing: headings -0.03em, body normal

---

## 5. Logo Guidelines

| Attribute      | Value                      |
| -------------- | -------------------------- |
| **Type**       | Combination Mark            |
| **Icon**       | Custom geometric letter "N" |
| **Style**      | Minimal · Modern · Memorable |

### SVG Specifications

The N icon uses a custom SVG path in viewBox `0 0 100 100`:

```svg
<path d="M28 77 L28 23 L72 77 L72 23" stroke="url(#logoGrad)" stroke-width="13" stroke-linecap="round" stroke-linejoin="round"/>
```

**Sizes:**
- Desktop navbar: 32px × 32px
- Intro animation (full): 420px × 420px → scales to ~260px
- Mobile: 28px × 28px

### Logo Meaning
The "N" symbol represents: Innovation · Forward Movement · Precision · Smart Engineering · Digital Transformation

### Do NOT Use
✗ Generic tech icons · Circuit boards · Gears · Robots · Stock symbols

---

## 6. UI Design Style

- **Dark mode first** — no light mode variant
- **Premium glass effects** — `backdrop-filter: blur(18px)` on all cards
- **Rounded corners** — 16px–24px, consistent across components
- **Soft shadows** — purple-tinted `drop-shadow` for depth
- **Purple glow** — ambient radial gradients behind key sections
- **Smooth hover effects** — lift + border glow on interactive elements
- **High contrast** — WCAG AA minimum on all text pairings
- **Grid system** — flexible 2–4 column, collapses to single at mobile
- **Section spacing** — consistent `padding: 120px 6%`

---

## 7. Glassmorphism & Liquid Glass (Core Visual)

The primary surface treatment for every card, panel, and section container.

### Base Glass
```css
background: rgba(27, 21, 51, 0.5);
backdrop-filter: blur(18px) saturate(1.1);
border: 1px solid rgba(42, 34, 77, 0.6);
border-radius: 22px;
```

### Liquid Glass Enhancements

| Effect                   | Implementation                                   |
| ------------------------ | ------------------------------------------------ |
| Iridescent border        | `::before` + `conic-gradient` + `@property --angle` |
| Shimmer sweep            | `::after` diagonal gradient sweep on hover       |
| Morphing blobs           | `.liquid-blob` + animated `border-radius` (12–18s) |
| Depth variants           | `.noviq-glass-deep` (blur 28px) / `.noviq-glass-light` (blur 10px) |
| Inner glow               | `inset` shadows for concave/convex depth          |
| Icon badge shimmer       | Reflection sweep on service card icons           |

**Hover state:** iridescent border activates, shimmer sweeps across, border transitions to purple, shadow expands, element lifts.

---

## 8. Animation Philosophy

**Smooth · Fast · Premium · Professional** (120fps-style — `will-change` on animated elements)

| Technique                    | Implementation                              |
| ---------------------------- | ------------------------------------------- |
| Scroll reveal (4 variants)   | `reveal` / `reveal-left` / `reveal-right` / `reveal-scale` + IntersectionObserver |
| Stagger cards                | Transition-delay per index (90ms steps)     |
| 3D tilt on hover             | JS mouse-tracking with `rotateX`/`rotateY` |
| Three.js 3D scene            | WebGL geometric core (hero)                |
| Counters                     | `requestAnimationFrame` with easeOutExpo    |
| Testimonial auto-slide       | `setInterval` + crossfade + dot nav        |
| Floating tech chips          | CSS `@keyframes` float + random delays     |
| Navbar blur on scroll        | CSS class toggle at 80px scroll            |
| Liquid Glass shimmer         | `::after` sweep on hover                   |
| Iridescent border            | `conic-gradient` + `@property --angle`     |
| Morphing blobs               | CSS `border-radius` keyframes              |
| Custom cursor                | Dot + ring + trail, ring expands on hover  |
| Magnetic buttons             | JS translates toward cursor on hover       |
| Ripple click                 | Expanding circle from click point          |
| HUD progress                 | Vertical track + gradient fill + glow orb  |
| Text split reveal            | Character-by-character entrance on scroll  |
| Parallax layers              | `data-parallax` + Y offset on scroll       |
| Section header eyebrow       | Animated line divider before label          |

### Easing Curves

```css
--ease-smooth: cubic-bezier(0.16, 1, 0.3, 1);
--ease-out: cubic-bezier(0, 0, 0.2, 1);
--ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);
```

### Motion Safety
- All animations respect `prefers-reduced-motion: reduce`
- Custom cursor disabled when `hover: none` (touch devices)
- Parallax disabled on mobile

---

## 9. Intro Animation

A 5-second cinematic entrance sequence that sets the brand tone immediately.

### Timeline

| Time      | Event                                        | Visual                           |
| --------- | -------------------------------------------- | -------------------------------- |
| 0.0s      | Background particles start falling            | 300 twinkling stars              |
| 0–3.3s    | Star particles converge to form letter "N"    | 350 dots assemble into N shape   |
| 1.85s     | Gradient face layer of N icon appears         | Purple gradient stroke           |
| 1.95s     | Glow effect begins                           | `drop-shadow` purple glow        |
| 2.05–2.85s| Glow burst pulse                             | Expanding glow ring              |
| 2.3–3.1s  | Subtle scale pulse                           | 1.0 → 1.04 → 1.0               |
| 2.6s      | 3D rotation begins                           | `8° rotY, -4° rotX`             |
| 2.85s     | N slides left + shrinks                      | x: 750→497, scale: 1→0.62      |
| 3.1s      | Idle floating motion starts                   | `sin` wave, ±6px                |
| 3.4–3.7s  | Letters "o", "v", "i", "q" appear            | Slide in from left, stagger 90ms |
| 4.0s      | Underline draws under "Noviq"                | 700px gradient line              |
| 4.2s      | Tagline fades in                             | "Software, engineered forward."  |
| 5.0s      | Overlay fades out, page content loads         | `opacity: 0` + `visibility: hidden` |

### Camera Motion
The entire intro overzoom container subtly scales throughout:
- 0–2.8s: `1.04 → 1.09` (slow zoom in)
- 2.8–3.6s: `1.09 → 1.0` (zoom out to normal)
- 3.6–5.0s: `1.0 → 1.02` (gentle settle)

---

## 10. Section Breakdown

| Section         | Description                                      | Visual Treatment                  |
| --------------- | ------------------------------------------------ | --------------------------------- |
| **Intro**       | 5s cinematic overlay — particles + N 3D + reveal | Full-screen overlay, fixed        |
| **Navbar**      | Fixed transparent → blur on scroll               | Glass effect after 80px           |
| **Hero**        | Split layout — headline + 3D geometric core      | Three.js WebGL scene              |
| **Stats**       | Animated counters                                | 4-column grid, easeOutExpo        |
| **Services**    | 11 glass cards with Lucide icons + tilt          | 4-column grid, stagger reveal     |
| **Why Noviq**   | 8 value-proposition glass cards                  | 4-column grid                      |
| **Industries**  | 8 interactive cards with icon                    | 4-column grid, hover scale        |
| **Portfolio**   | 4 case study cards with hover overlay            | 2×2 grid, overlay on hover        |
| **Process**     | 7-step animated timeline + HUD progress          | Vertical line, numbered nodes     |
| **Testimonials**| Auto-rotating quotes with dot nav                | Single card, crossfade            |
| **Tech Stack**  | 17 floating animated chips                       | Flex wrap, float keyframes        |
| **Contact**     | 2-column — form + info                           | Glass card form, validation       |
| **Footer**      | 5-column — links, newsletter, social             | Dark surface, 3 columns mobile    |

---

## 11. Component Library

### Buttons

| Variant       | Class                    | Style                                     |
| ------------- | ------------------------ | ----------------------------------------- |
| Primary       | `.noviq-btn-primary`     | `--primary` bg, white text, hover glow    |
| Secondary     | `.noviq-btn-secondary`   | Transparent, border, hover fill           |
| Ghost         | `.noviq-btn-ghost`       | No bg, hover surface                      |

**States:** default, hover (lift + glow), active (scale 0.97), focus-visible (ring)

### Cards

| Variant         | Class                  | Style                                    |
| --------------- | ---------------------- | ---------------------------------------- |
| Glass Card      | `.noviq-glass-card`    | Glassmorphism + hover lift               |
| Service Card    | `.noviq-service-card`  | Glass + tilt + icon shimmer              |
| Industry Card   | `.noviq-industry-card` | Glass + hover scale + icon               |
| Project Card    | `.noviq-project-card`  | Image + overlay on hover                 |

### Form Elements

| Element    | Style                                                     |
| ---------- | --------------------------------------------------------- |
| Input      | Dark bg, glass border, focus purple ring                  |
| Textarea   | Same as input, resize vertical                            |
| Button     | Submit with loading + success/error states                |
| Error msg  | Red text below field, slide in animation                  |

### Navigation

| Element      | Style                                              |
| ------------ | -------------------------------------------------- |
| Desktop nav  | Horizontal links with underline slide on hover     |
| Mobile nav   | Full-screen overlay with slide-in menu             |
| Logo         | N icon + "oviq" text side by side                  |
| CTA button   | Primary button in nav bar                          |

---

## 12. Micro-Interactions

| Interaction              | Effect                                              |
| ------------------------ | --------------------------------------------------- |
| Button click             | Scale 0.97 + ripple wave from click point           |
| Navbar link hover        | Underline slides in from left                       |
| Card hover               | Lift 4px + border glow + shadow expand              |
| Input focus              | Purple ring glow + subtle shadow                    |
| Testimonial transition   | Crossfade between quotes                            |
| Form submit              | Loading spinner → checkmark or error shake          |
| Toast notification       | Slide in from right, auto-dismiss after 3s          |
| Cursor over interactive  | Ring expands to 2× size                             |
| Magnetic button hover    | Button tracks cursor position within bounds         |
| Scroll reveal            | Elements slide up with stagger delay                |
| Service icon pulse       | Gentle pulse on card hover                          |

---

## 13. Photography & Illustration Style

### Photography
- Modern technology offices · Developers working · Server rooms
- Purple / blue lighting accents
- High contrast · Shallow depth of field
- Professional corporate atmosphere

### Illustration
- Abstract geometric shapes · Floating 3D objects
- Purple gradient fills · Wireframe overlays
- Futuristic / tech aesthetic
- No photos of people — abstract + environmental only

### Image Specifications
- Format: PNG / WebP
- Max width: 1200px
- Aspect ratio: 16:9 or 4:3
- Dark theme optimized (avoid bright backgrounds)

---

## 14. Voice & Messaging

| Do Say                                    | Don't Say                     |
| ----------------------------------------- | ----------------------------- |
| "We build smart digital solutions."       | Corporate buzzwords           |
| "Engineering the future through technology." | Overly sales-focused       |
| "Scalable software for ambitious businesses." | Complex technical jargon    |
| "Transforming ideas into powerful products." | Vague promises              |

### Writing Principles
- **Be direct:** Lead with value, not features
- **Be specific:** Show numbers, avoid generalities
- **Be confident:** Use active voice, assertive tone
- **Be human:** Avoid robotic / overly formal language

---

## 15. Layout & Responsiveness

### Breakpoints

| Device         | Width   | Grid Columns |
| -------------- | ------- | ------------ |
| Desktop XL     | 1100px+ | 4            |
| Desktop        | 1000px+ | 3–4          |
| Tablet         | 900px+  | 2–3          |
| Tablet Small   | 800px+  | 2            |
| Mobile         | 560px-  | 1            |

### Layout Rules
- Section padding: `120px 6%` (reduced to `80px 5%` at tablet, `60px 4%` at mobile)
- Max content width: 1400px with auto margins
- Consistent 20px gap between grid items
- Process timeline hides connector line on mobile

---

## 16. Accessibility

| Requirement               | Implementation                           |
| ------------------------- | ---------------------------------------- |
| aria-labels               | All buttons, icons, sections             |
| Keyboard navigation       | `focus-visible` outlines, tab order      |
| Reduced motion            | `prefers-reduced-motion` disables all    |
| Color contrast            | WCAG AA minimum on all text              |
| Semantic HTML             | Proper heading hierarchy, landmarks      |
| Form labels               | All inputs have associated labels        |
| Screen reader             | Descriptive alt text, ARIA live regions  |

---

## 17. File Structure

```
noviq/
├── index.html                          # Main landing page
├── styles.css                          # Imports all css/* files
├── script.js                           # Entry point, imports all js/*
│
├── data/
│   └── content.config.js               # All text content (edit here)
│
├── css/
│   ├── tokens.css                      # Colors, typography, spacing
│   ├── base.css                        # Resets, cursor, scrollbar
│   ├── glass.css                       # Glass system + signature trace
│   ├── components.css                  # Navbar, buttons, inputs, toast
│   ├── sections.css                    # Each section's layout
│   ├── motion.css                      # Reveal animations, HUD
│   ├── intro.css                       # Intro overlay styles
│   └── responsive.css                  # Mobile queries (loaded last)
│
├── js/
│   ├── engine/
│   │   ├── utils.js                    # Helper utilities
│   │   ├── reveal.js                   # Scroll intersection observer
│   │   ├── cursor.js                   # Custom cursor system
│   │   ├── navigation.js               # Navbar scroll + mobile
│   │   ├── hero3d.js                   # Three.js 3D scene
│   │   └── intro.js                    # Intro canvas + animation
│   └── render/
│       ├── build-static.js             # Static section builders
│       ├── build-sections.js           # Dynamic section builders
│       ├── testimonials.js             # Testimonial carousel
│       └── contact-form.js             # Form + validation + toast
│
└── images/
    ├── project-ai.png
    ├── project-fintech.png
    ├── project-healthcare.png
    └── project-retail.png
```

### Architecture Notes
- `styles.css` and `script.js` serve as indexes only — no actual rules/logic
- CSS loads in order: tokens → base → glass → components → sections → motion → intro → responsive
- JS loads in order: utils → reveal → cursor → navigation → hero3d → intro → render modules
- All text content in `data/content.config.js` loaded at runtime

---

## 18. Future Improvements

| Priority | Feature                      | Implementation                        |
| -------- | ---------------------------- | ------------------------------------- |
| 1        | Page transitions             | Barba.js or Swup for SPA-like nav     |
| 2        | GSAP ScrollTrigger           | Richer scroll sequences               |
| 3        | Form backend                 | SendGrid / Resend integration         |
| 4        | Lazy loading                 | Code-split Three.js + image lazy load |
| 5        | SEO                          | Open Graph, Twitter Card, JSON-LD     |
| 6        | i18n                         | Multi-language (English + Arabic)     |
| 7        | Theme toggle                 | CSS custom properties for light mode  |
| 8        | 3D background scenes         | More Three.js elements throughout     |
| 9        | Performance budget           | Lighthouse CI, bundle analysis        |
| 10       | PWA                          | Service worker, offline support       |

---

## Design Tokens Reference

All design tokens are defined in `css/tokens.css` as CSS custom properties.
Refer to this file as the single source of truth for all visual values.

For any questions or contributions, refer to the **Editing Guide** (`README.md`).
