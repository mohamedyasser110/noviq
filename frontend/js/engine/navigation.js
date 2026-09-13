/* ============================================================
   NAVIGATION — navbar, mega menu, mobile, HUD, keyboard
   ============================================================ */

/* ---- Mega menu data ---- */
const MEGA_MENUS = {
  services: {
    label: 'Services',
    columns: [
      { title: 'Core Offerings', links: [
        { label: 'AI Solutions', href: '#/services', icon: 'brain' },
        { label: 'Custom Software', href: '#/services', icon: 'code-2' },
        { label: 'ERP Systems', href: '#/services', icon: 'layers' },
        { label: 'CRM Platforms', href: '#/services', icon: 'users' },
      ]},
      { title: 'Web & Platforms', links: [
        { label: 'SaaS Development', href: '#/services', icon: 'sparkles' },
        { label: 'Web Applications', href: '#/services', icon: 'globe' },
        { label: 'API Development', href: '#/services', icon: 'plug' },
      ]},
      { title: 'Business Systems', links: [
        { label: 'Automation', href: '#/services', icon: 'settings' },
        { label: 'Digital Transformation', href: '#/services', icon: 'compass' },
        { label: 'View All Services →', href: '#/services', icon: 'arrow-right' },
      ]},
    ],
  },
  industries: {
    label: 'Industries',
    columns: [
      { title: 'Sector Leaders', links: [
        { label: 'Healthcare', href: '#/industries', icon: 'building-2' },
        { label: 'Manufacturing', href: '#/industries', icon: 'factory' },
        { label: 'Education', href: '#/industries', icon: 'graduation-cap' },
        { label: 'Real Estate', href: '#/industries', icon: 'landmark' },
      ]},
      { title: 'Growth Sectors', links: [
        { label: 'Finance', href: '#/industries', icon: 'wallet' },
        { label: 'Retail', href: '#/industries', icon: 'shopping-bag' },
        { label: 'Government', href: '#/industries', icon: 'scale' },
        { label: 'Logistics', href: '#/industries', icon: 'truck' },
      ]},
      { title: 'Explore', links: [
        { label: 'AI Lab →', href: '#/ai-lab', icon: 'sparkles' },
        { label: 'View All Industries', href: '#/industries', icon: 'arrow-right' },
      ]},
    ],
  },
  solutions: {
    label: 'Solutions',
    columns: [
      { title: 'Business Systems', links: [
        { label: 'Clinic Management', href: '#/solutions', icon: 'stethoscope' },
        { label: 'School ERP', href: '#/solutions', icon: 'graduation-cap' },
        { label: 'HR & Payroll', href: '#/solutions', icon: 'users' },
      ]},
      { title: 'Operations', links: [
        { label: 'Inventory System', href: '#/solutions', icon: 'package' },
        { label: 'POS System', href: '#/solutions', icon: 'shopping-cart' },
        { label: 'Fleet Management', href: '#/solutions', icon: 'truck' },
      ]},
      { title: 'Custom', links: [
        { label: 'Solution Builder →', href: '#/builder', icon: 'settings' },
        { label: 'View All Solutions', href: '#/solutions', icon: 'arrow-right' },
      ]},
    ],
  },
  more: {
    label: 'More',
    columns: [
      { title: 'Resources', links: [
        { label: 'Knowledge Hub', href: '#/resources', icon: 'book-open' },
        { label: 'FAQ', href: '#/faq', icon: 'help-circle' },
      ]},
      { title: 'Company', links: [
        { label: 'About Us', href: '#/about', icon: 'info' },
        { label: 'Why Noviq', href: '#/why', icon: 'award' },
        { label: 'Our Toolkit', href: '#/toolkit', icon: 'layers' },
        { label: 'Careers', href: '#/careers', icon: 'briefcase' },
      ]},
      { title: 'Pricing & Contact', links: [
        { label: 'Pricing', href: '#/pricing', icon: 'tag' },
        { label: 'Contact', href: '#/contact', icon: 'mail' },
      ]},
    ],
  },
};

