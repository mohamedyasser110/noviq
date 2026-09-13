# Noviq — Engineering the Future Through Technology

Global software & AI engineering studio website — single-page application with SPA routing, interactive tools, and immersive animations.

## Architecture

```
index.html              ← single entry point (SPA shell)
styles.css              ← @imports all CSS modules
data/content.config.js  ← all editable copy in one place

js/
├── engine/             ← core framework
│   ├── utils.js            DOM helpers, easing, PRNG
│   ├── reveal.js           scroll-triggered entrance animations
│   ├── cursor.js           custom cursor + magnetic effect
│   ├── navigation.js       navbar, mega menu, mobile accordion, HUD, keyboard nav
│   ├── hero3d.js           Three.js 3D icosahedron scene
│   ├── intro.js            5‑second canvas particle intro
│   ├── router.js           hash‑based SPA router
│   └── page-transitions.js fade/slide transitions
├── render/             ← SPA page builders (each is a function)
│   ├── build-static.js      fills hero, section headers, footer
│   ├── build-sections.js    home‑page grids (services, why, industries…)
│   ├── testimonials.js      testimonial carousel
│   ├── contact-form.js      contact form handling
│   ├── build-services.js    /services + /service/:slug
│   ├── build-industries.js  /industries + /industry/:name
│   ├── build-solutions.js   /solutions + /solution/:slug
│   ├── build-portfolio.js   /portfolio + case‑study detail
│   ├── build-pricing.js     /pricing (3 tiers)
│   ├── build-ai-lab.js      /ai-lab + AI demos (chat, OCR, vision…)
│   ├── build-about.js       /about
│   ├── build-contact.js     /contact
│   ├── build-resources.js   /resources (tabs: blog, whitepapers…)
│   ├── build-careers.js     /careers (filterable job listings)
│   └── build-faq.js         /faq (accordion)
├── tools/              ← interactive tools (fully coded, need data)
│   ├── solution-builder.js  8‑step proposal wizard
│   ├── ai-consultant.js     chat‑based consultation
│   ├── cost-estimator.js    feature toggle cost calculator
│   ├── assessment.js        30‑question digital maturity quiz
│   └── roi-calculator.js    slider‑based ROI comparison
└── script.js           ← entry point (init everything)
```

## SPA Routing

Hash‑based (`#/services`, `#/portfolio`, …).  
Router in `js/engine/router.js` — `AppRouter` object with `register()`, `go()`, `resolve()`.

### Route table

| Hash | Handler | Description |
|---|---|---|
| `#/home` | `showHome()` | Shows home‑page sections |
| `#/services` | `renderServicesPage()` | Service listing |
| `#/service/:slug` | `renderServiceDetailPage()` | Single service detail |
| `#/industries` | `renderIndustriesPage()` | Industry listing |
| `#/industry/:name` | `renderIndustryDetailPage()` | Single industry detail |
| `#/solutions` | `renderSolutionsPage()` | Solution packages |
| `#/solution/:slug` | `renderSolutionDetailPage()` | Single solution detail |
| `#/portfolio` | `renderPortfolioPage()` | Project grid |
| `#/case-study/:index` | `renderCaseStudyPage()` | Case study detail |
| `#/pricing` | `renderPricingPage()` | Pricing tiers |
| `#/ai-lab` | `renderAILabPage()` | AI demo gallery |
| `#/ai-demo/:name` | `renderAIDemoPage()` | Individual AI demo |
| `#/resources` | `renderResourcesPage()` | Knowledge hub |
| `#/careers` | `renderCareersPage()` | Job listings |
| `#/faq` | `renderFAQPage()` | FAQ accordion |
| `#/contact` | `renderContactPage()` | Contact form |
| `#/about` | `renderAboutPage()` | About / values |
| `#/builder` | `SolutionBuilder.init()` | Proposal wizard |
| `#/ai-consultant` | `AIConsultant.init()` | Chat consultation |
| `#/estimator` | `CostEstimator.init()` | Cost estimator |
| `#/assessment` | `DigitalAssessment.init()` | Maturity assessment |
| `#/roi` | `ROICalculator.init()` | ROI calculator |

## Content Management

**ALL copy lives in `data/content.config.js`** — no text is hardcoded in render logic.  
To edit services, industries, testimonials, footer, etc. → edit that file only.

### Missing data (tools that need content.config.js entries)

| Tool | Required key | Status |
|---|---|---|
| Solution Builder | `solutionBuilder.steps` | ❌ NOT IN CONFIG |
| AI Consultant | `aiConsultant.flow` | ❌ NOT IN CONFIG |
| Cost Estimator | `costEstimator.features` | ❌ NOT IN CONFIG |
| Digital Assessment | `assessment.questions` | ❌ NOT IN CONFIG |

## Design Tokens

Defined in `css/tokens.css` — colors, fonts, spacing, breakpoints via CSS custom properties.

### Key visual elements

- **Intro overlay** — 5‑second canvas particle animation with "N" logo morph
- **3D hero** — Three.js icosahedron with orbiting satellites and particle field
- **Custom cursor** — dot + ring + trail (5 elements), magnetic hover on buttons
- **Scroll reveals** — IntersectionObserver‑based entrance animations
- **Liquid blobs** — organic gradient shapes behind sections
- **HUD progress** — side‑mounted vertical progress tracker
- **Glass morphism** — `backdrop-filter: blur()` cards throughout

## Browser Support

Targets modern Chromium‑based browsers, Firefox, Safari ≥ 15.  
Requires `IntersectionObserver`, `Canvas`, `WebGL`, `backdrop-filter`.

## Development

```bash
# Serve locally
python -m http.server 8000     # Python
npx serve . -p 8000            # Node
```

Edit `data/content.config.js` to change copy, icons, stats, testimonials.  
Add new render functions in `js/render/` and register routes in `script.js`.

## What Needs Work

### High priority
1. **Interactive tool data** — Add `solutionBuilder.steps`, `aiConsultant.flow`, `costEstimator.features`, `assessment.questions` to `content.config.js`
2. **Image assets** — Replace placeholder project images (`images/project-*.png`) with real visuals

### Medium priority
3. **Page enhancements** — More detailed content for Services, Portfolio, Industries, etc.
4. **Responsive polish** — Fine‑tune mobile layouts for mega menus, HUD, hero 3D
5. **Form integration** — Wire contact form to backend or email service
6. **SEO / meta** — Per‑route dynamic `<title>` and meta tags

### Low priority
7. **Animations** — Page‑enter transitions, micro‑interactions on cards
8. **Accessibility** — Focus management, ARIA labels, keyboard trap for modals
9. **Performance** — Lazy‑load Three.js, code‑split page renders
10. **i18n / RTL** — Arabic language support
