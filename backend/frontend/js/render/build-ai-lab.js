/* ============================================================
   AI LAB — NOVIQ SMART ASSISTANT (all-in-one chatbot)
   ------------------------------------------------------------
   One chat, every feature:
   • Knowledge engine + live database (server, 1000+ keywords)
   • Image generation  → "ارسم قطة" / "draw a cat"
   • OCR               → attach an image (Tesseract ara+eng)
   • Voice input       → mic button (Web Speech API)
   • Spoken replies    → speaker toggle (SpeechSynthesis)
   • Translation       → "ترجم hello للعربي" / "translate مرحبا to english"
   • Summarization     → "لخص <نص طويل>" / "summarize <long text>"
   • Knowledge search  → "ابحث عن ..." / "search: ..." (+web fallback)
   • Lead capture, session persistence, copy/reset, offline mode
   ============================================================ */

function renderAILabPage(param, container) {
  const isAr = document.documentElement.lang === 'ar';
  const cap = (icon, label) => `<span class="nv-cap"><i data-lucide="${icon}"></i>${label}</span>`;
  const prompt = (icon, ar, en) => `<button type="button" class="ai-lab-prompt" data-ai-prompt="${isAr ? ar : en}">
    <i data-lucide="${icon}"></i><span>${isAr ? ar : en}</span><i data-lucide="arrow-up-right" class="ai-lab-prompt-arrow"></i>
  </button>`;

  container.innerHTML = `
    <div class="noviq-page-hero ai-lab-hero">
      <div class="ai-lab-hero-glow" aria-hidden="true"></div>
      <div class="noviq-breadcrumb">
        <a href="#/home">${t('Home')}</a> <span>/</span> <span>${t('AI Lab')}</span>
      </div>
      <div class="ai-lab-hero-copy">
        <div class="reveal noviq-hero-badge"><i data-lucide="sparkles"></i> ${isAr ? 'تجربة ذكاء اصطناعي مباشرة' : 'Live AI experience'}</div>
        <h1>${isAr ? 'مختبر نوفيك للذكاء الاصطناعي' : 'Noviq Intelligence Lab'}</h1>
        <p>${isAr
          ? 'جرّب مساعداً ثنائي اللغة يجمع معرفة خدمات نوفيك، وتوليد الصور، واستخراج النصوص، والصوت في مساحة عمل واحدة.'
          : 'Explore one focused workspace for Noviq knowledge, image generation, OCR, voice, and bilingual assistance.'}</p>
        <div class="ai-lab-metrics" aria-label="AI Lab capabilities">
          <span><strong>1000+</strong>${isAr ? 'كلمة مفتاحية' : 'keywords'}</span>
          <span><strong>AR / EN</strong>${isAr ? 'ثنائي اللغة' : 'bilingual'}</span>
          <span><strong><i data-lucide="database"></i></strong>${isAr ? 'بيانات مباشرة' : 'live data'}</span>
        </div>
      </div>
    </div>

    <div class="noviq-page-section ai-lab-workspace">
      <div class="ai-lab-layout">
        <aside class="ai-lab-console reveal">
          <div class="ai-lab-console-head">
            <span class="ai-lab-kicker">${isAr ? 'لوحة التشغيل' : 'Launchpad'}</span>
            <h2>${isAr ? 'ماذا تريد أن تنجز؟' : 'What will you create?'}</h2>
            <p>${isAr ? 'اختر أداة أو ابدأ بأحد الأوامر الجاهزة.' : 'Choose a capability or start with a prepared command.'}</p>
          </div>
          <div class="ai-lab-tools">
            <button type="button" class="ai-lab-tool ai-lab-tool-button" data-ai-action="image-builder"><span><i data-lucide="image"></i></span><div><strong>${isAr ? 'توليد الصور' : 'Image studio'}</strong><small>Pollinations AI</small></div></button>
            <div class="ai-lab-tool"><span><i data-lucide="scan-text"></i></span><div><strong>${isAr ? 'استخراج النص' : 'Document OCR'}</strong><small>AR + EN</small></div></div>
            <div class="ai-lab-tool"><span><i data-lucide="messages-square"></i></span><div><strong>${isAr ? 'معرفة نوفيك' : 'Noviq knowledge'}</strong><small>${isAr ? 'خدمات وحلول' : 'Services + solutions'}</small></div></div>
            <div class="ai-lab-tool"><span><i data-lucide="mic"></i></span><div><strong>${isAr ? 'محادثة صوتية' : 'Voice input'}</strong><small>${isAr ? 'تحدث بطبيعتك' : 'Speak naturally'}</small></div></div>
          </div>
          <div class="ai-lab-starters">
            <span>${isAr ? 'جرّب الآن' : 'Try a starter'}</span>
            ${prompt('sparkles', 'أنشئ صورة واجهة موقع إلكتروني لعيادة حديثة', 'Create a modern clinic website interface')}
            ${prompt('layers-3', 'ما أفضل نظام ERP لشركة متوسطة؟', 'What ERP fits a mid-size company?')}
            ${prompt('cloud', 'اشرح خدماتكم السحابية', 'Explain your cloud services')}
          </div>
          <div class="ai-lab-private-note"><i data-lucide="shield-check"></i><span>${isAr ? 'لا تكتب بيانات سرية أو كلمات مرور.' : 'Do not enter passwords or confidential data.'}</span></div>
        </aside>

        <div class="nv-chat-shell reveal-scale">
          <div class="nv-chat-head">
            <div class="nv-chat-id">
              <div class="nv-bot-avatar"><i data-lucide="brain-circuit"></i></div>
              <div>
                <div class="nv-bot-name">${isAr ? 'مساعد نوفيك الذكي' : 'Noviq AI Assistant'}</div>
                <div class="nv-bot-status" id="chatbot-status-badge"><i data-lucide="loader" style="width:12px;height:12px;opacity:.6"></i> ${t('Connecting...')}</div>
              </div>
            </div>
            <div class="nv-chat-actions">
              <button class="nv-icon-btn" id="chat-tts-btn" title="${t('Read replies aloud')}" aria-label="Voice replies"><i data-lucide="volume-x"></i></button>
              <button class="nv-icon-btn" id="chat-copy-btn" title="${t('Copy Chat')}" aria-label="Copy chat"><i data-lucide="copy"></i></button>
              <button class="nv-icon-btn" id="chat-reset-btn" title="${t('New Chat')}" aria-label="New chat"><i data-lucide="rotate-ccw"></i></button>
            </div>
          </div>
          <div class="nv-chat-caps" id="chatbot-stats-bar">
            ${cap('image', isAr ? 'توليد صور' : 'Images')}
            ${cap('scan-text', 'OCR')}
            ${cap('mic', isAr ? 'صوت' : 'Voice')}
            ${cap('languages', isAr ? 'ترجمة' : 'Translate')}
            ${cap('file-text', isAr ? 'تلخيص' : 'Summarize')}
            ${cap('globe', isAr ? 'بحث ويب' : 'Web search')}
          </div>
          <div class="noviq-chat-messages" id="demo-chat-msgs" aria-live="polite"></div>
          <div class="chat-quick-replies" id="demo-chat-suggestions"></div>
          <div class="chat-input-bar">
            <button id="chat-attach" class="nv-tool-btn" title="${t('Attach image (OCR)')}" aria-label="OCR"><i data-lucide="paperclip"></i></button>
            <button id="chat-mic" class="nv-tool-btn" title="${t('Voice input')}" aria-label="Voice"><i data-lucide="mic"></i></button>
            <div class="nv-composer-field">
              <input type="text" id="demo-chat-input" placeholder="${isAr ? 'اسأل عن الخدمات أو اكتب: ارسم لوحة تحكم ذكية...' : 'Ask about services or type: draw a smart dashboard...'}" autocomplete="off" />
              <span class="nv-composer-hint">Enter</span>
            </div>
            <button id="demo-chat-send" class="nv-send-btn" aria-label="Send"><i data-lucide="send"></i></button>
          </div>
          <input type="file" id="chat-file" accept="image/png,image/jpeg,image/webp,image/gif,application/pdf,text/plain,text/csv,text/markdown,application/json,application/vnd.openxmlformats-officedocument.wordprocessingml.document" style="display:none" />
          <div id="chat-status" class="nv-chat-statusline"></div>
        </div>
      </div>
      <p class="ai-lab-contact-tip"><i data-lucide="mail"></i>${t('Tip: leave your email in the chat and our team will contact you within one business day.')}</p>
    </div>`;

  if (typeof lucide !== 'undefined') lucide.createIcons();
  NoviqChatbot.init(isAr);
}

