/* ============================================================
   BUILD TEAM — Our Team list + member profile pages
   Mirrors the Knowledge Hub (Resources) architecture:
   content lives in NOVIQ_CONTENT.team, managed from admin.
   ============================================================ */

function teamEscape(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, function (char) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char];
  });
}

function teamText(value, isAr) {
  if (value && typeof value === 'object') {
    return String((isAr ? value.ar : value.en) || value.en || value.ar || '');
  }
  return String(value || '');
}

function teamExternalUrl(value) {
  const url = String(value || '').trim();
  return /^(?:https?:\/\/|mailto:|tel:)[^\s"'<>]*$/i.test(url) ? url : '';
}

function teamAssetUrl(value) {
  const url = String(value || '').trim();
  if (/(?:^|\/)\.\.(?:\/|$)/.test(url)) return '';
  if (/^https?:\/\/[^\s"'()<>]+$/i.test(url)) return url;
  return /^\/?(?:images|assets)\/[A-Za-z0-9_./-]+(?:\?[A-Za-z0-9_.~!$&+,;=:@%/?-]*)?$/.test(url) ? url : '';
}

function teamInitials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  const initials = ((parts[0] && parts[0][0]) || '') + ((parts[1] && parts[1][0]) || (parts[0] && parts[0][1]) || '');
  return (initials || 'N').toUpperCase();
}

function teamEmailUrl(value) {
  const email = String(value || '').trim();
  if (/^\S+@\S+\.\S+$/.test(email)) return 'mailto:' + email;
  return teamExternalUrl(email);
}

/* Brand icons as inline SVG — current lucide builds dropped brand glyphs
   (linkedin/github/facebook stay empty <i> tags), so we ship the paths. */
const TEAM_BRAND_PATHS = {
  linkedin: 'M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.225 0z',
  github: 'M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12',
  facebook: 'M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z',
};

function teamBrandIcon(name) {
  const path = TEAM_BRAND_PATHS[name];
  if (!path) return '';
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style="width:16px;height:16px;display:block"><path d="' + path + '"/></svg>';
}

function defaultTeamFallback() {
  return {
    hero: {
      eyebrow: { en: 'Our Team', ar: 'فريقنا' },
      title: { en: 'Meet the Minds Behind Noviq', ar: 'تعرف على عقول نوفيك' },
      description: {
        en: 'Engineers, designers, and strategists crafting software that matters.',
        ar: 'مهندسون ومصممون واستراتيجيون يصنعون برمجيات ذات أثر.',
      },
    },
    members: [],
  };
}

function getTeamContent() {
  return (window.NOVIQ_CONTENT && window.NOVIQ_CONTENT.team) || defaultTeamFallback();
}

function publishedMembers() {
  const team = getTeamContent();
  const members = Array.isArray(team.members) ? team.members : [];
  return members.filter(function (m) { return m && m.status !== 'draft'; });
}

function renderTeamPage(param, container) {
  const isAr = document.documentElement.lang === 'ar';
  const team = getTeamContent();
  const hero = team.hero || {};
  const members = publishedMembers();

  container.innerHTML = `
    <div class="noviq-page-hero">
      <div class="noviq-breadcrumb"><a href="#/home">${teamEscape(t('Home'))}</a> <span>/</span> <span>${teamEscape(t('Our Team'))}</span></div>
      <div class="reveal noviq-hero-badge"><i data-lucide="users" style="width:14px;height:14px"></i> ${teamEscape(teamText(hero.eyebrow, isAr) || t('Our Team'))}</div>
      <h1>${teamEscape(teamText(hero.title, isAr) || t('Meet the Minds Behind Noviq'))}</h1>
      <p>${teamEscape(teamText(hero.description, isAr) || t('Engineers, designers, and strategists crafting software that matters.'))}</p>
    </div>
    <div class="noviq-page-section">
      ${!members.length ? `
      <div class="noviq-resource-empty"><i data-lucide="users"></i><h3>${isAr ? 'فريقنا ينمو — ترقبوا الأعضاء قريباً' : 'Our team is growing — members coming soon'}</h3><p>${isAr ? 'تابع هذه الصفحة للتعرف على فريق نوفيك.' : 'Check back soon to meet the Noviq team.'}</p></div>` : `
      <div class="noviq-team-grid" id="team-full-grid">
        ${members.map(function (m, i) {
          const name = teamText(m.name, isAr);
          const role = teamText(m.role, isAr);
          const bio = teamText(m.bio, isAr);
          const photo = teamAssetUrl(m.photo);
          const profileHref = '#/member/' + encodeURIComponent(m.id || String(i));
          const portfolio = teamExternalUrl(m.portfolio);
          const cv = teamAssetUrl(m.cv);
          const email = teamEmailUrl(m.email);
          const linkedin = teamExternalUrl(m.linkedin);
          const github = teamExternalUrl(m.github);
          const facebook = teamExternalUrl(m.facebook);
          return `<article class="reveal noviq-glass-card noviq-team-card ${m.featured ? 'featured' : ''}" data-tilt="" style="transition-delay:${(i % 4) * 80 + 30}ms">
            ${photo ? `<a href="${teamEscape(profileHref)}" aria-label="${teamEscape(name)}"><img class="noviq-team-photo" src="${teamEscape(photo)}" alt="${teamEscape(name)}" loading="lazy" width="236" height="236"></a>` : `<a href="${teamEscape(profileHref)}" aria-label="${teamEscape(name)}" style="text-decoration:none"><span class="noviq-team-avatar" aria-hidden="true">${teamEscape(teamInitials(name))}</span></a>`}
            <h3><a href="${teamEscape(profileHref)}">${teamEscape(name)}</a></h3>
            ${role ? `<p class="noviq-team-role">${teamEscape(role)}</p>` : ''}
            ${bio ? `<p class="noviq-team-bio">${teamEscape(bio)}</p>` : ''}
            <div class="noviq-team-links">
              <a class="noviq-team-profile-btn" href="${teamEscape(profileHref)}">${isAr ? 'عرض الملف' : 'View Profile'} <i data-lucide="arrow-up-right" style="width:14px;height:14px"></i></a>
              ${portfolio ? `<a class="noviq-team-icon-btn" href="${teamEscape(portfolio)}" target="_blank" rel="noopener" title="${isAr ? 'الأعمال' : 'Portfolio'}" aria-label="${isAr ? 'الأعمال' : 'Portfolio'}"><i data-lucide="briefcase" style="width:16px;height:16px"></i></a>` : ''}
              ${cv ? `<a class="noviq-team-icon-btn" href="${teamEscape(cv)}" target="_blank" rel="noopener" title="${isAr ? 'السيرة الذاتية' : 'CV'}" aria-label="${isAr ? 'السيرة الذاتية' : 'CV'}"><i data-lucide="file-text" style="width:16px;height:16px"></i></a>` : ''}
              ${email ? `<a class="noviq-team-icon-btn" href="${teamEscape(email)}" title="Email" aria-label="Email"><i data-lucide="mail" style="width:16px;height:16px"></i></a>` : ''}
              ${linkedin ? `<a class="noviq-team-icon-btn" href="${teamEscape(linkedin)}" target="_blank" rel="noopener" title="LinkedIn" aria-label="LinkedIn">${teamBrandIcon('linkedin')}</a>` : ''}
              ${github ? `<a class="noviq-team-icon-btn" href="${teamEscape(github)}" target="_blank" rel="noopener" title="GitHub" aria-label="GitHub">${teamBrandIcon('github')}</a>` : ''}
              ${facebook ? `<a class="noviq-team-icon-btn" href="${teamEscape(facebook)}" target="_blank" rel="noopener" title="Facebook" aria-label="Facebook">${teamBrandIcon('facebook')}</a>` : ''}
            </div>
          </article>`;
        }).join('')}
      </div>`}
    </div>`;
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function renderMemberDetailPage(param, container) {
  const isAr = document.documentElement.lang === 'ar';
  const memberId = String(param || '').split('/').map(function (part) {
    try { return decodeURIComponent(part); } catch { return part; }
  }).join('/');
  const member = publishedMembers().find(function (m, index) {
    return m && String(m.id || index) === memberId;
  });

  if (!member) {
    renderTeamPage(null, container);
    return;
  }

  const name = teamText(member.name, isAr);
  const role = teamText(member.role, isAr);
  const bio = teamText(member.bio, isAr);
  const photo = teamAssetUrl(member.photo);
  const portfolio = teamExternalUrl(member.portfolio);
  const cv = teamAssetUrl(member.cv);
  const email = teamEmailUrl(member.email);
  const linkedin = teamExternalUrl(member.linkedin);
  const github = teamExternalUrl(member.github);
  const facebook = teamExternalUrl(member.facebook);
  const paragraphs = bio.split(/\n{2,}/).map(function (p) { return p.trim(); }).filter(Boolean);

  document.title = `${name} — ${role || t('Our Team')} | Noviq`;
  const metaDescription = document.querySelector('meta[name="description"]');
  if (metaDescription && bio) metaDescription.setAttribute('content', bio.slice(0, 200));
  const ogTitle = document.querySelector('meta[property="og:title"]');
  if (ogTitle) ogTitle.setAttribute('content', name);

  container.innerHTML = `
    <div class="noviq-page-hero">
      <div class="noviq-breadcrumb"><a href="#/home">${teamEscape(t('Home'))}</a><span>/</span><a href="#/team">${teamEscape(t('Our Team'))}</a><span>/</span><span>${teamEscape(name)}</span></div>
      <div class="reveal noviq-hero-badge"><i data-lucide="user-round" style="width:14px;height:14px"></i> ${teamEscape(role || t('Our Team'))}</div>
      <h1>${teamEscape(name)}</h1>
    </div>
    <div class="noviq-page-section">
      <div class="noviq-team-detail">
        <div class="reveal">
          ${photo ? `<img class="noviq-team-detail-photo" src="${teamEscape(photo)}" alt="${teamEscape(name)}" loading="lazy">` : `<div class="noviq-team-detail-avatar" aria-hidden="true">${teamEscape(teamInitials(name))}</div>`}
        </div>
        <div class="reveal noviq-team-detail-info">
          <h2>${teamEscape(name)}</h2>
          ${role ? `<p class="noviq-team-detail-role">${teamEscape(role)}</p>` : ''}
          <div class="noviq-team-detail-bio">${paragraphs.length ? paragraphs.map(function (p) { return `<p>${teamEscape(p).replace(/\n/g, '<br>')}</p>`; }).join('') : ''}</div>
          <div class="noviq-team-detail-actions">
            ${cv ? `<a class="noviq-btn-primary" href="${teamEscape(cv)}" target="_blank" rel="noopener"><i data-lucide="download" style="width:16px;height:16px"></i>${isAr ? 'تحميل السيرة الذاتية' : 'Download CV'}</a>` : ''}
            ${portfolio ? `<a class="noviq-btn-secondary" href="${teamEscape(portfolio)}" target="_blank" rel="noopener"><i data-lucide="briefcase" style="width:16px;height:16px"></i>${isAr ? 'عرض الأعمال' : 'View Portfolio'}</a>` : ''}
          </div>
          ${(email || linkedin || github || facebook) ? `<div class="noviq-team-socials">
            ${email ? `<a class="noviq-team-icon-btn" href="${teamEscape(email)}" title="Email" aria-label="Email"><i data-lucide="mail" style="width:16px;height:16px"></i></a>` : ''}
            ${linkedin ? `<a class="noviq-team-icon-btn" href="${teamEscape(linkedin)}" target="_blank" rel="noopener" title="LinkedIn" aria-label="LinkedIn">${teamBrandIcon('linkedin')}</a>` : ''}
            ${github ? `<a class="noviq-team-icon-btn" href="${teamEscape(github)}" target="_blank" rel="noopener" title="GitHub" aria-label="GitHub">${teamBrandIcon('github')}</a>` : ''}
            ${facebook ? `<a class="noviq-team-icon-btn" href="${teamEscape(facebook)}" target="_blank" rel="noopener" title="Facebook" aria-label="Facebook">${teamBrandIcon('facebook')}</a>` : ''}
          </div>` : ''}
          <a class="noviq-team-back" href="#/team"><i data-lucide="${isAr ? 'arrow-right' : 'arrow-left'}" style="width:16px;height:16px"></i>${isAr ? 'العودة للفريق' : 'Back to Team'}</a>
        </div>
      </div>
    </div>`;
  if (typeof lucide !== 'undefined') lucide.createIcons();
}