function initNavbar() {
  const nav = document.getElementById("navbar");
  const toggle = document.getElementById("mobile-toggle");
  const menu = document.getElementById("mobile-menu");
  const sections = document.querySelectorAll("section[id]");
  const desktopNavContainer = nav?.querySelector('.noviq-desktop-nav');
  const isArabic = document.documentElement.lang === 'ar';

  // Build services dynamically from NOVIQ_CONTENT
  const activeServices = (typeof NOVIQ_CONTENT !== 'undefined' && NOVIQ_CONTENT.services) || [];
  const dynamicServicesColumns = [
    { title: isArabic ? 'حلولنا الأساسية' : 'Core Offerings', links: [] },
    { title: isArabic ? 'الويب والمنصات' : 'Web & Platforms', links: [] },
    { title: isArabic ? 'أنظمة الأعمال' : 'Business Systems', links: [] }
  ];

  activeServices.forEach((service, idx) => {
    const linkItem = {
      label: service.title,
      href: '#/services',
      icon: service.icon || 'layers'
    };
    if (idx < 3) {
      dynamicServicesColumns[0].links.push(linkItem);
    } else if (idx < 6) {
      dynamicServicesColumns[1].links.push(linkItem);
    } else {
      dynamicServicesColumns[2].links.push(linkItem);
    }
  });

  dynamicServicesColumns[2].links.push({
    label: isArabic ? 'كل الخدمات' : 'View All Services →',
    href: '#/services',
    icon: isArabic ? 'arrow-left' : 'arrow-right'
  });

  MEGA_MENUS.services.columns = dynamicServicesColumns;

  const labels = isArabic ? {
    home: 'الرئيسية', services: 'الخدمات', industries: 'القطاعات', solutions: 'الحلول',
    builder: 'منشئ الحلول', aiLab: 'مختبر الذكاء الاصطناعي', portfolio: 'أعمالنا', team: 'فريقنا', resources: 'المصادر', pricing: 'الأسعار',
    more: 'المزيد', startProject: 'ابدأ مشروعك'
  } : {
    home: 'Home', services: 'Services', industries: 'Industries', solutions: 'Solutions',
    builder: 'Solution Builder', aiLab: 'AI Lab', portfolio: 'Portfolio', team: 'Our Team', resources: 'Resources', pricing: 'Pricing',
    more: 'More', startProject: 'Start Your Project'
  };

  const megaMenus = isArabic ? {
    services: {
      label: 'الخدمات',
      columns: dynamicServicesColumns
    },
    industries: {
      label: 'القطاعات',
      columns: [
        { title: 'القطاعات الرئيسية', links: [{ label: 'الرعاية الصحية', href: '#/industries', icon: 'building-2' }, { label: 'التصنيع', href: '#/industries', icon: 'factory' }, { label: 'التعليم', href: '#/industries', icon: 'graduation-cap' }, { label: 'العقارات', href: '#/industries', icon: 'landmark' }]},
        { title: 'قطاعات النمو', links: [{ label: 'القطاع المالي', href: '#/industries', icon: 'wallet' }, { label: 'التجزئة', href: '#/industries', icon: 'shopping-bag' }, { label: 'الجهات الحكومية', href: '#/industries', icon: 'scale' }, { label: 'الخدمات اللوجستية', href: '#/industries', icon: 'truck' }]},
        { title: 'استكشف', links: [{ label: 'مختبر الذكاء الاصطناعي', href: '#/ai-lab', icon: 'sparkles' }, { label: 'كل القطاعات', href: '#/industries', icon: 'arrow-left' }]}
      ]
    },
    solutions: {
      label: 'الحلول',
      columns: [
        { title: 'أدوات مخصصة', links: [{ label: ' منشئ الحلول المخصص', href: '#/builder', icon: 'wand-2', isFeatured: true }, { label: 'إدارة العيادات', href: '#/solutions', icon: 'stethoscope' }, { label: 'ERP للمدارس', href: '#/solutions', icon: 'graduation-cap' }, { label: 'الموارد والرواتب', href: '#/solutions', icon: 'users' }]},
        { title: 'العمليات والتجزئة', links: [{ label: 'نظام المخزون', href: '#/solutions', icon: 'package' }, { label: 'نقطة البيع', href: '#/solutions', icon: 'shopping-cart' }, { label: 'إدارة الأساطيل', href: '#/solutions', icon: 'truck' }]},
        { title: 'استكشف', links: [{ label: 'كل الحلول والأنظمة', href: '#/solutions', icon: 'arrow-left' }]}
      ]
    },
    more: {
      label: 'المزيد',
      columns: [
        { title: 'المصادر', links: [{ label: 'مركز المعرفة', href: '#/resources', icon: 'book-open' }, { label: 'الأسئلة الشائعة', href: '#/faq', icon: 'help-circle' }]},
        { title: 'الشركة', links: [{ label: 'من نحن', href: '#/about', icon: 'info' }, { label: 'لماذا نوفيك', href: '#/why', icon: 'award' }, { label: 'أدواتنا', href: '#/toolkit', icon: 'layers' }, { label: 'الوظائف', href: '#/careers', icon: 'briefcase' }]},
        { title: 'التسعير والتواصل', links: [{ label: 'الأسعار', href: '#/pricing', icon: 'tag' }, { label: 'تواصل معنا', href: '#/contact', icon: 'mail' }]}
      ]
    }
  } : MEGA_MENUS;

  let scrollTick = false;
  const _navLinks = document.querySelectorAll(".noviq-desktop-nav a:not(.mega-trigger)");
  window.addEventListener("scroll", () => {
    if (!scrollTick) {
      requestAnimationFrame(() => {
        if (nav) nav.classList.toggle("scrolled", window.scrollY > 24);
        let current = "";
        for (let i = 0; i < sections.length; i++) {
          if (window.scrollY >= sections[i].offsetTop - 150) current = sections[i].getAttribute("id");
        }
        for (let i = 0; i < _navLinks.length; i++) {
          const a = _navLinks[i];
          if (a.getAttribute("href") === `#${current}`) a.style.color = "var(--text)";
          else if (!a.closest('.noviq-mega-menu')) a.style.color = "";
        }
        scrollTick = false;
      });
      scrollTick = true;
    }
  }, { passive: true });

  /* Build mega menu desktop nav */
  if (desktopNavContainer) {
    const navLinks = [
      { label: labels.home, href: '#/home' },
      { label: labels.services, href: null, mega: 'services' },
      { label: labels.industries, href: null, mega: 'industries' },
      { label: labels.solutions, href: null, mega: 'solutions' },
      { label: labels.aiLab, href: '#/ai-lab' },
      { label: labels.portfolio, href: '#/portfolio' },
      { label: labels.team, href: '#/team' },
      { label: labels.more, href: null, mega: 'more' },
    ];

    desktopNavContainer.innerHTML = navLinks.map(n => {
      if (n.mega) {
        return `<div class="noviq-nav-mega-trigger" style="position:relative">
          <a class="mega-trigger" data-mega="${n.mega}" href="javascript:void(0)" aria-haspopup="true" aria-expanded="false">${n.label} <i data-lucide="chevron-down" style="width:13px;height:13px"></i></a>
          <div class="noviq-mega-menu" data-mega="${n.mega}" style="display:none" aria-hidden="true"></div>
        </div>`;
      }
      return `<a href="${n.href || '#'}">${n.label}</a>`;
    }).join('');

    /* Build mega menu content */
    Object.keys(MEGA_MENUS).forEach(key => {
      const menuData = megaMenus[key];
      const menuEl = desktopNavContainer.querySelector(`.noviq-mega-menu[data-mega="${key}"]`);
      if (!menuEl) return;
      menuEl.innerHTML = `<div class="noviq-mega-grid">
        ${menuData.columns.map(col => `
          <div class="noviq-mega-col">
            <h4>${col.title}</h4>
            ${col.links.map(link => `
              <a href="${link.href}" ${link.isFeatured ? 'class="noviq-mega-featured-link" onclick="navigateTo(\'builder\');"' : ''} data-icon="${link.icon || ''}">
                <span>${link.label}</span>
              </a>`).join('')}
          </div>`).join('')}
      </div>`;
    });

    /* Mega menu hover + keyboard open */
    let hideTimeout;
    const setMega = (trigger, open) => {
      const menuEl = trigger.querySelector('.noviq-mega-menu');
      const linkEl = trigger.querySelector('.mega-trigger');
      if (menuEl) {
        menuEl.style.display = open ? 'block' : 'none';
        menuEl.setAttribute('aria-hidden', open ? 'false' : 'true');
      }
      if (linkEl) linkEl.setAttribute('aria-expanded', open ? 'true' : 'false');
    };
    desktopNavContainer.querySelectorAll('.noviq-nav-mega-trigger').forEach(trigger => {
      const menuEl = trigger.querySelector('.noviq-mega-menu');
      const linkEl = trigger.querySelector('.mega-trigger');
      trigger.addEventListener('mouseenter', () => {
        clearTimeout(hideTimeout);
        document.querySelectorAll('.noviq-nav-mega-trigger').forEach(t => setMega(t, false));
        setMega(trigger, true);
      });
      trigger.addEventListener('mouseleave', () => {
        hideTimeout = setTimeout(() => setMega(trigger, false), 150);
      });
      if (menuEl) {
        menuEl.addEventListener('mouseenter', () => clearTimeout(hideTimeout));
        menuEl.addEventListener('mouseleave', () => setMega(trigger, false));
      }
      /* Keyboard: open on focus, Enter/Space toggle, Escape closes */
      trigger.addEventListener('focusin', () => {
        document.querySelectorAll('.noviq-nav-mega-trigger').forEach(t => setMega(t, false));
        setMega(trigger, true);
      });
      if (linkEl) linkEl.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          setMega(trigger, false);
          linkEl.focus();
        } else if (e.key === 'Enter' || e.key === ' ') {
          const isOpen = menuEl && menuEl.style.display === 'block';
          document.querySelectorAll('.noviq-nav-mega-trigger').forEach(t => setMega(t, false));
          setMega(trigger, !isOpen);
          e.preventDefault();
        }
      });
    });

    /* Click away close */
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.noviq-nav-mega-trigger')) {
        document.querySelectorAll('.noviq-nav-mega-trigger').forEach(t => setMega(t, false));
      }
    });
  }

  /* Mobile toggle */
  if (toggle && menu) {
    toggle.addEventListener("click", () => {
      const open = menu.style.display === "flex";
      menu.style.display = open ? "none" : "flex";
      toggle.innerHTML = "";
      toggle.appendChild(createIcon(open ? "menu" : "x", 24));
      if (typeof lucide !== "undefined") lucide.createIcons();
    });

    /* Build mobile menu with accordion submenus — Solution Builder 1st inside Solutions! */
    const mobileLinks = [
      { label: labels.home, href: '#/home' },
      { label: labels.services, href: '#/services', children: megaMenus.services.columns.flatMap(c => c.links).slice(0, 6) },
      { label: labels.industries, href: '#/industries', children: megaMenus.industries.columns.flatMap(c => c.links).slice(0, 6) },
      { label: labels.solutions, href: '#/solutions', children: megaMenus.solutions.columns.flatMap(c => c.links) },
      { label: labels.aiLab, href: '#/ai-lab' },
      { label: labels.portfolio, href: '#/portfolio' },
      { label: labels.team, href: '#/team' },
      { label: labels.more, href: '#/resources', children: megaMenus.more.columns.flatMap(c => c.links) },
    ];

    const mobileExtras = isArabic
      ? { login: 'تسجيل الدخول', language: 'English', searchPlaceholder: 'ابحث...' }
      : { login: 'Login', language: 'العربية', searchPlaceholder: 'Search...' };

    menu.innerHTML = `
      <div class="noviq-mobile-search">
        <i data-lucide="search" style="width:16px;height:16px"></i>
        <input type="text" id="mobile-search-input" placeholder="${mobileExtras.searchPlaceholder}" autocomplete="off" />
        <div class="noviq-search-dropdown" id="mobile-search-dropdown" style="display:none"></div>
      </div>
      ` + mobileLinks.map(n => {
      if (n.children) {
        return `<div class="noviq-mobile-accordion">
          <div class="noviq-mobile-accordion-trigger">
            <a href="${n.href}">${n.label}</a>
            <button type="button" class="noviq-mobile-accordion-btn" aria-label="${n.label}" aria-expanded="false">
              <i data-lucide="chevron-down" style="width:16px;height:16px;color:var(--text-secondary)"></i>
            </button>
          </div>
          <div class="noviq-mobile-accordion-content" style="display:none">
            ${n.children.map(c => `<a href="${c.href}" ${c.isFeatured ? 'class="noviq-mobile-sublink-highlight" onclick="navigateTo(\'builder\');"' : ''}>${c.label}</a>`).join('')}
          </div>
        </div>`;
      }
      return `<a href="${n.href}">${n.label}</a>`;
    }).join('') + `
      <div class="noviq-mobile-menu-actions">
        <a href="#/login" class="noviq-mobile-action">
          <i data-lucide="circle-user-round" style="width:17px;height:17px"></i>
          <span>${mobileExtras.login}</span>
        </a>
        <button type="button" class="noviq-mobile-action" id="mobile-language-toggle">
          <i data-lucide="globe" style="width:17px;height:17px"></i>
          <span>${mobileExtras.language}</span>
        </button>
      </div>
      <button class="noviq-btn-primary" style="padding:12px 22px;font-size:14px;width:100%;justify-content:center" onclick="navigateTo('contact')">${labels.startProject}</button>`;

    const mobileLangToggle = menu.querySelector('#mobile-language-toggle');
    if (mobileLangToggle) {
      mobileLangToggle.addEventListener('click', () => {
        document.getElementById('language-toggle')?.click();
      });
    }

     /* Accordion: toggle on arrow button / icon / svg clicks */
     menu.querySelectorAll('.noviq-mobile-accordion-trigger').forEach(trigger => {
       const btn = trigger.querySelector('.noviq-mobile-accordion-btn');
       const content = trigger.nextElementSibling;
       
       const toggleAccordion = (e) => {
         e.preventDefault();
         e.stopPropagation();
         const icon = trigger.querySelector('i, svg');
         const isOpen = content.style.display === 'block';
         content.style.display = isOpen ? 'none' : 'block';
         if (icon) icon.style.transform = isOpen ? 'rotate(0deg)' : 'rotate(180deg)';
         btn.setAttribute('aria-expanded', String(!isOpen));
         
         // Auto-scroll to show the expanded content if needed
         if (!isOpen) {
           setTimeout(() => {
             const contentRect = content.getBoundingClientRect();
             const menuRect = menu.getBoundingClientRect();
             if (contentRect.bottom > menuRect.bottom) {
               menu.scrollTo({
                 top: menu.scrollTop + (contentRect.bottom - menuRect.bottom) + 20,
                 behavior: 'smooth'
               });
             }
           }, 100);
         }
       };
       
       // Open accordion when clicking the trigger link (not just the button)
       const triggerLink = trigger.querySelector('a');
       if (triggerLink) {
         triggerLink.addEventListener('click', (e) => {
           const isOpen = content.style.display === 'block';
           if (!isOpen) {
             e.preventDefault();
             toggleAccordion(e);
           }
         });
       }
       
       if (btn) btn.addEventListener('click', toggleAccordion);
       trigger.addEventListener('click', (e) => {
         const target = e.target;
         if (target.closest('svg') || target.closest('i') || target === btn) {
           toggleAccordion(e);
         }
       });
     });

    /* Mobile search (reuses the same NLP pipeline as the header search) */
    const mobileSearchInput = menu.querySelector('#mobile-search-input');
    const mobileSearchDropdown = menu.querySelector('#mobile-search-dropdown');
    if (mobileSearchInput && mobileSearchDropdown && window.NoviqSearch) {
      const { analyzeQuery, performSearch, searchChatbotKnowledge, askAssistantItem, renderDropdown } = window.NoviqSearch;
      let msTimer = null;
      let msSeq = 0;

      mobileSearchInput.addEventListener('input', function() {
        const val = this.value;
        if (!val.trim()) {
          mobileSearchDropdown.style.display = 'none';
          mobileSearchDropdown.innerHTML = '';
          return;
        }
        clearTimeout(msTimer);
        const seq = ++msSeq;
        msTimer = setTimeout(async () => {
          const analysis = analyzeQuery(val);
          let results = await performSearch(analysis);
          if (results.length === 0) {
            const lang = analysis.isArabic ? 'ar' : 'en';
            const kbResults = val.trim().length >= 3 ? await searchChatbotKnowledge(val, lang) : [];
            if (seq !== msSeq) return;
            results = kbResults.concat([askAssistantItem(val, analysis.isArabic)]);
          }
          if (seq !== msSeq) return;
          renderDropdown(mobileSearchDropdown, results, analysis);
        }, 200);
      });

      mobileSearchInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
          const firstItem = mobileSearchDropdown.querySelector('.noviq-search-item');
          if (firstItem) {
            firstItem.click();
            mobileSearchDropdown.style.display = 'none';
            mobileSearchInput.value = '';
            mobileSearchInput.blur();
          }
        }
      });
    }

    menu.querySelectorAll("a").forEach(a => {
      a.addEventListener("click", () => {
        menu.style.display = "none";
        toggle.innerHTML = "";
        toggle.appendChild(createIcon("menu", 24));
        if (typeof lucide !== "undefined") lucide.createIcons();
      });
    });
  }
}