/* All old demo routes land on the chatbot */
function renderAIDemoPage(param, container) {
  renderAILabPage(param, container);
}

/* ============================================================
   CHATBOT CONTROLLER
   ============================================================ */
const NoviqChatbot = {
  sessionId: '',
  isLoading: false,
  online: null,
  tts: false,
  recognition: null,
  recording: false,

  init(isAr) {
    this.tts = false;
    this.recording = false;

    try {
      this.sessionId = localStorage.getItem('noviq_chat_session')
        || ('chat-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8));
      localStorage.setItem('noviq_chat_session', this.sessionId);
    } catch { this.sessionId = 'chat-' + Date.now(); }

    this.el = {
      msgs: document.getElementById('demo-chat-msgs'),
      input: document.getElementById('demo-chat-input'),
      send: document.getElementById('demo-chat-send'),
      status: document.getElementById('chat-status'),
      suggestions: document.getElementById('demo-chat-suggestions'),
      statsBadge: document.getElementById('chatbot-status-badge'),
      statsBar: document.getElementById('chatbot-stats-bar'),
      copyBtn: document.getElementById('chat-copy-btn'),
      resetBtn: document.getElementById('chat-reset-btn'),
      ttsBtn: document.getElementById('chat-tts-btn'),
      micBtn: document.getElementById('chat-mic'),
      attachBtn: document.getElementById('chat-attach'),
      fileInput: document.getElementById('chat-file'),
    };

    this.el.send.addEventListener('click', () => this.handleSend());
    this.el.input.addEventListener('keydown', e => { if (e.key === 'Enter') this.handleSend(); });
    this.el.resetBtn.addEventListener('click', () => this.resetChat(isAr));
    this.el.copyBtn.addEventListener('click', () => this.copyChat());
    this.el.ttsBtn.addEventListener('click', () => this.toggleTts());
    this.el.micBtn.addEventListener('click', () => this.toggleVoice(isAr));
    this.el.attachBtn.addEventListener('click', () => this.el.fileInput.click());
    this.el.fileInput.addEventListener('change', e => {
      const file = e.target.files[0];
      if (file) this.handleAttachment(file, isAr);
      e.target.value = '';
    });
    const shell = this.el.msgs.closest('.nv-chat-shell');
    shell?.addEventListener('dragover', e => { if (e.dataTransfer?.types?.includes('Files')) { e.preventDefault(); shell.classList.add('drag-active'); } });
    shell?.addEventListener('dragleave', e => { if (!shell.contains(e.relatedTarget)) shell.classList.remove('drag-active'); });
    shell?.addEventListener('drop', e => {
      shell.classList.remove('drag-active');
      const file = e.dataTransfer?.files?.[0];
      if (file) { e.preventDefault(); this.handleAttachment(file, isAr); }
    });
    this.el.input.addEventListener('paste', e => {
      const file = Array.from(e.clipboardData?.files || [])[0];
      if (file) { e.preventDefault(); this.handleAttachment(file, isAr); }
    });
    document.querySelectorAll('.ai-lab-prompt').forEach(button => {
      button.addEventListener('click', () => {
        this.el.input.value = button.dataset.aiPrompt || '';
        this.handleSend();
      });
    });
    document.querySelector('[data-ai-action="image-builder"]')?.addEventListener('click', () => this.openImageBuilder('', isAr));

    this.welcome(isAr);
    this.loadStats();

    /* Pre-load TTS voices (Chrome loads them asynchronously) */
    if (window.speechSynthesis) {
      this._loadVoices();
      window.speechSynthesis.onvoiceschanged = () => this._loadVoices();
    }

    /* Hand-off from the header search: prefill the query so the user
       just hits Enter to ask the assistant */
    try {
      const q = sessionStorage.getItem('noviq_search_query');
      if (q) {
        sessionStorage.removeItem('noviq_search_query');
        this.el.input.value = q;
        this.el.input.focus();
      }
    } catch {}
  },

  welcome(isAr) {
    this.addMessage('ai', t("Hello! I'm the Noviq assistant — ask me about services, pricing, projects, or leave your email to book a free consultation."));
    this.addMessage('ai', isAr
      ? 'يمكنك أيضاً إنشاء تصور بصري لخدمة رقمية. جرّب: "أنشئ صورة واجهة موقع إلكتروني لعيادة"، أو أرفق صورة لاستخراج نصها، أو استخدم المايك للتحدث.'
      : 'You can also visualize a digital product. Try: "Create a clinic website interface", attach an image for OCR, or use the microphone.');
    this.renderSuggestions(isAr
      ? ['أنشئ صورة واجهة موقع إلكتروني لعيادة', 'أنشئ صورة تطبيق جوال لمطعم', 'أنشئ صورة لوحة تحكم ERP لشركة لوجستية', 'خدماتكم', 'الأسعار']
      : ['Create a clinic website interface', 'Create a restaurant mobile app interface', 'Create an ERP dashboard for a logistics company', 'Our services', 'Pricing']);
  },

  async loadStats() {
    try {
      const res = await fetch(NoviqAPI.url('/chatbot/stats'));
      if (!res.ok) throw new Error('offline');
      const s = await res.json();
      this.online = true;
      this.el.statsBadge.classList.remove('offline');
      this.el.statsBadge.innerHTML = `<i data-lucide="circle-check" style="width:12px;height:12px;color:#22c55e"></i> ${t('Connected to live database')}`;
      if (typeof lucide !== 'undefined') lucide.createIcons();
      if (!this.el.statsBar.dataset.filled) {
        this.el.statsBar.dataset.filled = '1';
        const stat = (label) => `<span class="nv-cap nv-cap-stat">${label}</span>`;
        this.el.statsBar.insertAdjacentHTML('beforeend',
          stat(`${s.keywords.toLocaleString()} ${t('keywords')}`) +
          stat(`${s.topics || ((s.faqs || 0) + s.intents)} ${t('topics')}`) +
          stat(`${s.conversations.toLocaleString()} ${t('conversations')}`));
      }
    } catch {
      this.online = false;
      this.el.statsBadge.classList.add('offline');
      this.el.statsBadge.innerHTML = `<i data-lucide="cloud-off" style="width:12px;height:12px;color:#F59E0B"></i> ${t('Offline mode — answers from cached site content.')}`;
      if (typeof lucide !== 'undefined') lucide.createIcons();
    }
  },

  /* ---------------- messages ---------------- */
  formatTime(date = new Date()) {
    const isAr = document.documentElement.lang === 'ar';
    let h = date.getHours();
    const m = String(date.getMinutes()).padStart(2, '0');
    const period = isAr ? (h < 12 ? 'ص' : 'م') : (h < 12 ? 'AM' : 'PM');
    h = h % 12 || 12;
    return `${h}:${m} ${period}`;
  },

  addMessage(type, text) {
    const row = document.createElement('div');
    row.className = `nv-msg ${type}`;
    const bubble = document.createElement('div');
    bubble.className = `chat-bubble ${type}`;
    if (type === 'ai') {
      const avatar = document.createElement('span');
      avatar.className = 'nv-msg-avatar';
      avatar.textContent = 'N';
      row.appendChild(avatar);
      bubble.style.whiteSpace = 'pre-line';
      bubble.textContent = text;
      this.speak(text);
    } else {
      bubble.textContent = text;
    }
    const meta = document.createElement('span');
    meta.className = 'chat-time';
    meta.textContent = this.formatTime();
    bubble.appendChild(meta);
    row.appendChild(bubble);
    this.el.msgs.appendChild(row);
    this.el.msgs.scrollTop = this.el.msgs.scrollHeight;
    return bubble;
  },

  addImageBubble(type, src, caption) {
    const row = document.createElement('div');
    row.className = `nv-msg ${type}`;
    const bubble = document.createElement('div');
    bubble.className = `chat-bubble ${type}`;
    if (type === 'ai') {
      const avatar = document.createElement('span');
      avatar.className = 'nv-msg-avatar';
      avatar.textContent = 'N';
      row.appendChild(avatar);
    }
    const wrap = document.createElement('div');
    const img = document.createElement('img');
    if (src) img.src = src;
    img.alt = caption || 'image';
    img.style.cssText = 'max-width:280px;max-height:280px;border-radius:12px;display:block;box-shadow:0 6px 24px rgba(0,0,0,0.35)';
    wrap.appendChild(img);
    if (caption) {
      const cap = document.createElement('div');
      cap.className = 'chat-img-caption';
      cap.textContent = caption;
      wrap.appendChild(cap);
    }
    const meta = document.createElement('span');
    meta.className = 'chat-time';
    meta.textContent = this.formatTime();
    wrap.appendChild(meta);
    bubble.appendChild(wrap);
    row.appendChild(bubble);
    this.el.msgs.appendChild(row);
    this.el.msgs.scrollTop = this.el.msgs.scrollHeight;
    return { bubble, img, wrap };
  },

  renderSuggestions(items) {
    this.el.suggestions.innerHTML = '';
    (items || []).forEach(label => {
      const btn = document.createElement('button');
      btn.className = 'chat-quick-reply';
      btn.textContent = label;
      btn.addEventListener('click', () => { this.el.input.value = label; this.handleSend(); });
      this.el.suggestions.appendChild(btn);
    });
  },

  /* Related knowledge links — source cards under the last bot message */
  renderRelated(items) {
    if (!Array.isArray(items) || !items.length) return;
    const iconFor = (r) => {
      if (/^https?:/i.test(r.link || '')) return 'globe';
      return { faq: 'help-circle', service: 'layers', industry: 'building-2', project: 'folder', testimonial: 'quote', process: 'list-checks', tech: 'cpu' }[r.type] || 'link';
    };
    const wrap = document.createElement('div');
    wrap.className = 'nv-sources';
    items.slice(0, 3).forEach(r => {
      const external = /^https?:/i.test(r.link || '');
      const a = document.createElement('a');
      a.className = 'nv-source-card';
      a.href = r.link || '#/services';
      if (external) { a.target = '_blank'; a.rel = 'noopener'; }
      let host = '';
      if (external) { try { host = new URL(r.link).hostname.replace('www.', ''); } catch {} }
      a.innerHTML = `<i data-lucide="${iconFor(r)}"></i><span class="nv-source-title">${r.title}</span>${host ? `<span class="nv-source-host">${host}</span>` : ''}`;
      wrap.appendChild(a);
    });
    this.el.msgs.appendChild(wrap);
    this.el.msgs.scrollTop = this.el.msgs.scrollHeight;
    if (typeof lucide !== 'undefined') lucide.createIcons();
  },

  showTyping() {
    const typing = document.createElement('div');
    typing.className = 'typing-indicator';
    typing.id = 'typing-indicator';
    const isAr = document.documentElement.lang === 'ar';
    typing.innerHTML = `<span class="typing-dots"><span></span><span></span><span></span></span><span class="typing-text">${isAr ? 'يكتب الآن' : 'typing'}</span>`;
    this.el.msgs.appendChild(typing);
    this.el.msgs.scrollTop = this.el.msgs.scrollHeight;
  },

  hideTyping() {
    const typing = document.getElementById('typing-indicator');
    if (typing) typing.remove();
  },

  lock(statusText) {
    this.isLoading = true;
    this.el.send.disabled = true;
    this.el.input.disabled = true;
    this.el.status.textContent = statusText || t('Thinking...');
  },

  unlock() {
    this.isLoading = false;
    this.el.send.disabled = false;
    this.el.input.disabled = false;
    this.el.input.focus();
    this.el.status.textContent = '';
  },

  /* ---------------- send pipeline ---------------- */
  async handleSend() {
    const val = this.el.input.value.trim();
    if (!val || this.isLoading) return;
    const isAr = /[\u0600-\u06FF]/.test(val) || document.documentElement.lang === 'ar';

    this.addMessage('user', val);
    this.el.input.value = '';

    /* 1) Local multi-modal commands first */
    const imgPrompt = this.detectImageCommand(val);
    if (imgPrompt !== null) return this.handleImageGen(imgPrompt, isAr);

    const trans = this.detectTranslateCommand(val);
    if (trans) return this.handleTranslate(trans, isAr);

    const summary = this.detectSummarizeCommand(val);
    if (summary !== null) return this.handleSummarize(summary, isAr);

    /* 2) Server knowledge engine (with offline fallback) */
    this.lock();
    this.showTyping();
    try {
      const res = await fetch(NoviqAPI.url('/chatbot/message'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: val, sessionId: this.sessionId }),
      });
      const type = res.headers.get('content-type') || '';
      if (!res.ok || !type.includes('application/json')) throw new Error('bad response');
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      this.hideTyping();
      this.addMessage('ai', data.reply);
      this.renderRelated(data.related);
      this.renderSuggestions(data.suggestions);
      if (this.online === false) this.loadStats();
    } catch (e) {
      this.hideTyping();
      this.addMessage('ai', this.localReply(val));
      if (this.online !== false) { this.online = false; this.loadStats(); }
    } finally {
      this.unlock();
    }
  },

  /* ---------------- IMAGE GENERATION ---------------- */

  transformPrompt(raw, isAr) {
    const clean = String(raw || '').replace(/\s+/g, ' ').trim().slice(0, 300);
    if (!clean) return null;
    const normalized = clean.toLowerCase();
    const has = (ar, en) => ar.test(normalized) || en.test(normalized);
    const isMobile = has(/تطبيق|جوال|موبايل|ايفون|اندرويد/, /mobile|app|iphone|android/);
    const isDashboard = has(/لوحه تحكم|لوحة تحكم|داشبورد|تحليلات|erp|crm/, /dashboard|analytics|erp|crm/);
    const isWebsite = !isMobile && !isDashboard && has(/موقع|ويب|صفحه هبوط|صفحة هبوط|واجهه|واجهة/, /website|web interface|landing page|homepage|ui\/ux/);
    const isLogo = has(/شعار|لوجو|هويه بصريه|هوية بصرية/, /logo|brand identity/);

    const semanticHints = [];
    const hint = (pattern, value) => { if (pattern.test(normalized)) semanticHints.push(value); };
    hint(/عياد|طبيب|طبي|صحه|صحة|مستشفى|clinic|medical|health|hospital/, 'medical clinic');
    hint(/مطعم|طعام|اكل|أكل|وجبات|restaurant|food|dining/, 'restaurant');
    hint(/تعليم|مدرس|جامع|طلاب|education|school|university|student/, 'education');
    hint(/عقار|عقارات|real estate|property/, 'real estate');
    hint(/متجر|تجاره|تجارة|تسوق|ecommerce|e-commerce|store|shop/, 'e-commerce');
    hint(/لوجست|شحن|اسطول|أسطول|logistic|shipping|fleet/, 'logistics');
    hint(/بنك|مالي|تمويل|fintech|bank|finance/, 'fintech');
    hint(/مصنع|تصنيع|manufactur|factory/, 'factory');
    hint(/تنين|dragon/, 'dragon');
    hint(/كريستال|بلور|crystal/, 'crystal');
    hint(/واقعي|واقعيه|واقعية|realistic|photoreal/, 'photorealistic');
    hint(/ثلاثي الابعاد|ثلاثي الأبعاد|3d/, '3d');

    const interpretation = semanticHints.length
      ? `Topic: ${[...new Set(semanticHints)].join(', ')}.`
      : '';
    const request = `User request: "${clean}". ${interpretation}`.trim();

    let result = '';
    if (isWebsite) {
      result = `${request} Create a high-fidelity desktop website UI mockup straight-on inside a clean browser frame. Complete homepage layout, hero, content cards. Production-ready interface. No watermarks.`;
    } else if (isMobile) {
      result = `${request} Create a high-fidelity mobile app UI mockup across three smartphone screens. Key workflows, clean spacing, modern design system. No watermarks.`;
    } else if (isDashboard) {
      result = `${request} Create a high-fidelity business dashboard UI mockup. Sidebar navigation, KPIs, charts, data tables. Enterprise SaaS layout. No watermarks.`;
    } else if (isLogo) {
      result = `${request} Create one clean vector logo concept on plain neutral background. Strong silhouette, professional branding. No extra text, no watermarks.`;
    } else {
      result = `${request} Create one coherent high-quality image of the requested subject. Detailed rendering, balanced composition. No watermarks.`;
    }
    return result.replace(/\s+/g, ' ').trim().slice(0, 480);
  },

  getImageProfile(raw) {
    const prompt = String(raw || '').toLowerCase();
    if (/تطبيق|جوال|موبايل|mobile|app|iphone|android/.test(prompt)) return { width: 768, height: 1024 };
    if (/موقع|ويب|صفحه|صفحة|واجهه|واجهة|لوحه تحكم|لوحة تحكم|داشبورد|website|web|landing|dashboard|erp|crm/.test(prompt)) {
      return { width: 1280, height: 768 };
    }
    return { width: 1024, height: 1024 };
  },

  buildPollinationsUrl(finalPrompt, profile, seed) {
    let safePrompt = String(finalPrompt || '').trim();
    while (encodeURIComponent(safePrompt).length > 450 && safePrompt.length > 0) {
      safePrompt = safePrompt.slice(0, -5).trim();
    }
    const referrer = (window.location && (window.location.hostname || window.location.host)) || 'localhost';
    const params = new URLSearchParams({
      width: String(profile.width),
      height: String(profile.height),
      seed: String(seed),
      enhance: 'true',
      safe: 'true',
      private: 'true',
      referrer,
    });
    return `https://image.pollinations.ai/prompt/${encodeURIComponent(safePrompt)}?${params.toString()}`;
  },

  imageSuggestionsFor(prompt, isAr) {
    const p = String(prompt || '').toLowerCase();
    if (/عياد|طبيب|طبي|clinic|medical/.test(p)) return isAr
      ? ['أنشئ صورة تطبيق حجز مواعيد لعيادة', 'أنشئ صورة لوحة تحكم لإدارة عيادة', 'أنشئ صورة واجهة موقع لمستشفى حديث']
      : ['Create an image of a clinic appointment app', 'Create an image of a clinic management dashboard', 'Create an image of a modern hospital website'];
    if (/مطعم|طعام|اكل|أكل|restaurant|food/.test(p)) return isAr
      ? ['أنشئ صورة واجهة موقع لمطعم فاخر', 'أنشئ صورة تطبيق طلب طعام', 'أنشئ صورة لوحة تحكم لإدارة مطعم']
      : ['Create an image of a fine-dining restaurant website', 'Create an image of a food ordering mobile app', 'Create an image of a restaurant management dashboard'];
    if (/لوجست|شحن|اسطول|أسطول|logistic|shipping|fleet/.test(p)) return isAr
      ? ['أنشئ صورة لوحة تحكم لتتبع أسطول', 'أنشئ صورة تطبيق توصيل وشحن', 'أنشئ صورة واجهة موقع لشركة لوجستية']
      : ['Create an image of a fleet tracking dashboard', 'Create an image of a delivery mobile app', 'Create an image of a logistics company website'];
    if (/تنين|dragon/.test(p)) return isAr
      ? ['ارسم تنيناً من الكريستال داخل كهف جليدي', 'ارسم تنيناً كريستالياً بأسلوب واقعي', 'ارسم لقطة مقربة لرأس تنين من الكريستال']
      : ['Draw a crystal dragon inside an ice cave', 'Draw a photorealistic crystal dragon', 'Draw a close-up crystal dragon portrait'];
    return isAr
      ? ['أنشئ صورة واجهة موقع إلكتروني لعيادة', 'أنشئ صورة تطبيق جوال لمطعم', 'أنشئ صورة لوحة تحكم ERP لشركة لوجستية']
      : ['Create an image of a clinic website interface', 'Create an image of a restaurant mobile app', 'Create an image of an ERP dashboard for a logistics company'];
  },
  
  handleImageGenDirect(prompt, finalPrompt, isAr, profile) {
    this.lock(t('Generating your image...'));
    const seed = Math.floor(Math.random() * 99999);
    const imageProfile = profile || this.getImageProfile(prompt);
    const displayPrompt = prompt.length > 60 ? prompt.slice(0, 57) + '...' : prompt;
    this.addMessage('ai', isAr
      ? `جارٍ إنشاء "${displayPrompt}" عبر Pollinations.ai (قد يستغرق حتى دقيقة).`
      : `Creating "${displayPrompt}" with Pollinations.ai (this can take up to a minute).`);

    const caption = isAr
      ? 'تم الإنشاء بواسطة Pollinations.ai - اضغط لفتح الصورة بالحجم الكامل'
      : 'Generated by Pollinations.ai - click to open the full-size image';
    const { bubble, img, wrap } = this.addImageBubble('ai', '', caption);
    img.alt = displayPrompt;
    img.style.display = 'none';
    const spinner = document.createElement('div');
    spinner.className = 'typing-indicator';
    spinner.style.cssText = 'position:static;margin:30px auto;justify-content:center';
    spinner.innerHTML = '<span></span><span></span><span></span>';
    wrap.insertBefore(spinner, img);

    let settled = false;
    const overallTimeout = setTimeout(() => finishFail(), 150000);

    const finishOk = (url) => {
      if (settled) return;
      settled = true;
      clearTimeout(overallTimeout);
      spinner.remove();
      img.style.display = 'block';
      img.style.cursor = 'pointer';
      img.addEventListener('click', () => window.open(url, '_blank', 'noopener'));
      this.el.msgs.scrollTop = this.el.msgs.scrollHeight;
      
      this.renderSuggestions(this.imageSuggestionsFor(prompt, isAr));
      this.unlock();
    };

    const finishFail = () => {
      if (settled) return;
      settled = true;
      clearTimeout(overallTimeout);
      bubble.remove();
      this.addMessage('ai', t('Image generation failed. Try a different description.'));
      this.unlock();
    };

    // The browser loads Pollinations directly, so the visitor IP and page referrer
    // identify the request instead of concentrating all traffic on the backend.
    const pollinationsUrl = typeof NoviqImageGeneration !== 'undefined'
      ? NoviqImageGeneration.buildUrl(finalPrompt, imageProfile, seed)
      : this.buildPollinationsUrl(finalPrompt, imageProfile, seed);
    img.referrerPolicy = 'origin';
    img.onload = () => finishOk(img.src);
    img.onerror = () => {
      const fallbackUrl = typeof NoviqImageGeneration !== 'undefined'
        ? NoviqImageGeneration.buildUrl(finalPrompt, imageProfile, seed + 1)
        : this.buildPollinationsUrl(finalPrompt, imageProfile, seed + 1);
      img.onerror = () => finishFail();
      img.src = fallbackUrl;
    };
    img.src = pollinationsUrl;
  },

  verifyPrompt(raw) {
    const blocked = /sex|nude|naked|porn|explicit|xxx|graphic|violence|gore|weapon|kill|\b(?:woman|women|female|girl|girls|lady|ladies|actress|bride)\b|امرأة|امراه|نساء|أنثى|انثى|فتاة|فتاه|بنت|بنات|سيدة|سيده|سيدات|عروس/i;
    return !blocked.test(raw || '');
  },

  detectImageCommand(msg) {
    const triggers = [
      /^(?:ارسم|أرسم|ارسمي|رسم|صمم|صممي|انشئ صوره|أنشئ صوره|انشئ صورة|أنشئ صورة|اعمل صوره|اعمل صورة|ولد صوره|ولد صورة|توليد صوره|توليد صورة|صوره عن|صورة عن)\s+(.+)/i,
      /^(?:draw|paint|sketch|imagine)\s+(.+)/i,
      /^(?:generate|create|make)\s+(?:an?\s+)?(?:image|picture|photo|art)\s+(?:of\s+)?(.+)/i,
      /^(?:generate|create|design|make)\s+(.+\b(?:website|web interface|landing page|homepage|mobile app|app interface|dashboard|logo|illustration|visual|mockup)\b.*)$/i,
      /^(?:image|picture)\s+of\s+(.+)/i,
    ];
    for (const re of triggers) {
      const m = msg.match(re);
      if (m) return m[1].trim();
    }
    return null;
  },

  handleImageGen(prompt, isAr) {
    const safe = this.verifyPrompt(prompt);
    if (!safe) {
      this.addMessage('ai', isAr
        ? 'عذراً، هذا النوع من طلبات الصور غير مدعوم. جرّب وصفاً تقنياً مثل "تطبيق جوال" أو "لوحة تحكم" أو وصفاً لا يتضمن فتيات أو نساء.'
        : 'Sorry, this image request is not supported. Try a technical description such as "mobile app dashboard" or a subject without women or girls.');
      return;
    }
    this.openImageBuilder(prompt, isAr);
  },

  openImageBuilder(subject, isAr) {
    if (typeof NoviqImagePromptBuilder === 'undefined' || typeof NoviqImageGeneration === 'undefined') {
      this.addMessage('ai', isAr ? 'تعذر تحميل مصمم الصور. حدّث الصفحة وحاول مرة أخرى.' : 'The image designer failed to load. Refresh the page and try again.');
      return;
    }
    const config = window.NOVIQ_CONTENT && window.NOVIQ_CONTENT.promptBuilder;
    if (!config || config.active === false || !Array.isArray(config.groups)) {
      this.addMessage('ai', isAr ? 'مصمم الصور غير متاح حالياً.' : 'The image designer is currently unavailable.');
      return;
    }
    document.querySelector('.nv-img-builder-row')?.remove();
    const row = document.createElement('div');
    row.className = 'nv-img-builder-row';
    this.el.msgs.appendChild(row);
    this.el.msgs.scrollTop = this.el.msgs.scrollHeight;
    NoviqImagePromptBuilder.mount(row, {
      config,
      subject,
      locale: isAr ? 'ar' : 'en',
      onCancel: () => {
        row.remove();
        NoviqImagePromptBuilder.destroy();
        this.el.input.focus();
      },
      onComplete: result => {
        row.remove();
        NoviqImagePromptBuilder.destroy();
        this.handleImageGenDirect(result.subject, result.prompt, isAr, result.profile);
      },
    });
  },

  /* ---------------- File attachments and OCR ---------------- */
  addFileBubble(file) {
    const row = document.createElement('div');
    row.className = 'nv-msg user';
    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble user nv-file-bubble';
    const icon = document.createElement('i');
    icon.setAttribute('data-lucide', 'file-text');
    const copy = document.createElement('span');
    const name = document.createElement('strong');
    const size = document.createElement('small');
    name.textContent = file.name;
    size.textContent = `${Math.max(1, Math.round(file.size / 1024))} KB`;
    copy.append(name, size);
    bubble.append(icon, copy);
    row.appendChild(bubble);
    this.el.msgs.appendChild(row);
    this.el.msgs.scrollTop = this.el.msgs.scrollHeight;
    if (typeof lucide !== 'undefined') lucide.createIcons();
  },

  readFileAsText(file) {
    if (typeof file.text === 'function') return file.text();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(reader.error || new Error('read failed'));
      reader.readAsText(file);
    });
  },

  loadPdfJs() {
    if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
    if (this._pdfPromise) return this._pdfPromise;
    this._pdfPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
      script.onload = () => {
        if (!window.pdfjsLib) { reject(new Error('PDF library unavailable')); return; }
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        resolve(window.pdfjsLib);
      };
      script.onerror = reject;
      document.head.appendChild(script);
    });
    return this._pdfPromise;
  },

  loadMammoth() {
    if (window.mammoth) return Promise.resolve(window.mammoth);
    if (this._mammothPromise) return this._mammothPromise;
    this._mammothPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/mammoth@1.8.0/mammoth.browser.min.js';
      script.onload = () => resolve(window.mammoth);
      script.onerror = reject;
      document.head.appendChild(script);
    });
    return this._mammothPromise;
  },

  async extractPdf(file) {
    const pdfjs = await this.loadPdfJs();
    const documentTask = pdfjs.getDocument({ data: await file.arrayBuffer() });
    const pdf = await documentTask.promise;
    const pages = [];
    for (let pageNumber = 1; pageNumber <= Math.min(pdf.numPages, 50); pageNumber++) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      pages.push(content.items.map(item => item.str).join(' '));
    }
    return pages.join('\n\n');
  },

  async handleAttachment(file, isAr) {
    if (this.isLoading) return;
    if (!file || file.size > 10 * 1024 * 1024) {
      this.addMessage('ai', isAr ? 'الحد الأقصى للملف 10 ميجابايت.' : 'The maximum file size is 10MB.');
      return;
    }
    if (file.type.startsWith('image/')) return this.handleImageOCR(file, isAr);
    const name = String(file.name || '').toLowerCase();
    const textFile = /(?:text\/|application\/json)/.test(file.type) || /\.(?:txt|csv|md|json)$/i.test(name);
    const pdfFile = file.type === 'application/pdf' || name.endsWith('.pdf');
    const docxFile = /wordprocessingml\.document/.test(file.type) || name.endsWith('.docx');
    if (!textFile && !pdfFile && !docxFile) {
      this.addMessage('ai', isAr ? 'نوع الملف غير مدعوم. استخدم صورة أو PDF أو DOCX أو TXT أو CSV أو JSON.' : 'Unsupported file type. Use an image, PDF, DOCX, TXT, CSV, or JSON file.');
      return;
    }
    this.addFileBubble(file);
    this.lock(isAr ? 'جارٍ قراءة الملف...' : 'Reading file...');
    this.showTyping();
    try {
      let extracted = '';
      if (pdfFile) extracted = await this.extractPdf(file);
      else if (docxFile) {
        const mammoth = await this.loadMammoth();
        extracted = (await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() })).value;
      } else extracted = await this.readFileAsText(file);
      this.hideTyping();
      const clean = String(extracted || '').replace(/\u0000/g, '').trim();
      if (!clean) this.addMessage('ai', isAr ? 'لم أجد نصاً قابلاً للقراءة في الملف.' : 'No readable text was found in this file.');
      else this.addMessage('ai', (isAr ? 'محتوى الملف المستخرج:\n\n' : 'Extracted file content:\n\n') + clean.slice(0, 12000));
    } catch {
      this.hideTyping();
      this.addMessage('ai', isAr ? 'تعذرت قراءة الملف. جرّب ملفاً آخر أو متصفحاً محدثاً.' : 'The file could not be read. Try another file or an updated browser.');
    } finally { this.unlock(); }
  },

  loadTesseract() {
    if (window.Tesseract) return Promise.resolve();
    if (this._tessPromise) return this._tessPromise;
    this._tessPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
      s.onload = resolve;
      s.onerror = () => { this._tessPromise = null; reject(new Error('tesseract load failed')); };
      document.head.appendChild(s);
    });
    return this._tessPromise;
  },

  async handleImageOCR(file, isAr) {
    if (!file.type.startsWith('image/')) {
      this.addMessage('ai', t('Please upload an image file'));
      return;
    }
    const objUrl = URL.createObjectURL(file);
    this.addImageBubble('user', objUrl, file.name);
    this.lock(t('Extracting text from image...'));
    this.showTyping();
    try {
      await this.loadTesseract();
      const { data: { text } } = await window.Tesseract.recognize(objUrl, 'ara+eng');
      this.hideTyping();
      const clean = (text || '').trim();
      if (clean) {
        this.addMessage('ai', (isAr ? 'النص المستخرج من الصورة: 📄\n\n' : 'Text extracted from the image: 📄\n\n') + clean);
      } else {
        this.addMessage('ai', t('No text detected in image.'));
      }
    } catch (e) {
      this.hideTyping();
      this.addMessage('ai', t('Failed to process image. Please try again.'));
    } finally {
      URL.revokeObjectURL(objUrl);
      this.unlock();
    }
  },

  /* ---------------- VOICE INPUT ---------------- */
  toggleVoice(isAr) {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      this.addMessage('ai', t('Web Speech API not supported in this browser. Try Chrome or Edge.'));
      return;
    }
    if (this.recording) {
      try { this.recognition.stop(); } catch {}
      return;
    }
    this.recognition = new SR();
    this.recognition.lang = (document.documentElement.lang === 'ar') ? 'ar-SA' : 'en-US';
    this.recognition.interimResults = true;
    this.recognition.continuous = false;

    this.recognition.onstart = () => {
      this.recording = true;
      this.el.micBtn.classList.add('recording');
      this.el.status.textContent = t('Listening... Speak now');
    };
    this.recognition.onresult = (event) => {
      let txt = '';
      for (let i = event.resultIndex; i < event.results.length; i++) txt += event.results[i][0].transcript;
      this.el.input.value = txt;
    };
    this.recognition.onerror = () => this.stopVoiceUI();
    this.recognition.onend = () => {
      this.stopVoiceUI();
      if (this.el.input.value.trim()) this.handleSend();
    };
    try { this.recognition.start(); } catch { this.stopVoiceUI(); }
  },

  stopVoiceUI() {
    this.recording = false;
    this.el.micBtn.classList.remove('recording');
    this.el.status.textContent = '';
  },

  /* ---------------- SPOKEN REPLIES (TTS) ---------------- */
  toggleTts() {
    this.tts = !this.tts;
    this.el.ttsBtn.innerHTML = `<i data-lucide="${this.tts ? 'volume-2' : 'volume-x'}"></i>`;
    this.el.ttsBtn.classList.toggle('active', this.tts);
    if (typeof lucide !== 'undefined') lucide.createIcons();
    if (!this.tts && window.speechSynthesis) { window.speechSynthesis.cancel(); clearInterval(this._speakTimer); }
  },

  _voiceCache: { ar: null, en: null, loaded: false },

  _loadVoices() {
    if (this._voiceCache.loaded) return;
    const voices = window.speechSynthesis.getVoices();
    if (!voices.length) return;
    this._voiceCache.loaded = true;

    /* Arabic — prefer high-quality voices */
    const arPriority = [
      /google.*arab/i, /microsoft.*hoda/i, /microsoft.*arab/i,
      /laila/i, /maged/i, /majed/i, /tarik/i,
    ];
    const arVoices = voices.filter(v => /^ar/i.test(v.lang));
    for (const pat of arPriority) {
      const match = arVoices.find(v => pat.test(v.name));
      if (match) { this._voiceCache.ar = match; break; }
    }
    if (!this._voiceCache.ar && arVoices.length) this._voiceCache.ar = arVoices[0];

    /* English — prefer natural-sounding voices */
    const enPriority = [
      /google.*us.*english/i, /google.*english/i,
      /microsoft.*jenny/i, /microsoft.*aria/i, /microsoft.*guy/i,
      /samantha/i, /alex/i, /daniel/i, /karen/i,
    ];
    const enVoices = voices.filter(v => /^en/i.test(v.lang));
    for (const pat of enPriority) {
      const match = enVoices.find(v => pat.test(v.name));
      if (match) { this._voiceCache.en = match; break; }
    }
    if (!this._voiceCache.en && enVoices.length) this._voiceCache.en = enVoices[0];
  },

  _splitIntoChunks(text, maxLen = 180) {
    /* Split by sentence boundaries to avoid mid-word cutoff */
    const sentences = text.match(/[^.!?،؟\n]+[.!?،؟\n]?\s*/g) || [text];
    const chunks = [];
    let current = '';
    for (const s of sentences) {
      if ((current + s).length > maxLen && current) {
        chunks.push(current.trim());
        current = s;
      } else {
        current += s;
      }
    }
    if (current.trim()) chunks.push(current.trim());
    return chunks;
  },

  speak(text) {
    if (!this.tts || !window.speechSynthesis) return;
    try {
      window.speechSynthesis.cancel();
      this._loadVoices();

      const clean = String(text).replace(/[•\u{1F300}-\u{1FAFF}]/gu, '').trim();
      if (!clean) return;
      const isArabic = /[\u0600-\u06FF]/.test(clean);
      const lang = isArabic ? 'ar-SA' : 'en-US';
      const voice = isArabic ? this._voiceCache.ar : this._voiceCache.en;
      const chunks = this._splitIntoChunks(clean);

      chunks.forEach((chunk, i) => {
        const u = new SpeechSynthesisUtterance(chunk);
        u.lang = lang;
        if (voice) u.voice = voice;
        u.rate = isArabic ? 0.95 : 1.0;
        u.pitch = 1.0;
        /* Chrome pauses synthesis after ~15s; keep-alive workaround */
        if (i === 0) {
          u.onstart = () => {
            this._speakTimer = setInterval(() => {
              if (window.speechSynthesis.speaking) { window.speechSynthesis.pause(); window.speechSynthesis.resume(); }
              else clearInterval(this._speakTimer);
            }, 10000);
          };
        }
        if (i === chunks.length - 1) {
          u.onend = () => clearInterval(this._speakTimer);
          u.onerror = () => clearInterval(this._speakTimer);
        }
        window.speechSynthesis.speak(u);
      });
    } catch {}
  },

  /* ---------------- TRANSLATION ---------------- */
  detectTranslateCommand(msg) {
    const m = msg.match(/^(?:ترجم|ترجمي|ترجمة|translate)\s+(.+)/i);
    if (!m) return null;
    let payload = m[1].trim();
    let target = null;
    const arTarget = /(?:\s|^)(?:الى|إلى|لل|ل)\s*(?:العربيه|العربية|عربي)\s*$/i;
    const enTarget = /(?:\s|^)(?:الى|إلى|لل|ل)\s*(?:الانجليزيه|الإنجليزية|الانجليزية|انجليزي|إنجليزي)\s*$|(?:\s|^)to\s+english\s*$/i;
    const arTargetEn = /(?:\s|^)to\s+arabic\s*$/i;
    if (enTarget.test(payload)) { target = 'en'; payload = payload.replace(enTarget, '').trim(); }
    else if (arTarget.test(payload) || arTargetEn.test(payload)) { target = 'ar'; payload = payload.replace(arTarget, '').replace(arTargetEn, '').trim(); }
    payload = payload.replace(/^["'«]|["'»]$/g, '').trim();
    if (!payload) return null;
    const source = /[\u0600-\u06FF]/.test(payload) ? 'ar' : 'en';
    if (!target) target = source === 'ar' ? 'en' : 'ar';
    if (target === source) target = source === 'ar' ? 'en' : 'ar';
    return { text: payload, source, target };
  },

  async handleTranslate({ text, source, target }, isAr) {
    this.lock(t('Translating...'));
    this.showTyping();
    try {
      const res = await fetch('https://api.mymemory.translated.net/get?q=' + encodeURIComponent(text) + '&langpair=' + source + '|' + target);
      const data = await res.json();
      const out = data && data.responseData && data.responseData.translatedText;
      this.hideTyping();
      if (out) {
        this.addMessage('ai', (isAr ? 'الترجمة: 🌐\n' : 'Translation: 🌐\n') + out);
      } else {
        throw new Error('no translation');
      }
    } catch {
      this.hideTyping();
      this.addMessage('ai', isAr ? 'تعذرت الترجمة حالياً. حاول مرة أخرى.' : 'Translation is unavailable right now. Please try again.');
    } finally {
      this.unlock();
    }
  },

  /* ---------------- SUMMARIZATION ---------------- */
  detectSummarizeCommand(msg) {
    const m = msg.match(/^(?:لخص|لخصي|تلخيص|summarize|summarise)\s+([\s\S]+)/i);
    return m ? m[1].trim() : null;
  },

  handleSummarize(text, isAr) {
    if (text.length < 120) {
      this.addMessage('ai', t('Please provide longer text to summarize.'));
      return;
    }
    this.lock(t('Summarizing...'));
    this.showTyping();
    setTimeout(() => {
      const summary = this.extractiveSummary(text, 3);
      this.hideTyping();
      this.addMessage('ai', (isAr ? 'الملخص: 📝\n' : 'Summary: 📝\n') + summary);
      this.unlock();
    }, 350);
  },

  extractiveSummary(text, maxSentences) {
    const sentences = text.match(/[^.!؟?\n]+[.!؟?\n]+/g) || [text];
    if (sentences.length <= maxSentences) return text.trim();
    const freq = {};
    (text.toLowerCase().match(/[\w\u0600-\u06FF]{3,}/g) || []).forEach(w => { freq[w] = (freq[w] || 0) + 1; });
    const scored = sentences.map(s => {
      const words = s.toLowerCase().match(/[\w\u0600-\u06FF]{3,}/g) || [];
      const score = words.reduce((sum, w) => sum + (freq[w] || 0), 0) / (words.length || 1);
      return { sentence: s.trim(), score };
    });
    scored.sort((a, b) => b.score - a.score);
    const top = scored.slice(0, maxSentences);
    top.sort((a, b) => text.indexOf(a.sentence) - text.indexOf(b.sentence));
    return top.map(s => s.sentence).join(' ');
  },

  /* ---------------- offline fallback ---------------- */
  localReply(message) {
    const ar = /[\u0600-\u06FF]/.test(message);
    const m = message.toLowerCase();
    const has = (...words) => words.some(w => m.includes(w));
    const C = (typeof NOVIQ_CONTENT !== 'undefined' && NOVIQ_CONTENT) || {};

    if (has('service', 'offer', 'خدم', 'تقدمون', 'حلول')) {
      const list = (C.services || []).slice(0, 8).map(s => `• ${s.title}`).join('\n');
      return ar
        ? `نقدم مجموعة متكاملة من الخدمات:\n${list}\n\nتصفح صفحة الخدمات للتفاصيل الكاملة.`
        : `We offer a full range of services:\n${list}\n\nBrowse the Services page for full details.`;
    }
    if (has('price', 'cost', 'سعر', 'اسعار', 'أسعار', 'تكلف', 'بكم', 'باقات')) {
      return ar
        ? 'أسعارنا تعتمد على نطاق المشروع — لدينا باقات تبدأ من الأساسية حتى المؤسسية. جرب "مقدر التكلفة" في الموقع لتقدير فوري، أو تواصل معنا لعرض سعر مفصل.'
        : 'Our pricing depends on project scope — plans range from Starter to Enterprise. Try the Cost Estimator for an instant estimate, or contact us for a detailed quote.';
    }
    if (has('project', 'work', 'portfolio', 'مشاريع', 'اعمال', 'أعمال')) {
      const list = (C.projects || []).slice(0, 4).map(p => `• [${p.tag}] ${p.title}`).join('\n');
      return ar
        ? `من مشاريعنا المميزة:\n${list}\n\nشاهد دراسات الحالة كاملة في صفحة أعمالنا.`
        : `Some of our featured projects:\n${list}\n\nSee full case studies on the Portfolio page.`;
    }
    if (has('contact', 'email', 'phone', 'تواصل', 'ايميل', 'إيميل', 'بريد', 'هاتف', 'رقم', 'استشار', 'اجتماع', 'consult', 'meeting', 'book')) {
      const b = C.brand || {};
      return ar
        ? `يسعدنا تواصلك!\nالبريد: ${b.email || 'hello@noviqsolutions.com'}\nالهاتف: ${b.phone || '+1 (415) 555-0182'}\n\nأو استخدم نموذج التواصل في الموقع وسنرد خلال يوم عمل.`
        : `We'd love to hear from you!\nEmail: ${b.email || 'hello@noviqsolutions.com'}\nPhone: ${b.phone || '+1 (415) 555-0182'}\n\nOr use the contact form and we'll reply within one business day.`;
    }
    return ar
      ? 'يمكنك السؤال عن: خدماتنا، الأسعار، مشاريعنا، معلومات التواصل — أو جرب "ارسم قطة" أو أرفق صورة لاستخراج نصها! (الخادم غير متاح حالياً)'
      : 'You can ask about: services, pricing, projects, contact info — or try "draw a cat" or attach an image for OCR! (Server currently unavailable)';
  },

  /* ---------------- utilities ---------------- */
  resetChat(isAr) {
    try {
      this.sessionId = 'chat-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
      localStorage.setItem('noviq_chat_session', this.sessionId);
    } catch {}
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    this.el.msgs.innerHTML = '';
    this.welcome(isAr);
  },

  copyChat() {
    const lines = [];
    this.el.msgs.querySelectorAll('.chat-bubble').forEach(b => {
      const who = b.classList.contains('user') ? 'You' : 'Noviq';
      lines.push(`${who}: ${b.textContent.trim()}`);
    });
    navigator.clipboard.writeText(lines.join('\n')).then(() => {
      this.el.copyBtn.innerHTML = '<i data-lucide="check"></i>';
      this.el.copyBtn.classList.add('active');
      if (typeof lucide !== 'undefined') lucide.createIcons();
      setTimeout(() => {
        this.el.copyBtn.innerHTML = '<i data-lucide="copy"></i>';
        this.el.copyBtn.classList.remove('active');
        if (typeof lucide !== 'undefined') lucide.createIcons();
      }, 2000);
    });
  },
};

if (typeof window !== 'undefined') {
  window.renderAILabPage = renderAILabPage;
  window.renderAIDemoPage = renderAIDemoPage;
}
