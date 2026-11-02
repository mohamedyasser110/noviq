/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        /* ---------------------------------------------------------
         * HOW COLOURS ARE WIRED HERE (read before editing)
         * ---------------------------------------------------------
         * globals.css stores tokens as RAW HSL TRIPLES ("210 85% 48%"),
         * not finished colours, so the hsl() wrapper must live HERE.
         * Two rules follow from that:
         *
         * 1. Never pre-format a token as hsl()/oklch() in globals.css.
         *    The config would then wrap a finished colour a second time.
         *
         * 2. Opacity modifiers (/10, /50, …) are MASKED in this setup.
         *    `bg-primary/10` compiles to a legacy srgb fallback that
         *    double-wraps — color-mix(in srgb, hsl(hsl(var(--color-primary)))
         *    10%, transparent) — and hsl() cannot nest, so the browser
         *    discards that line. It is not visible today because Tailwind
         *    emits a correct oklab replacement right after it inside
         *    `@supports (color:color-mix(in lab,red,red))`:
         *        color-mix(in oklab, hsl(var(--color-primary)) 10%, transparent)
         *    That single wrap is valid, and every browser new enough to
         *    matter (Chrome 111+, Safari 16.2+, Firefox 113+) honours it.
         *    So the modifiers render correctly and the srgb line is inert.
         *
         *    The `<alpha-value>` placeholder does NOT fix this under
         *    Tailwind v4's @config (v3-compat) layer — it substitutes the
         *    placeholder to 1 and re-wraps anyway. The clean fix is to
         *    move these roles into a CSS `@theme` block, which is the
         *    v4-native home for colours and supports alpha modifiers
         *    natively. Left undone deliberately: it renames the utilities
         *    (bg-noviq-primary/10, …) and would touch ~92 call sites.
         *    Tracked here so the next person does not re-try the
         *    placeholder and assume it is broken.
         */
        border: 'hsl(var(--color-border))',
        input: 'hsl(var(--color-border-strong))',
        ring: 'hsl(var(--color-primary))',
        background: 'hsl(var(--color-background))',
        foreground: 'hsl(var(--color-text))',
        primary: {
          DEFAULT: 'hsl(var(--color-primary))',
          foreground: '#FFFFFF',
          /* The remaining steps exist as tokens in globals.css but had no
           * Tailwind mapping, so `text-primary-strong` silently compiled to
           * nothing and the element inherited the body colour. Mapped here
   * so utilities can reach them. Purely additive — no existing call site
           * changes meaning. `strong` is the WCAG-safe small-text orange
           * (5.55:1); the DEFAULT #EA580C only clears the 3:1 large-text
           * floor and must not be used for small type. */
          hover: 'hsl(var(--color-primary-hover))',
          strong: 'hsl(var(--color-primary-strong))',
          container: 'hsl(var(--color-primary-container))',
          glow: 'hsl(var(--color-primary-glow))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--color-secondary))',
          foreground: '#FFFFFF',
        },
        destructive: {
          DEFAULT: 'hsl(var(--color-error))',
          foreground: '#FFFFFF',
        },
        muted: {
          DEFAULT: 'hsl(var(--color-surface-container))',
          foreground: 'hsl(var(--color-text-secondary))',
        },
        accent: {
          DEFAULT: 'hsl(var(--color-accent))',
          foreground: 'hsl(var(--color-text))',
    /* Same story as `primary` above: these are the tokens the stylesheet
           * already uses for the SIGNAL layer (eyebrows, ticks, ghost rules)
           * and they were unreachable from a utility class until now. */
          hover: 'hsl(var(--color-accent-hover))',
          action: 'hsl(var(--color-accent-action))',
          bright: 'hsl(var(--color-accent-bright))',
    container: 'hsl(var(--color-accent-container))',
        },
        card: {
          DEFAULT: 'hsl(var(--md-surface))',
          foreground: 'hsl(var(--color-text))',
        },
        /* Qodix-style named brand roles (see globals.css "QODIX v2").
           These point at raw HSL triples, hence the hsl() wrapper.
           Hierarchy comes from alpha modifiers on these, not new hues:
           text-ink/70, text-ink/45, text-ink/30. */
        navy: 'hsl(var(--navy))',
        gold: 'hsl(var(--gold))',
        'warm-grey': 'hsl(var(--warm-grey))',
        ink: {
          DEFAULT: 'hsl(var(--ink))',
          soft: 'hsl(var(--ink-soft))',
          muted: 'hsl(var(--ink-muted))',
          faint: 'hsl(var(--ink-faint))',
        },
        line: 'hsl(var(--line))',
        'line-strong': 'hsl(var(--line-strong))',
        brand: 'hsl(var(--brand))',
        signal: 'hsl(var(--signal))',

        /* The Qodix lesson, applied to the greys.
         *
         * The migrated pages still speak raw Tailwind — bg-slate-50,
         * text-slate-600, border-slate-200, dark:bg-slate-900. Left alone
         * those resolve to Tailwind's DEFAULT cool slate, which is a
         * second, competing neutral: it sits next to the Noviq navy/gold
         * identity and reads as "unbranded default" rather than as a
         * tint of the brand. globals.css already defines a navy-tinted
         * ladder in --slate-50…--slate-950; mapping the scale here is
         * what actually applies it, because the hand-written variables
         * alone are inert until something consumes them.
         *
         * Values mirror Tailwind's own lightness ladder so no layout or
         * hierarchy shifts. Every TEXT step is slightly DARKER than the
         * Tailwind default (500: 50% vs 65%, 600: 40% vs 47%, 700: 29% vs
         * 39%), so contrast only ever increases — the tint is a hue
         * change, never a legibility cost. Revert by deleting this block;
         * the default palette returns on the next build.
         *
         * These are RAW HSL TRIPLES on purpose — the hsl() wrapper lives
         * here, not in the variable. Storing a finished hsl() in
         * globals.css would yield hsl(hsl(...)) and silently drop colour.
         */
        slate: {
          50: 'hsl(var(--slate-50))',
          100: 'hsl(var(--slate-100))',
          200: 'hsl(var(--slate-200))',
          300: 'hsl(var(--slate-300))',
          400: 'hsl(var(--slate-400))',
          500: 'hsl(var(--slate-500))',
          600: 'hsl(var(--slate-600))',
          700: 'hsl(var(--slate-700))',
          800: 'hsl(var(--slate-800))',
          900: 'hsl(var(--slate-900))',
          950: 'hsl(var(--slate-950))',
        },
      },
      borderRadius: {
        lg: 'var(--radius-lg)',
        md: 'var(--radius-md)',
        sm: 'var(--radius-sm)',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'monospace'],
        arabic: ['var(--font-cairo)', 'system-ui', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out',
        'slide-up': 'slideUp 0.5s ease-out',
        'slide-down': 'slideDown 0.3s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideDown: {
          '0%': { opacity: '0', transform: 'translateY(-10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};