/* Admin-configurable, inline AI image prompt wizard. */
const NoviqImagePromptBuilder = (() => {
  const STORAGE_KEY = 'noviq_image_builder_v1';
  let root = null;
  let config = null;
  let state = null;
  let locale = 'en';
  let onComplete = null;
  let onCancel = null;

  const text = (value) => value && typeof value === 'object' ? (value[locale] || value.en || value.ar || '') : String(value || '');
  const labels = () => locale === 'ar' ? {
    subject: 'وصف الصورة', subjectHelp: 'اكتب الفكرة الأساسية بدقة. لن نغيّر موضوعك.',
    placeholder: 'مثال: واجهة موقع إلكتروني لعيادة أسنان حديثة', next: 'التالي', back: 'السابق',
    cancel: 'إلغاء', generate: 'إنشاء الصورة', review: 'مراجعة التصميم', edit: 'تعديل',
    required: 'اختر خياراً واحداً على الأقل للمتابعة.', progress: 'الخطوة', of: 'من',
  } : {
    subject: 'Image subject', subjectHelp: 'Describe the core idea precisely. Your subject will not be replaced.',
    placeholder: 'Example: a modern dental clinic website interface', next: 'Next', back: 'Back',
    cancel: 'Cancel', generate: 'Generate image', review: 'Review design', edit: 'Edit',
    required: 'Choose at least one option to continue.', progress: 'Step', of: 'of',
  };

  function availableGroups() {
    return NoviqImageGeneration.activeGroups(config, state.selections);
  }

  function saveDraft() {
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, subject: state.subject, step: state.step, selections: state.selections })); } catch {}
  }

  function clearDraft() {
    try { sessionStorage.removeItem(STORAGE_KEY); } catch {}
  }

  function initialSelections() {
    return Object.fromEntries((config.groups || []).map(group => [group.id, []]));
  }

  function optionVisible(option) {
    return NoviqImageGeneration.optionAvailable(option, (state.selections.output || [])[0] || '');
  }

  function renderOption(group, option) {
    const selected = (state.selections[group.id] || []).includes(option.id);
    const swatches = (option.swatches || []).map(color => `<span class="nv-img-swatch" style="--swatch:${color}"></span>`).join('');
    return `<button type="button" class="nv-img-option${selected ? ' selected' : ''}" data-option="${option.id}" aria-pressed="${selected}">
      <span class="nv-img-option-icon"><i data-lucide="${option.icon || 'circle'}"></i></span>
      <span class="nv-img-option-copy"><strong>${text(option.label)}</strong>${swatches ? `<span class="nv-img-swatches">${swatches}</span>` : ''}</span>
      <span class="nv-img-check"><i data-lucide="check"></i></span>
    </button>`;
  }

  function renderSubject() {
    const L = labels();
    const stepTag = locale === 'ar' ? 'الخطوة 1' : 'Step 1';
    return `<div class="nv-img-step-copy"><span class="nv-step-pill">${stepTag}</span><h3>${L.subject}</h3><p>${L.subjectHelp}</p></div>
      <div class="nv-img-subject"><textarea data-role="subject" dir="auto" maxlength="450" placeholder="${L.placeholder}">${state.subject}</textarea><span data-role="count">${state.subject.length}/450</span></div>`;
  }

  function renderGroup(group, number) {
    const options = group.options.filter(optionVisible);
    const stepTag = locale === 'ar' ? `الخطوة ${number}` : `Step ${number}`;
    return `<div class="nv-img-step-copy"><span class="nv-step-pill">${stepTag}</span><h3>${text(group.label)}</h3><p>${text(group.description)}</p></div>
      <div class="nv-img-options" data-group="${group.id}">${options.map(option => renderOption(group, option)).join('')}</div>`;
  }

  function renderReview(groups) {
    const L = labels();
    const rows = groups.map(group => {
      const selected = group.options.filter(option => (state.selections[group.id] || []).includes(option.id));
      return `<div class="nv-img-review-row"><span>${text(group.label)}</span><strong>${selected.map(option => text(option.label)).join(', ')}</strong></div>`;
    }).join('');
    let compiled = '';
    try { compiled = NoviqImageGeneration.compose(config, state.subject, state.selections).prompt; } catch {}
    return `<div class="nv-img-step-copy"><span><i data-lucide="sparkles"></i></span><h3>${L.review}</h3><p>${text(config.description)}</p></div>
      <div class="nv-img-review"><div class="nv-img-review-row"><span>${L.subject}</span><strong dir="auto">${escapeHtml(state.subject)}</strong></div>${rows}</div>
      <details class="nv-img-prompt-preview"><summary>${locale === 'ar' ? 'عرض وصف التصميم النهائي' : 'View final design prompt'}</summary><pre dir="auto">${escapeHtml(compiled)}</pre></details>`;
  }

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
  }

  function render() {
    if (!root) return;
    const groups = availableGroups();
    const totalSteps = groups.length + 2;
    state.step = Math.min(state.step, totalSteps - 1);
    const isSubject = state.step === 0;
    const isReview = state.step === totalSteps - 1;
    const group = !isSubject && !isReview ? groups[state.step - 1] : null;
    const L = labels();
    root.innerHTML = `<section class="nv-image-builder" aria-label="${text(config.label)}">
      <header class="nv-img-head"><div><span>${locale === 'ar' ? 'مصمم الصور' : 'Image designer'}</span><h2>${text(config.label)}</h2></div><button type="button" data-action="cancel" aria-label="${L.cancel}"><i data-lucide="x"></i></button></header>
      <div class="nv-img-progress"><div><span>${L.progress} ${state.step + 1} ${L.of} ${totalSteps}</span><strong>${Math.round(((state.step + 1) / totalSteps) * 100)}%</strong></div><span><i style="width:${((state.step + 1) / totalSteps) * 100}%"></i></span></div>
      <div class="nv-img-body">${isSubject ? renderSubject() : isReview ? renderReview(groups) : renderGroup(group, state.step + 1)}<div class="nv-img-error" data-role="error" aria-live="polite"></div></div>
      <footer class="nv-img-actions"><button type="button" class="nv-img-btn ghost" data-action="back" ${state.step === 0 ? 'disabled' : ''}><i data-lucide="arrow-left"></i>${L.back}</button><button type="button" class="nv-img-btn primary" data-action="${isReview ? 'generate' : 'next'}">${isReview ? L.generate : L.next}<i data-lucide="${isReview ? 'sparkles' : 'arrow-right'}"></i></button></footer>
    </section>`;
    bind();
    if (typeof lucide !== 'undefined') lucide.createIcons();
  }

  function setError(message) {
    const el = root && root.querySelector('[data-role="error"]');
    if (el) el.textContent = message;
  }

  function validCurrent() {
    const L = labels();
    if (state.step === 0) {
      const input = root.querySelector('[data-role="subject"]');
      state.subject = input.value.replace(/\s+/g, ' ').trim();
      if (!state.subject) { setError(L.required); return false; }
      return true;
    }
    const groups = availableGroups();
    if (state.step <= groups.length) {
      const group = groups[state.step - 1];
      const count = (state.selections[group.id] || []).length;
      if (count < group.minSelections || count > group.maxSelections) { setError(L.required); return false; }
    }
    return true;
  }

  function select(groupId, optionId) {
    const group = (config.groups || []).find(item => item.id === groupId);
    if (!group) return;
    const current = state.selections[groupId] || [];
    if (group.maxSelections === 1) state.selections[groupId] = current.includes(optionId) && group.minSelections === 0 ? [] : [optionId];
    else state.selections[groupId] = current.includes(optionId) ? current.filter(id => id !== optionId) : current.length < group.maxSelections ? [...current, optionId] : current;
    if (groupId === 'output') {
      for (const other of config.groups) state.selections[other.id] = (state.selections[other.id] || []).filter(id => other.options.some(opt => opt.id === id && optionVisible(opt)));
    }
    saveDraft();
    render();
  }

  function bind() {
    root.querySelectorAll('[data-option]').forEach(button => button.addEventListener('click', () => select(button.closest('[data-group]').dataset.group, button.dataset.option)));
    const subject = root.querySelector('[data-role="subject"]');
    if (subject) subject.addEventListener('input', () => { state.subject = subject.value; const count = root.querySelector('[data-role="count"]'); if (count) count.textContent = `${subject.value.length}/450`; saveDraft(); });
    root.querySelector('[data-action="cancel"]')?.addEventListener('click', () => { clearDraft(); if (onCancel) onCancel(); });
    root.querySelector('[data-action="back"]')?.addEventListener('click', () => { if (state.step > 0) { state.step--; saveDraft(); render(); } });
    root.querySelector('[data-action="next"]')?.addEventListener('click', () => { if (validCurrent()) { state.step++; saveDraft(); render(); } });
    root.querySelector('[data-action="generate"]')?.addEventListener('click', () => {
      if (!validCurrent()) return;
      try {
        const result = NoviqImageGeneration.compose(config, state.subject, state.selections);
        clearDraft();
        if (onComplete) onComplete({ ...result, subject: state.subject, selections: state.selections });
      } catch (error) {
        setError(locale === 'ar' ? 'هذا النوع من طلبات الصور غير مدعوم. غيّر وصف الصورة.' : (error.message || 'This image request is not supported.'));
      }
    });
  }

  function mount(target, options) {
    root = target;
    config = options.config;
    locale = options.locale === 'ar' ? 'ar' : 'en';
    onComplete = options.onComplete;
    onCancel = options.onCancel;
    state = { step: 0, subject: String(options.subject || '').trim(), selections: initialSelections() };
    render();
    requestAnimationFrame(() => root.querySelector('textarea,button')?.focus());
  }

  function destroy() { root = null; config = null; state = null; onComplete = null; onCancel = null; }
  return { mount, destroy };
})();
