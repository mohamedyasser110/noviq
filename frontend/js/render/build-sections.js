/* ============================================================
   BUILD SECTIONS — renders each grid from NOVIQ_CONTENT
   ------------------------------------------------------------
   Pure DOM construction. To change what's shown, edit
   data/content.config.js — never edit the markup logic here.
   ============================================================ */

function buildServices() {
  const grid = document.getElementById("services-grid");
  if (!grid) return;
  grid.innerHTML = "";
  const dirs = ["reveal", "reveal-scale", "reveal"];
  NOVIQ_CONTENT.services.forEach((s, i) => {
    const card = createEl("div", `${dirs[i % 3]} noviq-glass-card noviq-trace noviq-service-card`);
    card.setAttribute("data-tilt", "");
    card.style.transitionDelay = `${(i % 3) * 90 + 50}ms`;
    const badge = createEl("div", "noviq-icon-badge");
    badge.appendChild(createIcon(s.icon, 22));
    card.appendChild(badge);
    card.appendChild(createEl("h3", null, typeof t === 'function' ? (localized(s,'title')||t(s.title)) : s.title));
    card.appendChild(createEl("p", null, typeof t === 'function' ? (localized(s,'desc')||t(s.desc)) : s.desc));
    grid.appendChild(card);
  });
}

function buildWhy() {
  const grid = document.getElementById("why-grid");
  if (!grid) return;
  grid.innerHTML = "";
  const dirs = ["reveal-left", "reveal", "reveal-right", "reveal-scale"];
  NOVIQ_CONTENT.why.forEach((w, i) => {
    const card = createEl("div", `${dirs[i % 4]} noviq-glass-card noviq-why-card`);
    card.setAttribute("data-tilt", "");
    card.style.transitionDelay = `${(i % 4) * 80 + 30}ms`;
    const icon = createIcon(w.icon, 24);
    icon.style.color = "var(--accent)";
    card.appendChild(icon);
    card.appendChild(createEl("h4", null, localized(w,'title') || (typeof t === 'function' ? t(w.title) : w.title)));
    card.appendChild(createEl("p", null, localized(w,'desc') || (typeof t === 'function' ? t(w.desc) : w.desc)));
    grid.appendChild(card);
  });
}

function buildIndustries() {
  const grid = document.getElementById("industries-grid");
  if (!grid) return;
  grid.innerHTML = "";
  NOVIQ_CONTENT.industries.forEach((ind, i) => {
    const card = createEl("div", "reveal noviq-glass-card noviq-industry-card");
    card.setAttribute("data-tilt", "");
    card.style.transitionDelay = `${(i % 4) * 80}ms`;
    const icon = createIcon(ind.icon, 26);
    icon.style.color = "var(--secondary)";
    card.appendChild(icon);
    card.appendChild(createEl("span", null, localized(ind,'title') || (typeof t === 'function' ? t(ind.title) : ind.title)));
    grid.appendChild(card);
  });
}

function buildProjects() {
  const grid = document.getElementById("projects-grid");
  if (!grid) return;
  grid.innerHTML = "";

  const projectObserver = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        const el = e.target;
        const src = el.dataset.src;
        if (src) {
          el.style.backgroundImage = `url('${src}')`;
          el.style.backgroundSize = "cover";
          el.style.backgroundPosition = "center";
          el.onerror = () => { el.style.background = "linear-gradient(135deg, #1B1533 0%, #2A1266 45%, #6D28FF 100%)"; };
        }
        projectObserver.unobserve(el);
      }
    });
  }, { rootMargin: "200px" });

  (NOVIQ_CONTENT.projects || []).forEach((p, i) => {
    const card = createEl("div", "reveal noviq-project-card");
    card.style.transitionDelay = `${(i % 2) * 100}ms`;
    const img = document.createElement("div");
    img.className = "noviq-project-image";
    img.dataset.src = typeof safeProjectAsset === 'function' ? safeProjectAsset(p.img) : '';
    img.style.background = "linear-gradient(135deg, #1B1533 0%, #2A1266 45%, #6D28FF 100%)";
    projectObserver.observe(img);
    const overlay = createEl("div", "noviq-project-overlay");
    img.appendChild(overlay);
    card.appendChild(img);
    const pTag = localized(p,'tag') || (typeof t === 'function' ? t(p.tag) : p.tag);
    const pTitle = localized(p,'title') || (typeof t === 'function' ? t(p.title) : p.title);
    const pDesc = localized(p,'desc') || (typeof t === 'function' ? t(p.desc) : p.desc);
    const body = createEl("div", "noviq-project-body");
    body.innerHTML = `
      <span class="tag">${typeof portfolioEscape === 'function' ? portfolioEscape(pTag) : pTag}</span>
      <h3>${typeof portfolioEscape === 'function' ? portfolioEscape(pTitle) : pTitle}</h3>
      <p>${typeof portfolioEscape === 'function' ? portfolioEscape(pDesc) : pDesc}</p>
      <a class="link" href="#/case-study/${i}">${typeof t === 'function' ? t('View Case Study') : 'View Case Study'} <i data-lucide="arrow-up-right" style="width:15px;height:15px"></i></a>`;
    card.appendChild(body);
    grid.appendChild(card);
  });
}

