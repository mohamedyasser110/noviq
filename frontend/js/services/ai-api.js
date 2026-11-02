/* ============================================================
   NOVIQ AI API SERVICE — Free API integrations for AI Lab
   ============================================================ */

const NOVIQ_AI_API = (() => {
  'use strict';

  const CONFIG = {
    groq: {
      baseUrl: 'https://api.groq.com/openai/v1',
      models: {
        chat: 'llama-3.3-70b-versatile',
        fast: 'llama-3.1-8b-instant',
      },
    },
    huggingface: {
      baseUrl: 'https://api-inference.huggingface.co/models',
      models: {
        chat: 'meta-llama/Meta-Llama-3.1-8B-Instruct',
        vision: 'microsoft/resnet-50',
        ocr: 'microsoft/trocr-base-printed',
        speech: 'openai/whisper-base',
        summarization: 'facebook/bart-large-cnn',
      },
    },
    cohere: {
      baseUrl: 'https://api.cohere.ai/v1',
      models: {
        chat: 'command-r-plus',
      },
    },
    together: {
      baseUrl: 'https://api.together.xyz/v1',
      models: {
        chat: 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo',
        vision: 'meta-llama/Llama-3.2-11B-Vision-Instruct-Turbo',
      },
    },
    // Free APIs - no key required
    libreTranslate: {
      baseUrl: 'https://libretranslate.com',
    },
    pollinations: {
      baseUrl: 'https://image.pollinations.ai',
    },
    public: {
      facts: 'https://uselessfacts.jsph.pl/random.json?language=en',
      quotes: 'https://api.quotable.io/random',
      jokes: 'https://v2.jokeapi.dev/joke/Any?type=single&safe-mode',
      bored: 'https://www.boredapi.com/api/activity',
      github: 'https://api.github.com',
      numbers: 'https://numbersapi.p.rapidapi.com/random/trivia',
    },
  };

  const state = {
    apiKeys: {
      groq: null,
      huggingface: null,
      cohere: null,
      together: null,
    },
    currentProvider: 'groq',
    isInitialized: false,
  };

  const DEFAULT_SYSTEM_PROMPT = `You are Noviq AI, an expert AI consultant for Noviq - a global software and AI engineering company. 
We build custom AI solutions, ERP systems, CRM platforms, web/mobile apps, and digital transformation solutions.
We've delivered 480+ projects across 32 countries with 3x average ROI for clients.
Be helpful, professional, and concise. Focus on business value and technical excellence.`;

  function init(apiKeys = {}) {
    state.apiKeys = { ...state.apiKeys, ...apiKeys };
    state.currentProvider = getBestAvailableProvider();
    state.isInitialized = true;
    console.log('[Noviq AI] Initialized with provider:', state.currentProvider);
    return state.isInitialized;
  }

  function getBestAvailableProvider() {
    if (state.apiKeys.groq) return 'groq';
    if (state.apiKeys.huggingface) return 'huggingface';
    if (state.apiKeys.cohere) return 'cohere';
    if (state.apiKeys.together) return 'together';
    return 'groq';
  }

  function setApiKey(provider, key) {
    if (state.apiKeys.hasOwnProperty(provider)) {
      state.apiKeys[provider] = key;
      state.currentProvider = getBestAvailableProvider();
      return true;
    }
    return false;
  }

  function getCurrentProvider() {
    return state.currentProvider;
  }

  async function chat(messages, options = {}) {
    const provider = options.provider || state.currentProvider;
    const model = options.model || CONFIG[provider]?.models?.chat;

    const systemMessage = options.systemPrompt || DEFAULT_SYSTEM_PROMPT;
    const fullMessages = [
      { role: 'system', content: systemMessage },
      ...messages,
    ];

    try {
      switch (provider) {
        case 'groq':
          return await chatGroq(fullMessages, model, options);
        case 'huggingface':
          return await chatHuggingFace(fullMessages, model, options);
        case 'cohere':
          return await chatCohere(fullMessages, model, options);
        case 'together':
          return await chatTogether(fullMessages, model, options);
        default:
          throw new Error(`Unknown provider: ${provider}`);
      }
    } catch (error) {
      console.error('[Noviq AI] Chat error:', error);
      return fallbackResponse(messages[messages.length - 1]?.content || '');
    }
  }

  async function chatGroq(messages, model, options) {
    const apiKey = state.apiKeys.groq || getEnvKey('GROQ_API_KEY');
    if (!apiKey) throw new Error('Groq API key not configured');

    const response = await fetch(`${CONFIG.groq.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model || CONFIG.groq.models.chat,
        messages,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? 1024,
        stream: options.stream ?? false,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(`Groq API error: ${response.status} - ${error.error?.message || 'Unknown'}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || 'No response generated';
  }

  async function chatHuggingFace(messages, model, options) {
    const apiKey = state.apiKeys.huggingface || getEnvKey('HUGGINGFACE_API_KEY');
    const prompt = messages.map(m => `${m.role}: ${m.content}`).join('\n');

    const response = await fetch(`${CONFIG.huggingface.baseUrl}/${model || CONFIG.huggingface.models.chat}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': apiKey ? `Bearer ${apiKey}` : '',
      },
      body: JSON.stringify({
        inputs: prompt,
        parameters: {
          temperature: options.temperature ?? 0.7,
          max_new_tokens: options.maxTokens ?? 1024,
          return_full_text: false,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(`Hugging Face API error: ${response.status} - ${error.error || 'Unknown'}`);
    }

    const data = await response.json();
    return data[0]?.generated_text || 'No response generated';
  }

  async function chatCohere(messages, model, options) {
    const apiKey = state.apiKeys.cohere || getEnvKey('COHERE_API_KEY');
    if (!apiKey) throw new Error('Cohere API key not configured');

    const chatHistory = messages
      .filter(m => m.role !== 'system')
      .map(m => ({ role: m.role === 'assistant' ? 'CHATBOT' : 'USER', message: m.content }));

    const response = await fetch(`${CONFIG.cohere.baseUrl}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model || CONFIG.cohere.models.chat,
        message: messages[messages.length - 1]?.content || '',
        chat_history: chatHistory.slice(0, -1),
        preamble: messages.find(m => m.role === 'system')?.content,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? 1024,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(`Cohere API error: ${response.status} - ${error.message || 'Unknown'}`);
    }

    const data = await response.json();
    return data.text || 'No response generated';
  }

  async function chatTogether(messages, model, options) {
    const apiKey = state.apiKeys.together || getEnvKey('TOGETHER_API_KEY');
    if (!apiKey) throw new Error('Together API key not configured');

    const response = await fetch(`${CONFIG.together.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model || CONFIG.together.models.chat,
        messages,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? 1024,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(`Together API error: ${response.status} - ${error.error?.message || 'Unknown'}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || 'No response generated';
  }

  function fallbackResponse(userMessage) {
    const responses = [
      `Great question! We offer custom AI solutions, ERP systems, CRM platforms, and more. For "${userMessage}", I'd recommend scheduling a consultation to discuss your specific needs.`,
      `Our AI solutions can automate workflows, analyze data, and provide intelligent insights. Based on your interest in "${userMessage}", we've delivered 480+ projects across 32 countries with 3x average ROI.`,
      `Absolutely! Let's schedule a call to discuss your specific needs in detail. We use Python, TensorFlow, PyTorch, and modern AI frameworks for our solutions.`,
      `Typical project timeline is 3-6 months for most solutions. For "${userMessage}", we'd start with a discovery phase to understand your exact requirements.`,
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  }

  async function vision(imageFile, options = {}) {
    const provider = options.provider || state.currentProvider;

    try {
      switch (provider) {
        case 'together':
          return await visionTogether(imageFile, options);
        case 'huggingface':
          return await visionHuggingFace(imageFile, options);
        default:
          throw new Error(`Vision not supported for provider: ${provider}`);
      }
    } catch (error) {
      console.error('[Noviq AI] Vision error:', error);
      return fallbackVision();
    }
  }

  async function visionTogether(imageFile, options) {
    const apiKey = state.apiKeys.together || getEnvKey('TOGETHER_API_KEY');
    if (!apiKey) throw new Error('Together API key not configured');

    const base64 = await fileToBase64(imageFile);

    const response = await fetch(`${CONFIG.together.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: CONFIG.together.models.vision,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: options.prompt || 'Analyze this image and describe what you see in detail.' },
              { type: 'image_url', image_url: { url: `data:${imageFile.type};base64,${base64}` } },
            ],
          },
        ],
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(`Together Vision error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || 'No analysis generated';
  }

  async function visionHuggingFace(imageFile, options) {
    const apiKey = state.apiKeys.huggingface || getEnvKey('HUGGINGFACE_API_KEY');

    const response = await fetch(`${CONFIG.huggingface.baseUrl}/${CONFIG.huggingface.models.vision}`, {
      method: 'POST',
      headers: {
        'Authorization': apiKey ? `Bearer ${apiKey}` : '',
      },
      body: imageFile,
    });

    if (!response.ok) throw new Error(`HF Vision error: ${response.status}`);

    const data = await response.json();
    return data.map(d => `${d.label} (${(d.score * 100).toFixed(1)}%)`).join(', ');
  }

  function fallbackVision() {
    const objects = ['Person', 'Computer', 'Desk', 'Chair', 'Monitor', 'Phone', 'Book', 'Plant'];
    const detected = objects.sort(() => 0.5 - Math.random()).slice(0, 3 + Math.floor(Math.random() * 3));
    return {
      objects: detected,
      scene: 'Office environment',
      confidence: (90 + Math.random() * 8).toFixed(1),
    };
  }

  async function ocr(imageFile, options = {}) {
    try {
      if (typeof Tesseract !== 'undefined') {
        return await ocrTesseract(imageFile, options);
      }
      return await ocrHuggingFace(imageFile, options);
    } catch (error) {
      console.error('[Noviq AI] OCR error:', error);
      return fallbackOCR();
    }
  }

  async function ocrTesseract(imageFile, options) {
    const worker = await Tesseract.createWorker(options.lang || 'eng');
    const { data: { text } } = await worker.recognize(imageFile);
    await worker.terminate();
    return text.trim() || 'No text detected in image';
  }

  async function ocrHuggingFace(imageFile, options) {
    const apiKey = state.apiKeys.huggingface || getEnvKey('HUGGINGFACE_API_KEY');

    const response = await fetch(`${CONFIG.huggingface.baseUrl}/${CONFIG.huggingface.models.ocr}`, {
      method: 'POST',
      headers: {
        'Authorization': apiKey ? `Bearer ${apiKey}` : '',
      },
      body: imageFile,
    });

    if (!response.ok) throw new Error(`HF OCR error: ${response.status}`);

    const data = await response.json();
    return data[0]?.generated_text || 'No text extracted';
  }

  function fallbackOCR() {
    return 'This is a simulated OCR result. In production, Tesseract.js would process the uploaded image and return extracted text in real-time.';
  }

  /* ============================================================
     NEW FREE API ENDPOINTS
     ============================================================ */

  async function translateText(text, targetLang = 'es', sourceLang = 'en') {
    try {
      const response = await fetch(`${CONFIG.libreTranslate.baseUrl}/translate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: text, source: sourceLang, target: targetLang, format: 'text' }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      return data.translatedText || text;
    } catch (error) {
      console.warn('[Translate] API failed:', error);
      return `[Translation unavailable: "${text}" would appear in ${targetLang}]`;
    }
  }

  async function getLanguages() {
    try {
      const response = await fetch(`${CONFIG.libreTranslate.baseUrl}/languages`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch {
      return [
        { code: 'en', name: 'English' }, { code: 'es', name: 'Spanish' },
        { code: 'fr', name: 'French' }, { code: 'de', name: 'German' },
        { code: 'it', name: 'Italian' }, { code: 'pt', name: 'Portuguese' },
        { code: 'ru', name: 'Russian' }, { code: 'zh', name: 'Chinese' },
        { code: 'ja', name: 'Japanese' }, { code: 'ar', name: 'Arabic' },
      ];
    }
  }

  function getImageGenerationUrl(prompt, options = {}) {
    const safePrompt = String(prompt || '').slice(0, 480);
    const encoded = encodeURIComponent(safePrompt);
    const width = options.width || 1024;
    const height = options.height || 1024;
    const seed = options.seed || Math.floor(Math.random() * 100000);
    const referrer = (window.location && (window.location.hostname || window.location.host)) || 'localhost';
    const params = new URLSearchParams({
      width: String(width), height: String(height), seed: String(seed),
      enhance: 'true', safe: 'true', private: 'true', referrer,
    });
    return `${CONFIG.pollinations.baseUrl}/prompt/${encoded}?${params.toString()}`;
  }

  async function fetchFact() {
    try {
      const response = await fetch(CONFIG.public.facts);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      return data.text || 'Did you know? The average cloud weighs about 1.1 million pounds.';
    } catch {
      const facts = [
        'Honey never spoils. Archaeologists found 3000-year-old honey in Egyptian tombs that was still edible.',
        'Octopuses have three hearts, nine brains, and blue blood.',
        'Bananas are berries, but strawberries are not.',
        'A day on Venus is longer than a year on Venus.',
        'The Eiffel Tower grows 6 inches in summer due to thermal expansion.',
        'Your brain uses about 20% of your body\'s total oxygen and energy.',
      ];
      return facts[Math.floor(Math.random() * facts.length)];
    }
  }

  async function fetchQuote() {
    try {
      const response = await fetch(CONFIG.public.quotes);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      return { content: data.content || '', author: data.author || 'Unknown' };
    } catch {
      const quotes = [
        { content: 'The best way to predict the future is to invent it.', author: 'Alan Kay' },
        { content: 'Innovation distinguishes between a leader and a follower.', author: 'Steve Jobs' },
        { content: 'The only impossible journey is the one you never begin.', author: 'Tony Robbins' },
        { content: 'Technology is best when it brings people together.', author: 'Matt Mullenweg' },
        { content: 'AI will be the best or worst thing for humanity.', author: 'Elon Musk' },
      ];
      return quotes[Math.floor(Math.random() * quotes.length)];
    }
  }

  async function fetchJoke() {
    try {
      const response = await fetch(CONFIG.public.jokes);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      return data.joke || data.setup + ' ' + (data.delivery || '') || 'Why did the AI cross the road? To optimize the path!';
    } catch {
      const jokes = [
        'Why do programmers prefer dark mode? Because light attracts bugs.',
        'I told my AI a joke. It said it needs more training data to understand humor.',
        'What is a computer\'s favorite snack? Microchips!',
        'Why was the AI so good at chess? It had deep learning.',
        'How many AI engineers does it take to change a light bulb? None — that\'s a hardware problem.',
      ];
      return jokes[Math.floor(Math.random() * jokes.length)];
    }
  }

  async function fetchActivity() {
    try {
      const response = await fetch(CONFIG.public.bored);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      return data.activity || 'Take a walk and clear your mind.';
    } catch {
      const activities = [
        'Learn a new programming language this weekend',
        'Write a short story using only emojis',
        'Try to solve a Rubik\'s cube',
        'Build something with a Raspberry Pi',
        'Contribute to an open-source project',
      ];
      return activities[Math.floor(Math.random() * activities.length)];
    }
  }

  async function summarizeText(text, options = {}) {
    const apiKey = state.apiKeys.huggingface || getEnvKey('HUGGINGFACE_API_KEY');

    if (apiKey) {
      try {
        const response = await fetch(`${CONFIG.huggingface.baseUrl}/${CONFIG.huggingface.models.summarization}`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ inputs: text, parameters: { max_length: options.maxLength || 150, min_length: options.minLength || 40 } }),
        });
        if (response.ok) {
          const data = await response.json();
          return data[0]?.summary_text || extractiveSummary(text);
        }
      } catch (e) {
        console.warn('[Summarize] API failed:', e);
      }
    }
    return extractiveSummary(text);
  }

  function extractiveSummary(text, maxSentences = 4) {
    const sentences = text.match(/[^.!?\n]+[.!?\n]+/g) || [text];
    if (sentences.length <= maxSentences) return text.trim();

    const wordFreq = {};
    const words = text.toLowerCase().match(/\b\w{3,}\b/g) || [];
    words.forEach(w => { wordFreq[w] = (wordFreq[w] || 0) + 1; });

    const scored = sentences.map(s => {
      const sWords = s.toLowerCase().match(/\b\w{3,}\b/g) || [];
      const score = sWords.reduce((sum, w) => sum + (wordFreq[w] || 0), 0) / (sWords.length || 1);
      return { sentence: s.trim(), score };
    });

    scored.sort((a, b) => b.score - a.score);
    const topSentences = scored.slice(0, maxSentences);
    topSentences.sort((a, b) => text.indexOf(a.sentence) - text.indexOf(b.sentence));

    return topSentences.map(s => s.sentence).join(' ');
  }

  async function speechToText(audioBlob, options = {}) {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      return await speechToTextBrowser(audioBlob, options);
    }
    return await speechToTextHuggingFace(audioBlob, options);
  }

  function speechToTextBrowser(audioBlob, options) {
    return new Promise((resolve, reject) => {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.lang = options.lang || 'en-US';
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        resolve(transcript);
      };
      recognition.onerror = (event) => reject(new Error(`Speech recognition error: ${event.error}`));
      recognition.onend = () => {};

      const reader = new FileReader();
      reader.onload = (e) => {
        const audio = new Audio(e.target.result);
        audio.onplay = () => recognition.start();
        audio.play();
      };
      reader.readAsDataURL(audioBlob);
    });
  }

  async function speechToTextHuggingFace(audioBlob, options) {
    const apiKey = state.apiKeys.huggingface || getEnvKey('HUGGINGFACE_API_KEY');

    const response = await fetch(`${CONFIG.huggingface.baseUrl}/${CONFIG.huggingface.models.speech}`, {
      method: 'POST',
      headers: {
        'Authorization': apiKey ? `Bearer ${apiKey}` : '',
      },
      body: audioBlob,
    });

    if (!response.ok) throw new Error(`HF Speech error: ${response.status}`);

    const data = await response.json();
    return data.text || 'No speech detected';
  }

  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function getEnvKey(key) {
    return (typeof window !== 'undefined' && window.ENV && window.ENV[key]) || null;
  }

  function isConfigured() {
    return Object.values(state.apiKeys).some(k => k) || 
           (typeof window !== 'undefined' && window.ENV && Object.values(window.ENV).some(k => k));
  }

  return {
    init,
    setApiKey,
    getCurrentProvider,
    chat,
    vision,
    ocr,
    speechToText,
    translateText,
    getLanguages,
    getImageGenerationUrl,
    fetchFact,
    fetchQuote,
    fetchJoke,
    fetchActivity,
    summarizeText,
    isConfigured,
    CONFIG,
  };
})();

if (typeof window !== 'undefined') {
  window.NOVIQ_AI_API = NOVIQ_AI_API;

  // Auto-initialize from ENV and localStorage
  if (typeof window.ENV !== 'undefined' || localStorage.getItem('noviq_groq_key') || localStorage.getItem('noviq_hf_key')) {
    const savedKeys = {
      groq: localStorage.getItem('noviq_groq_key'),
      huggingface: localStorage.getItem('noviq_hf_key'),
    };
    NOVIQ_AI_API.init(savedKeys);
  }
}
