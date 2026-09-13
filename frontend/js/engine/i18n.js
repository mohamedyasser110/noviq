/* Noviq language switcher: public content only; admin edits remain the English source. */
(function () {
  'use strict';

  const STORAGE_KEY = 'noviq_language';
  let englishContent = null;
  let arabicContent = null;

  function isArabic() {
    return document.documentElement.lang === 'ar';
  }

  function getLanguage() {
    try { return localStorage.getItem(STORAGE_KEY) === 'ar' ? 'ar' : 'en'; }
    catch { return 'en'; }
  }

  function copy(value) {
    return JSON.parse(JSON.stringify(value));
  }

  const SPA_STRINGS = {
    'Home': 'الرئيسية', 'Services': 'الخدمات', 'Industries': 'القطاعات', 'Solutions': 'الحلول',
    'Portfolio': 'أعمالنا', 'Resources': 'المصادر', 'Pricing': 'الأسعار', 'About': 'من نحن',
    'Contact': 'تواصل معنا', 'Careers': 'الوظائف', 'FAQ': 'الأسئلة الشائعة',
    'What We Build': 'ما نبنيه', 'WHAT WE BUILD': 'ما نبنيه',
    'Why Noviq': 'لماذا نوفيك', 'WHY NOVIQ': 'لماذا نوفيك',
    'Admin sign in': 'دخول الإدارة',
    'Admin Sign In': 'دخول الإدارة',
    'Sign In as Admin': 'دخول كمسؤول',
    'Back to user sign in': 'عودة لدخول المستخدم',
    'Username or email': 'اسم المستخدم أو الإيميل',
    'admin username or email': 'اسم المستخدم أو إيميل الإدارة',
    'Restricted area. Authorized administrators only.': 'منطقة مقيدة. للمخولين فقط.',
    'Welcome, Admin!': 'أهلاً بك!',
    'Our Team': 'فريقنا', 'OUR TEAM': 'فريقنا',
    'Meet the Minds Behind Noviq': 'تعرف على عقول نوفيك',
    'Engineers, designers, and strategists crafting software that matters.': 'مهندسون ومصممون واستراتيجيون يصنعون برمجيات ذات أثر.',
    'Our Toolkit': 'أدواتنا', 'OUR TOOLKIT': 'أدواتنا',
    'Technology We Trust': 'التقنيات التي نثق بها',
    'The proven stack behind our 480+ projects — picked for performance, security and scale.': 'التقنيات المجرّبة وراء أكثر من 480 مشروعاً — مختارة للأداء والأمان وقابلية التوسع.',
    'Have a stack in mind?': 'عندك تقنيات في بالك؟',
    'Eight reasons ambitious teams choose Noviq — engineered for outcomes, not just output.': 'ثمانية أسباب تجعل الفرق الطموحة تختار نوفيك — هندسة للنتائج وليس للمخرجات فقط.',
    'Ready to Build Different?': 'جاهز تبني بشكل مختلف؟',
    'Our Clients': 'عملاؤنا', 'OUR CLIENTS': 'عملاؤنا',
    'Get In Touch': 'تواصل معنا', 'Send Us a Message': 'أرسل لنا رسالة',
    'Contact Information': 'معلومات التواصل', 'Follow Us': 'تابعنا', 'Email': 'البريد الإلكتروني',
    'Phone': 'الهاتف', 'Offices': 'المكاتب', 'Select Department': 'اختر القسم',
    'Sales': 'المبيعات', 'Support': 'الدعم', 'Partnerships': 'الشراكات', 'General Inquiry': 'استفسار عام',
    'Message Sent!': 'تم إرسال الرسالة!', 'Send Message': 'إرسال الرسالة',
    'Our Approach': 'منهجيتنا', 'Requirements Analysis': 'تحليل المتطلبات', 'Architecture Design': 'تصميم المعمارية',
    'Agile Development': 'تطوير مرن', 'Quality Assurance': 'ضمان الجودة', 'Deployment': 'الإطلاق',
    'Ongoing Support': 'دعم مستمر', 'Ready to Get Started?': 'هل أنت مستعد للبدء؟',
    'Start Your Project': 'ابدأ مشروعك', 'View Case Study': 'عرض دراسة الحالة',
    'Page Not Found': 'الصفحة غير موجودة', 'Go Home': 'العودة للرئيسية',
    'Build Your Solution': 'صمّم حلك', 'Custom Solution': 'حل مخصص', 'Solution Builder': 'منشئ الحلول',
    'AI Consultant': 'مستشار الذكاء الاصطناعي', 'Cost Estimator': 'مقدّر التكلفة',
    'Digital Transformation Assessment': 'تقييم التحول الرقمي', 'ROI Calculator': 'حاسبة العائد على الاستثمار',
    'View All Services': 'كل الخدمات', 'View All Industries': 'كل القطاعات', 'View All Solutions': 'كل الحلول',
    'AI Lab': 'مختبر الذكاء الاصطناعي', 'Case Studies': 'دراسات الحالة', 'Blog': 'المدونة',
    'Documentation': 'التوثيق', 'Privacy': 'الخصوصية', 'Terms': 'الشروط', 'Newsletter': 'النشرة البريدية',
    'SCROLL': 'مرر للأسفل',
    'Full-Spectrum Software & AI Solutions': 'حلول برمجية وذكاء اصطناعي متكاملة',
    'From intelligent automation to enterprise-grade platforms, engineered end to end.': 'من الأتمتة الذكية إلى المنصات المؤسسية، مصممة من البداية للنهاية.',
    "Let's Build Something Exceptional": 'لنصنع شيئاً استثنائياً',
    "Tell us about your project and we'll get back to you within one business day.": 'أخبرنا عن مشروعك وسنعاود التواصل خلال يوم عمل واحد.',
    'Trusted Across Every Major Industry': 'شريك موثوق عبر القطاعات الرئيسية',
    'We deliver tailored solutions for healthcare, finance, manufacturing, and more.': 'نقدم حلولاً مخصصة للرعاية الصحية والقطاع المالي والتصنيع والمزيد.',
    'Featured Work': 'أعمال مختارة',
    'Case Studies From the Field': 'دراسات حالة من أرض الواقع',
    'Real projects, real results — see how we\'ve helped businesses transform.': 'مشاريع حقيقية ونتائج ملموسة — اكتشف كيف ساعدنا أعمالاً على التحول.',
    'Proven Solutions, Ready to Deploy': 'حلول مجرّبة وجاهزة للإطلاق',
    'Pre-engineered packages tailored to your industry, backed by years of delivery expertise.': 'حزم جاهزة مصممة لقطاعك، مدعومة بخبرة تسليم سنوات.',
    'Transparent Pricing': 'أسعار شفافة',
    'Plans That Scale With You': 'خطط تنمو معك',
    'Start small, grow big — no hidden fees, no surprises.': 'ابدأ صغيراً وكبُر — بدون رسوم خفية أو مفاجآت.',
    'Not Sure Which Plan?': 'غير متأكد من الخطة المناسبة؟',
    'Use our Solution Builder to get a custom recommendation.': 'استخدم منشئ الحلول للحصول على توصية مخصصة.',
    'Who We Are': 'من نحن',
    'Engineering the Future Through Technology': 'هندسة المستقبل بالتقنية',
    "We're a global team of engineers, designers, and strategists committed to building software that matters.": 'نحن فريق عالمي من المهندسين والمصممين والاستراتيجيين ملتزمون ببناء برمجيات ذات أثر.',
    'Our Story': 'قصتنا',
    'Founded': 'تأسست', 'Projects': 'المشاريع', 'Clients': 'العملاء', 'Countries': 'الدول',
    'Our Values': 'قيمنا',
    'Innovation First': 'الابتكار أولاً', 'We push boundaries and explore what\'s possible.': 'ندفع الحدود ونستكشف الممكن.',
    'Quality Obsession': 'هاجس الجودة', 'Every line of code is engineered to the highest standard.': 'كل سطر برمجي مصمم بأعلى المعايير.',
    'People-Centric': 'الإنسان أولاً', 'Technology serves people, not the other way around.': 'التقنية في خدمة الإنسان وليس العكس.',
    'Global Mindset': 'تفكير عالمي', 'Diverse perspectives create better solutions.': 'التنوع في وجهات النظر يصنع حلولاً أفضل.',
    'Want to Join Our Team?': 'ترغب بالانضمام لفريقنا؟',
    "We're always looking for talented engineers, designers, and thinkers.": 'نبحث دائماً عن مهندسين ومصممين ومفكرين موهوبين.',
    'View Open Positions': 'عرض الوظائف المتاحة',
    'Join Our Team': 'انضم لفريقنا',
    'Build the Future With Us': 'اصنع المستقبل معنا',
    "We're looking for talented people who want to work on meaningful technology.": 'نبحث عن أشخاص موهوبين يرغبون بالعمل على تقنية ذات معنى.',
    "Don't See the Right Role?": 'لا تجد الدور المناسب؟',
    "We're always open to hearing from talented people. Send us your resume.": 'نرحب دائماً بالاستماع للموهوبين. أرسل لنا سيرتك الذاتية.',
    'Send Open Application': 'أرسل طلباً مفتوحاً',
    'Apply Now': 'قدم الآن',
    'All': 'الكل',
    'Knowledge Hub': 'مركز المعرفة',
    'Resources & Insights': 'مصادر ورؤى',
    'Stay ahead with our latest articles, whitepapers, and technical guides.': 'ابقَ في المقدمة بأحدث المقالات والأبحاث والأدلة التقنية.',
    'Whitepapers': 'أبحاث', 'Downloads': 'تحميلات',
    'Latest Articles': 'أحدث المقالات', 'Research & Whitepapers': 'أبحاث ودراسات',
    'Got Questions?': 'لديك أسئلة؟',
    'Frequently Asked Questions': 'الأسئلة الشائعة',
    'Everything you need to know about working with Noviq.': 'كل ما تحتاج معرفته للعمل مع نوفيك.',
    'Still Have Questions?': 'ما زالت لديك أسئلة؟',
    "We're here to help. Reach out and we'll get back to you within one business day.": 'نحن هنا للمساعدة. تواصل معنا وسنعاود إليك خلال يوم عمل واحد.',
    'The Challenge': 'التحدي', 'Our Solution': 'حلنا', 'Key Results': 'النتائج الرئيسية',
    'Our client needed a solution that could scale with rapid growth while maintaining performance and reliability across multiple regions.': 'احتاج عميلنا لحل قادر على التوسع مع النمو السريع مع الحفاظ على الأداء والموثوقية عبر مناطق متعددة.',
    'We designed and built a modern, cloud-native platform leveraging AI and real-time data processing to deliver measurable outcomes.': 'صممنا وبنينا منصة سحابية حديثة تستفيد من الذكاء الاصطناعي ومعالجة البيانات اللحظية لتحقيق نتائج قابلة للقياس.',
    '40% Efficiency Gain': '40% تحسن في الكفاءة', '99.9% Uptime': '99.9% وقت تشغيل', '3x ROI': '3x عائد استثمار',
    'Start a Similar Project': 'ابدأ مشروعاً مماثلاً',
    'Industry Challenges': 'تحديات القطاع', 'Our Solutions': 'حلولنا',
    'Digital transformation lag': 'تأخر التحول الرقمي', 'Legacy system integration': 'دمج الأنظمة القديمة',
    'Data security & compliance': 'أمن البيانات والامتثال', 'Operational inefficiency': 'inefficiência التشغيل',
    'Custom Software Development': 'تطوير برمجيات مخصصة', 'AI & Automation': 'الذكاء الاصطناعي والأتمتة',
    'Cloud Migration': 'الترحيل السحابي', 'Data Analytics': 'تحليلات البيانات',
    'AI Solutions': 'حلول الذكاء الاصطناعي', 'Custom Software': 'برمجيات مخصصة',
    'ERP Systems': 'أنظمة ERP', 'CRM Platforms': 'منصات CRM',
    'Cloud Solutions': 'حلول سحابية', 'SaaS Development': 'تطوير SaaS',
    'Web Applications': 'تطبيقات ويب', 'Mobile Applications': 'تطبيقات موبايل',
    'API Development': 'تطوير API', 'Automation': 'أتمتة الأعمال',
    'Digital Transformation': 'التحول الرقمي',
    'Custom AI models, LLM integrations, and intelligent automation built for real business outcomes.': 'أنظمة ذكاء اصطناعي مخصصة وأتمتة ذكية تعزز كفاءة الأعمال وتصنع أثراً ملموساً.',
    'Bespoke systems engineered around your workflows, not the other way around.': 'أنظمة مبنية خصيصاً لتناسب سير عملك وتلبي تطلعات فريقك.',
    'Unified operations platforms that connect finance, inventory, and people in one place.': 'حلول متكاملة تربط الحسابات والمخزون والموارد البشرية في منصة واحدة.',
    'Sales and support tooling that gives every team a single source of truth.': 'أدوات ذكية للمبيعات والدعم تمنح فريقك رؤية شاملة لكل عميل.',
    'Resilient, auto-scaling infrastructure across AWS, Azure, and Google Cloud.': 'بنية سحابية آمنة ومرنة تضمن استقرار منصتك تحت أي ضغط.',
    'Multi-tenant products built to scale from first customer to first million.': 'منتجات سحابية متطورة مصممة للنمو السلس من البداية حتى ملايين المستخدمين.',
    'Fast, accessible, pixel-perfect interfaces engineered for growth.': 'واجهات فائقة السرعة وسلسة الاستخدام توفر تجربة تصفح راقية.',
    'Native-feel iOS and Android apps from a single, maintainable codebase.': 'تطبيقات أصلية عالية الأداء لأنظمة iOS وAndroid بلمسة تصميمية مبدعة.',
    'Documented, versioned, secure APIs that your partners actually enjoy integrating.': 'ربط برمجي آمن وسلس بين مختلف منظوماتك التطبيقية والشركاء.',
    'Workflow and process automation that removes manual work at the root.': 'أتمتة ذكية للمهام الروتينية لرفع الإنتاجية وتقليل الجهد اليدوي.',
    'Full modernization strategy paired with practical engineering.': 'رؤية استراتيجية واضحة لتحديث تقنياتك وتحويل أفكارك إلى واقع.',
    'Schedule a Consultation': 'احجز استشارة',
    'Key Features': 'الميزات الرئيسية',
    'Dashboard & Reports': 'لوحة التحكم والتقارير', 'User Management': 'إدارة المستخدمين',
    'Role-based Access': 'وصول حسب الدور', 'Audit Logging': 'سجل التدقيق',
    'Email Notifications': 'إشعارات البريد', 'API Integration': 'تكامل API',
    'Data Export': 'تصدير البيانات', 'Mobile Access': 'وصول الموبايل',
    'Starting From': 'يبدأ من', 'Get This Solution': 'احصل على هذا الحل',
    'Build Custom': 'صمم حلاً مخصصاً', 'Learn More': 'اعرف المزيد',
    'Full-time': 'دوام كامل', 'Contract': 'تعاقد', 'Remote': 'عن بُعد',
    'Senior Full Stack Developer': 'مطور Full Stack أول', 'Engineering': 'الهندسة',
    'AI/ML Engineer': 'مهندس ذكاء اصطناعي', 'AI': 'الذكاء الاصطناعي',
    'UI/UX Designer': 'مصمم واجهات', 'Design': 'التصميم',
    'DevOps Engineer': 'مهندس DevOps', 'Infrastructure': 'البنية التحتية',
    'Technical Writer': 'كاتب تقني', 'Documentation': 'التوثيق',
    'Product Manager': 'مدير منتج', 'Product': 'المنتج',
    'Starter': 'المبتدئ', 'Growth': 'النمو', 'Enterprise': 'المؤسسة',
    'Popular': 'الأكثر شيوعاً', 'Contact Us': 'تواصل معنا', 'Get Started': 'ابدأ الآن',
    'Most Popular': 'الأكثر شيوعاً',
    'Perfect for small teams starting their digital journey.': 'مثالي للفِرق الصغيرة التي تبدأ رحلتها الرقمية.',
    'For growing businesses needing advanced capabilities.': 'للأعمال النامية التي تحتاج قدرات متقدمة.',
    'Full-scale solutions for large organizations.': 'حلول شاملة للمنظمات الكبيرة.',
    'Up to 10 Users': 'حتى 10 مستخدمين', 'Core Features': 'الميزات الأساسية',
    'Email Support': 'دعم بريدي', 'Basic Analytics': 'تحليلات أساسية', '1 Integration': 'تكامل واحد',
    'Up to 50 Users': 'حتى 50 مستخدماً', 'All Features': 'كل الميزات',
    'Priority Support': 'دعم ذو أولوية', 'Advanced Analytics': 'تحليلات متقدمة',
    '5 Integrations': '5 تكاملات', 'AI Assistant': 'مساعد ذكاء اصطناعي', 'Custom Reports': 'تقارير مخصصة',
    'Unlimited Users': 'مستخدمون بلا حد', 'Everything in Growth': 'كل ما في النمو',
    'Dedicated Support': 'دعم مخصص', 'Custom AI Models': 'نماذج ذكاء اصطناعي مخصصة',
    'Unlimited Integrations': 'تكاملات بلا حد', 'SLA Guarantee': 'ضمان SLA', 'On-premise Option': 'خيار محلي',
    'Read More': 'اقرأ المزيد', 'Download': 'تحميل', 'Click a tab to load content...': 'اضغط على تبويب لعرض المحتوى...',
    "What technologies does Noviq use?": 'ما التقنيات التي تستخدمها نوفيك؟',
    'How long does a typical project take?': 'كم تستغرق المشاريع عادةً؟',
    'What is your pricing model?': 'ما نموذل التسعير لديكم؟',
    'Do you offer post-launch support?': 'هل تقدمون دعماً بعد الإطلاق؟',
    'Can you work with our existing team?': 'هل يمكنكم العمل مع فريقنا الحالي؟',
    'What industries do you serve?': 'ما القطاعات التي تخدمونها؟',
    'Is my data secure with Noviq?': 'هل بياناتي آمنة مع نوفيك؟',
    'Do you offer mobile app development?': 'هل تقدمون تطوير تطبيقات موبايل؟',
    "Answer a few questions and we'll generate a custom proposal.": 'أجب على بضعة أسئلة وسننشئ عرضاً مخصصاً.',
    'Get personalized recommendations for your business.': 'احصل على توصيات مخصصة لأعمالك.',
    'Estimate your project budget based on features.': 'قدّر ميزانية مشروعك بناءً على الميزات.',
    'Assessment': 'التقييم',
    'Evaluate your digital readiness with our comprehensive quiz.': 'قيّم جاهزيتك الرقمية من خلال اختبارنا الشامل.',
    "Compare manual vs AI costs for your business.": 'قارن بين التكاليف اليدوية وتكاليف الذكاء الاصطناعي لأعمالك.',
    "The page you're looking for doesn't exist.": 'الصفحة التي تبحث عنها غير موجودة.',
    'Sending...': 'جارٍ الإرسال...',
    'Message Sent': 'تم إرسال الرسالة',
    'Failed to send. Please try again.': 'فشل الإرسال. حاول مرة أخرى.',
    'View Case Study': 'عرض دراسة الحالة',
    'Innovation Playground': 'ملعب الابتكار',
    'AI Lab — Experience Intelligence': 'مختبر الذكاء الاصطناعي — جرب الذكاء بنفسك',
    'Try Demo': 'جرب العرض',
    'Try our AI demos live. Powered by free APIs — no setup, no commitment.': 'جرب عروض الذكاء الاصطناعي مباشرة. مدعومة بواجهات مجانية وبدون إعداد مسبق.',
    'AI Chatbot Demo': 'عرض تجريبي للمحادثة الذكية',
    'Powered by Llama-3 via Groq API (free tier). Ask anything about Noviq or general topics.': 'مدعوم من Llama-3 عبر Groq API (مجاني). اسأل أي شيء عن نوفيك أو مواضيع عامة.',
    'Ask me anything...': 'اسألني أي شيء...',
    'Smart assistant with 1000+ keywords, bilingual (AR/EN), connected live to our database.': 'مساعد ذكي بأكثر من 1000 كلمة مفتاحية، ثنائي اللغة (عربي/إنجليزي)، متصل مباشرة بقاعدة بياناتنا.',
    'Noviq Smart Assistant': 'مساعد نوفيك الذكي',
    'Connecting...': 'جارٍ الاتصال...',
    'Connected to live database': 'متصل بقاعدة البيانات مباشرة',
    'Offline mode — answers from cached site content.': 'وضع عدم الاتصال — الإجابات من محتوى الموقع.',
    'keywords': 'كلمة مفتاحية',
    'topics': 'موضوعاً',
    'conversations': 'محادثة',
    'Copy Chat': 'نسخ المحادثة',
    'New Chat': 'محادثة جديدة',
    'Tip: leave your email in the chat and our team will contact you within one business day.': 'نصيحة: اترك بريدك الإلكتروني في المحادثة وسيتواصل معك فريقنا خلال يوم عمل واحد.',
    "Hello! I'm the Noviq assistant — ask me about services, pricing, projects, or leave your email to book a free consultation.": 'مرحباً! أنا مساعد نوفيك — اسألني عن الخدمات أو الأسعار أو المشاريع، أو اترك بريدك الإلكتروني لحجز استشارة مجانية.',
    'Thinking...': 'يفكر...',
    'Sorry, I encountered an error. Please try again.': 'عذراً، حدث خطأ. حاول مرة أخرى.',
    "Hello! I'm Noviq AI, powered by Llama-3. Ask me anything about our services, AI, or technology.": 'مرحباً! أنا نوفيك AI، مدعوم من Llama-3. اسألني عن خدماتنا أو الذكاء الاصطناعي أو التقنية.',
    "Great question! We offer custom AI solutions, ERP systems, CRM platforms, and more.": 'سؤال رائع! نقدم حلول ذكاء اصطناعي مخصصة وأنظمة ERP ومنصات CRM والمزيد.',
    "Our AI solutions can automate workflows, analyze data, and provide intelligent insights.": 'حلول الذكاء الاصطناعي لدينا تؤتمت سير العمل وتحلل البيانات وتقدم رؤى ذكية.',
    "We've delivered 480+ projects across 32 countries. Our clients see 3x average ROI.": 'قدّمنا أكثر من 480 مشروعاً في 32 دولة. متوسط عائد الاستثمار 3 أضعاف.',
    "Absolutely! Let's schedule a call to discuss your specific needs in detail.": 'بالتأكيد! دعنا نحدد موعد اتصال لمناقشة احتياجاتك بالتفصيل.',
    "We use Python, TensorFlow, PyTorch, and OpenAI for our AI solutions.": 'نستخدم Python وTensorFlow وPyTorch وOpenAI لحلول الذكاء الاصطناعي.',
    "Typical project timeline is 3-6 months for most solutions.": 'الجدول الزمني النموذجي للمشروع هو 3-6 أشهر لمعظم الحلول.',
    'AI Chatbot': 'المحادثة الذكية',
    'Smart bilingual assistant with 1000+ keywords and live database access.': 'مساعد ذكي ثنائي اللغة بأكثر من 1000 كلمة مفتاحية ووصول مباشر لقاعدة البيانات.',
    'OCR Recognition': 'التعرف على النصوص',
    'OCR Recognition Demo': 'عرض تجريبي للتعرف على النصوص',
    'Upload an image and extract text using Tesseract.js (runs entirely in your browser).': 'ارفع صورة واستخرج النص باستخدام Tesseract.js (يعمل بالكامل في متصفحك).',
    'Drop an image here or click to upload': 'أسقط الصورة هنا أو انقر للرفع',
    'Processing image with Tesseract.js...': 'جارٍ معالجة الصورة...',
    'Extracted Text': 'النص المستخرج',
    'Copy Text': 'نسخ النص',
    'Clear': 'مسح',
    'Please upload an image file (PNG, JPG, WebP, etc.)': 'يرجى رفع ملف صورة (PNG, JPG, WebP, إلخ)',
    'Tesseract.js not loaded. Please refresh the page.': 'لم يتم تحميل Tesseract.js. يرجى تحديث الصفحة.',
    'No text detected in image.': 'لم يتم اكتشاف نص في الصورة.',
    'Failed to process image. Please try again.': 'فشلت معالجة الصورة. حاول مرة أخرى.',
    'Copied!': 'تم النسخ!',
    'Vision AI': 'الرؤية الذكية',
    'Vision AI Demo': 'عرض تجريبي للرؤية الذكية',
    'Upload an image for AI-powered classification using Hugging Face models.': 'ارفع صورة للتصنيف بالذكاء الاصطناعي باستخدام نماذج Hugging Face.',
    'Upload an image for AI analysis': 'ارفع صورة للتحليل بالذكاء الاصطناعي',
    'Analyzing with Vision AI...': 'جارٍ التحليل بالرؤية الذكية...',
    'AI Analysis Results': 'نتائج تحليل الذكاء الاصطناعي',
    'Please upload an image file': 'يرجى رفع ملف صورة',
    'Failed to analyze image': 'فشل تحليل الصورة',
    'Objects Detected': 'الكائنات المكتشفة',
    'Scene Classification': 'تصنيف المشهد',
    'Confidence': 'الثقة',
    'Detailed Predictions': 'التوقعات التفصيلية',
    'Powered by Hugging Face Inference API (google/vit-base-patch16-224)': 'مدعوم من Hugging Face Inference API',
    'Person': 'شخص', 'Computer': 'حاسوب', 'Desk': 'مكتب', 'Chair': 'كرسي', 'Monitor': 'شاشة',
    'Phone': 'هاتف', 'Book': 'كتاب', 'Plant': 'نبات', 'Coffee mug': 'فنجان قهوة',
    'Keyboard': 'لوحة مفاتيح', 'Mouse': 'فأرة', 'Notebook': 'دفتر ملاحظات',
    'Modern office environment': 'بيئة مكتبية حديثة', 'Home workspace': 'مساحة عمل منزلية',
    'Meeting room': 'غرفة اجتماعات', 'Co-working space': 'مساحة عمل مشتركة',
    'Creative studio': 'استوديو إبداعي', 'Tech office': 'مكتب تقني',
    'Voice AI': 'الصوت الذكي',
    'Voice AI Demo': 'عرض تجريبي للصوت الذكي',
    'Click the microphone and speak to test speech-to-text using the Web Speech API.': 'اضغط على الميكروفون وتحدث لاختبار تحويل الصوت إلى نص.',
    'Click to start recording': 'انقر لبدء التسجيل',
    'Click the microphone to start recording': 'اضغط على الميكروفون لبدء التسجيل',
    'Transcription': 'النص المحول',
    'Your speech will appear here...': 'سينتقل كلامك إلى هنا...',
    'Record Again': 'تسجيل مرة أخرى',
    'Copy': 'نسخ',
    'Web Speech API not supported in this browser. Try Chrome or Edge.': 'واجهة Web Speech غير مدعومة في هذا المتصفح. جرب Chrome أو Edge.',
    'Listening... Speak now': 'يستمع... تحدث الآن',
    'Speech recognition error: ': 'خطأ في التعرف على الصوت: ',
    'No speech detected. Please try again.': 'لم يتم اكتشاف كلام. حاول مرة أخرى.',
    'No microphone found.': 'لم يتم العثور على ميكروفون.',
    'Microphone permission denied.': 'تم رفض إذن الميكروفون.',
    'Recording complete': 'اكتمل التسجيل',
    'Could not start recording: ': 'تعذر بدء التسجيل: ',
    'Prompt Generator': 'مولد الأوامر',
    'AI Prompt Generator': 'مولد الأوامر الذكي',
    'Craft the perfect prompt for any AI model. Optionally enhance with AI.': 'صمم الأمر المثالي لأي نموذج ذكاء اصطناعي. يمكنك تحسينه بالذكاء الاصطناعي.',
    'Task Type': 'نوع المهمة',
    'Content Writing': 'كتابة محتوى',
    'Code Generation': 'توليد كود',
    'Data Analysis': 'تحليل بيانات',
    'Creative Writing': 'كتابة إبداعية',
    'Translation': 'ترجمة',
    'Summarization': 'تلخيص',
    'Brainstorming': 'عصف ذهني',
    'Code Review': 'مراجعة كود',
    'Tone': 'النبرة',
    'Professional': 'مهنية', 'Casual': 'غير رسمية', 'Technical': 'تقنية',
    'Creative': 'إبداعية', 'Persuasive': 'إقناعية', 'Educational': 'تعليمية', 'Concise': 'موجزة',
    'Output Format': 'صيغة الإخراج',
    'Structured (headings, bullets)': 'منظمة (عناوين ونقاط)',
    'JSON': 'JSON', 'Markdown': 'Markdown', 'Plain Text': 'نص عادي',
    'Table': 'جدول', 'Step-by-step': 'خطوة بخطوة',
    'Target Model': 'النموذج المستهدف',
    'GPT-4 / Claude / General': 'GPT-4 / Claude / عام',
    'GPT-3.5': 'GPT-3.5', 'Llama / Open Source': 'Llama / مفتوح المصدر',
    'Code-specific (CodeLlama, etc.)': 'خاص بالكود (CodeLlama، إلخ)',
    'Topic / Context': 'الموضوع / السياق',
    'Generate Prompt': 'توليد الأمر',
    'Enhance with AI': 'تحسين بالذكاء الاصطناعي',
    'Your Prompt': 'الأمر الخاص بك',
    'Regenerate': 'إعادة التوليد',
    'Task': 'المهمة', 'Format': 'الصيغة', 'Model': 'النموذج',
    'Enhanced with AI': 'مُحسَّن بالذكاء الاصطناعي',
    'Image Generator': 'مولد الصور',
    'AI Image Generator': 'مولد الصور بالذكاء الاصطناعي',
    'Generate images from text descriptions using Pollinations.ai. Completely free, no API key needed.': 'توليد صور من النصوص باستخدام Pollinations.ai. مجاني بالكامل.',
    'Describe the image you want to generate...': 'صف الصورة التي تريد توليدها...',
    'Generate': 'توليد',
    'Square (1024×1024)': 'مربع (1024×1024)',
    'Landscape (1024×768)': 'أفقي (1024×768)',
    'Portrait (768×1024)': 'عمودي (768×1024)',
    'Small (512×512)': 'صغير (512×512)',
    'Surprise Me': 'فاجئني',
    'Download': 'تحميل',
    'Generating your image...': 'جارٍ توليد الصورة...',
    'Prompt': 'الأمر',
    'Please enter an image description.': 'يرجى إدخال وصف للصورة.',
    'Failed to generate image. Please try again with a different prompt.': 'فشل توليد الصورة. حاول مرة أخرى بأمر مختلف.',
    'AI Translator': 'المترجم الذكي',
    'Translate text between languages using LibreTranslate API. Free, no API key needed.': 'ترجمة النصوص بين اللغات باستخدام LibreTranslate API. مجاني.',
    'From': 'من', 'To': 'إلى',
    'Enter text to translate...': 'أدخل النص للترجمة...',
    'Translate': 'ترجمة',
    'Translating...': 'جارٍ الترجمة...',
    'Please enter text to translate.': 'يرجى إدخال نص للترجمة.',
    'Translation failed: ': 'فشلت الترجمة: ',
    'English': 'الإنجليزية', 'Spanish': 'الإسبانية', 'French': 'الفرنسية',
    'German': 'الألمانية', 'Italian': 'الإيطالية', 'Portuguese': 'البرتغالية',
    'Russian': 'الروسية', 'Chinese': 'الصينية', 'Japanese': 'اليابانية', 'Arabic': 'العربية',
    'AI Summarizer': 'الملخص الذكي',
    'Summarize long text into concise key points. Uses extractive AI + Hugging Face API if configured.': 'لخّص النصوص الطويلة في نقاط موجزة. يستخدم AI استخلاصي.',
    'Paste your article, document, or long text here...': 'الصق مقالك أو مستندك أو نصك الطويل هنا...',
    'Short (2-3 sentences)': 'قصير (2-3 جمل)',
    'Medium (4-6 sentences)': 'متوسط (4-6 جمل)',
    'Long (7-10 sentences)': 'طويل (7-10 جمل)',
    'Summarize': 'تلخيص',
    'Load Sample': 'تحميل عينة',
    'Summary': 'الملخص',
    'Summarizing...': 'جارٍ التلخيص...',
    'Please enter text to summarize.': 'يرجى إدخال نص للتلخيص.',
    'Summarization failed: ': 'فشل التلخيص: ',
    'Original: ': 'الأصل: ', ' chars ': ' حرف ',
    ' Summary: ': ' الملخص: ', '%)': '%)',
    'Fun Facts & Trivia': 'حقائق وترفيه',
    'AI Fun Facts & Trivia': 'حقائق وترفيه بالذكاء الاصطناعي',
    'Random facts, quotes, jokes, and activity suggestions powered by free public APIs.': 'حقائق واقتباسات ونكات واقتراحات أنشطة عشوائية.',
    'Random Fact': 'حقيقة عشوائية',
    'Random Quote': 'اقتباس عشوائي',
    'Random Joke': 'نكتة عشوائية',
    'Activity Idea': 'فكرة نشاط',
    'Click a button above to get started!': 'اضغط على زر أعلاه للبدء!',
    'Failed to fetch: ': 'فشل الجلب: ',
    'A futuristic city floating in the clouds at sunset, cyberpunk style': 'مدينة مستقبلية تطفو في الغروب، بأسلوب السايبربانك',
    'A majestic dragon made of crystal and light, fantasy art': 'تنين مهيب من الكريستال والضوء، فن خيالي',
    'A cozy cabin in a snowy forest, digital painting, warm lighting': 'كوخ دافئ في غابة ثلجية، رسم رقمي بإضاءة دافئة',
    'An AI robot painting on a canvas in a studio, Van Gogh style': 'روبوت ذكاء اصطناعي يرسم في استوديو، بأسلوب فان غوخ',
    'A surreal dreamscape with floating islands and waterfalls': 'منظر أحلام سريالي بجزر عائمة وشلالات',
    'A steampunk owl with mechanical wings, detailed illustration': 'بومة ستيم بانك بأجنحة ميكانيكية، رسم تفصيلي',
    'An alien landscape with two moons, purple skies, bioluminescent plants': 'منظر فضائي بقمرين وسماء أرجوانية ونباتات مضيئة',
    'A cute corgi astronaut floating in space, cartoon style': 'كلب كورجي رائد فضاء يطفو في الفضاء، بأسلوب كرتون',
    'Neon-lit Tokyo street at night, reflections in puddles, anime style': 'شارع طوكيوي مضاء بالنيون ليلاً، انعكاسات في البرك، بأسلوب الأنمي',
    'A quantum computer core with particles of light, sci-fi concept art': 'نواة حاسوب كمومي بجسيمات ضوئية، فن مفهوم خيال علمي',
    'Honey never spoils. Archaeologists found 3000-year-old honey in Egyptian tombs that was still edible.': 'العسل لا يفسد أبداً. وجد علماء آثار عسلاً عمره 3000 عام في مقابر مصرية وكان صالحاً للأكل.',
    'The best way to predict the future is to invent it.': 'أفضل طريقة لتوقع المستقبل هي اختراعه.',
    'Alan Kay': 'آلان كاي',
    'Why do programmers prefer dark mode? Because light attracts bugs.': 'لماذا يفضل المبرمجون الوضع المظلم؟ لأن الضوء يجذب الحشرات (الأخطاء).',
    'Learn a new programming language this weekend': 'تعلم لغة برمجة جديدة هذا الأسبوع',
    'Welcome Back': 'مرحباً بعودتك',
    'Create Account': 'إنشاء حساب',
    "Don't have an account?": 'ليس لديك حساب؟',
    'Already have an account?': 'لديك حساب بالفعل؟',
    'Create One': 'أنشئ واحداً',
    'Sign In': 'تسجيل الدخول',
    'Sign up to get started with Noviq.': 'سجّل للبدء مع نوفيك.',
    'Sign in to your Noviq account.': 'سجّل الدخول إلى حسابك في نوفيك.',
    'First Name': 'الاسم الأول',
    'Last Name': 'الاسم الأخير',
    'Password': 'كلمة المرور',
    'Confirm Password': 'تأكيد كلمة المرور',
    'John': 'John',
    'Doe': 'Doe',
    'Create a strong password': 'أنشئ كلمة مرور قوية',
    'Repeat your password': 'أعد إدخال كلمة المرور',
    'Success!': 'تم بنجاح!',
    'Please fill in all fields.': 'يرجى ملء جميع الحقول.',
    'Please enter your name.': 'يرجى إدخال اسمك.',
    'Passwords do not match.': 'كلمتا المرور غير متطابقتين.',
    'Password must be at least 6 characters.': 'كلمة المرور يجب أن تكون 6 أحرف على الأقل.',
    'Login failed: ': 'فشل تسجيل الدخول: ',
    'Connection error. Please try again.': 'خطأ في الاتصال. حاول مرة أخرى.',
    'Name, email, and password are required.': 'الاسم والبريد الإلكتروني وكلمة المرور مطلوبة.',
    'Please enter a valid email address.': 'يرجى إدخال بريد إلكتروني صحيح.',
    'An account with this email already exists.': 'يوجد حساب مسجل بهذا البريد الإلكتروني بالفعل.',
    'Email and password are required.': 'البريد الإلكتروني وكلمة المرور مطلوبان.',
    'Invalid email or password.': 'البريد الإلكتروني أو كلمة المرور غير صحيحة.',
    'you@company.com': 'you@company.com',
    'My Account': 'حسابي',
    'Account type': 'نوع الحساب',
    'Member': 'عضو',
    'Contact Support': 'تواصل مع الدعم',
    'Sign Out': 'تسجيل الخروج',
    'Forgot password?': 'نسيت كلمة المرور؟',
    'Reset Password': 'إعادة تعيين كلمة المرور',
    'Enter your email and we will send you a reset code.': 'أدخل بريدك الإلكتروني وسنرسل لك رمز إعادة التعيين.',
    'Enter the 6-digit code and your new password.': 'أدخل الرمز المكون من 6 أرقام وكلمة المرور الجديدة.',
    'Reset Code': 'رمز إعادة التعيين',
    'New Password': 'كلمة المرور الجديدة',
    'Send Code': 'إرسال الرمز',
    'Back to Sign In': 'العودة لتسجيل الدخول',
    'Please enter the 6-digit code.': 'يرجى إدخال الرمز المكون من 6 أرقام.',
    'Invalid or expired reset code.': 'الرمز غير صحيح أو منتهي الصلاحية.',
    'Password updated. You can now sign in.': 'تم تحديث كلمة المرور. يمكنك الآن تسجيل الدخول.',
    'If an account exists for this email, a reset code has been sent.': 'إذا كان هناك حساب بهذا البريد، فقد تم إرسال رمز إعادة التعيين.',
    'Email, code, and new password are required.': 'البريد الإلكتروني والرمز وكلمة المرور الجديدة مطلوبة.',
    'Previous': 'السابق', 'Next': 'التالي', 'Generate Proposal': 'إنشاء العرض',
    'Your Solution Proposal': 'عرض الحل الخاص بك',
    'Generated based on your requirements': 'تم إنشاؤه بناءً على متطلباتك',
    '/mo': '/شهرياً', 'Business Type': 'نوع النشاط', 'Custom': 'مخصص',
    'Scope': 'النطاق', 'Standard': 'قياسي', 'Solutions Included': 'الحلول المضمنة',
    'Core System': 'النظام الأساسي', 'Estimated Timeline': 'المدة المتوقعة',
    '1-2 months': '1-2 شهر', '2-3 months': '2-3 أشهر', '3-5 months': '3-5 أشهر',
    '3-6 months': '3-6 أشهر', '5-8 months': '5-8 أشهر',
    'Request Meeting': 'طلب اجتماع', 'Start Over': 'البدء من جديد',
    'Select Features': 'اختر الميزات', 'Estimated Budget': 'الميزانية المتوقعة',
    'Request Detailed Quote': 'طلب عرض سعر تفصيلي',
    'Question': 'السؤال', 'of': 'من',
    'Digital Transformation Score': 'نتيجة التحول الرقمي',
    'Your business is well-positioned for digital transformation!': 'نشاطك في وضع جيد للانطلاق في التحول الرقمي!',
    "You have good foundations but there's room for improvement.": 'لديك أساس جيد، مع وجود فرص واضحة للتحسين.',
    'Starting your digital journey will unlock significant potential.': 'بدء رحلتك الرقمية سيفتح إمكانات كبيرة لأعمالك.',
    'Get Your Full Report': 'احصل على تقريرك الكامل',
    'AI Integration': 'دمج الذكاء الاصطناعي', 'Advanced Analytics': 'تحليلات متقدمة',
    'Cloud Optimization': 'تحسين السحابة', 'Process Automation': 'أتمتة العمليات',
    'Data Strategy': 'استراتيجية البيانات', 'Digital Workplace': 'بيئة عمل رقمية',
    'Digital Assessment': 'تقييم رقمي', 'Core System Upgrade': 'تحديث النظام الأساسي',
    'IT Modernization': 'تحديث تقنية المعلومات',
    'Something went wrong': 'حدث خطأ ما', 'Please try again.': 'يرجى المحاولة مرة أخرى.',
    'Type your answer...': 'اكتب إجابتك...',
    "Welcome! I'm your Noviq AI Consultant. Let me help find the perfect solution for your business.": 'مرحباً! أنا مستشار نوفيك الذكي. سأساعدك في إيجاد الحل الأنسب لأعمالك.',
    'What type of business are you in?': 'ما نوع نشاطك التجاري؟',
    'SaaS/Tech': 'البرمجيات والتقنية', 'E-commerce': 'التجارة الإلكترونية',
    'Healthcare': 'الرعاية الصحية', 'Finance': 'القطاع المالي',
    'Manufacturing': 'التصنيع', 'Education': 'التعليم', 'Other': 'أخرى',
    'How many employees does your company have?': 'كم عدد موظفي شركتك؟',
    "What's your biggest operational challenge?": 'ما أكبر تحدٍ تشغيلي تواجهه؟',
    'Manual processes': 'العمليات اليدوية', 'Data silos': 'تشتت البيانات',
    'Scaling issues': 'تحديات التوسع', 'Customer experience': 'تجربة العملاء',
    'Cost optimization': 'تحسين التكاليف', 'Not sure': 'غير متأكد',
    'What are your primary goals? (Select all that apply)': 'ما أهدافك الرئيسية؟ (اختر كل ما ينطبق)',
    'Automate workflows': 'أتمتة سير العمل', 'Improve analytics': 'تحسين التحليلات',
    'Build custom software': 'بناء برمجيات مخصصة',
    'Modernize legacy systems': 'تحديث الأنظمة القديمة',
    'AI integration': 'دمج الذكاء الاصطناعي', 'Cloud migration': 'الترحيل إلى السحابة',
    "What's your ideal timeline?": 'ما الجدول الزمني المناسب لك؟',
    'ASAP': 'في أسرع وقت', '1-3 months': '1-3 أشهر', '6-12 months': '6-12 شهراً',
    'Exploring only': 'مرحلة الاستكشاف فقط', "What's your budget range?": 'ما نطاق ميزانيتك؟',
    'Not defined': 'غير محددة', 'Continue': 'متابعة',
    "Based on your answers, here's my recommendation:": 'بناءً على إجاباتك، هذه توصيتي:',
    'Get Full Analysis': 'احصل على التحليل الكامل',
    'your business': 'نشاطك', 'your team': 'فريقك', 'operational efficiency': 'الكفاءة التشغيلية',
    'AI-Powered SaaS Platform': 'منصة SaaS مدعومة بالذكاء الاصطناعي',
    'Multi-tenant Architecture': 'بنية متعددة المستأجرين', 'AI Analytics': 'تحليلات ذكية',
    'Auto-scaling': 'توسع تلقائي', 'API-First': 'تصميم قائم على API',
    'Real-time Monitoring': 'مراقبة لحظية', 'Custom Integrations': 'تكاملات مخصصة',
    'Intelligent Commerce Engine': 'محرك تجارة ذكي', 'Personalization AI': 'تخصيص ذكي',
    'Inventory Optimization': 'تحسين المخزون', 'Dynamic Pricing': 'تسعير ديناميكي',
    'Customer 360': 'رؤية شاملة للعملاء', 'Automated Marketing': 'تسويق آلي',
    'Fraud Detection': 'كشف الاحتيال', 'Patient Intelligence Platform': 'منصة ذكاء المرضى',
    'HIPAA Compliance': 'امتثال HIPAA', 'Clinical Decision Support': 'دعم القرار السريري',
    'Patient Portal': 'بوابة المرضى', 'Interoperability': 'التشغيل البيني',
    'Predictive Analytics': 'تحليلات تنبؤية', 'Telehealth Integration': 'تكامل الرعاية عن بعد',
    'FinTech Core Banking Suite': 'منظومة مصرفية مالية متكاملة',
    'Real-time Ledger': 'دفتر حسابات لحظي', 'Risk Engine': 'محرك المخاطر',
    'Compliance Automation': 'أتمتة الامتثال', 'Open Banking APIs': 'واجهات مصرفية مفتوحة',
    'Fraud Prevention': 'منع الاحتيال', 'Regulatory Reporting': 'تقارير تنظيمية',
    'Smart Factory Platform': 'منصة مصنع ذكي', 'IoT Integration': 'تكامل إنترنت الأشياء',
    'Predictive Maintenance': 'صيانة تنبؤية', 'Quality AI': 'جودة مدعومة بالذكاء الاصطناعي',
    'Supply Chain Optimization': 'تحسين سلسلة الإمداد', 'Digital Twin': 'توأم رقمي',
    'Energy Management': 'إدارة الطاقة', 'EdTech Learning Platform': 'منصة تعليم تقني',
    'Adaptive Learning': 'تعلم تكيفي', 'Assessment AI': 'تقييم ذكي',
    'Virtual Classrooms': 'فصول افتراضية', 'Analytics Dashboard': 'لوحة تحليلات',
    'Content Management': 'إدارة المحتوى', 'Mobile-First': 'مصممة للموبايل أولاً',
    'Recommended: ': 'موصى به: ', 'for': 'لـ',
    'Based on your team profile and operational needs, we recommend a comprehensive solution with intelligent automation and real-time analytics.': 'بناءً على طبيعة فريقك واحتياجاتك التشغيلية، نوصي بحل متكامل يجمع الأتمتة الذكية والتحليلات اللحظية.',
    'Your Business Parameters': 'بيانات نشاطك', 'Employees': 'الموظفون',
    'Hours per Week per Task': 'الساعات أسبوعياً لكل مهمة', 'Hourly Rate ($)': 'سعر الساعة ($)',
    'Tasks per Week': 'المهام أسبوعياً', 'Automation Feasibility (%)': 'قابلية الأتمتة (%)',
    'Cost Comparison': 'مقارنة التكلفة', 'Manual': 'يدوي', 'With AI': 'باستخدام الذكاء الاصطناعي',
    'Annual Savings': 'التوفير السنوي', 'Efficiency Gain': 'تحسن الكفاءة',
  };

  const DO_NOT_TRANSLATE_EXACT = new Set([
    'Noviq', 'Noviq Solutions', 'NOVIQ', 'React', 'Next.js', 'Node.js', 'TypeScript',
    'Python', '.NET', 'Docker', 'Kubernetes', 'AWS', 'Azure', 'Google Cloud',
    'PostgreSQL', 'MongoDB', 'Redis', 'TensorFlow', 'PyTorch', 'OpenAI',
    'API', 'LLM', 'iOS', 'Android', 'HIPAA', 'SLA', 'ROI', 'CRM', 'ERP', 'SaaS',
    'UI/UX', 'DevOps',
    'o', 'v', 'i', 'q', 'N',
    'LinkedIn', 'X', 'GitHub',
    /* Technical abbreviations & demo labels — keep as-is */
    'OCR', 'ML', 'AI', 'GPU', 'CPU', 'TPU', 'JSON', 'XML', 'HTTP', 'HTTPS',
    'CSS', 'HTML', 'JS', 'TS', 'SQL', 'NoSQL', 'REST', 'GraphQL', 'gRPC',
    'CI/CD', 'CDN', 'DNS', 'VPN', 'SSH', 'SSL', 'TLS',
    'Groq', 'Llama-3', 'Llama', 'Tesseract.js', 'Tesseract', 'Hugging Face',
    'Web Speech API', 'TTS', 'STT', 'NLP', 'CV', 'YOLO', 'BERT', 'GPT',
    'EN', 'AR',
    /* Numbers / quantities */
    '1000+', '500+', '100+', '50+', '10+', '3x', '2x', '5x',
    /* Units */
    'ms', 'fps', 'px', 'KB', 'MB', 'GB', 'TB'
  ]);

  /* CSS selectors for elements whose text must NEVER be translated */
  const SKIP_SELECTORS = [
    /* Brand / logo */
    '.noviq-no-translate', '.no-translate',
    '.brand-logo', '.noviq-brand',
    '.noviq-logo-icon', '.noviq-auth-logo',
    '.intro-lockup', '.intro-letter', '.intro-wordmark',
    '#noviq-intro-overlay',
    '.noviq-client-name', '.noviq-client-logo',
    /* Dynamic content — numbers, counters, stats */
    '.noviq-stat-number', '.noviq-stat-label', '.noviq-stat',
    '[data-counter]', '[data-to]', '[data-suffix]',
    '.noviq-hero-badge',
    '.nv-bot-status', '.nv-chat-statusline', '.nv-cap-stat',
    /* Typewriter / hero text */
    '.noviq-typewriter', '.typewriter',
    '.noviq-typewriter-text', '#hero-badge-text',
    '.noviq-typewriter-cursor',
    '#noviq-typewriter-text',
    /* Misc dynamic */
    '.noviq-stack-chip',
    '.noviq-social-link',
    '.slider-header', '.proposal-header',
    'svg text'
  ].join(', ');

  const ARABIC_RE = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;

  function shouldSkipTranslation(str, element) {
    if (typeof str === 'string') {
      const trimmed = str.trim();
      if (DO_NOT_TRANSLATE_EXACT.has(trimmed)) return true;
      if (/^\S+@\S+\.\S+$/.test(trimmed)) return true;
      if (/^https?:\/\//.test(trimmed)) return true;
      /* Single character — likely a logo letter */
      if (trimmed.length === 1) return true;
      /* Already Arabic — don't send to en→ar API */
      if (ARABIC_RE.test(trimmed)) return true;
      /* Very short strings (<=3 chars) — likely abbreviations/codes */
      if (trimmed.length <= 3) return true;
      /* Contains digits — numbers/quantities shouldn't be translated */
      if (/\d/.test(trimmed)) return true;
      /* All-caps acronym (2-6 chars, no lowercase) — OCR, AI, ML, API, GPU */
      if (/^[A-Z]{2,6}$/.test(trimmed)) return true;
    }
    if (element && element.closest) {
      try {
        if (element.closest(SKIP_SELECTORS)) return true;
      } catch (e) {}
    }
    return false;
  }

  const API_CACHE_KEY = 'noviq_translation_cache_v1';
  let apiTranslationCache = {};
  try {
    apiTranslationCache = JSON.parse(localStorage.getItem(API_CACHE_KEY) || '{}') || {};
  } catch {}

  function saveApiCache() {
    try {
      localStorage.setItem(API_CACHE_KEY, JSON.stringify(apiTranslationCache));
    } catch {}
  }

  const pendingTranslations = new Map();
  /* ── Rate-limit queue for MyMemory API (avoid 429) ── */
  const API_QUEUE = [];
  let API_PROCESSING = false;
  const API_DELAY_MS = 1500; /* gap between requests */
  const API_MAX_RETRY = 2;
  let API_CIRCUIT_OPEN = false; /* circuit breaker */
  let API_CIRCUIT_RESET_AT = 0; /* timestamp when breaker resets */
  let API_429_STREAK = 0; /* consecutive 429s */

  function processApiQueue() {
    if (API_PROCESSING || API_QUEUE.length === 0) return;

    /* Circuit breaker: if open, wait until reset time */
    if (API_CIRCUIT_OPEN) {
      const now = Date.now();
      if (now < API_CIRCUIT_RESET_AT) {
        const wait = API_CIRCUIT_RESET_AT - now;
        setTimeout(processApiQueue, wait);
        return;
      }
      /* Reset breaker */
      API_CIRCUIT_OPEN = false;
      API_429_STREAK = 0;
    }

    API_PROCESSING = true;
    const job = API_QUEUE.shift();
    const { clean, url, retryCount } = job;

    fetch(url)
      .then(res => {
        /* On 429, wait longer and retry (up to API_MAX_RETRY) */
        if (res.status === 429) {
          API_429_STREAK++;
          /* If 3+ consecutive 429s, open circuit breaker for 60s */
          if (API_429_STREAK >= 3) {
            API_CIRCUIT_OPEN = true;
            API_CIRCUIT_RESET_AT = Date.now() + 60000;
            /* Drop all pending jobs — circuit is tripped */
            API_QUEUE.length = 0;
            pendingTranslations.clear();
            API_PROCESSING = false;
            return null;
          }
          if (retryCount < API_MAX_RETRY) {
            const backoff = 3000 * (retryCount + 1);
            API_QUEUE.unshift({ clean, url, retryCount: retryCount + 1 });
            setTimeout(() => {
              API_PROCESSING = false;
              processApiQueue();
            }, backoff);
            return null;
          }
        }
        if (!res.ok) return null;
        return res.json();
      })
      .then(data => {
        if (data) {
          /* Successful response — reset streak */
          API_429_STREAK = 0;
          let trans = data && data.responseData && data.responseData.translatedText;
          if (trans && trans !== clean && !trans.includes('MYMEMORY WARNING')) {
            apiTranslationCache[clean] = trans;
            saveApiCache();
            const callbacks = pendingTranslations.get(clean) || [];
            pendingTranslations.delete(clean);
            callbacks.forEach(cb => cb(trans));
          } else {
            pendingTranslations.delete(clean);
          }
        }
        API_PROCESSING = false;
        /* Schedule next request after delay */
        if (API_QUEUE.length > 0) {
          setTimeout(processApiQueue, API_DELAY_MS);
        }
      })
      .catch(() => {
        pendingTranslations.delete(clean);
        API_PROCESSING = false;
        if (API_QUEUE.length > 0) {
          setTimeout(processApiQueue, API_DELAY_MS);
        }
      });
  }

  function translateViaAPI(text, callback) {
    if (!text || typeof text !== 'string') return;
    const clean = text.trim();
    if (!clean || shouldSkipTranslation(clean)) return;

    if (apiTranslationCache[clean]) {
      callback(apiTranslationCache[clean]);
      return;
    }

    if (pendingTranslations.has(clean)) {
      pendingTranslations.get(clean).push(callback);
      return;
    }

    pendingTranslations.set(clean, [callback]);

    const url = 'https://api.mymemory.translated.net/get?q=' + encodeURIComponent(clean) + '&langpair=en|ar';
    API_QUEUE.push({ clean, url, retryCount: 0 });
    /* Start processing if idle */
    if (!API_PROCESSING) processApiQueue();
  }

  const SPA_STRINGS_LOWER = {};
  for (const k in SPA_STRINGS) {
    SPA_STRINGS_LOWER[k.toLowerCase()] = SPA_STRINGS[k];
  }

  function t(str, element) {
    if (typeof str !== 'string') return str;
    if (!isArabic()) return str;
    const trimmed = str.trim();
    if (!trimmed) return str;
    if (shouldSkipTranslation(trimmed, element)) return str;

    if (SPA_STRINGS[trimmed] !== undefined) {
      return str.replace(trimmed, SPA_STRINGS[trimmed]);
    }
    const lower = trimmed.toLowerCase();
    if (SPA_STRINGS_LOWER[lower] !== undefined) {
      return str.replace(trimmed, SPA_STRINGS_LOWER[lower]);
    }

    /* Case-insensitive or normalized punctuation check */
    const cleanKey = trimmed.replace(/[:!?.,]$/, '');
    if (SPA_STRINGS[cleanKey] !== undefined) {
      const punct = trimmed.slice(cleanKey.length);
      return str.replace(trimmed, SPA_STRINGS[cleanKey] + punct);
    }
    const cleanLower = cleanKey.toLowerCase();
    if (SPA_STRINGS_LOWER[cleanLower] !== undefined) {
      const punct = trimmed.slice(cleanKey.length);
      return str.replace(trimmed, SPA_STRINGS_LOWER[cleanLower] + punct);
    }

    if (apiTranslationCache[trimmed]) {
      return str.replace(trimmed, apiTranslationCache[trimmed]);
    }
    return str;
  }

  function autoTranslateAttributes(scope) {
    const isAr = isArabic();
    const root = scope || document.body;
    
    // Placeholders
    const inputs = root.querySelectorAll('input[placeholder], textarea[placeholder]');
    inputs.forEach(el => {
      const ph = el.getAttribute('placeholder');
      if (isAr) {
        const source = el._enPlaceholder || ph;
        if (source && !shouldSkipTranslation(source, el)) {
          const trans = t(source, el);
          if (trans !== source) {
            if (!el._enPlaceholder) el._enPlaceholder = source;
            el.setAttribute('placeholder', trans);
          } else {
            translateViaAPI(source, (apiTrans) => {
              if (isArabic() && el.getAttribute('placeholder') === source) {
                if (!el._enPlaceholder) el._enPlaceholder = source;
                el.setAttribute('placeholder', apiTrans);
              }
            });
          }
        }
      } else if (el._enPlaceholder) {
        el.setAttribute('placeholder', el._enPlaceholder);
        delete el._enPlaceholder;
      }
    });

    // Aria labels
    const labelled = root.querySelectorAll('[aria-label]');
    labelled.forEach(el => {
      const aria = el.getAttribute('aria-label');
      if (isAr && aria) {
        const source = el._enAriaLabel || aria;
        if (source && !shouldSkipTranslation(source, el)) {
          const trans = t(source, el);
          if (trans !== source) {
            if (!el._enAriaLabel) el._enAriaLabel = source;
            el.setAttribute('aria-label', trans);
          }
        }
      } else if (!isAr && el._enAriaLabel) {
        el.setAttribute('aria-label', el._enAriaLabel);
        delete el._enAriaLabel;
      }
    });
  }

  function localizeTextNode(node) {
    const isAr = isArabic();
    const raw = node.nodeValue;
    if (!raw) return;
    const trimmed = raw.trim();
    if (!trimmed) return;
    const parent = node.parentElement;

    if (isAr) {
      if (shouldSkipTranslation(trimmed, parent)) return;
      const source = node._enOriginalText !== undefined ? node._enOriginalText : raw;
      const translated = t(source, parent);
      if (translated !== source) {
        if (node._enOriginalText === undefined) node._enOriginalText = raw;
        node.nodeValue = translated;
      } else {
        /* Async Translation API Fallback for custom unmapped texts */
        const sourceClean = source.trim();
        if (apiTranslationCache[sourceClean]) {
          if (node._enOriginalText === undefined) node._enOriginalText = raw;
          node.nodeValue = node.nodeValue.replace(sourceClean, apiTranslationCache[sourceClean]);
        } else {
          translateViaAPI(sourceClean, (apiTranslated) => {
            if (isArabic() && node.parentElement) {
              if (node._enOriginalText === undefined) node._enOriginalText = raw;
              node.nodeValue = node.nodeValue.replace(sourceClean, apiTranslated);
            }
          });
        }
      }
    } else {
      if (node._enOriginalText !== undefined) {
        node.nodeValue = node._enOriginalText;
        delete node._enOriginalText;
      }
    }
  }

  function localizeStaticPage(root) {
    const scope = root || document.getElementById('app-main') || document.body;
    const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = node.parentElement;
        if (!parent || ['SCRIPT', 'STYLE', 'SVG', 'INPUT', 'TEXTAREA', 'CODE', 'PRE'].includes(parent.tagName)) {
          return NodeFilter.FILTER_REJECT;
        }
        if (shouldSkipTranslation(node.nodeValue, parent)) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(localizeTextNode);

    autoTranslateAttributes(scope);
  }

  function getLatestEnglishContent() {
    if (!englishContent && window.NOVIQ_CONTENT) {
      englishContent = copy(window.NOVIQ_CONTENT);
    }
    const base = copy(englishContent || {});
    try {
      const overrides = JSON.parse(localStorage.getItem('noviq_content_overrides') || '{}') || {};
      for (const k in overrides) {
        if (k === 'promptBuilder' && base.promptBuilder) {
          base.promptBuilder = Object.assign({}, base.promptBuilder, overrides.promptBuilder);
        } else {
          base[k] = copy(overrides[k]);
        }
      }
    } catch (e) {}
    return base;
  }

  function applyLanguage(language, shouldReload) {
    const latestEn = getLatestEnglishContent();
    const useArabic = language === 'ar';
    const arStatic = window.NOVIQ_CONTENT_AR || {};

    const next = copy(latestEn);

    if (useArabic) {
      /* Clients & Stack: Admin structure & items preserved 1:1.
         Brand names and tech names stay intact. */
      if (Array.isArray(latestEn.clients)) next.clients = copy(latestEn.clients);
      if (Array.isArray(latestEn.stack)) next.stack = copy(latestEn.stack);

      /* Array sections: services, industries, why, process, testimonials, stats, projects */
      const AR_ARRAY_SECTIONS = ['services', 'industries', 'why', 'process', 'testimonials', 'stats', 'projects'];
      const TEXT_FIELDS = ['title', 'desc', 'label', 'tag', 'challenge', 'solution', 'results', 'eyebrow', 'quote', 'role'];

      AR_ARRAY_SECTIONS.forEach(function (key) {
        const enArr = latestEn[key];
        if (!Array.isArray(enArr)) return;
        next[key] = enArr.map(function (enItem, i) {
          if (!enItem || typeof enItem !== 'object') return enItem;
          const merged = copy(enItem);
          TEXT_FIELDS.forEach(function (field) {
            const arField = field + 'Ar';
            if (enItem[arField]) {                                 /* 1. Admin *Ar */
              merged[field] = enItem[arField];
            } else if (typeof enItem[field] === 'string' && enItem[field]) {
              const trans = t(enItem[field]);                      /* 2. SPA_STRINS */
              if (trans !== enItem[field]) merged[field] = trans;
            }
          });
          return merged;
        });
      });

      /* ── Nested wizard sections: aiConsultant.flow, assessment.questions,
            costEstimator.features, solutionBuilder.steps ──
            These have 'question'/'label'/'title'/'desc' string fields
            plus 'options' arrays (of strings or objects with .label). */
      const AR_WIZARD_SECTIONS = [
        { enKey: 'aiConsultant', arKey: 'aiConsultant', arrField: 'flow',
          textFields: ['question'], optionsField: 'options' },
        { enKey: 'assessment', arKey: 'assessment', arrField: 'questions',
          textFields: ['question'], optionsField: 'options' },
        { enKey: 'costEstimator', arKey: 'costEstimator', arrField: 'features',
          textFields: ['label'], optionsField: null },
        { enKey: 'solutionBuilder', arKey: 'solutionBuilder', arrField: 'steps',
          textFields: ['label', 'title', 'desc'], optionsField: 'options' }
      ];

      AR_WIZARD_SECTIONS.forEach(function (cfg) {
        const enRoot = latestEn[cfg.enKey];
        if (!enRoot || typeof enRoot !== 'object') return;
        const enArr = enRoot[cfg.arrField];
        if (!Array.isArray(enArr)) return;

        const mergedRoot = copy(enRoot);
        mergedRoot[cfg.arrField] = enArr.map(function (enItem, i) {
          if (!enItem || typeof enItem !== 'object') return enItem;
          const merged = copy(enItem);

          /* Translate text fields: question, label, title, desc — only via *Ar */
          cfg.textFields.forEach(function (field) {
            const arField = field + 'Ar';
            if (enItem[arField]) {
              merged[field] = enItem[arField];
            }
          });

          /* Translate options array (strings or {label, value} objects) — only via *Ar */
          if (cfg.optionsField && Array.isArray(enItem[cfg.optionsField])) {
            const enOpts = enItem[cfg.optionsField];
            merged[cfg.optionsField] = enOpts.map(function (opt, oi) {
              if (typeof opt === 'string') {
                if (shouldSkipTranslation(opt)) return opt;
                return opt; /* keep English — no *Ar for primitive options */
              }
              if (opt && typeof opt === 'object' && opt.label) {
                const m = copy(opt);
                const arField = 'labelAr';
                if (enItem[arField]) {
                  m.label = enItem[arField];
                }
                return m;
              }
              return opt;
            });
          }
          return merged;
        });
        next[cfg.enKey] = mergedRoot;
      });

      /* Object sections: footer, hero, brand, contact, and all section headers */
      const AR_OBJECTS = [
        'footer', 'hero', 'brand', 'contact',
        'servicesHeader', 'clientsHeader', 'whyHeader', 'industriesHeader',
        'portfolioHeader', 'processHeader', 'testimonialsHeader', 'stackHeader'
      ];
      AR_OBJECTS.forEach(function (key) {
        const enObj = latestEn[key];
        const arObj = arStatic[key] || {};
        if (!enObj || typeof enObj !== 'object' || Array.isArray(enObj)) return;
        const merged = copy(enObj);
        for (const field in enObj) {
          const arField = field + 'Ar';
          if (enObj[arField]) {                                     /* 1. Admin *Ar */
            merged[field] = enObj[arField];
          } else if (typeof enObj[field] === 'string' && enObj[field]) {
            const trans = t(enObj[field]);                          /* 2. SPA_STRINS */
            if (trans !== enObj[field]) {
              merged[field] = trans;
            } else if (arObj[field]) {                              /* 3. content.ar.js */
              merged[field] = arObj[field];
            }
          }
        }
        if (key === 'footer' && Array.isArray(merged.columns)) {
          merged.columns = merged.columns.map(function (col, ci) {
            const enCol = enObj.columns ? enObj.columns[ci] : {};
            const arCol = (arObj && Array.isArray(arObj.columns)) ? (arObj.columns[ci] || {}) : {};
            const m = copy(col);
            if (enCol.titleAr) m.title = enCol.titleAr;
            else if (m.title) {
              const trans = t(m.title);
              if (trans !== m.title) m.title = trans;
              else if (arCol.title) m.title = arCol.title;
            }

            if (Array.isArray(m.links)) {
              m.links = m.links.map(function (link, li) {
                const enLink = enCol.links ? enCol.links[li] : null;
                const arLink = arCol.links ? arCol.links[li] : null;
                if (typeof link === 'string') {
                  const trans = t(link);
                  if (trans !== link) return trans;
                  if (arLink && typeof arLink === 'string') return arLink;
                  return link;
                }
                const lm = copy(link);
                if (enLink && enLink.textAr) lm.text = enLink.textAr;
                else if (lm.text) {
                  const trans = t(lm.text);
                  if (trans !== lm.text) lm.text = trans;
                  else if (arLink && arLink.text) lm.text = arLink.text;
                }
                return lm;
              });
            }
            return m;
          });
        }
        next[key] = merged;
      });
    }

    /* Mutate window.NOVIQ_CONTENT in place */
    const live = window.NOVIQ_CONTENT;
    if (live && typeof live === 'object') {
      Object.keys(live).forEach(key => { delete live[key]; });
      Object.assign(live, next);
    } else {
      window.NOVIQ_CONTENT = next;
    }

    document.documentElement.lang = useArabic ? 'ar' : 'en';
    document.documentElement.dir = useArabic ? 'rtl' : 'ltr';
    document.body.classList.toggle('noviq-rtl', useArabic);

    try { localStorage.setItem(STORAGE_KEY, useArabic ? 'ar' : 'en'); } catch {}
    document.title = useArabic ? 'نوفيك — هندسة المستقبل بالتقنية' : 'Noviq — Engineering the Future Through Technology';

    updateLanguageToggle();
    updatePlaceholders(useArabic);

    if (typeof buildStaticContent === 'function') {
      try { buildStaticContent(); } catch (e) {}
    }
    if (typeof initLazyBuilds === 'function') {
      try { initLazyBuilds(); } catch (e) {}
    }

    localizeStaticPage(document.body);
  }

  function updateLanguageToggle() {
    const toggle = document.getElementById('language-toggle');
    if (!toggle) return;
    const isAr = isArabic();
    const langCode = isAr ? 'EN' : 'ع';
    const langFull = isAr ? 'English' : 'العربية';
    toggle.innerHTML = '<span class="lang-globe" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg></span><span class="lang-code">' + langCode + '</span>';
    toggle.setAttribute('aria-label', isAr ? 'Switch to English' : 'التبديل إلى العربية');
    toggle.setAttribute('title', langFull);
  }

  function updatePlaceholders(useArabic) {
    const labels = useArabic ? {
      search: 'ابحث...', name: 'الاسم الكامل', email: 'البريد الإلكتروني للعمل', company: 'الشركة',
      message: 'أخبرنا عن مشروعك', newsletter: 'أدخل بريدك الإلكتروني', scroll: 'مرر للأسفل',
      intro: 'برمجيات مصممة للمضي قدماً.'
    } : {
      search: 'Search...', name: 'Full name', email: 'Work email', company: 'Company',
      message: 'Tell us about your project', newsletter: 'you@company.com', scroll: 'SCROLL',
      intro: 'Software, engineered forward.'
    };
    const set = (selector, property, value) => {
      const el = document.querySelector(selector);
      if (el) el[property] = value;
    };
    set('#header-search-input', 'placeholder', labels.search);
    set('#c-name', 'placeholder', labels.name);
    set('#c-email', 'placeholder', labels.email);
    set('#c-company', 'placeholder', labels.company);
    set('#c-message', 'placeholder', labels.message);
    set('#newsletter-email', 'placeholder', labels.newsletter);
    set('.noviq-scroll-hint span', 'textContent', labels.scroll);
    set('.intro-tagline', 'textContent', labels.intro);
  }

  function switchLanguage() {
    applyLanguage(isArabic() ? 'en' : 'ar', false);
    window.location.reload();
  }

  window.NoviqI18n = {
    applyLanguage,
    isArabic,
    getLanguage,
    localizeStaticPage,
    t
  };
  window.t = t;

  /* Apply the saved language IMMEDIATELY (this script loads after the
     content files at the end of <body>) so NOVIQ_CONTENT is already
     localized before any builder or deferred script runs. */
  try { applyLanguage(getLanguage(), false); }
  catch (e) { console.warn('[i18n] early apply failed:', e); }

  document.addEventListener('DOMContentLoaded', () => {
    applyLanguage(getLanguage(), false);
    const toggle = document.getElementById('language-toggle');
    if (toggle) {
      toggle.addEventListener('click', switchLanguage);
    }

    const appMain = document.getElementById('app-main') || document.body;
    if (appMain) {
      let observerTickScheduled = false;
      let observerTickPending = false;
      const observer = new MutationObserver(() => {
        if (!isArabic()) return;
        if (observerTickScheduled || observerTickPending) return;
        observerTickScheduled = true;
        setTimeout(() => {
          observerTickScheduled = false;
          /* Prevent re-entrancy: localizeStaticPage mutates nodeValue
             which triggers the observer again. Pause observation
             during the localization pass. */
          observerTickPending = true;
          observer.disconnect();
          try { localizeStaticPage(appMain); }
          catch (e) { console.warn('[i18n] localizeStaticPage failed:', e); }
          finally {
            observerTickPending = false;
            observer.observe(appMain, { childList: true, subtree: true });
          }
        }, 50);
      });
      observer.observe(appMain, { childList: true, subtree: true });
    }
  }, { once: true });
})();