function buildClients() {
  const grid = document.getElementById("clients-grid");
  if (!grid || !Array.isArray(NOVIQ_CONTENT.clients)) return;
  grid.innerHTML = "";
  NOVIQ_CONTENT.clients.forEach((c, i) => {
    const card = createEl("div", "reveal noviq-client-card");
    card.style.transitionDelay = `${(i % 4) * 70}ms`;

    const logo = createEl("div", "noviq-client-logo");
    const addIcon = () => {
      if (!c.icon) return;
      const icon = createIcon(c.icon, 32);
      icon.classList.add("client-icon");
      logo.appendChild(icon);
    };
    if (c.img) {
      const img = document.createElement("img");
      img.src = c.img;
      img.alt = c.name || "client";
      img.loading = "lazy";
      /* Broken upload → fall back to the lucide icon */
      img.onerror = () => { img.remove(); addIcon(); if (typeof lucide !== "undefined") lucide.createIcons(); };
      logo.appendChild(img);
    } else {
      addIcon();
    }
    card.appendChild(logo);

    if (c.name) card.appendChild(createEl("div", "noviq-client-name", c.name));
    grid.appendChild(card);
  });
}

function buildProcess() {
  const grid = document.getElementById("process-grid");
  if (!grid) return;
  grid.innerHTML = "";
  NOVIQ_CONTENT.process.forEach((step, i) => {
    const item = createEl("div", "reveal noviq-timeline-item");
    item.style.transitionDelay = `${i * 90}ms`;
    const iconWrap = createEl("div", "noviq-timeline-icon");
    const icon = createIcon(step.icon, 18);
    icon.style.color = "#fff";
    iconWrap.appendChild(icon);
    item.appendChild(iconWrap);
    item.appendChild(createEl("h4", null, localized(step,'title') || (typeof t === 'function' ? t(step.title) : step.title)));
    item.appendChild(createEl("p", null, localized(step,'desc') || (typeof t === 'function' ? t(step.desc) : step.desc)));
    grid.appendChild(item);
  });
}

function buildStack() {
  const grid = document.getElementById("stack-grid");
  if (!grid) return;
  grid.innerHTML = "";
  NOVIQ_CONTENT.stack.forEach((tech, i) => {
    const chip = createEl("div", "noviq-stack-chip");
    chip.style.animationDelay = `${(i % 6) * 0.4}s`;
    chip.textContent = tech;
    grid.appendChild(chip);
  });
}

/* ---- Initialize all section grids eagerly (home page is hidden initially) ---- */
function initLazyBuilds() {
  const builds = [
    { id: 'services-grid', fn: buildServices },
    { id: 'why-grid', fn: buildWhy },
    { id: 'clients-grid', fn: buildClients },
    { id: 'industries-grid', fn: buildIndustries },
    { id: 'projects-grid', fn: buildProjects },
    { id: 'process-grid', fn: buildProcess },
    { id: 'stack-grid', fn: buildStack },
  ];
  builds.forEach(b => {
    const el = document.getElementById(b.id);
    if (el) {
      b.fn();
      el.querySelectorAll('.reveal, .reveal-left, .reveal-right, .reveal-scale').forEach(el => observeReveal(el));
    }
  });
  if (typeof lucide !== "undefined") lucide.createIcons();
}