/* ---- Futuristic HUD side progress ---- */
function initHudProgress() {
  const sectionsArr = Array.from(document.querySelectorAll('#home-sections section[id]'));
  if (!sectionsArr.length) return;
  const labels = sectionsArr.map(s => s.dataset.hudLabel || s.id);

  const hud = document.createElement('div'); hud.className = 'noviq-hud';
  hud.innerHTML = `
    <div class="noviq-hud-track">
      <div class="noviq-hud-fill"></div>
      <div class="noviq-hud-orb"></div>
      <div class="noviq-hud-nodes">
        ${sectionsArr.map((_, i) => `
          <div class="noviq-hud-node${i === 0 ? ' active' : ''}" data-idx="${i}">
            <span class="hud-label">${labels[i] || 'Section'}</span>
          </div>`).join('')}
      </div>
    </div>`;
  document.body.appendChild(hud);

  const fill = hud.querySelector('.noviq-hud-fill');
  const orb = hud.querySelector('.noviq-hud-orb');
  const nodes = hud.querySelectorAll('.noviq-hud-node');
  const track = hud.querySelector('.noviq-hud-track');

  nodes.forEach((node, i) => {
    node.addEventListener('click', () => {
      if (sectionsArr[i]) sectionsArr[i].scrollIntoView({ behavior: 'smooth' });
    });
  });

  let hudTick = false;
  let _hudPrevIdx = 0;
  window.addEventListener('scroll', () => {
    if (!hudTick) {
      requestAnimationFrame(() => {
        const scrolled = window.scrollY;
        let active = 0;
        for (let i = 0; i < sectionsArr.length; i++) {
          if (scrolled >= sectionsArr[i].offsetTop - 250) active = i;
        }

        if (active !== _hudPrevIdx) {
          _hudPrevIdx = active;
          for (let i = 0; i < nodes.length; i++) nodes[i].classList.toggle('active', i === active);
        }

        const trackH = track.offsetHeight;
        const total = sectionsArr.length - 1;
        const pct = total > 0 ? active / total : 0;
        const orbY = 4 + pct * (trackH - 22);
        orb.style.top = orbY + 'px';
        fill.style.height = orbY + 'px';
        hudTick = false;
      });
      hudTick = true;
    }
  }, { passive: true });
}

