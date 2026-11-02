/* Browser-direct Pollinations image generation and prompt composition. */
const NoviqImageGeneration = (() => {
  const PROFILES = {
    square: { width: 1024, height: 1024 },
    landscape: { width: 1280, height: 768 },
    portrait: { width: 768, height: 1024 },
  };
  const PEOPLE_REQUEST = /(?:\b(?:person|people|human|woman|women|girl|girls|man|men|boy|boys|child|children|family|portrait|model)\b|شخص|أشخاص|اشخاص|ناس|إنسان|انسان|امرأة|امراه|نساء|فتاة|فتاه|بنت|بنات|رجل|رجال|ولد|أولاد|اولاد|طفل|أطفال|اطفال|عائلة|عائله|أسرة|اسرة|بورتريه|عارضة|عارضه)/i;
  const FEMALE_REQUEST = /(?:\b(?:woman|women|female|girl|girls|lady|ladies|actress|bride|mother|daughter|sister)\b|امرأة|امراه|نساء|أنثى|انثى|فتاة|فتاه|بنت|بنات|سيدة|سيده|سيدات|عروس|أم|ام|ابنة|اخت|أخت)/i;
  const VISUAL_PROFESSION_REQUEST = /(?:\b(?:photo|image|picture|portrait|draw|paint|show)\b.{0,40}\b(?:doctor|nurse|teacher|student|worker|employee|customer|patient|team)\b|(?:صورة|صوره|ارسم|أرسم|اظهر|أظهر).{0,40}(?:طبيب|دكتور|ممرض|معلم|مدرس|طالب|عامل|موظف|عميل|مريض|فريق))/i;
  const UI_OUTPUTS = new Set(['website', 'mobile-app', 'desktop-app', 'dashboard', 'landing-page']);
  const OUTPUT_ANCHORS = {
    website: 'Professional desktop website UI/UX screenshot filling the entire frame',
    'mobile-app': 'Professional mobile application UI/UX presentation filling the entire frame',
    'desktop-app': 'Professional desktop software application UI screenshot filling the entire frame',
    dashboard: 'Professional enterprise SaaS dashboard UI screenshot filling the entire frame',
    'landing-page': 'Professional conversion-focused landing page UI screenshot filling the entire frame',
    'general-image': 'Single coherent high-quality creative image',
  };

  function replaceTokens(template, values) {
    return String(template || '').replace(/{{\s*(input|base|fragments|negative)\s*}}/g, (_, key) => values[key] || '');
  }

  function optionAvailable(option, outputId) {
    if (!option || option.active === false) return false;
    if (Array.isArray(option.onlyFor) && option.onlyFor.length && !option.onlyFor.includes(outputId)) return false;
    if (Array.isArray(option.hiddenFor) && option.hiddenFor.includes(outputId)) return false;
    return true;
  }

  function activeGroups(config, selections = {}) {
    const outputId = (selections.output || [])[0] || '';
    return (config.groups || []).filter(group => {
      if (!group || group.active === false) return false;
      if (Array.isArray(group.onlyFor) && group.onlyFor.length && !group.onlyFor.includes(outputId)) return false;
      if (Array.isArray(group.hiddenFor) && group.hiddenFor.includes(outputId)) return false;
      return group.id === 'output' || group.options.some(item => optionAvailable(item, outputId));
    });
  }

  function compose(config, subject, selections) {
    const cleanSubject = String(subject || '').replace(/\s+/g, ' ').trim().slice(0, 300);
    if (!cleanSubject) throw new Error('A subject is required.');
    if (FEMALE_REQUEST.test(cleanSubject)) throw new Error('Female image requests are not supported.');
    const outputId = (selections.output || [])[0] || '';
    const fragments = [];
    const detailFragments = [];
    let profileName = 'square';
    for (const group of activeGroups(config, selections)) {
      const ids = Array.from(new Set(selections[group.id] || []));
      const available = group.options.filter(item => optionAvailable(item, outputId));
      const chosen = available.filter(item => ids.includes(item.id));
      if (chosen.length < group.minSelections || chosen.length > group.maxSelections) {
        throw new Error(`Invalid selections for ${group.id}.`);
      }
      for (const item of chosen) {
        if (item.fragment) fragments.push(item.fragment.trim());
        if (group.id !== 'output' && item.fragment) detailFragments.push(item.fragment.trim());
        if (item.profile && PROFILES[item.profile]) profileName = item.profile;
      }
    }
    const peopleRequested = PEOPLE_REQUEST.test(cleanSubject) || VISUAL_PROFESSION_REQUEST.test(cleanSubject);
    let prompt;
    if (UI_OUTPUTS.has(outputId)) {
      prompt = [
        `${OUTPUT_ANCHORS[outputId]}.`,
        `Product brief: ${cleanSubject}.`,
        detailFragments.length ? `${detailFragments.join('. ')}.` : '',
        'Interface-only composition using navigation, cards, tables, charts, icons, typography.',
        'Straight-on view full canvas, coherent info architecture, realistic data.',
      ].filter(Boolean).join(' ');
    } else {
      const values = {
        input: cleanSubject,
        fragments: fragments.join('; '),
        negative: peopleRequested
          ? config.templates.negative || ''
          : 'Keep central subject focus with clean visual detail.',
      };
      values.base = replaceTokens(config.templates.base, values);
      prompt = replaceTokens(config.templates.final, values);
    }
    prompt = 'No female portraits. ' + prompt;
    prompt = prompt.replace(/\s+\n/g, '\n').replace(/\s{2,}/g, ' ').trim();
    return { prompt: prompt.slice(0, 480), profile: PROFILES[profileName] || PROFILES.square, profileName };
  }

  function buildUrl(prompt, profile, seed) {
    let safePrompt = String(prompt || '').trim();
    while (encodeURIComponent(safePrompt).length > 450 && safePrompt.length > 0) {
      safePrompt = safePrompt.slice(0, -5).trim();
    }
    const referrer = typeof window !== 'undefined' && window.location
      ? (window.location.hostname || window.location.host || 'localhost')
      : 'localhost';
    const params = new URLSearchParams({
      width: String(profile.width), height: String(profile.height), seed: String(seed),
      model: 'flux', nologo: 'true', enhance: 'false', safe: 'true', private: 'true', referrer,
    });
    return `https://image.pollinations.ai/prompt/${encodeURIComponent(safePrompt)}?${params.toString()}`;
  }

  return { PROFILES, FEMALE_REQUEST, optionAvailable, activeGroups, compose, buildUrl };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = NoviqImageGeneration;
