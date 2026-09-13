/* ============================================================
   NOVIQ NLP & TRANSLATING SEARCH ENGINE
   ============================================================ */

(function() {
  // Simple Arabic-to-English translation mapping for site navigation & intent detection
  const DICTIONARY = {
    'تواصل': 'contact', 'اتصل': 'contact', 'رسالة': 'contact', 'ارسل': 'contact',
    'مشاريع': 'portfolio', 'اعمال': 'portfolio', 'سابقة': 'portfolio', 'أعمال': 'portfolio',
    'عن': 'about', 'من نحن': 'about', 'معلومات': 'about', 'شركة': 'about',
    'اسعار': 'pricing', 'أسعار': 'pricing', 'تكلفة': 'pricing', 'باقة': 'pricing', 'سعر': 'pricing',
    'ذكاء': 'ai-lab', 'شات': 'ai-lab', 'مختبر': 'ai-lab', 'تجربة': 'ai-lab', 'بوت': 'ai-lab',
    'وظائف': 'careers', 'توظيف': 'careers', 'عمل': 'careers', 'وظيفة': 'careers',
    'اسئلة': 'faq', 'أسئلة': 'faq', 'اجوبة': 'faq', 'أجوبة': 'faq', 'استفسار': 'faq',
    'خدمات': 'services', 'برمجة': 'services', 'تطوير': 'services',
    'مقالات': 'resources', 'مدونة': 'resources', 'أبحاث': 'resources', 'ابحاث': 'resources',
    'تحميل': 'resources', 'تنزيل': 'resources', 'ملفات': 'resources',
    'رئيسية': 'home', 'الرئيسية': 'home', 'بداية': 'home'
  };

  // Synonyms mapping to improve search accuracy
  const SYNONYMS = {
    'llm': ['ai', 'artificial intelligence', 'chat', 'model'],
    'website': ['custom software', 'web applications', 'code'],
    'app': ['mobile applications', 'custom software', 'saas'],
    'pricing': ['cost', 'budget', 'estimator', 'roi'],
    'money': ['pricing', 'cost', 'roi'],
    'jobs': ['careers', 'join', 'work', 'hiring'],
    'help': ['faq', 'contact', 'support']
  };

  // Helper to detect if a string contains Arabic characters
  function isArabic(text) {
    return /[\u0600-\u06FF]/.test(text);
  }

  // Pre-process and normalize query
  function normalizeText(text) {
    return text.toLowerCase().trim()
      .replace(/[أإآ]/g, 'ا')
      .replace(/ة/g, 'ه')
      .replace(/ى/g, 'ي');
  }

  // NLP: Detect search intent, translate, and match synonyms
  function analyzeQuery(query) {
    const rawNormalized = query.toLowerCase().trim();
    const normalized = normalizeText(rawNormalized);
    const tokens = normalized.split(/\s+/);
    
    let isAr = isArabic(query);
    let englishQuery = rawNormalized;
    let detectedIntent = null;
    let nlpMethod = isAr ? "Arabic NLP Translation" : "Keyword Matching";

    // 1. Translate Arabic tokens or match Arabic intents
    if (isAr) {
      for (let token of tokens) {
        if (DICTIONARY[token]) {
          detectedIntent = DICTIONARY[token];
          englishQuery = DICTIONARY[token];
          break;
        }
      }
      // Check full string match in dictionary if no single token matched
      if (!detectedIntent) {
        for (let key in DICTIONARY) {
          if (normalized.includes(key)) {
            detectedIntent = DICTIONARY[key];
            englishQuery = DICTIONARY[key];
            break;
          }
        }
      }
    } else {
      // 2. English Intent Matching
      const intents = {
        'contact': ['contact', 'mail', 'email', 'phone', 'support', 'message', 'touch'],
        'portfolio': ['portfolio', 'work', 'projects', 'case study', 'delivered'],
        'about': ['about', 'team', 'who we are', 'history', 'experience'],
        'pricing': ['pricing', 'cost', 'estimator', 'roi', 'price', 'budget'],
        'ai-lab': ['ai-lab', 'ai lab', 'chat', 'consultant', 'model', 'llm', 'demo'],
        'careers': ['careers', 'jobs', 'hiring', 'work', 'join'],
        'faq': ['faq', 'questions', 'support', 'help'],
        'services': ['services', 'solutions', 'erp', 'crm', 'cloud', 'software', 'app'],
        'resources': ['resources', 'blog', 'whitepapers', 'downloads', 'articles']
      };

      for (let intent in intents) {
        if (intents[intent].some(keyword => normalized.includes(keyword))) {
          detectedIntent = intent;
          nlpMethod = "Intent Classification";
          break;
        }
      }
    }

    // 3. Synonym expansion
    let searchTerms = [englishQuery];
    for (let key in SYNONYMS) {
      if (englishQuery.includes(key)) {
        searchTerms = searchTerms.concat(SYNONYMS[key]);
        nlpMethod = "Synonym Expansion";
      }
    }

    return {
      original: query,
      isArabic: isAr,
      englishQuery: englishQuery,
      intent: detectedIntent,
      searchTerms: searchTerms,
      nlpMethod: nlpMethod
    };
  }

  // Find matching items from the site content
  async function performSearch(analysis) {
    const results = [];
    const content = window.NOVIQ_CONTENT;
    if (!content) return results;

    const terms = analysis.searchTerms;

    // A. Match Main Pages
    const pages = [
      { title: 'Home', path: 'home', desc: 'Main landing page and overview.' },
      { title: 'Solutions & Services', path: 'services', desc: 'Custom software, AI integrations, ERP, CRM, and cloud.' },
      { title: 'Portfolio / Case Studies', path: 'portfolio', desc: 'Featured projects and success stories.' },
      { title: 'About Us', path: 'about', desc: 'Noviq values, mission, and engineering philosophy.' },
      { title: 'Pricing & Cost Tools', path: 'pricing', desc: 'Transparent price tables, ROI calculators, and estimators.' },
      { title: 'AI Lab', path: 'ai-lab', desc: 'Interact with AI demos and test intelligent systems.' },
      { title: 'Careers', path: 'careers', desc: 'Join our team. View open tech and design roles.' },
      { title: 'Resources & Insights', path: 'resources', desc: 'Read our latest blog posts, whitepapers, and guides.' },
      { title: 'Contact & Support', path: 'contact', desc: 'Get in touch with our engineering team.' },
      { title: 'FAQ', path: 'faq', desc: 'Frequently asked questions about our process.' }
    ];

    pages.forEach(p => {
      let matched = false;
      if (analysis.intent && p.path === analysis.intent) {
        matched = true;
      } else {
        matched = terms.some(term => p.title.toLowerCase().includes(term) || p.desc.toLowerCase().includes(term) || p.path.includes(term));
      }
      if (matched) {
        results.push({
          type: 'Page',
          title: p.title,
          desc: p.desc,
          path: p.path,
          icon: p.path === 'ai-lab' ? 'sparkles' : (p.path === 'contact' ? 'mail' : 'layers')
        });
      }
    });

    // B. Match Services
    if (content.services) {
      content.services.forEach(s => {
        const isMatched = terms.some(term => s.title.toLowerCase().includes(term) || s.desc.toLowerCase().includes(term));
        if (isMatched) {
          results.push({
            type: 'Service',
            title: s.title,
            desc: s.desc,
            path: 'services',
            icon: s.icon || 'code-2'
          });
        }
      });
    }

    // C. Match Projects
    if (content.projects) {
      content.projects.forEach(p => {
        const isMatched = terms.some(term => p.title.toLowerCase().includes(term) || p.desc.toLowerCase().includes(term) || p.tag.toLowerCase().includes(term));
        if (isMatched) {
          results.push({
            type: 'Project',
            title: p.title,
            desc: `${p.tag} - ${p.desc}`,
            path: 'portfolio',
            icon: 'folder-git2'
          });
        }
      });
    }

    // D. Match published news, articles, whitepapers, and downloads
    if (content.resources && Array.isArray(content.resources.tabs)) {
      const isAr = document.documentElement.lang === 'ar';
      const localized = value => value && typeof value === 'object'
        ? String((isAr ? value.ar : value.en) || value.en || value.ar || '')
        : String(value || '');
      content.resources.tabs.filter(tab => tab && tab.active !== false).forEach(tab => {
        const items = (content.resources.items && content.resources.items[tab.id]) || [];
        items.filter(item => item && item.status !== 'draft').forEach((item, index) => {
          const title = localized(item.title);
          const desc = localized(item.excerpt);
          const category = localized(item.cat);
          const haystack = `${title} ${desc} ${category}`.toLowerCase();
          if (!terms.some(term => haystack.includes(term))) return;
          results.push({
            type: localized(tab.label) || 'Resource',
            title,
            desc,
            path: `resource/${encodeURIComponent(tab.id)}/${encodeURIComponent(item.id || String(index))}`,
            icon: item.file ? 'download' : tab.id === 'news' ? 'newspaper' : 'book-open'
          });
        });
      });
    }

    return results.slice(0, 6); // Limit to top 6 results
  }

  // Fallback: search chatbot knowledge base via API if no local results
  async function searchChatbotKnowledge(query, lang) {
    try {
      const res = await fetch(`${NoviqAPI.url('/chatbot/search')}?q=${encodeURIComponent(query)}&lang=${lang}&limit=4`);
      if (!res.ok) return [];
      const data = await res.json();
      return (data.results || []).map(r => ({
        type: 'Knowledge',
        title: r.title,
        desc: (r.snippet || '').substring(0, 100) + ((r.snippet || '').length > 100 ? '…' : ''),
        path: String(r.link || '#/ai-lab').replace(/^#\//, ''),
        icon: 'lightbulb'
      }));
    } catch (e) {
      console.warn('[Search] Chatbot knowledge fallback failed:', e);
      return [];
    }
  }

  // Guaranteed last-resort result: hand the query to the assistant
  function askAssistantItem(query, isAr) {
    try { sessionStorage.setItem('noviq_search_query', query); } catch {}
    return {
      type: isAr ? 'المساعد الذكي' : 'Assistant',
      title: isAr ? `اسأل المساعد عن: "${query}"` : `Ask the assistant about: "${query}"`,
      desc: isAr ? 'مساعد نوفيك يجيب من معرفة الموقع والويب' : 'The Noviq assistant answers from site knowledge and the web',
      path: 'ai-lab',
      icon: 'sparkles'
    };
  }

  // Render Search Dropdown Results (pure render — fallback handled by caller)
  function renderDropdown(dropdown, results, analysis) {

    // Categorize results
    const categories = {};
    results.forEach(item => {
      if (!categories[item.type]) categories[item.type] = [];
      categories[item.type].push(item);
    });

    let html = '';
    for (let cat in categories) {
      html += `<div class="noviq-search-group">
        <div class="noviq-search-group-title">${cat}</div>`;
      categories[cat].forEach(item => {
        html += `
          <a class="noviq-search-item" href="#/${item.path}">
            <i data-lucide="${item.icon}" style="width:14px;height:14px;color:var(--secondary)"></i>
            <div class="noviq-search-item-info">
              <span class="noviq-search-item-title">${item.title}</span>
              <span class="noviq-search-item-desc">${item.desc}</span>
            </div>
          </a>`;
      });
      html += `</div>`;
    }

    // Add NLP feedback badge at the bottom of the dropdown
    html += `<div style="display:flex;justify-content:space-between;align-items:center;padding:4px 8px;border-top:1px solid var(--control-border);margin-top:4px">
      <span style="font-size:9px;color:var(--text-tertiary)">NLP: ${analysis.nlpMethod}</span>
      ${analysis.isArabic ? '<span style="font-size:9px;color:var(--secondary)">تمت الترجمة والفهم</span>' : ''}
    </div>`;

    dropdown.innerHTML = html;
    dropdown.style.display = 'block';
    if (typeof lucide !== 'undefined') lucide.createIcons();
  }

  // Initialize event listeners
  function initSearch() {
    const input = document.getElementById('header-search-input');
    const dropdown = document.getElementById('header-search-dropdown');
    const container = document.getElementById('header-search-container');

    if (!input || !dropdown) return;

    let searchTimer = null;
    let searchSeq = 0;

    input.addEventListener('input', function() {
      const val = this.value;
      if (!val.trim()) {
        dropdown.style.display = 'none';
        dropdown.innerHTML = '';
        return;
      }

      /* Debounce (200ms) + sequence guard so a slow KB/API response
         never overwrites results of newer keystrokes */
      clearTimeout(searchTimer);
      const seq = ++searchSeq;
      searchTimer = setTimeout(async () => {
        const analysis = analyzeQuery(val);
        let results = await performSearch(analysis);

        /* No local hits → chatbot knowledge base (150 topics, BM25),
           and ALWAYS append an "ask the assistant" result */
        if (results.length === 0) {
          const lang = analysis.isArabic ? 'ar' : 'en';
          const kbResults = val.trim().length >= 3
            ? await searchChatbotKnowledge(val, lang)
            : [];
          if (seq !== searchSeq) return;
          results = kbResults.concat([askAssistantItem(val, analysis.isArabic)]);
        }

        if (seq !== searchSeq) return;           // a newer search superseded us
        renderDropdown(dropdown, results, analysis);
      }, 200);
    });

    // Handle keypress Enter
    input.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') {
        const firstItem = dropdown.querySelector('.noviq-search-item');
        if (firstItem) {
          firstItem.click();
          dropdown.style.display = 'none';
          input.value = '';
          input.blur();
        } else if (input.value.trim() && typeof showToast === 'function') {
          showToast(isArabic(input.value) ? 'البحث عن: ' + input.value : 'Searching for: ' + input.value);
        }
      }
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', function(e) {
      if (container && !container.contains(e.target)) {
        dropdown.style.display = 'none';
      }
    });

    // Re-open dropdown on focus if input is not empty
    input.addEventListener('focus', function() {
      if (this.value.trim()) {
        dropdown.style.display = 'block';
      }
    });
  }

  // Load immediately or wait for DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSearch);
  } else {
    initSearch();
  }

  /* Expose internals so the mobile menu search (and other reuses)
     can share the same NLP pipeline without duplicating logic. */
  window.NoviqSearch = { analyzeQuery, performSearch, searchChatbotKnowledge, askAssistantItem, renderDropdown };
})();