/* ---- Keyboard navigation ---- */
function initKeyboardNav() {
  const sections = Array.from(document.querySelectorAll('#home-sections section[id]'));

  window.addEventListener('keydown', function(e) {
    if (e.target.closest('input, textarea, select, [contenteditable="true"], .nv-image-builder')) return;
    const k = e.key, c = e.code, w = e.which || e.keyCode;
    const isLeft = k === 'ArrowLeft' || c === 'ArrowLeft' || w === 37;
    const isRight = k === 'ArrowRight' || c === 'ArrowRight' || w === 39;

    if (isLeft || isRight) {
      e.preventDefault();
      e.stopImmediatePropagation();
      const vw = window.innerWidth, vh = window.innerHeight;
      const focusable = Array.from(document.querySelectorAll('a, button, input, textarea, select, [tabindex]:not([tabindex="-1"])'))
        .filter(el => {
          if (!el.offsetParent || el.tabIndex === -1) return false;
          const r = el.getBoundingClientRect();
          return r.top < vh && r.bottom > 0 && r.left < vw && r.right > 0;
        });
      if (focusable.length) {
        const activeEl = document.activeElement;
        let curIdx = focusable.indexOf(activeEl);
        if (curIdx === -1) curIdx = isLeft ? focusable.length : -1;
        const nextIdx = isLeft
          ? (curIdx - 1 + focusable.length) % focusable.length
          : (curIdx + 1) % focusable.length;
        focusable[nextIdx].focus();
      }
      return;
    }

    if (k === 'ArrowDown' || k === 'ArrowUp') {
      e.preventDefault();
      const scrollY = window.scrollY;
      const viewH = window.innerHeight;
      const threshold = scrollY + viewH * 0.35;

      if (k === 'ArrowDown') {
        for (const s of sections) {
          const top = s.getBoundingClientRect().top + scrollY;
          if (top > threshold) { s.scrollIntoView({ behavior: 'smooth', block: 'start' }); break; }
        }
      } else {
        let target = null;
        for (const s of sections) {
          const rect = s.getBoundingClientRect();
          if (rect.bottom + scrollY < threshold) target = s;
        }
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }, { capture: true });
}
