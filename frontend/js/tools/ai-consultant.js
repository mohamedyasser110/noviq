/* ============================================================
   AI CONSULTANT — Interactive chat-based consultation with AI API
   ============================================================ */

const AIConsultant = {
  currentStep: 0,
  responses: {},
  flow: [],

  init(container) {
    this.flow = this.getDefaultFlow();
    this.currentStep = 0;
    this.responses = {};
    container.innerHTML = `
      <div class="noviq-chat-container">
        <div class="noviq-chat-messages" id="chat-messages"></div>
        <div class="chat-quick-replies" id="chat-replies"></div>
        <div class="chat-input-bar" id="chat-input-bar" style="display:none">
          <input type="text" id="chat-input" placeholder="${t('Type your answer...')}" />
          <button id="chat-send"><i data-lucide="send" style="width:16px;height:16px"></i></button>
        </div>
      </div>`;
    if (typeof lucide !== 'undefined') lucide.createIcons();

    this.showMessage('ai', t("Welcome! I'm your Noviq AI Consultant. Let me help find the perfect solution for your business."));
    setTimeout(() => this.askQuestion(), 600);
  },

  getDefaultFlow() {
    return [
      { key: 'business', question: t('What type of business are you in?'), options: [t('SaaS/Tech'), t('E-commerce'), t('Healthcare'), t('Finance'), t('Manufacturing'), t('Education'), t('Other')] },
      { key: 'employees', question: t('How many employees does your company have?'), options: ['1-10', '11-50', '51-200', '201-500', '500+'] },
      { key: 'challenge', question: t("What's your biggest operational challenge?"), options: [t('Manual processes'), t('Data silos'), t('Scaling issues'), t('Customer experience'), t('Cost optimization'), t('Not sure')] },
      { key: 'goals', question: t('What are your primary goals? (Select all that apply)'), options: [t('Automate workflows'), t('Improve analytics'), t('Build custom software'), t('Modernize legacy systems'), t('AI integration'), t('Cloud migration')], multi: true },
      { key: 'timeline', question: t("What's your ideal timeline?"), options: [t('ASAP'), t('1-3 months'), t('3-6 months'), t('6-12 months'), t('Exploring only')] },
      { key: 'budget', question: t("What's your budget range?"), options: ['<$50K', '$50K-$150K', '$150K-$500K', '$500K+', t('Not defined')] },
    ];
  },

  askQuestion() {
    if (this.currentStep >= this.flow.length) {
      this.showResult();
      return;
    }
    const q = this.flow[this.currentStep];
    this.showMessage('ai', q.question);

    const replies = document.getElementById('chat-replies');
    const inputBar = document.getElementById('chat-input-bar');
    if (!replies) return;

    replies.innerHTML = '';
    inputBar.style.display = 'none';

    if (q.options && q.options.length > 0) {
      if (q.multi) {
        this.showMultiSelect(q);
      } else {
        q.options.forEach(opt => {
          const btn = document.createElement('button');
          btn.className = 'chat-quick-reply';
          btn.textContent = opt;
          btn.addEventListener('click', () => this.handleResponse(opt));
          replies.appendChild(btn);
        });
      }
    } else {
      inputBar.style.display = 'flex';
      const input = document.getElementById('chat-input');
      const send = document.getElementById('chat-send');
      if (input) input.value = '';
      const handler = () => {
        const val = input?.value.trim();
        if (val) this.handleResponse(val);
      };
      send?.addEventListener('click', handler);
      input?.addEventListener('keydown', e => { if (e.key === 'Enter') handler(); });
    }
  },

  showMultiSelect(q) {
    const replies = document.getElementById('chat-replies');
    const selected = [];

    q.options.forEach(opt => {
      const btn = document.createElement('button');
      btn.className = 'chat-quick-reply';
      btn.textContent = opt;
      btn.style.flex = '1';
      btn.style.minWidth = '120px';
      btn.addEventListener('click', () => {
        btn.classList.toggle('selected');
        const idx = selected.indexOf(opt);
        if (idx > -1) selected.splice(idx, 1);
        else selected.push(opt);
      });
      replies.appendChild(btn);
    });

    const doneBtn = document.createElement('button');
    doneBtn.className = 'noviq-btn-primary';
    doneBtn.style.marginTop = '12px';
    doneBtn.style.width = '100%';
    doneBtn.textContent = t('Continue');
    doneBtn.addEventListener('click', () => {
      if (selected.length === 0) return;
      this.handleResponse(selected.join(', '));
    });
    replies.appendChild(doneBtn);
  },

  handleResponse(val) {
    const q = this.flow[this.currentStep];
    if (q?.key) this.responses[q.key] = val;
    this.showMessage('user', val);
    this.currentStep++;
    document.getElementById('chat-replies').innerHTML = '';
    document.getElementById('chat-input-bar').style.display = 'none';
    this.showTyping();
    setTimeout(() => this.askQuestion(), 800);
  },

  showMessage(type, text) {
    const msgs = document.getElementById('chat-messages');
    if (!msgs) return;
    const bubble = document.createElement('div');
    bubble.className = `chat-bubble ${type}`;
    if (type === 'ai') {
      bubble.innerHTML = `<span class="chat-avatar">N</span> ${text}`;
    } else {
      bubble.textContent = text;
    }
    msgs.appendChild(bubble);
    msgs.scrollTop = msgs.scrollHeight;
  },

  showTyping() {
    const msgs = document.getElementById('chat-messages');
    if (!msgs) return;
    const typing = document.createElement('div');
    typing.className = 'typing-indicator';
    typing.id = 'typing-indicator';
    typing.innerHTML = '<span></span><span></span><span></span>';
    msgs.appendChild(typing);
    msgs.scrollTop = msgs.scrollHeight;
  },

  async showResult() {
    const typing = document.getElementById('typing-indicator');
    if (typing) typing.remove();

    this.showMessage('ai', t("Based on your answers, here's my recommendation:"));

    let recommendation;
    try {
      recommendation = await this.generateRecommendationAI();
    } catch (e) {
      console.warn('[AI Consultant] AI generation failed, using fallback:', e);
      recommendation = this.generateRecommendation();
    }

    const msgs = document.getElementById('chat-messages');
    if (!msgs) return;

    const card = document.createElement('div');
    card.className = 'noviq-result-card';
    card.style.margin = '12px 0';
    card.innerHTML = `
      <h3>${recommendation.title}</h3>
      <p>${recommendation.desc}</p>
      <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-top:10px">
        ${recommendation.features.map(f => `<span class="noviq-badge" style="background:rgba(109,40,255,0.12);color:var(--secondary);padding:4px 12px;border-radius:6px;font-size:12px">${f}</span>`).join('')}
      </div>
      <div style="margin-top:20px">
        <button class="noviq-btn-primary" onclick="navigateTo('contact')">${t('Get Full Analysis')} <i data-lucide="arrow-right" style="width:16px;height:16px"></i></button>
      </div>`;
    msgs.appendChild(card);
    msgs.scrollTop = msgs.scrollHeight;

    if (typeof lucide !== 'undefined') lucide.createIcons();
  },

  async generateRecommendationAI() {
    if (typeof NOVIQ_AI_API === 'undefined') throw new Error('AI API not available');

    const r = this.responses;
    const prompt = `As an expert AI consultant at Noviq, analyze this client profile and recommend a tailored solution:
    
Business: ${r.business || 'Not specified'}
Team Size: ${r.employees || 'Not specified'}
Main Challenge: ${r.challenge || 'Not specified'}
Goals: ${r.goals || 'Not specified'}
Timeline: ${r.timeline || 'Not specified'}
Budget: ${r.budget || 'Not specified'}

Provide a specific, actionable recommendation with:
1. Solution title
2. 2-3 sentence description
3. 4-6 key features

Format as JSON: { "title": "...", "desc": "...", "features": ["...", "..."] }`;

    const messages = [
      { role: 'system', content: 'You are an expert AI consultant at Noviq. Return only valid JSON.' },
      { role: 'user', content: prompt },
    ];

    const response = await NOVIQ_AI_API.chat(messages, { provider: 'groq', temperature: 0.6, maxTokens: 500 });
    
    try {
      const parsed = JSON.parse(response.replace(/```json|```/g, '').trim());
      return {
        title: parsed.title || this.generateRecommendation().title,
        desc: parsed.desc || this.generateRecommendation().desc,
        features: parsed.features || this.generateRecommendation().features,
      };
    } catch (e) {
      throw new Error('Failed to parse AI response');
    }
  },

  generateRecommendation() {
    const r = this.responses;
    const business = r.business || t('your business');
    const employees = r.employees || t('your team');
    const challenge = r.challenge || t('operational efficiency');

    const solutions = {
      [t('SaaS/Tech')]: { title: t('AI-Powered SaaS Platform'), features: [t('Multi-tenant Architecture'), t('AI Analytics'), t('Auto-scaling'), t('API-First'), t('Real-time Monitoring'), t('Custom Integrations')] },
      [t('E-commerce')]: { title: t('Intelligent Commerce Engine'), features: [t('Personalization AI'), t('Inventory Optimization'), t('Dynamic Pricing'), t('Customer 360'), t('Automated Marketing'), t('Fraud Detection')] },
      [t('Healthcare')]: { title: t('Patient Intelligence Platform'), features: [t('HIPAA Compliance'), t('Clinical Decision Support'), t('Patient Portal'), t('Interoperability'), t('Predictive Analytics'), t('Telehealth Integration')] },
      [t('Finance')]: { title: t('FinTech Core Banking Suite'), features: [t('Real-time Ledger'), t('Risk Engine'), t('Compliance Automation'), t('Open Banking APIs'), t('Fraud Prevention'), t('Regulatory Reporting')] },
      [t('Manufacturing')]: { title: t('Smart Factory Platform'), features: [t('IoT Integration'), t('Predictive Maintenance'), t('Quality AI'), t('Supply Chain Optimization'), t('Digital Twin'), t('Energy Management')] },
      [t('Education')]: { title: t('EdTech Learning Platform'), features: [t('Adaptive Learning'), t('Assessment AI'), t('Virtual Classrooms'), t('Analytics Dashboard'), t('Content Management'), t('Mobile-First')] },
    };

    const sol = solutions[business] || solutions[t('SaaS/Tech')];

    return {
      title: t('Recommended: ') + sol.title + ' ' + t('for') + ' ' + business,
      desc: t('Based on your team profile and operational needs, we recommend a comprehensive solution with intelligent automation and real-time analytics.'),
      features: sol.features,
    };
  },
};

if (typeof window !== 'undefined') window.AIConsultant = AIConsultant;
