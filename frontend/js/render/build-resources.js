/* ============================================================
   BUILD RESOURCES - News, articles, research, and downloads
   Content is published centrally from the backend admin panel.
   ============================================================ */

function resourceEscape(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, function (char) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char];
  });
}

function resourceText(value, isAr) {
  if (value && typeof value === 'object') {
    return String((isAr ? value.ar : value.en) || value.en || value.ar || '');
  }
  return String(value || '');
}

function resourceExternalUrl(value) {
  const url = String(value || '').trim();
  return /^(?:https?:\/\/|mailto:|tel:)[^\s"'<>]*$/i.test(url) ? url : '';
}

function resourceAssetUrl(value) {
  const url = String(value || '').trim();
  if (/(?:^|\/)\.\.(?:\/|$)/.test(url)) return '';
  if (/^https?:\/\/[^\s"'()<>]+$/i.test(url)) return url;
  return /^\/?(?:images|assets)\/[A-Za-z0-9_./-]+(?:\?[A-Za-z0-9_.~!$&+,;=:@%/?-]*)?$/.test(url) ? url : '';
}

function defaultResourcesFallback() {
  return {
    hero: {
      eyebrow: { en: 'Knowledge Hub', ar: 'مركز المعرفة' },
      title: { en: 'Resources & Insights', ar: 'المصادر والرؤى' },
      description: {
        en: 'Stay ahead with our latest news, articles, whitepapers, and technical guides.',
        ar: 'تابع أحدث أخبارنا ومقالاتنا وأبحاثنا وأدلتنا التقنية.',
      },
    },
    tabs: [
      { id: 'news', label: { en: 'News', ar: 'الأخبار' }, active: true },
      { id: 'blog', label: { en: 'Articles', ar: 'المقالات' }, active: true },
      { id: 'whitepapers', label: { en: 'Whitepapers', ar: 'الأبحاث' }, active: true },
      { id: 'downloads', label: { en: 'Downloads', ar: 'التحميلات' }, active: true },
    ],
    items: { news: [], blog: [], whitepapers: [], downloads: [] },
  };
}

function getResourcesContent() {
  return (window.NOVIQ_CONTENT && window.NOVIQ_CONTENT.resources) || defaultResourcesFallback();
}

function renderResourcesPage(param, container) {
  const isAr = document.documentElement.lang === 'ar';
  const resources = getResourcesContent();
  const hero = resources.hero || {};
  const tabs = (resources.tabs || []).filter(function (tab) { return tab && tab.active !== false; });

  container.innerHTML = `
    <div class="noviq-page-hero">
      <div class="noviq-breadcrumb"><a href="#/home">${resourceEscape(t('Home'))}</a> <span>/</span> <span>${resourceEscape(t('Resources'))}</span></div>
      <div class="reveal noviq-hero-badge"><i data-lucide="book-open" style="width:14px;height:14px"></i> ${resourceEscape(resourceText(hero.eyebrow, isAr) || t('Knowledge Hub'))}</div>
      <h1>${resourceEscape(resourceText(hero.title, isAr) || t('Resources & Insights'))}</h1>
      <p>${resourceEscape(resourceText(hero.description, isAr) || t('Stay ahead with our latest articles, whitepapers, and technical guides.'))}</p>
    </div>
    <div class="noviq-page-section">
      <div class="noviq-resource-tabs" role="tablist" aria-label="${isAr ? 'أقسام المصادر' : 'Resource sections'}">
        ${tabs.map(function (tab, index) {
          return `<button type="button" role="tab" aria-selected="${index === 0}" class="noviq-btn-option ${index === 0 ? 'active' : ''}" data-resource-tab="${resourceEscape(tab.id)}">${resourceEscape(resourceText(tab.label, isAr))}</button>`;
        }).join('')}
      </div>
      <div id="rt-content"></div>
    </div>`;

  container.querySelectorAll('[data-resource-tab]').forEach(function (button, index) {
    button.addEventListener('click', function () { switchResourceTab(index); });
  });
  switchResourceTab(0);
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function switchResourceTab(index) {
  const isAr = document.documentElement.lang === 'ar';
  const resources = getResourcesContent();
  const tabs = (resources.tabs || []).filter(function (tab) { return tab && tab.active !== false; });
  const tab = tabs[index];
  const element = document.getElementById('rt-content');
  if (!tab || !element) return;
  const items = ((resources.items && resources.items[tab.id]) || []).filter(function (item) {
    return item && item.status !== 'draft';
  });

  document.querySelectorAll('[data-resource-tab]').forEach(function (button, buttonIndex) {
    const active = buttonIndex === index;
    button.classList.toggle('active', active);
    button.setAttribute('aria-selected', String(active));
  });

  if (!items.length) {
    element.innerHTML = `<div class="noviq-resource-empty"><i data-lucide="inbox"></i><h3>${isAr ? 'سيتم نشر محتوى جديد قريباً' : 'New content is coming soon'}</h3><p>${isAr ? 'تابع هذه الصفحة للحصول على آخر الأخبار والرؤى.' : 'Check back for the latest news and insights.'}</p></div>`;
    if (typeof lucide !== 'undefined') lucide.createIcons();
    return;
  }

  element.innerHTML = `<div class="noviq-resource-grid">${items.map(function (item, itemIndex) {
    const title = resourceText(item.title, isAr);
    const excerpt = resourceText(item.excerpt, isAr);
    const category = resourceText(item.cat, isAr);
    const safeLink = resourceExternalUrl(item.link);
    const safeFile = resourceAssetUrl(item.file);
    const safeImage = resourceAssetUrl(item.image);
    const externalTarget = safeFile || safeLink;
    const internalTarget = `#/resource/${encodeURIComponent(tab.id)}/${encodeURIComponent(item.id || String(itemIndex))}`;
    const href = externalTarget || internalTarget;
    const external = Boolean(externalTarget);
    const action = safeFile
      ? (isAr ? 'تحميل الملف' : 'Download file')
      : external
        ? (isAr ? 'فتح الرابط' : 'Open link')
        : (isAr ? 'اقرأ المزيد' : 'Read more');
    return `<article class="reveal noviq-resource-card ${item.featured ? 'featured' : ''}">
      ${safeImage ? `<a class="noviq-resource-image" href="${resourceEscape(href)}" ${external ? 'target="_blank" rel="noopener"' : ''} aria-label="${resourceEscape(title)}"><img src="${resourceEscape(safeImage)}" alt="" loading="lazy" width="400" height="240"></a>` : ''}
      <div class="noviq-resource-body">
        <div class="noviq-resource-meta">${category ? `<span>${resourceEscape(category)}</span>` : '<span></span>'}<time>${resourceEscape(item.date || '')}</time></div>
        <h2><a href="${resourceEscape(href)}" ${external ? 'target="_blank" rel="noopener"' : ''}>${resourceEscape(title)}</a></h2>
        ${excerpt ? `<p>${resourceEscape(excerpt)}</p>` : ''}
        <div class="noviq-resource-footer">${item.author ? `<small>${resourceEscape(item.author)}</small>` : '<small></small>'}<a href="${resourceEscape(href)}" ${external ? 'target="_blank" rel="noopener"' : ''}>${action} <i data-lucide="${safeFile ? 'download' : external ? 'external-link' : 'arrow-up-right'}"></i></a></div>
      </div>
    </article>`;
  }).join('')}</div>`;

  if (typeof lucide !== 'undefined') lucide.createIcons();
  if (typeof observeReveal === 'function') {
    element.querySelectorAll('.reveal').forEach(function (item) { observeReveal(item); });
  }
}

function renderResourceDetailPage(param, container) {
  const isAr = document.documentElement.lang === 'ar';
  const parts = String(param || '').split('/').map(function (part) {
    try { return decodeURIComponent(part); } catch { return part; }
  });
  const tabId = parts[0];
  const itemId = parts.slice(1).join('/');
  const resources = getResourcesContent();
  const tab = (resources.tabs || []).find(function (entry) { return entry.id === tabId && entry.active !== false; });
  const items = (resources.items && resources.items[tabId]) || [];
  const item = items.find(function (entry, index) {
    return entry && entry.status !== 'draft' && String(entry.id || index) === itemId;
  });

  if (!tab || !item) {
    renderResourcesPage(null, container);
    return;
  }

  const title = resourceText(item.title, isAr);
  const excerpt = resourceText(item.excerpt, isAr);
  const content = resourceText(item.content, isAr);
  const category = resourceText(item.cat, isAr);
  const safeImage = resourceAssetUrl(item.image);
  const safeFile = resourceAssetUrl(item.file);
  const safeLink = resourceExternalUrl(item.link);
  const paragraphs = content.split(/\n{2,}/).map(function (paragraph) { return paragraph.trim(); }).filter(Boolean);

  document.title = `${title} | Noviq`;
  const metaDescription = document.querySelector('meta[name="description"]');
  if (metaDescription && excerpt) metaDescription.setAttribute('content', excerpt.slice(0, 200));
  const ogTitle = document.querySelector('meta[property="og:title"]');
  if (ogTitle) ogTitle.setAttribute('content', title);
  const ogDescription = document.querySelector('meta[property="og:description"]');
  if (ogDescription && excerpt) ogDescription.setAttribute('content', excerpt.slice(0, 200));

  container.innerHTML = `
    <div class="noviq-page-hero noviq-resource-detail-hero">
      <div class="noviq-breadcrumb"><a href="#/home">${resourceEscape(t('Home'))}</a><span>/</span><a href="#/resources">${resourceEscape(t('Resources'))}</a><span>/</span><span>${resourceEscape(resourceText(tab.label, isAr))}</span></div>
      ${category ? `<span class="noviq-resource-detail-tag">${resourceEscape(category)}</span>` : ''}
      <h1>${resourceEscape(title)}</h1>
      ${excerpt ? `<p>${resourceEscape(excerpt)}</p>` : ''}
      <div class="noviq-resource-detail-meta">${item.author ? `<span><i data-lucide="user-round"></i>${resourceEscape(item.author)}</span>` : ''}${item.date ? `<span><i data-lucide="calendar"></i>${resourceEscape(item.date)}</span>` : ''}</div>
    </div>
    <div class="noviq-page-section">
      <article class="noviq-resource-article">
        ${safeImage ? `<img src="${resourceEscape(safeImage)}" alt="${resourceEscape(title)}" loading="lazy" width="400" height="240">` : ''}
        <div class="noviq-resource-article-copy">${paragraphs.length ? paragraphs.map(function (paragraph) { return `<p>${resourceEscape(paragraph).replace(/\n/g, '<br>')}</p>`; }).join('') : `<p>${resourceEscape(excerpt)}</p>`}</div>
        ${(safeFile || safeLink) ? `<div class="noviq-resource-detail-actions">${safeFile ? `<a class="noviq-btn-primary" href="${resourceEscape(safeFile)}" target="_blank" rel="noopener"><i data-lucide="download"></i>${isAr ? 'تحميل الملف' : 'Download file'}</a>` : ''}${safeLink ? `<a class="noviq-btn-secondary" href="${resourceEscape(safeLink)}" target="_blank" rel="noopener"><i data-lucide="external-link"></i>${isAr ? 'فتح الرابط' : 'Open link'}</a>` : ''}</div>` : ''}
      </article>
    </div>`;
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

window._switchRT = switchResourceTab;
