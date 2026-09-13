/* ============================================================
   BUILD FAQ — accordion FAQ page
   ============================================================ */

function renderFAQPage(param, container) {
  const isAr = document.documentElement.lang === 'ar';
  const faqs = isAr ? [
    { q: 'ما التقنيات التي تستخدمها نوفيك؟', a: 'نعمل مع حزمة حديثة تشمل React وNode.js وPython وTypeScript و.NET وDocker وKubernetes وAWS وAzure وGoogle Cloud. لمشاريع الذكاء الاصطناعي نستخدم TensorFlow وPyTorch وOpenAI.' },
    { q: 'كم تستغرق المشاريع عادةً؟', a: 'تستغرق معظم المشاريع من 3 إلى 6 أشهر من الاكتشاف حتى الإطلاق. يعتمد الوقت على النطاق والتعقيد والمتطلبات. نقدم جداول زمنية مفصلة خلال مرحلة التخطيط.' },
    { q: 'ما نموذج التسعير لديكم؟', a: 'نقدم تسعيراً مرناً: سعر ثابت للمشاريع محددة المعالم، وزمن ومواد للمتطلبات المتطورة، واشتراكات شهرية للدعم والصيانة المستمرين.' },
    { q: 'هل تقدمون دعماً بعد الإطلاق؟', a: 'نعم، نقدم دعماً 24/7 لجميع مشاريعنا. تشمل باقات الدعم المراقبة والصيانة والتحديثات وأوقات الاستجابة ذات الأولوية.' },
    { q: 'هل يمكنكم العمل مع فريقنا الحالي؟', a: 'بالتأكيد. نندمج بشكل متكرر مع الفِرق الحالية عبر تعزيز الموظفين والتطوير المشترك والمشاريع الاستشارية.' },
    { q: 'ما القطاعات التي تخدمونها؟', a: 'نخدم الرعاية الصحية والتصنيع والتعليم والعقارات والقطاع المالي والتجزئة والجهات الحكومية والخدمات اللوجستية والمزيد. كل حل مخصص لمتطلبات القطاع.' },
    { q: 'هل بياناتي آمنة مع نوفيك؟', a: 'الأمن أولويتنا القصوى. نتبع أفضل الممارسات بما في ذلك التشفير والتحكم في الوصول والمراجعات الدورية والامتثال لمعايير GDPR وHIPAA وSOC 2.' },
    { q: 'هل تقدمون تطوير تطبيقات موبايل؟', a: 'نعم، نبني تطبيقات iOS وAndroid أصلية بالإضافة إلى حلول متعددة المنصات باستخدام React Native وFlutter.' },
  ] : [
    { q: 'What technologies does Noviq use?', a: 'We work with a modern stack including React, Node.js, Python, TypeScript, .NET, Docker, Kubernetes, AWS, Azure, and Google Cloud. For AI projects, we use TensorFlow, PyTorch, and OpenAI.' },
    { q: 'How long does a typical project take?', a: 'Most projects take 3-6 months from discovery to deployment. Timeline depends on scope, complexity, and requirements. We provide detailed timelines during the planning phase.' },
    { q: 'What is your pricing model?', a: 'We offer flexible pricing: fixed-price for well-defined projects, time-and-materials for evolving requirements, and monthly retainers for ongoing support and maintenance.' },
    { q: 'Do you offer post-launch support?', a: 'Yes, we provide 24/7 support for all our projects. Support packages include monitoring, maintenance, updates, and priority response times.' },
    { q: 'Can you work with our existing team?', a: 'Absolutely. We frequently integrate with existing teams through staff augmentation, co-development, and consulting engagements.' },
    { q: 'What industries do you serve?', a: 'We serve healthcare, manufacturing, education, real estate, finance, retail, government, logistics, and more. Each solution is tailored to industry-specific requirements.' },
    { q: 'Is my data secure with Noviq?', a: 'Security is our top priority. We follow industry best practices including encryption, access control, regular audits, and compliance with GDPR, HIPAA, and SOC 2 standards.' },
    { q: 'Do you offer mobile app development?', a: 'Yes, we build native iOS and Android apps as well as cross-platform solutions using React Native and Flutter.' },
  ];

  container.innerHTML = `
    <div class="noviq-page-hero">
      <div class="noviq-breadcrumb"><a href="#/home">${t('Home')}</a> <span>/</span> <span>${t('FAQ')}</span></div>
      <div class="reveal noviq-hero-badge"><i data-lucide="help-circle" style="width:14px;height:14px"></i> ${t('Got Questions?')}</div>
      <h1>${t('Frequently Asked Questions')}</h1>
      <p>${t('Everything you need to know about working with Noviq.')}</p>
    </div>
    <div class="noviq-page-section">
      <div style="max-width:700px;margin:0 auto">
        <div style="display:flex;flex-direction:column;gap:8px" class="noviq-faq-list">
          ${faqs.map((faq, i) => `
            <div class="noviq-glass-card" style="padding:0;overflow:hidden">
              <div class="noviq-faq-question" role="button" tabindex="0" aria-expanded="false" aria-controls="faq-answer-${i}" style="padding:18px 20px;display:flex;justify-content:space-between;align-items:center;cursor:pointer;font-size:14px;font-weight:500">
                <span>${faq.q}</span>
                <i data-lucide="chevron-down" style="width:18px;height:18px;color:var(--text-secondary);transition:transform 0.3s;flex-shrink:0"></i>
              </div>
              <div class="noviq-faq-answer" id="faq-answer-${i}" style="max-height:0;overflow:hidden;transition:max-height 0.4s ease, padding 0.4s ease;padding:0 20px">
                <p style="font-size:13px;color:var(--text-secondary);line-height:1.7;padding-bottom:20px">${faq.a}</p>
              </div>
            </div>`).join('')}
        </div>
      </div>
    </div>
    <div class="noviq-page-section-alt" style="text-align:center">
      <h2>${t('Still Have Questions?')}</h2>
      <button class="noviq-btn-primary" onclick="navigateTo('contact')">${t('Contact Us')} <i data-lucide="arrow-right" style="width:16px;height:16px"></i></button>
    </div>`;

  function toggleFaq(question) {
    const answer = question.nextElementSibling;
    const icon = question.querySelector('i') || question.querySelector('svg');
    const isOpen = answer.style.maxHeight && answer.style.maxHeight !== '0px';
    container.querySelectorAll('.noviq-faq-answer').forEach(a => {
      a.style.maxHeight = '0px';
      a.style.padding = '0 20px';
    });
    container.querySelectorAll('.noviq-faq-question').forEach(q => {
      q.setAttribute('aria-expanded', 'false');
      const qIcon = q.querySelector('i') || q.querySelector('svg');
      if (qIcon) qIcon.style.transform = 'rotate(0deg)';
    });
    if (!isOpen) {
      answer.style.maxHeight = answer.scrollHeight + 'px';
      answer.style.padding = '0 20px';
      if (icon) icon.style.transform = 'rotate(180deg)';
      question.setAttribute('aria-expanded', 'true');
    }
  }

  container.querySelector('.noviq-faq-list').addEventListener('click', (e) => {
    const question = e.target.closest('.noviq-faq-question');
    if (question) toggleFaq(question);
  });
  container.querySelector('.noviq-faq-list').addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const question = e.target.closest('.noviq-faq-question');
    if (question) {
      e.preventDefault();
      toggleFaq(question);
    }
  });
}