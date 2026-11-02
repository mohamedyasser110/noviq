/* ============================================================
   NOVIQ CHATBOT KNOWLEDGE BASE
   ------------------------------------------------------------
   Intent map with 1000+ keywords (English + Arabic).
   Answers are generated in engine.js with live database data.
   ============================================================ */

const INTENTS = {
  greeting: {
    en: ['hello', 'hi', 'hey', 'good morning', 'good afternoon', 'good evening', 'greetings', 'howdy', 'yo', 'hiya', 'whats up', "what's up", 'sup', 'hello there', 'hi there', 'hey there', 'good day', 'morning', 'evening', 'salutations', 'hola', 'bonjour'],
    ar: ['مرحبا', 'اهلا', 'أهلا', 'اهلين', 'أهلين', 'هلا', 'السلام عليكم', 'سلام', 'صباح الخير', 'مساء الخير', 'صباح النور', 'مساء النور', 'حياك', 'حياكم', 'يا هلا', 'اهلا وسهلا', 'أهلاً وسهلاً', 'تحية طيبة', 'مرحبتين', 'هاي', 'هلو', 'ازيك', 'إزيك', 'ازيكم', 'شلونك', 'كيفك', 'عامل ايه', 'عامل إيه'],
  },
  goodbye: {
    en: ['bye', 'goodbye', 'see you', 'see ya', 'later', 'farewell', 'take care', 'im leaving', 'gotta go', 'good night', 'bye bye', 'catch you later', 'im done', 'that is all', "that's all", 'exit', 'quit', 'close chat', 'end chat', 'thanks bye'],
    ar: ['وداعا', 'وداعاً', 'مع السلامة', 'الى اللقاء', 'إلى اللقاء', 'باي', 'باي باي', 'تصبح على خير', 'اشوفك', 'أشوفك', 'سلام عليكم', 'استودعك الله', 'خلاص شكرا', 'انتهيت', 'اغلاق المحادثة', 'إنهاء المحادثة', 'اقفل الشات', 'يعطيك العافية وداعا'],
  },
  thanks: {
    en: ['thanks', 'thank you', 'thx', 'ty', 'appreciate it', 'much appreciated', 'thanks a lot', 'thank you so much', 'thanks so much', 'grateful', 'cheers', 'awesome thanks', 'great thanks', 'perfect thanks', 'thanks for the help', 'thank u', 'many thanks', 'thanks alot'],
    ar: ['شكرا', 'شكراً', 'شكرا جزيلا', 'شكراً جزيلاً', 'الف شكر', 'ألف شكر', 'مشكور', 'مشكورين', 'تسلم', 'تسلموا', 'يعطيك العافية', 'جزاك الله خير', 'جزاكم الله خيرا', 'ممتن', 'ممتنة', 'كل الشكر', 'اشكرك', 'أشكرك', 'اشكركم', 'ما قصرت', 'ما قصرتوا'],
  },
  help: {
    en: ['help', 'help me', 'i need help', 'can you help', 'assist', 'assistance', 'support me', 'what can you do', 'what do you do', 'how can you help', 'options', 'menu', 'commands', 'guide me', 'im lost', 'confused', 'where do i start', 'how does this work', 'what is this', 'capabilities', 'features of this bot', 'show me around'],
    ar: ['مساعدة', 'ساعدني', 'ساعديني', 'محتاج مساعدة', 'أحتاج مساعدة', 'ممكن تساعدني', 'ايش تقدر تسوي', 'إيش تقدر تسوي', 'ماذا يمكنك ان تفعل', 'ماذا تستطيع', 'كيف تساعدني', 'الخيارات', 'القائمة', 'الاوامر', 'الأوامر', 'دليل', 'انا تايه', 'أنا تائه', 'مش فاهم', 'لا افهم', 'من اين ابدا', 'من أين أبدأ', 'كيف يعمل هذا', 'ما هذا', 'وش تسوي', 'شو بتعمل'],
  },
  bot_identity: {
    en: ['who are you', 'what are you', 'are you a bot', 'are you human', 'are you real', 'are you ai', 'your name', 'whats your name', "what's your name", 'who made you', 'who built you', 'who created you', 'introduce yourself', 'tell me about yourself', 'are you chatgpt', 'are you a robot', 'real person', 'talk to human', 'human agent', 'real agent', 'speak to someone', 'live agent'],
    ar: ['من انت', 'من أنت', 'ما انت', 'ما أنت', 'هل انت روبوت', 'هل أنت روبوت', 'هل انت انسان', 'هل أنت إنسان', 'هل انت ذكاء اصطناعي', 'ما اسمك', 'شو اسمك', 'وش اسمك', 'من صنعك', 'من برمجك', 'من انشأك', 'عرف نفسك', 'عرفني بنفسك', 'تكلم عن نفسك', 'هل انت شات جي بي تي', 'اريد التحدث مع انسان', 'أريد التحدث مع إنسان', 'موظف حقيقي', 'شخص حقيقي', 'خدمة العملاء البشرية'],
  },
  services_overview: {
    en: ['services', 'what services', 'your services', 'list services', 'all services', 'service list', 'what do you offer', 'offerings', 'what do you provide', 'solutions', 'your solutions', 'products', 'your products', 'what do you build', 'what do you make', 'capabilities', 'expertise', 'specialties', 'what are you good at', 'areas of work', 'scope of work', 'portfolio of services', 'service catalog', 'catalogue'],
    ar: ['الخدمات', 'خدماتكم', 'خدماتك', 'ما هي خدماتكم', 'قائمة الخدمات', 'كل الخدمات', 'ماذا تقدمون', 'وش تقدمون', 'شو بتقدموا', 'الحلول', 'حلولكم', 'منتجاتكم', 'المنتجات', 'ماذا تبنون', 'ايش تسوون', 'إيش تسوون', 'تخصصاتكم', 'خبراتكم', 'مجالات عملكم', 'نطاق العمل', 'كتالوج الخدمات', 'ما الذي تقدمه الشركة', 'ايه الخدمات', 'إيه الخدمات'],
  },
  service_ai: {
    en: ['ai solutions', 'artificial intelligence', 'machine learning', 'ml', 'deep learning', 'ai model', 'ai models', 'custom ai', 'llm', 'large language model', 'gpt integration', 'openai integration', 'chatbot development', 'build a chatbot', 'ai chatbot', 'nlp', 'natural language processing', 'computer vision', 'image recognition', 'predictive analytics', 'ai automation', 'intelligent automation', 'neural network', 'data science', 'ai consulting', 'generative ai', 'ai agent', 'ai agents', 'rag', 'fine tuning', 'ai integration'],
    ar: ['الذكاء الاصطناعي', 'ذكاء اصطناعي', 'حلول الذكاء الاصطناعي', 'تعلم الالة', 'تعلم الآلة', 'التعلم العميق', 'نموذج ذكاء', 'نماذج ذكاء اصطناعي', 'ذكاء اصطناعي مخصص', 'نماذج لغوية', 'شات بوت', 'بناء شات بوت', 'روبوت محادثة', 'معالجة اللغة الطبيعية', 'رؤية حاسوبية', 'التعرف على الصور', 'تحليلات تنبؤية', 'اتمتة ذكية', 'أتمتة ذكية', 'شبكات عصبية', 'علم البيانات', 'استشارات ذكاء اصطناعي', 'ذكاء اصطناعي توليدي', 'وكيل ذكي', 'وكلاء اذكياء', 'دمج الذكاء الاصطناعي'],
  },
  service_erp: {
    en: ['erp', 'erp system', 'erp systems', 'enterprise resource planning', 'erp software', 'erp solution', 'erp implementation', 'odoo', 'sap alternative', 'inventory management', 'inventory system', 'warehouse management', 'accounting system', 'finance system', 'hr system', 'payroll system', 'procurement system', 'supply chain system', 'operations platform', 'business management system', 'company management software', 'resource planning'],
    ar: ['نظام تخطيط الموارد', 'انظمة erp', 'أنظمة erp', 'نظام erp', 'اي ار بي', 'تخطيط موارد المؤسسات', 'نظام محاسبة', 'نظام محاسبي', 'برنامج محاسبة', 'ادارة المخزون', 'إدارة المخزون', 'نظام مخزون', 'ادارة المستودعات', 'إدارة المستودعات', 'نظام موارد بشرية', 'نظام رواتب', 'نظام مشتريات', 'سلسلة الامداد', 'سلسلة الإمداد', 'نظام ادارة الشركة', 'نظام إدارة الأعمال', 'برنامج ادارة شركة', 'اودو'],
  },
  service_crm: {
    en: ['crm', 'crm system', 'crm platform', 'customer relationship management', 'crm software', 'sales system', 'sales pipeline', 'lead management', 'customer management', 'client management', 'contact management', 'sales automation', 'customer tracking', 'salesforce alternative', 'hubspot alternative', 'customer database', 'client database', 'ticketing system', 'customer support system', 'helpdesk system'],
    ar: ['ادارة علاقات العملاء', 'إدارة علاقات العملاء', 'نظام crm', 'سي ار ام', 'برنامج مبيعات', 'نظام مبيعات', 'ادارة المبيعات', 'إدارة المبيعات', 'ادارة العملاء', 'إدارة العملاء', 'متابعة العملاء', 'قاعدة بيانات العملاء', 'ادارة العملاء المحتملين', 'إدارة العملاء المحتملين', 'اتمتة المبيعات', 'أتمتة المبيعات', 'نظام تذاكر', 'نظام دعم العملاء', 'خدمة العملاء نظام'],
  },
  service_cloud: {
    en: ['cloud', 'cloud solutions', 'cloud services', 'cloud migration', 'move to cloud', 'aws', 'amazon web services', 'azure', 'google cloud', 'gcp', 'cloud infrastructure', 'cloud hosting', 'cloud architecture', 'devops', 'kubernetes', 'docker', 'containers', 'serverless', 'cloud native', 'infrastructure as code', 'terraform', 'ci cd', 'cicd', 'auto scaling', 'load balancing', 'cloud security', 'cloud backup', 'disaster recovery'],
    ar: ['السحابة', 'الحلول السحابية', 'خدمات سحابية', 'الترحيل السحابي', 'الانتقال للسحابة', 'امازون ويب', 'أمازون', 'ازور', 'أزور', 'جوجل كلاود', 'بنية تحتية سحابية', 'استضافة سحابية', 'معمارية سحابية', 'ديف اوبس', 'كوبرنيتس', 'دوكر', 'حاويات', 'بدون خوادم', 'البنية التحتية ككود', 'التوسع التلقائي', 'موازنة الاحمال', 'موازنة الأحمال', 'امن السحابة', 'أمن السحابة', 'نسخ احتياطي سحابي', 'التعافي من الكوارث'],
  },
  service_saas: {
    en: ['saas', 'saas development', 'saas product', 'saas platform', 'software as a service', 'build a saas', 'multi tenant', 'multitenant', 'subscription software', 'subscription platform', 'saas mvp', 'launch saas', 'saas startup', 'recurring revenue product', 'b2b saas', 'b2c saas', 'saas application'],
    ar: ['ساس', 'منتج ساس', 'منصة ساس', 'البرمجيات كخدمة', 'بناء منصة اشتراكات', 'منصة اشتراك', 'برنامج اشتراكات', 'متعدد المستأجرين', 'منتج اشتراك شهري', 'اطلاق منصة', 'إطلاق منصة', 'مشروع ساس', 'منصة خدمية', 'تطبيق سحابي بالاشتراك'],
  },
  service_web: {
    en: ['website', 'web development', 'web app', 'web application', 'build a website', 'make a website', 'web design', 'frontend', 'front end', 'backend', 'back end', 'full stack', 'react', 'nextjs', 'next.js', 'landing page', 'ecommerce website', 'online store', 'web portal', 'company website', 'corporate website', 'responsive website', 'progressive web app', 'pwa', 'website redesign', 'revamp website', 'dashboard development', 'admin panel'],
    ar: ['موقع', 'موقع الكتروني', 'موقع إلكتروني', 'تطوير مواقع', 'تصميم مواقع', 'تطبيق ويب', 'بناء موقع', 'انشاء موقع', 'إنشاء موقع', 'اعمل موقع', 'واجهة امامية', 'واجهة أمامية', 'واجهة خلفية', 'فل ستاك', 'رياكت', 'صفحة هبوط', 'متجر الكتروني', 'متجر إلكتروني', 'متجر اونلاين', 'أونلاين', 'بوابة الكترونية', 'موقع شركة', 'موقع تجاري', 'موقع متجاوب', 'اعادة تصميم موقع', 'إعادة تصميم الموقع', 'لوحة تحكم', 'داشبورد'],
  },
  service_mobile: {
    en: ['mobile app', 'mobile application', 'ios app', 'android app', 'app development', 'build an app', 'make an app', 'iphone app', 'flutter', 'react native', 'cross platform app', 'native app', 'app store', 'google play', 'mobile development', 'smartphone app', 'tablet app', 'app design', 'app idea', 'publish app'],
    ar: ['تطبيق جوال', 'تطبيق موبايل', 'تطبيقات الجوال', 'تطبيقات موبايل', 'تطبيق ايفون', 'تطبيق آيفون', 'تطبيق اندرويد', 'تطبيق أندرويد', 'تطوير تطبيقات', 'بناء تطبيق', 'انشاء تطبيق', 'إنشاء تطبيق', 'اعمل تطبيق', 'أعمل تطبيق', 'فلاتر', 'رياكت نيتف', 'تطبيق هجين', 'تطبيق اصلي', 'متجر التطبيقات', 'جوجل بلاي', 'اب ستور', 'آب ستور', 'فكرة تطبيق', 'نشر تطبيق', 'تصميم تطبيق'],
  },
  service_api: {
    en: ['api', 'api development', 'rest api', 'restful', 'graphql', 'api integration', 'third party integration', 'webhook', 'webhooks', 'microservices', 'api gateway', 'api documentation', 'swagger', 'openapi', 'payment integration', 'stripe integration', 'paypal integration', 'sms integration', 'whatsapp integration', 'integrate systems', 'connect systems', 'system integration'],
    ar: ['واجهة برمجية', 'واجهات برمجية', 'تطوير api', 'ربط الانظمة', 'ربط الأنظمة', 'تكامل الانظمة', 'تكامل الأنظمة', 'تكامل خارجي', 'ويب هوك', 'خدمات مصغرة', 'بوابة برمجية', 'توثيق برمجي', 'ربط الدفع', 'بوابة دفع', 'تكامل الدفع', 'ربط سترايب', 'ربط باي بال', 'ربط الرسائل', 'ربط واتساب', 'تكامل واتساب', 'ربط نظامين', 'دمج الانظمة', 'دمج الأنظمة'],
  },
  service_automation: {
    en: ['automation', 'automate', 'workflow automation', 'process automation', 'rpa', 'robotic process automation', 'automate tasks', 'automate workflow', 'automate business', 'reduce manual work', 'eliminate manual', 'streamline operations', 'streamline processes', 'business process', 'bpm', 'zapier alternative', 'automated reports', 'auto reports', 'scheduled tasks', 'automatic emails'],
    ar: ['اتمتة', 'أتمتة', 'الاتمتة', 'الأتمتة', 'اتمتة العمليات', 'أتمتة العمليات', 'اتمتة سير العمل', 'أتمتة سير العمل', 'اتمتة المهام', 'أتمتة المهام', 'تشغيل تلقائي', 'تقليل العمل اليدوي', 'الغاء العمل اليدوي', 'إلغاء العمل اليدوي', 'تبسيط العمليات', 'تحسين العمليات', 'عمليات الاعمال', 'عمليات الأعمال', 'تقارير تلقائية', 'مهام مجدولة', 'رسائل تلقائية', 'ايميلات تلقائية'],
  },
  service_custom: {
    en: ['custom software', 'custom system', 'bespoke software', 'tailored software', 'custom solution', 'custom development', 'build custom', 'software from scratch', 'custom platform', 'internal tool', 'internal tools', 'internal system', 'company system', 'business software', 'legacy system', 'legacy modernization', 'modernize system', 'replace excel', 'replace spreadsheets', 'digitize', 'digitalize', 'digital transformation', 'digitization'],
    ar: ['برمجيات مخصصة', 'نظام مخصص', 'برنامج مخصص', 'حل مخصص', 'تطوير مخصص', 'برنامج خاص', 'نظام خاص', 'من الصفر', 'منصة مخصصة', 'اداة داخلية', 'أداة داخلية', 'نظام داخلي', 'نظام الشركة', 'برنامج للشركة', 'نظام قديم', 'تحديث النظام القديم', 'تطوير النظام القديم', 'استبدال الاكسل', 'استبدال الإكسل', 'التحول الرقمي', 'رقمنة', 'الرقمنة', 'تحويل رقمي'],
  },
  pricing: {
    en: ['price', 'prices', 'pricing', 'cost', 'costs', 'how much', 'budget', 'quote', 'quotation', 'estimate', 'rates', 'fees', 'charge', 'charges', 'expensive', 'cheap', 'affordable', 'pricing plans', 'packages', 'subscription price', 'monthly price', 'annual price', 'payment plans', 'starting price', 'minimum budget', 'price list', 'how much does it cost', 'what does it cost', 'cost of website', 'cost of app', 'ballpark', 'price range'],
    ar: ['السعر', 'سعر', 'الاسعار', 'اسعار', 'الأسعار', 'التسعير', 'التكلفة', 'تكلفة', 'كم التكلفة', 'كم السعر', 'كم سعر', 'بكم', 'بكام', 'كام سعر', 'بكام الموقع', 'بكام التطبيق', 'بكم الموقع', 'بكم التطبيق', 'كم يكلف', 'كم تكلف', 'يكلف', 'الميزانية', 'عرض سعر', 'عرض اسعار', 'عرض أسعار', 'تسعيرة', 'تقدير التكلفة', 'الرسوم', 'كم تاخذون', 'كم تأخذون', 'غالي', 'رخيص', 'خطط الاسعار', 'خطط الأسعار', 'الباقات', 'باقة', 'سعر شهري', 'سعر سنوي', 'اقل ميزانية', 'أقل ميزانية', 'قائمة الاسعار', 'كم سعر الموقع', 'كم سعر التطبيق', 'تكلفة تقريبية'],
  },
  payment: {
    en: ['payment', 'payment methods', 'how to pay', 'pay', 'installments', 'milestones', 'deposit', 'down payment', 'invoice', 'billing', 'bank transfer', 'credit card', 'paypal', 'wire transfer', 'payment terms', 'refund', 'money back', 'pay monthly', 'pay in parts', 'split payment'],
    ar: ['الدفع', 'طرق الدفع', 'كيف ادفع', 'كيف أدفع', 'اقساط', 'أقساط', 'تقسيط', 'دفعات', 'دفعة مقدمة', 'مقدم', 'عربون', 'فاتورة', 'الفوترة', 'تحويل بنكي', 'بطاقة ائتمان', 'فيزا', 'باي بال', 'شروط الدفع', 'استرجاع', 'استرداد', 'ضمان مالي', 'دفع شهري', 'دفع على مراحل'],
  },
  timeline: {
    en: ['timeline', 'how long', 'duration', 'time frame', 'timeframe', 'delivery time', 'when will it be ready', 'deadline', 'how many weeks', 'how many months', 'project duration', 'time to build', 'time to launch', 'time to market', 'fast delivery', 'urgent project', 'rush', 'asap delivery', 'quick turnaround', 'eta', 'estimated time'],
    ar: ['المدة', 'كم المدة', 'كم يستغرق', 'كم تستغرق', 'الوقت', 'الجدول الزمني', 'وقت التسليم', 'متى يجهز', 'متى يكون جاهز', 'الموعد النهائي', 'كم اسبوع', 'كم أسبوع', 'كم شهر', 'مدة المشروع', 'وقت البناء', 'وقت الاطلاق', 'وقت الإطلاق', 'تسليم سريع', 'مشروع مستعجل', 'مستعجل', 'ضروري بسرعة', 'باسرع وقت', 'بأسرع وقت', 'الوقت المتوقع'],
  },
  process: {
    en: ['process', 'how do you work', 'workflow', 'methodology', 'agile', 'scrum', 'sprints', 'steps', 'phases', 'stages', 'project phases', 'how it works', 'work process', 'development process', 'project management', 'how do we start', 'kickoff', 'onboarding', 'discovery phase', 'requirements gathering', 'planning phase', 'what happens first', 'first step', 'next steps'],
    ar: ['العملية', 'كيف تعملون', 'كيف تشتغلون', 'منهجية العمل', 'المنهجية', 'اجايل', 'أجايل', 'سكرم', 'سبرنت', 'الخطوات', 'المراحل', 'مراحل المشروع', 'كيف يتم العمل', 'عملية التطوير', 'ادارة المشروع', 'إدارة المشروع', 'كيف نبدا', 'كيف نبدأ', 'بداية المشروع', 'مرحلة الاكتشاف', 'جمع المتطلبات', 'مرحلة التخطيط', 'ما هي الخطوة الاولى', 'الخطوة الأولى', 'الخطوات القادمة'],
  },
  portfolio: {
    en: ['portfolio', 'projects', 'your projects', 'past projects', 'previous work', 'work samples', 'examples', 'case study', 'case studies', 'success stories', 'clients you worked with', 'show me your work', 'what have you built', 'references', 'sample projects', 'demo projects', 'live projects', 'recent projects', 'best projects', 'featured work'],
    ar: ['اعمالكم', 'أعمالكم', 'مشاريعكم', 'المشاريع', 'مشاريع سابقة', 'اعمال سابقة', 'أعمال سابقة', 'نماذج اعمال', 'نماذج أعمال', 'امثلة', 'أمثلة', 'دراسة حالة', 'دراسات حالة', 'قصص نجاح', 'عملاء سابقون', 'اعرض اعمالك', 'ماذا بنيتم', 'مراجع', 'مشاريع تجريبية', 'مشاريع حية', 'احدث المشاريع', 'أحدث المشاريع', 'افضل مشاريعكم', 'أفضل المشاريع', 'سابقة اعمال', 'سابقة أعمال', 'بورتفوليو'],
  },
  industries: {
    en: ['industries', 'sectors', 'what industries', 'which industries', 'industry experience', 'verticals', 'domains', 'fields you serve', 'sectors you serve', 'industry expertise', 'do you work with', 'specialized industries'],
    ar: ['القطاعات', 'المجالات', 'الصناعات', 'اي قطاعات', 'أي قطاعات', 'خبرة القطاعات', 'المجالات التي تخدمونها', 'القطاعات التي تعملون بها', 'تخصص قطاعي', 'هل تعملون مع', 'قطاعات متخصصة'],
  },
  industry_healthcare: {
    en: ['healthcare', 'medical', 'hospital', 'clinic', 'clinics', 'patient', 'patients', 'health system', 'medical software', 'hospital system', 'clinic management', 'telehealth', 'telemedicine', 'hipaa', 'medical records', 'ehr', 'emr', 'pharmacy system', 'lab system', 'doctor app', 'appointment booking medical'],
    ar: ['الرعاية الصحية', 'الصحة', 'طبي', 'مستشفى', 'مستشفيات', 'عيادة', 'عيادات', 'مرضى', 'نظام صحي', 'برنامج طبي', 'نظام مستشفى', 'ادارة عيادة', 'إدارة عيادات', 'طب عن بعد', 'سجلات طبية', 'ملف طبي', 'نظام صيدلية', 'نظام مختبر', 'تطبيق دكتور', 'حجز مواعيد طبية'],
  },
  industry_finance: {
    en: ['fintech', 'finance', 'financial', 'banking', 'bank', 'digital bank', 'payments platform', 'wallet app', 'lending', 'loans system', 'trading platform', 'investment app', 'insurance', 'insurtech', 'accounting software', 'compliance finance', 'kyc', 'aml', 'ledger'],
    ar: ['التقنية المالية', 'فنتك', 'المالية', 'مالي', 'بنوك', 'بنك', 'مصرف', 'بنك رقمي', 'منصة مدفوعات', 'محفظة الكترونية', 'محفظة إلكترونية', 'تمويل', 'قروض', 'منصة تداول', 'تطبيق استثمار', 'تامين', 'تأمين', 'برنامج محاسبي مالي', 'التزام مالي', 'اعرف عميلك', 'مكافحة غسل الاموال', 'مكافحة غسل الأموال', 'دفتر حسابات'],
  },
  industry_ecommerce: {
    en: ['ecommerce', 'e-commerce', 'online shop', 'online store', 'retail', 'marketplace', 'shopify alternative', 'woocommerce', 'shopping app', 'cart', 'checkout', 'product catalog', 'omnichannel', 'pos', 'point of sale', 'sell online', 'dropshipping', 'b2b marketplace'],
    ar: ['التجارة الالكترونية', 'التجارة الإلكترونية', 'متجر الكتروني كبير', 'تجارة الكترونية', 'تجارة إلكترونية', 'التجزئة', 'سوق الكتروني', 'سوق إلكتروني', 'ماركت بليس', 'تطبيق تسوق', 'سلة الشراء', 'صفحة الدفع', 'كتالوج المنتجات', 'نقاط البيع', 'كاشير', 'البيع اونلاين', 'البيع أونلاين', 'دروبشيبينغ', 'متعدد القنوات'],
  },
  industry_other: {
    en: ['manufacturing', 'factory', 'industrial', 'education', 'school', 'university', 'elearning', 'e-learning', 'lms', 'logistics', 'shipping', 'delivery company', 'fleet', 'transportation', 'real estate', 'property management', 'government', 'public sector', 'municipality', 'ngo', 'nonprofit', 'restaurant', 'food delivery', 'hospitality', 'hotel system', 'travel', 'tourism', 'agriculture', 'energy', 'oil and gas', 'construction', 'legal', 'law firm'],
    ar: ['التصنيع', 'مصنع', 'مصانع', 'صناعي', 'التعليم', 'مدرسة', 'مدارس', 'جامعة', 'جامعات', 'تعليم الكتروني', 'تعليم إلكتروني', 'منصة تعليمية', 'اللوجستيات', 'الشحن', 'شركة توصيل', 'اسطول', 'أسطول', 'النقل', 'العقارات', 'ادارة الاملاك', 'إدارة الأملاك', 'عقاري', 'الحكومة', 'القطاع الحكومي', 'حكومي', 'بلدية', 'جمعية خيرية', 'مطعم', 'مطاعم', 'توصيل طعام', 'الضيافة', 'نظام فندق', 'فنادق', 'السياحة', 'سياحة وسفر', 'الزراعة', 'الطاقة', 'النفط والغاز', 'المقاولات', 'البناء', 'قانوني', 'مكتب محاماة'],
  },
  about_company: {
    en: ['about', 'about you', 'about noviq', 'about the company', 'who is noviq', 'company info', 'company profile', 'tell me about the company', 'your company', 'company background', 'history', 'when founded', 'founded', 'how old', 'company size', 'your story', 'mission', 'vision', 'values', 'what is noviq'],
    ar: ['عن الشركة', 'من انتم', 'من أنتم', 'عن نوفيك', 'من هي نوفيك', 'معلومات الشركة', 'ملف الشركة', 'حدثني عن الشركة', 'شركتكم', 'خلفية الشركة', 'تاريخ الشركة', 'متى تاسست', 'متى تأسست', 'التاسيس', 'التأسيس', 'حجم الشركة', 'قصتكم', 'الرسالة', 'الرؤية', 'القيم', 'ما هي نوفيك', 'نبذة عن الشركة', 'نبذة عنكم'],
  },
  stats: {
    en: ['stats', 'statistics', 'numbers', 'how many projects', 'how many clients', 'how many countries', 'years of experience', 'experience', 'track record', 'achievements', 'clients count', 'projects delivered', 'projects completed', 'success rate', 'how experienced', 'proven results'],
    ar: ['احصائيات', 'إحصائيات', 'ارقام', 'أرقام', 'كم مشروع', 'عدد المشاريع', 'كم عميل', 'عدد العملاء', 'كم دولة', 'عدد الدول', 'سنوات الخبرة', 'الخبرة', 'خبرتكم', 'سجل الانجازات', 'سجل الإنجازات', 'الانجازات', 'الإنجازات', 'مشاريع منجزة', 'مشاريع مكتملة', 'نسبة النجاح', 'نتائج مثبتة'],
  },
  team: {
    en: ['team', 'your team', 'developers', 'engineers', 'team size', 'how many developers', 'who works', 'staff', 'talent', 'senior developers', 'designers', 'meet the team', 'team members', 'employees', 'hiring developers', 'dedicated team', 'dedicated developers', 'outsourcing', 'staff augmentation', 'hire developers'],
    ar: ['الفريق', 'فريقكم', 'فريق العمل', 'المطورين', 'المطورون', 'المهندسين', 'المهندسون', 'حجم الفريق', 'كم مطور', 'عدد المطورين', 'الموظفين', 'الموظفون', 'المواهب', 'مطورين خبراء', 'مصممين', 'مصممون', 'اعضاء الفريق', 'أعضاء الفريق', 'فريق مخصص', 'مطورين مخصصين', 'الاستعانة بمصادر خارجية', 'توظيف مطورين', 'تاجير مطورين', 'تأجير مطورين'],
  },
  locations: {
    en: ['location', 'locations', 'where are you', 'where are you located', 'offices', 'office', 'address', 'headquarters', 'hq', 'which country', 'which city', 'san francisco', 'london', 'singapore', 'work remotely', 'remote company', 'visit office', 'meet in person', 'onsite'],
    ar: ['اين انتم', 'أين أنتم', 'وين مكانكم', 'المكاتب', 'المكتب', 'العنوان', 'المقر', 'المقر الرئيسي', 'اي دولة', 'أي دولة', 'اي مدينة', 'أي مدينة', 'سان فرانسيسكو', 'لندن', 'سنغافورة', 'عن بعد', 'شركة عن بعد', 'زيارة المكتب', 'مقابلة شخصية', 'حضوري', 'فروعكم', 'فرعكم'],
  },
  contact: {
    en: ['contact', 'contact you', 'contact info', 'contact information', 'email', 'email address', 'phone', 'phone number', 'call you', 'reach you', 'get in touch', 'talk to sales', 'sales team', 'whatsapp number', 'telegram', 'social media', 'linkedin', 'twitter', 'how to contact', 'contact details', 'reach out'],
    ar: ['التواصل', 'تواصل', 'اتواصل معكم', 'أتواصل معكم', 'معلومات التواصل', 'بيانات التواصل', 'الايميل', 'الإيميل', 'البريد الالكتروني', 'البريد الإلكتروني', 'الهاتف', 'رقم الهاتف', 'رقم الجوال', 'اتصل بكم', 'اكلمكم', 'أكلمكم', 'فريق المبيعات', 'رقم الواتساب', 'واتسابكم', 'تيليجرام', 'وسائل التواصل', 'لينكد ان', 'لينكد إن', 'تويتر', 'كيف اتواصل', 'كيف أتواصل', 'طرق التواصل'],
  },
  meeting: {
    en: ['meeting', 'book a meeting', 'schedule a meeting', 'schedule a call', 'book a call', 'consultation', 'free consultation', 'discovery call', 'demo', 'book a demo', 'appointment', 'talk to expert', 'speak with consultant', 'zoom call', 'video call', 'discuss project', 'discuss my project', 'lets talk', "let's talk", 'arrange meeting', 'available times'],
    ar: ['اجتماع', 'حجز اجتماع', 'موعد اجتماع', 'جدولة اجتماع', 'حجز مكالمة', 'مكالمة', 'استشارة', 'استشارة مجانية', 'مكالمة تعريفية', 'عرض توضيحي', 'ديمو', 'حجز موعد', 'موعد', 'التحدث مع خبير', 'التحدث مع مستشار', 'مكالمة زوم', 'مكالمة فيديو', 'مناقشة المشروع', 'مناقشة مشروعي', 'نتكلم', 'خلينا نتكلم', 'ترتيب اجتماع', 'الاوقات المتاحة', 'الأوقات المتاحة'],
  },
  support: {
    en: ['support', 'technical support', 'customer support', 'maintenance', 'after launch', 'post launch', 'ongoing support', 'sla', 'bug fix', 'bug fixes', 'issues after delivery', 'warranty', 'guarantee', 'updates', 'upgrades', 'monitoring', 'support plans', 'support hours', '24 7 support', 'emergency support', 'help after project'],
    ar: ['الدعم', 'الدعم الفني', 'دعم فني', 'دعم العملاء', 'الصيانة', 'صيانة', 'بعد الاطلاق', 'بعد الإطلاق', 'بعد التسليم', 'دعم مستمر', 'اتفاقية مستوى الخدمة', 'اصلاح الاخطاء', 'إصلاح الأخطاء', 'مشاكل بعد التسليم', 'الضمان', 'ضمان', 'التحديثات', 'الترقيات', 'المراقبة', 'خطط الدعم', 'ساعات الدعم', 'دعم على مدار الساعة', 'دعم طوارئ', 'مساعدة بعد المشروع'],
  },
  careers: {
    en: ['careers', 'jobs', 'job openings', 'vacancies', 'hiring', 'are you hiring', 'work for you', 'join your team', 'apply', 'job application', 'internship', 'remote jobs', 'developer job', 'designer job', 'open positions', 'cv', 'resume', 'recruitment'],
    ar: ['الوظائف', 'وظائف', 'وظيفة', 'التوظيف', 'فرص عمل', 'شواغر', 'هل توظفون', 'اعمل معكم', 'أعمل معكم', 'الانضمام للفريق', 'انضم لكم', 'تقديم طلب', 'طلب وظيفة', 'تدريب', 'تدريب تعاوني', 'وظائف عن بعد', 'وظيفة مطور', 'وظيفة مصمم', 'الوظائف المتاحة', 'السيرة الذاتية', 'سيرتي الذاتية'],
  },
  technology: {
    en: ['technology', 'technologies', 'tech stack', 'stack', 'what technologies', 'programming languages', 'frameworks', 'tools you use', 'python', 'javascript', 'typescript', 'node', 'nodejs', 'dotnet', '.net', 'java', 'php', 'laravel', 'django', 'postgresql', 'mongodb', 'mysql', 'redis', 'tensorflow', 'pytorch', 'which database', 'database you use', 'front end technology', 'backend technology'],
    ar: ['التقنيات', 'التكنولوجيا', 'التقنية', 'ما التقنيات', 'اي تقنيات', 'أي تقنيات', 'لغات البرمجة', 'اطر العمل', 'أطر العمل', 'الادوات', 'الأدوات', 'بايثون', 'جافا سكريبت', 'تايب سكريبت', 'نود', 'دوت نت', 'جافا', 'بي اتش بي', 'لارافل', 'جانغو', 'بوستجرس', 'مونجو', 'ماي سيكوال', 'قواعد البيانات', 'اي قاعدة بيانات', 'أي قاعدة بيانات', 'تقنيات الواجهة', 'تقنيات الخلفية'],
  },
  security: {
    en: ['security', 'secure', 'data security', 'cybersecurity', 'is my data safe', 'data protection', 'encryption', 'encrypted', 'penetration testing', 'pentest', 'vulnerability', 'gdpr', 'compliance', 'iso 27001', 'soc 2', 'privacy', 'privacy policy', 'data privacy', 'confidential', 'confidentiality', 'nda', 'non disclosure', 'sign nda', 'protect my idea', 'intellectual property', 'ip rights', 'who owns the code', 'source code ownership'],
    ar: ['الامان', 'الأمان', 'الامن', 'الأمن', 'امن البيانات', 'أمن البيانات', 'الامن السيبراني', 'الأمن السيبراني', 'هل بياناتي امنة', 'هل بياناتي آمنة', 'حماية البيانات', 'التشفير', 'مشفر', 'اختبار اختراق', 'الثغرات', 'الامتثال', 'الخصوصية', 'سياسة الخصوصية', 'خصوصية البيانات', 'السرية', 'سري', 'اتفاقية عدم افشاء', 'اتفاقية عدم إفشاء', 'اتفاقية سرية', 'حماية فكرتي', 'الملكية الفكرية', 'حقوق الملكية', 'من يملك الكود', 'ملكية الكود', 'ملكية المصدر'],
  },
  testimonials: {
    en: ['testimonials', 'reviews', 'client reviews', 'what clients say', 'feedback', 'client feedback', 'ratings', 'recommendations', 'client satisfaction', 'happy clients', 'trust', 'why trust you', 'proof', 'social proof', 'references from clients'],
    ar: ['اراء العملاء', 'آراء العملاء', 'التقييمات', 'تقييمات', 'مراجعات', 'مراجعات العملاء', 'ماذا يقول العملاء', 'انطباعات العملاء', 'رضا العملاء', 'عملاء سعداء', 'الثقة', 'لماذا اثق بكم', 'لماذا أثق بكم', 'اثبات', 'إثبات', 'توصيات العملاء', 'شهادات العملاء'],
  },
  why_us: {
    en: ['why noviq', 'why you', 'why choose you', 'why should i choose', 'what makes you different', 'competitive advantage', 'advantages', 'benefits of working', 'better than competitors', 'compare you', 'unique', 'strengths', 'usp', 'differentiators', 'value proposition'],
    ar: ['لماذا نوفيك', 'لماذا انتم', 'لماذا أنتم', 'لماذا اختاركم', 'لماذا أختاركم', 'ما يميزكم', 'ايش يميزكم', 'إيش يميزكم', 'شو بيميزكم', 'الميزة التنافسية', 'المزايا', 'فوائد العمل معكم', 'افضل من المنافسين', 'أفضل من المنافسين', 'مقارنة بغيركم', 'نقاط القوة', 'القيمة المضافة', 'ليش انتو'],
  },
  newsletter: {
    en: ['newsletter', 'subscribe', 'subscription news', 'email updates', 'mailing list', 'stay updated', 'news', 'blog updates', 'articles', 'insights', 'resources', 'whitepapers', 'guides', 'learning resources', 'blog'],
    ar: ['النشرة البريدية', 'النشرة', 'اشتراك بالنشرة', 'الاشتراك في النشرة', 'تحديثات البريد', 'القائمة البريدية', 'ابق على اطلاع', 'الاخبار', 'الأخبار', 'المدونة', 'مقالات', 'رؤى', 'المصادر', 'الادلة', 'الأدلة', 'مصادر تعليمية', 'اوراق بحثية', 'أوراق بحثية'],
  },
  ai_lab: {
    en: ['ai lab', 'demos', 'ai demos', 'try ai', 'test ai', 'playground', 'image generator', 'translator demo', 'ocr demo', 'voice demo', 'summarizer demo', 'prompt generator', 'fun facts', 'vision demo', 'free tools', 'ai tools'],
    ar: ['مختبر الذكاء', 'مختبر الذكاء الاصطناعي', 'العروض التجريبية', 'تجربة الذكاء الاصطناعي', 'اختبار الذكاء', 'مولد الصور', 'المترجم', 'التعرف على النصوص', 'الصوت الذكي', 'الملخص', 'مولد الاوامر', 'مولد الأوامر', 'حقائق ممتعة', 'الرؤية الذكية', 'ادوات مجانية', 'أدوات مجانية', 'ادوات الذكاء', 'أدوات الذكاء'],
  },
  start_project: {
    en: ['start project', 'start a project', 'new project', 'i have a project', 'i have an idea', 'project idea', 'build my idea', 'startup idea', 'mvp', 'minimum viable product', 'prototype', 'proof of concept', 'poc', 'begin project', 'kick off project', 'launch my product', 'i want to build', 'i need a system', 'i need software', 'develop for me', 'work together', 'partner with you', 'hire you', 'get started'],
    ar: ['بدء مشروع', 'ابدا مشروع', 'أبدأ مشروع', 'مشروع جديد', 'عندي مشروع', 'لدي مشروع', 'عندي فكرة', 'لدي فكرة', 'فكرة مشروع', 'بناء فكرتي', 'فكرة شركة ناشئة', 'منتج اولي', 'منتج أولي', 'نموذج اولي', 'نموذج أولي', 'اثبات مفهوم', 'إثبات مفهوم', 'اطلاق منتجي', 'إطلاق منتجي', 'اريد بناء', 'أريد بناء', 'احتاج نظام', 'أحتاج نظام', 'احتاج برنامج', 'أحتاج برنامج', 'طوروا لي', 'نعمل معا', 'نعمل معاً', 'شراكة معكم', 'اوظفكم', 'أوظفكم', 'نبدا', 'نبدأ', 'ابدأ الان', 'ابدأ الآن'],
  },
  language_switch: {
    en: ['arabic', 'speak arabic', 'talk arabic', 'in arabic', 'switch to arabic', 'do you speak arabic', 'english', 'speak english', 'switch language', 'change language', 'other languages', 'supported languages'],
    ar: ['عربي', 'تكلم عربي', 'بالعربي', 'حول للعربي', 'هل تتكلم عربي', 'انجليزي', 'إنجليزي', 'تكلم انجليزي', 'بالانجليزي', 'بالإنجليزي', 'تغيير اللغة', 'تبديل اللغة', 'لغات اخرى', 'لغات أخرى', 'اللغات المدعومة'],
  },
  image_generation: {
    en: ['draw', 'draw me', 'draw a', 'draw an', 'generate image', 'generate a picture', 'create image', 'create a picture', 'make image', 'make a picture', 'paint', 'paint a', 'paint me', 'image of', 'picture of', 'show me image', 'show me picture', 'can you draw', 'can you generate', 'ai image', 'ai art', 'ai drawing', 'text to image', 'generate from text', 'create from text'],
    ar: ['رسم', 'ارسم', 'ارسم لي', 'ارسم', 'ارسمي', 'رسم لي', 'رسم', 'انشئ صورة', 'انشاء صورة', 'اصنع صورة', 'اصنع لي صورة', 'اريد رسم', 'اريد صورة', 'يمكنك رسم', 'يمكنك انشاء صورة', 'ذكاء اصطناعي رسم', 'فن ذكاء اصطناعي', 'رسم بالذكاء الاصطناعي', 'توليد صورة من نص', 'انشاء صورة من نص', 'رسم تنين', 'رسم صورة', 'صورة ل', 'ارني صورة', 'ارني صورة'],
  },
};

/* ============================================================
   FAQ CORPUS — retrievable bilingual Q&A documents
   ------------------------------------------------------------
   Used by the BM25 search layer (search.js). Every entry:
   { id, tags (search terms), q/a (en+ar), link (SPA route) }
   This is the deep long-tail knowledge that intents don't cover.
   ============================================================ */

const FAQS = [
  { id: 'warranty', tags: 'guarantee warranty bugs free fix ضمان كفالة اصلاح مجاني عيوب',
    q: { en: 'Do you offer a warranty on delivered work?', ar: 'هل تقدمون ضماناً على العمل المسلم؟' },
    a: { en: 'Yes — every project includes a free bug-fix warranty period (typically 90 days post-launch). Anything that breaks due to our code gets fixed at no cost.', ar: 'نعم — كل مشروع يشمل فترة ضمان مجانية لإصلاح الأخطاء (عادة 90 يوماً بعد الإطلاق). أي خلل ناتج عن الكود نصلحه بدون أي تكلفة.' },
    link: '#/faq' },
  { id: 'nda', tags: 'nda confidential secret idea protect سرية اتفاقية عدم افصاح حماية فكرة',
    q: { en: 'Will you sign an NDA? Is my idea safe?', ar: 'هل توقعون اتفاقية سرية؟ هل فكرتي محمية؟' },
    a: { en: 'Absolutely. We sign NDAs before any detailed discussion, and your idea, data, and code remain 100% confidential and yours.', ar: 'بالتأكيد. نوقع اتفاقية عدم الإفصاح قبل أي نقاش تفصيلي، وتبقى فكرتك وبياناتك وكودك سرية وملكاً لك 100%.' },
    link: '#/faq' },
  { id: 'source_code', tags: 'source code ownership ip intellectual property own الكود المصدري ملكية فكرية',
    q: { en: 'Who owns the source code?', ar: 'من يملك الكود المصدري؟' },
    a: { en: 'You do. Full source code and IP ownership transfers to you on final delivery — no lock-in, no licensing fees.', ar: 'أنت. الملكية الكاملة للكود المصدري والملكية الفكرية تنتقل إليك عند التسليم النهائي — بدون احتكار أو رسوم ترخيص.' },
    link: '#/faq' },
  { id: 'hosting', tags: 'hosting server domain deploy where استضافة سيرفر دومين نشر رفع الموقع',
    q: { en: 'Do you provide hosting and deployment?', ar: 'هل توفرون الاستضافة والنشر؟' },
    a: { en: 'Yes. We deploy to your preferred provider (AWS, Azure, GCP, or shared hosting), configure domains and SSL, and can manage the infrastructure for you.', ar: 'نعم. ننشر على المزود الذي تفضله (AWS أو Azure أو GCP أو استضافة مشتركة)، ونجهز الدومين وشهادة SSL، ويمكننا إدارة البنية التحتية بالكامل نيابة عنك.' },
    link: '#/services' },
  { id: 'maintenance', tags: 'maintenance plan monthly retainer updates صيانة شهرية تحديثات عقد صيانة',
    q: { en: 'Do you offer maintenance plans?', ar: 'هل تقدمون عقود صيانة؟' },
    a: { en: 'Yes — monthly maintenance plans covering monitoring, security patches, backups, small improvements, and priority support.', ar: 'نعم — باقات صيانة شهرية تشمل المراقبة والتحديثات الأمنية والنسخ الاحتياطي والتحسينات الصغيرة والدعم ذي الأولوية.' },
    link: '#/pricing' },
  { id: 'discount', tags: 'discount cheaper offer deal startup nonprofit خصم عرض تخفيض ارخص',
    q: { en: 'Do you offer discounts?', ar: 'هل يوجد خصومات؟' },
    a: { en: 'We offer startup-friendly phased scopes, and discounts for long-term retainers, nonprofits, and educational projects. Share your budget and we\'ll design a scope that fits.', ar: 'نقدم نطاقات مرحلية مناسبة للشركات الناشئة، وخصومات للعقود طويلة المدى والجهات غير الربحية والمشاريع التعليمية. أخبرنا بميزانيتك وسنصمم نطاقاً يناسبها.' },
    link: '#/pricing' },
  { id: 'hours', tags: 'working hours open when available timezone ساعات العمل متى دوام توقيت',
    q: { en: 'What are your working hours?', ar: 'ما هي ساعات العمل لديكم؟' },
    a: { en: 'Our teams span San Francisco, London, and Singapore, so we cover almost every timezone. Support responses within one business day — faster on SLA plans.', ar: 'فرقنا موزعة بين سان فرانسيسكو ولندن وسنغافورة، لذا نغطي معظم المناطق الزمنية. نرد على الدعم خلال يوم عمل واحد — وأسرع في باقات SLA.' },
    link: '#/contact' },
  { id: 'languages_spoken', tags: 'languages english arabic speak support لغات انجليزي عربي تتكلمون',
    q: { en: 'What languages do you work in?', ar: 'بأي لغات تعملون؟' },
    a: { en: 'We work in English and Arabic end-to-end — communication, documentation, and fully RTL Arabic interfaces.', ar: 'نعمل بالإنجليزية والعربية بالكامل — في التواصل والتوثيق والواجهات العربية RTL.' },
    link: '#/about' },
  { id: 'remote', tags: 'remote onsite meeting visit office عن بعد حضوري زيارة مكتب اجتماع',
    q: { en: 'Do you work remotely or on-site?', ar: 'هل تعملون عن بعد أم حضورياً؟' },
    a: { en: 'Primarily remote with structured weekly demos. On-site workshops are available for enterprise engagements near our offices.', ar: 'نعمل عن بعد بشكل أساسي مع عروض تقدم أسبوعية منظمة، وورش حضورية متاحة للمشاريع المؤسسية القريبة من مكاتبنا.' },
    link: '#/contact' },
  { id: 'handover', tags: 'handover documentation training docs تسليم توثيق تدريب شرح',
    q: { en: 'What do I get at handover?', ar: 'ماذا أستلم عند التسليم؟' },
    a: { en: 'Full source code, technical documentation, deployment guides, admin training sessions, and a recorded walkthrough of the system.', ar: 'الكود المصدري كاملاً، التوثيق التقني، أدلة النشر، جلسات تدريب للمشرفين، وفيديو شرح مسجل للنظام.' },
    link: '#/faq' },
  { id: 'revisions', tags: 'revisions changes modify iterate feedback تعديلات مراجعات تغيير ملاحظات',
    q: { en: 'How many revisions are included?', ar: 'كم عدد التعديلات المشمولة؟' },
    a: { en: 'Design phases include structured revision rounds, and weekly sprint demos let you steer continuously — so surprises never pile up at the end.', ar: 'مراحل التصميم تشمل جولات تعديل منظمة، والعروض الأسبوعية تتيح لك توجيه العمل باستمرار — فلا تتراكم المفاجآت في النهاية.' },
    link: '#/faq' },
  { id: 'small_budget', tags: 'small budget cheap mvp minimum start ميزانية صغيرة محدودة رخيص بسيط',
    q: { en: 'My budget is small — can you still help?', ar: 'ميزانيتي صغيرة — هل يمكنكم مساعدتي؟' },
    a: { en: 'Yes. We scope lean MVPs that prove the core idea first, then grow in phases as revenue arrives. Try the Cost Estimator or tell us your number.', ar: 'نعم. نصمم نسخة MVP مركزة تثبت الفكرة الأساسية أولاً، ثم نتوسع على مراحل مع نمو الإيرادات. جرّب مقدّر التكلفة أو أخبرنا بميزانيتك.' },
    link: '#/solutions' },
  { id: 'takeover', tags: 'existing project takeover rescue fix another developer مشروع قائم انقاذ مطور سابق استكمال',
    q: { en: 'Can you take over an existing project?', ar: 'هل يمكنكم استكمال مشروع قائم؟' },
    a: { en: 'Yes — we do code audits and project rescues regularly. We review the codebase, report risks honestly, then stabilize and continue development.', ar: 'نعم — نقوم بمراجعة الأكواد وإنقاذ المشاريع باستمرار. نفحص الكود، نقدم تقريراً صريحاً بالمخاطر، ثم نستقر النظام ونكمل التطوير.' },
    link: '#/contact' },
  { id: 'migration_excel', tags: 'excel spreadsheet migrate replace manual اكسل جداول ترحيل استبدال يدوي',
    q: { en: 'Can you replace our Excel sheets with a real system?', ar: 'هل يمكن استبدال ملفات الإكسل بنظام حقيقي؟' },
    a: { en: 'That\'s one of our most common projects: we turn spreadsheet chaos into a proper database system with roles, validation, dashboards, and automatic reports.', ar: 'هذا من أكثر مشاريعنا شيوعاً: نحول فوضى الجداول إلى نظام بقاعدة بيانات حقيقية مع صلاحيات وتحقق تلقائي ولوحات تحكم وتقارير آلية.' },
    link: '#/solutions' },
  { id: 'seo', tags: 'seo google ranking search engine optimization سيو جوجل ظهور محركات البحث ترتيب',
    q: { en: 'Do you handle SEO?', ar: 'هل تهتمون بالسيو SEO؟' },
    a: { en: 'Every site ships with technical SEO built in: meta tags, structured data (JSON-LD), sitemaps, performance optimization, and multilingual hreflang.', ar: 'كل موقع نسلمه يشمل السيو التقني: وسوم الميتا، البيانات المنظمة JSON-LD، خرائط الموقع، تحسين الأداء، ودعم hreflang متعدد اللغات.' },
    link: '#/services' },
  { id: 'payment_gateways', tags: 'payment gateway stripe paypal mada visa integrate بوابة دفع مدى فيزا ستربايب دفع الكتروني',
    q: { en: 'Which payment gateways can you integrate?', ar: 'ما بوابات الدفع التي تدعمونها؟' },
    a: { en: 'Stripe, PayPal, and regional gateways (Mada, STC Pay, Paymob, Fawry, Tap and more) — with PCI-compliant checkout flows.', ar: 'سترايب وباي بال والبوابات الإقليمية (مدى، STC Pay، Paymob، فوري، Tap وغيرها) — مع مسارات دفع متوافقة مع معايير PCI.' },
    link: '#/services' },
  { id: 'whatsapp', tags: 'whatsapp sms notifications telegram bot واتساب رسائل اشعارات تيليجرام تكامل',
    q: { en: 'Can you integrate WhatsApp or SMS notifications?', ar: 'هل يمكن تكامل واتساب أو الرسائل النصية؟' },
    a: { en: 'Yes — WhatsApp Business API, SMS providers, Telegram bots, and email automation are standard integrations we deliver.', ar: 'نعم — واجهة واتساب للأعمال ومزودي الرسائل النصية وبوتات تيليجرام وأتمتة البريد كلها تكاملات قياسية ننفذها.' },
    link: '#/services' },
  { id: 'data_privacy', tags: 'privacy gdpr data protection compliance خصوصية حماية البيانات امتثال قوانين',
    q: { en: 'How do you handle data privacy and GDPR?', ar: 'كيف تتعاملون مع خصوصية البيانات؟' },
    a: { en: 'Privacy by design: data minimization, encryption at rest and in transit, role-based access, audit logs, and GDPR/regional compliance baked into architecture.', ar: 'الخصوصية من التصميم: تقليل البيانات، تشفير أثناء التخزين والنقل، صلاحيات حسب الأدوار، سجلات تدقيق، وامتثال GDPR واللوائح الإقليمية مدمج في المعمارية.' },
    link: '#/faq' },
  { id: 'contract', tags: 'contract agreement terms legal عقد اتفاقية شروط قانوني',
    q: { en: 'How does contracting work?', ar: 'كيف يتم التعاقد؟' },
    a: { en: 'A clear statement of work defines scope, milestones, payments, and IP transfer. You review everything before we start — no hidden clauses.', ar: 'وثيقة نطاق عمل واضحة تحدد النطاق والمراحل والدفعات ونقل الملكية. تراجع كل شيء قبل البدء — بدون بنود خفية.' },
    link: '#/faq' },
  { id: 'dedicated_team', tags: 'dedicated team staff augmentation hire developers فريق مخصص توظيف مطورين تعزيز',
    q: { en: 'Can we hire a dedicated team?', ar: 'هل يمكن استئجار فريق مخصص؟' },
    a: { en: 'Yes — dedicated squads (engineers, designer, PM) embedded with your team on monthly terms, or individual senior staff augmentation.', ar: 'نعم — فرق مخصصة (مهندسون، مصمم، مدير مشروع) تعمل ضمن فريقك بعقود شهرية، أو تعزيز فردي بكوادر خبيرة.' },
    link: '#/services' },
  { id: 'code_quality', tags: 'code quality testing tests review standards جودة الكود اختبارات مراجعة معايير',
    q: { en: 'How do you ensure code quality?', ar: 'كيف تضمنون جودة الكود؟' },
    a: { en: 'Code reviews on every merge, automated tests, CI pipelines, linting, and staging environments before production. Quality is engineered, not inspected in.', ar: 'مراجعة كود لكل دمج، اختبارات آلية، خطوط CI، فحص أسلوبي، وبيئات تجريبية قبل الإنتاج. الجودة تُهندس ولا تُفحص لاحقاً.' },
    link: '#/faq' },
  { id: 'performance', tags: 'performance speed slow fast optimize اداء سرعة بطيء تحسين تسريع',
    q: { en: 'My current system is slow — can you optimize it?', ar: 'نظامي الحالي بطيء — هل يمكن تحسينه؟' },
    a: { en: 'Yes. We profile bottlenecks (queries, N+1s, bundle size, caching) and deliver measurable speedups — often 5-10x on database-heavy screens.', ar: 'نعم. نحلل نقاط الاختناق (الاستعلامات، حجم الملفات، التخزين المؤقت) ونحقق تسريعاً قابلاً للقياس — غالباً 5-10 أضعاف في الشاشات الثقيلة.' },
    link: '#/contact' },
  { id: 'multilingual', tags: 'multilingual arabic rtl translation locales متعدد اللغات عربي واجهة ترجمة',
    q: { en: 'Can you build multilingual (Arabic/English) products?', ar: 'هل تبنون منتجات متعددة اللغات؟' },
    a: { en: 'It\'s a specialty: full RTL Arabic + English interfaces, locale-aware dates and numbers, and translation workflows your team can manage.', ar: 'هذا تخصصنا: واجهات عربية RTL وإنجليزية كاملة، تواريخ وأرقام حسب اللغة، ونظام ترجمة يديره فريقك بسهولة.' },
    link: '#/services' },
  { id: 'cms', tags: 'cms admin panel manage content edit myself لوحة تحكم اداره محتوى تعديل بنفسي',
    q: { en: 'Will I be able to edit content myself?', ar: 'هل سأتمكن من تعديل المحتوى بنفسي؟' },
    a: { en: 'Yes — every site ships with an admin panel to edit texts, images, services, and projects without touching code.', ar: 'نعم — كل موقع يأتي بلوحة تحكم لتعديل النصوص والصور والخدمات والمشاريع بدون لمس الكود.' },
    link: '#/services' },
  { id: 'pos', tags: 'pos point of sale cashier retail نقاط بيع كاشير محل تجزئة',
    q: { en: 'Do you build POS systems?', ar: 'هل تبنون أنظمة نقاط بيع؟' },
    a: { en: 'Yes — POS with inventory sync, barcode scanning, receipts, shift reports, and e-invoicing compliance (including ZATCA).', ar: 'نعم — نقاط بيع مع مزامنة المخزون وقراءة الباركود والفواتير وتقارير الورديات والفوترة الإلكترونية (متوافقة مع زاتكا).' },
    link: '#/solutions' },
  { id: 'lms', tags: 'lms learning education courses training platform تعليم منصة دورات تدريب اكاديمية',
    q: { en: 'Can you build a learning platform (LMS)?', ar: 'هل تبنون منصة تعليمية؟' },
    a: { en: 'Yes — courses, video lessons, quizzes, certificates, subscriptions, and progress analytics for academies and corporate training.', ar: 'نعم — دورات ودروس فيديو واختبارات وشهادات واشتراكات وتحليلات تقدم للأكاديميات والتدريب المؤسسي.' },
    link: '#/solutions' },
  { id: 'booking', tags: 'booking reservation appointment scheduling حجز مواعيد جدولة عيادة صالون',
    q: { en: 'Do you build booking/appointment systems?', ar: 'هل تبنون أنظمة حجز مواعيد؟' },
    a: { en: 'Yes — calendars, staff availability, reminders (SMS/WhatsApp), payments, and no-show tracking for clinics, salons, and services.', ar: 'نعم — تقويمات وتوفر الموظفين وتذكيرات (رسائل/واتساب) ومدفوعات وتتبع الغياب للعيادات والصالونات والخدمات.' },
    link: '#/solutions' },
  { id: 'delivery', tags: 'delivery app drivers tracking orders توصيل تطبيق سائقين تتبع طلبات مطعم',
    q: { en: 'Can you build a delivery app with driver tracking?', ar: 'هل تبنون تطبيق توصيل بتتبع السائقين؟' },
    a: { en: 'Yes — customer app, driver app, dispatcher dashboard, live GPS tracking, and route optimization.', ar: 'نعم — تطبيق للعملاء وتطبيق للسائقين ولوحة توزيع وتتبع GPS مباشر وتحسين المسارات.' },
    link: '#/solutions' },
  { id: 'marketplace', tags: 'marketplace multi vendor sellers commissions سوق الكتروني بائعين عمولات منصة',
    q: { en: 'Do you build multi-vendor marketplaces?', ar: 'هل تبنون أسواقاً متعددة البائعين؟' },
    a: { en: 'Yes — vendor onboarding, product catalogs, split payments, commissions, reviews, and dispute flows.', ar: 'نعم — تسجيل البائعين وكتالوجات المنتجات وتقسيم المدفوعات والعمولات والتقييمات ومعالجة النزاعات.' },
    link: '#/solutions' },
  { id: 'real_estate', tags: 'real estate property listings agents عقارات نظام عقاري وساطة املاك',
    q: { en: 'Do you have real estate solutions?', ar: 'هل لديكم حلول عقارية؟' },
    a: { en: 'Yes — property listings with map search, agent CRM, lead routing, contracts, and owner portals.', ar: 'نعم — قوائم عقارات مع بحث على الخريطة وCRM للوسطاء وتوزيع العملاء والعقود وبوابات الملاك.' },
    link: '#/solutions' },
  { id: 'restaurant', tags: 'restaurant menu qr ordering kitchen مطعم منيو قائمة طلبات مطبخ كيو ار',
    q: { en: 'Do you build restaurant systems?', ar: 'هل تبنون أنظمة مطاعم؟' },
    a: { en: 'Yes — QR menus, table ordering, kitchen display systems, POS integration, and delivery-platform sync.', ar: 'نعم — منيو QR وطلب من الطاولة وشاشات مطبخ وتكامل نقاط البيع ومزامنة منصات التوصيل.' },
    link: '#/solutions' },
  { id: 'reports', tags: 'reports dashboard analytics bi kpi تقارير لوحات تحليلات مؤشرات اداء',
    q: { en: 'Can you build analytics dashboards?', ar: 'هل تبنون لوحات تحليلات وتقارير؟' },
    a: { en: 'Yes — real-time KPI dashboards, scheduled PDF/Excel reports, and BI pipelines that unify data from all your systems.', ar: 'نعم — لوحات مؤشرات لحظية وتقارير PDF/Excel مجدولة وخطوط BI توحد البيانات من كل أنظمتك.' },
    link: '#/services' },
  { id: 'legacy', tags: 'legacy old system modernize rewrite upgrade نظام قديم تحديث اعادة بناء ترقية',
    q: { en: 'Our system is old — rewrite or upgrade?', ar: 'نظامنا قديم — نعيد بناءه أم نطوره؟' },
    a: { en: 'We audit first, then recommend honestly: sometimes strangler-pattern modernization beats a risky big-bang rewrite. You get a roadmap either way.', ar: 'نفحص أولاً ثم ننصح بصدق: أحياناً التحديث التدريجي أفضل من إعادة البناء الكاملة المحفوفة بالمخاطر. وفي الحالتين تستلم خارطة طريق واضحة.' },
    link: '#/contact' },
  { id: 'scalability', tags: 'scale users traffic growth million توسع مستخدمين نمو ضغط ملايين',
    q: { en: 'Will the system handle growth?', ar: 'هل يتحمل النظام النمو؟' },
    a: { en: 'We architect for 10x your current load: horizontal scaling, caching layers, queue-based processing, and load testing before launch.', ar: 'نصمم لعشرة أضعاف حملك الحالي: توسع أفقي وطبقات تخزين مؤقت ومعالجة بالطوابير واختبارات ضغط قبل الإطلاق.' },
    link: '#/faq' },
  { id: 'uptime', tags: 'uptime sla downtime availability 99.9 توفر انقطاع اتفاقية مستوى الخدمة',
    q: { en: 'What uptime do you guarantee?', ar: 'ما نسبة التوفر المضمونة؟' },
    a: { en: 'Managed plans include SLAs up to 99.9% uptime with monitoring, alerting, and automatic failover options.', ar: 'باقات الإدارة تشمل اتفاقيات مستوى خدمة حتى 99.9% توفراً مع مراقبة وتنبيهات وخيارات تجاوز تلقائي للأعطال.' },
    link: '#/pricing' },
  { id: 'communication', tags: 'communication updates slack email pm تواصل متابعة تحديثات مدير مشروع',
    q: { en: 'How will we communicate during the project?', ar: 'كيف سيكون التواصل أثناء المشروع؟' },
    a: { en: 'A dedicated PM, shared Slack/WhatsApp channel, weekly demo calls, and a live task board you can check anytime.', ar: 'مدير مشروع مخصص، قناة مشتركة (سلاك/واتساب)، اجتماع عرض أسبوعي، ولوحة مهام حية تطلع عليها في أي وقت.' },
    link: '#/faq' },
  { id: 'vs_freelancer', tags: 'freelancer agency why company difference فريلانسر مستقل فرق شركة مقارنة',
    q: { en: 'Why choose Noviq over a freelancer?', ar: 'لماذا نوفيك بدلاً من مستقل؟' },
    a: { en: 'Continuity and accountability: a full senior team, documented code, QA, contracts with warranties — and no single point of failure that disappears mid-project.', ar: 'استمرارية ومسؤولية: فريق خبير متكامل، كود موثق، ضمان جودة، عقود بضمانات — وبدون نقطة فشل واحدة قد تختفي منتصف المشروع.' },
    link: '#/about' },
  { id: 'consulting', tags: 'consulting advice audit strategy cto استشارة تقنية تدقيق استراتيجية',
    q: { en: 'Do you offer technical consulting only?', ar: 'هل تقدمون استشارات تقنية فقط؟' },
    a: { en: 'Yes — architecture reviews, code audits, digital-transformation roadmaps, and fractional-CTO engagements.', ar: 'نعم — مراجعات معمارية وتدقيق أكواد وخرائط تحول رقمي وخدمة مدير تقني جزئي.' },
    link: '#/services' },
  { id: 'free_consultation', tags: 'free consultation call demo estimate استشارة مجانية مكالمة تقدير عرض',
    q: { en: 'Is the first consultation free?', ar: 'هل الاستشارة الأولى مجانية؟' },
    a: { en: 'Yes — a free discovery call to understand your needs, followed by a written proposal with scope and estimate. No obligation.', ar: 'نعم — مكالمة استكشافية مجانية لفهم احتياجك، يليها عرض مكتوب بالنطاق والتقدير. بدون أي التزام.' },
    link: '#/contact' },
  { id: 'cost_estimator', tags: 'cost estimator calculator price tool مقدر التكلفة حاسبة الاسعار اداة',
    q: { en: 'How can I estimate my project cost quickly?', ar: 'كيف أقدر تكلفة مشروعي بسرعة؟' },
    a: { en: 'Use the Cost Estimator on our Pricing page — pick features and see a live range. For exact numbers, book the free consultation.', ar: 'استخدم مقدّر التكلفة في صفحة الأسعار — اختر المزايا وشاهد نطاقاً فورياً. وللأرقام الدقيقة احجز الاستشارة المجانية.' },
    link: '#/pricing' },
  { id: 'solution_builder', tags: 'solution builder proposal instant tool منشئ الحلول عرض فوري اداة',
    q: { en: 'What is the Solution Builder?', ar: 'ما هو منشئ الحلول؟' },
    a: { en: 'An interactive tool that turns your answers into an instant tailored proposal: recommended modules, timeline, and budget band.', ar: 'أداة تفاعلية تحول إجاباتك إلى عرض فوري مخصص: الوحدات المقترحة والمدة ونطاق الميزانية.' },
    link: '#/solutions' },
  { id: 'resources', tags: 'blog articles resources whitepapers guides مدونة مقالات مصادر ادلة',
    q: { en: 'Do you publish technical content?', ar: 'هل تنشرون محتوى تقنياً؟' },
    a: { en: 'Yes — articles, guides, and whitepapers on our Resources page, plus a newsletter with practical engineering insights.', ar: 'نعم — مقالات وأدلة وأوراق بحثية في صفحة المصادر، بالإضافة لنشرة بريدية بخلاصات هندسية عملية.' },
    link: '#/resources' },
  { id: 'account_benefits', tags: 'account signup register benefits login حساب تسجيل فوائد دخول',
    q: { en: 'Why create an account on your site?', ar: 'لماذا أنشئ حساباً في موقعكم؟' },
    a: { en: 'Accounts let you save Solution Builder proposals, track consultation requests, and get faster support responses.', ar: 'الحساب يتيح حفظ عروض منشئ الحلول ومتابعة طلبات الاستشارة والحصول على ردود دعم أسرع.' },
    link: '#/signup' },
  { id: 'refund', tags: 'refund money back cancel project الغاء استرجاع استرداد اموال',
    q: { en: 'What if I want to cancel mid-project?', ar: 'ماذا لو أردت الإلغاء منتصف المشروع؟' },
    a: { en: 'Milestone-based billing protects you: you only pay for completed, delivered milestones and keep everything built so far.', ar: 'الدفع بالمراحل يحميك: تدفع فقط مقابل المراحل المكتملة والمسلّمة وتحتفظ بكل ما تم بناؤه.' },
    link: '#/faq' },
  { id: 'start_today', tags: 'start now begin today first step كيف ابدا الان اليوم اول خطوة',
    q: { en: 'How do I start?', ar: 'كيف أبدأ؟' },
    a: { en: 'Three ways: leave your email here in the chat, fill the contact form, or use the Solution Builder for an instant proposal. We reply within one business day.', ar: 'ثلاث طرق: اترك بريدك هنا في المحادثة، أو املأ نموذج التواصل، أو استخدم منشئ الحلول لعرض فوري. نرد خلال يوم عمل واحد.' },
    link: '#/contact' },
];

/* Contextual follow-up suggestions per intent (shown as quick replies) */
const SUGGESTS = {
  greeting:          { en: ['Our services', 'Pricing', 'Start a project'], ar: ['خدماتكم', 'الأسعار', 'ابدأ مشروعاً'] },
  services_overview: { en: ['AI solutions', 'ERP systems', 'Mobile apps', 'Pricing'], ar: ['حلول الذكاء الاصطناعي', 'أنظمة ERP', 'تطبيقات الجوال', 'الأسعار'] },
  service_ai:        { en: ['AI project cost', 'Past AI projects', 'Book consultation'], ar: ['تكلفة مشروع ذكاء اصطناعي', 'مشاريع ذكاء اصطناعي سابقة', 'حجز استشارة'] },
  service_erp:       { en: ['ERP timeline', 'ERP pricing', 'Replace Excel sheets'], ar: ['مدة تنفيذ ERP', 'أسعار ERP', 'استبدال ملفات الإكسل'] },
  service_crm:       { en: ['CRM pricing', 'WhatsApp integration', 'Book a demo'], ar: ['أسعار CRM', 'تكامل واتساب', 'حجز عرض'] },
  service_web:       { en: ['Website cost', 'How long for a website?', 'SEO included?'], ar: ['تكلفة الموقع', 'كم يستغرق الموقع؟', 'هل السيو مشمول؟'] },
  service_mobile:    { en: ['App cost', 'iOS and Android?', 'App timeline'], ar: ['تكلفة التطبيق', 'آيفون وأندرويد؟', 'مدة تنفيذ التطبيق'] },
  pricing:           { en: ['Payment terms', 'Discounts?', 'Free consultation'], ar: ['طريقة الدفع', 'خصومات؟', 'استشارة مجانية'] },
  payment:           { en: ['Pricing packages', 'Refund policy', 'Start a project'], ar: ['باقات الأسعار', 'سياسة الاسترجاع', 'ابدأ مشروعاً'] },
  timeline:          { en: ['Our process', 'Pricing', 'Start now'], ar: ['منهجية العمل', 'الأسعار', 'ابدأ الآن'] },
  process:           { en: ['Timelines', 'Communication during project', 'Warranty'], ar: ['المدة الزمنية', 'التواصل أثناء المشروع', 'الضمان'] },
  portfolio:         { en: ['Healthcare projects', 'Finance projects', 'Client reviews'], ar: ['مشاريع الرعاية الصحية', 'مشاريع القطاع المالي', 'آراء العملاء'] },
  industries:        { en: ['Healthcare', 'Finance', 'E-commerce'], ar: ['الرعاية الصحية', 'القطاع المالي', 'التجارة الإلكترونية'] },
  contact:           { en: ['Book consultation', 'Working hours', 'Offices'], ar: ['حجز استشارة', 'ساعات العمل', 'المكاتب'] },
  meeting:           { en: ['Contact info', 'Pricing first', 'Our process'], ar: ['معلومات التواصل', 'الأسعار أولاً', 'منهجية العمل'] },
  support:           { en: ['Maintenance plans', 'SLA details', 'Contact support'], ar: ['عقود الصيانة', 'تفاصيل SLA', 'تواصل مع الدعم'] },
  technology:        { en: ['AI capabilities', 'Cloud solutions', 'Security practices'], ar: ['قدرات الذكاء الاصطناعي', 'الحلول السحابية', 'ممارسات الأمان'] },
  security:          { en: ['NDA?', 'Source code ownership', 'Data privacy'], ar: ['اتفاقية سرية؟', 'ملكية الكود المصدري', 'خصوصية البيانات'] },
  about_company:     { en: ['Our numbers', 'Why Noviq?', 'Client reviews'], ar: ['أرقامنا', 'لماذا نوفيك؟', 'آراء العملاء'] },
  start_project:     { en: ['Pricing', 'Timeline', 'Free consultation'], ar: ['الأسعار', 'المدة الزمنية', 'استشارة مجانية'] },
  fallback:          { en: ['Our services', 'Pricing', 'Past projects', 'Book a consultation'], ar: ['خدماتكم', 'الأسعار', 'مشاريع سابقة', 'حجز استشارة'] },
};

/* ============================================================
   FAQ EXPANSION — 63 additional bilingual topics (total 108)
   With the 42 intents this brings the knowledge base to 150
   organized topics, all reachable through the TOPIC_TREE below.
   ============================================================ */

const FAQS_EXTRA = [
  /* ---- AI (8) ---- */
  { id: 'rag_chatbot', tags: 'rag chatbot knowledge base documents pdf bot يقرا ملفات شات بوت يجاوب من ملفاتي مستندات',
    q: { en: 'Can you build a chatbot that answers from our documents?', ar: 'هل تبنون شات بوت يجيب من ملفاتنا؟' },
    a: { en: 'Yes — RAG chatbots that index your PDFs, wikis, and databases, answering with citations from your own content.', ar: 'نعم — شات بوتات RAG تفهرس ملفات PDF والويكي وقواعد البيانات لديكم وتجيب مع الاستشهاد بمحتواكم.' }, link: '#/services' },
  { id: 'custom_gpt', tags: 'gpt openai integrate llm api custom دمج جي بي تي نموذج لغوي في نظامي',
    q: { en: 'Can you integrate GPT/LLMs into our product?', ar: 'هل تدمجون نماذج GPT في منتجنا؟' },
    a: { en: 'Yes — OpenAI, Claude, and open-source LLMs, with prompt engineering, guardrails, and cost controls built in.', ar: 'نعم — OpenAI وClaude والنماذج مفتوحة المصدر، مع هندسة أوامر وضوابط أمان وتحكم بالتكلفة.' }, link: '#/services' },
  { id: 'arabic_nlp', tags: 'arabic nlp dialect sentiment text معالجة نصوص عربية لهجات تحليل مشاعر',
    q: { en: 'Do you handle Arabic NLP and dialects?', ar: 'هل تدعمون معالجة النصوص العربية واللهجات؟' },
    a: { en: 'Yes — Arabic-first NLP: dialect handling, sentiment analysis, entity extraction, and Arabic chatbots are a core specialty.', ar: 'نعم — معالجة عربية أولاً: اللهجات وتحليل المشاعر واستخراج الكيانات والشات بوتات العربية تخصص أساسي لدينا.' }, link: '#/services' },
  { id: 'computer_vision_qc', tags: 'computer vision quality inspection camera defect فحص جودة كاميرات رؤية حاسوبية عيوب',
    q: { en: 'Can cameras + AI inspect product quality?', ar: 'هل يمكن للكاميرات والذكاء الاصطناعي فحص الجودة؟' },
    a: { en: 'Yes — vision models detect defects, count items, and read labels on production lines in real time.', ar: 'نعم — نماذج رؤية تكتشف العيوب وتعد القطع وتقرأ الملصقات على خطوط الإنتاج لحظياً.' }, link: '#/services' },
  { id: 'demand_forecasting', tags: 'forecasting demand sales prediction stock تنبؤ طلب مبيعات مخزون توقع',
    q: { en: 'Can AI forecast our sales and stock needs?', ar: 'هل يتنبأ الذكاء الاصطناعي بمبيعاتنا واحتياج المخزون؟' },
    a: { en: 'Yes — forecasting models trained on your history cut stockouts and overstock, typically improving accuracy 20-40%.', ar: 'نعم — نماذج تنبؤ مدربة على بياناتكم تقلل نفاد المخزون وتكدسه، بتحسن دقة 20-40% عادة.' }, link: '#/services' },
  { id: 'recommender', tags: 'recommendation engine personalization suggest products توصيات تخصيص اقتراح منتجات',
    q: { en: 'Do you build recommendation engines?', ar: 'هل تبنون أنظمة توصيات؟' },
    a: { en: 'Yes — "customers also bought", personalized feeds, and content recommendations that lift conversion.', ar: 'نعم — "اشترى العملاء أيضاً" وواجهات مخصصة وتوصيات محتوى ترفع التحويل.' }, link: '#/services' },
  { id: 'ai_cost_data', tags: 'ai needs data how much data enough بيانات كافية للذكاء الاصطناعي كمية البيانات',
    q: { en: 'Do we need big data to use AI?', ar: 'هل نحتاج بيانات ضخمة لاستخدام الذكاء الاصطناعي؟' },
    a: { en: 'Not always — pretrained models and RAG work with modest data. We assess your data in the free consultation.', ar: 'ليس دائماً — النماذج المدربة مسبقاً وRAG تعمل ببيانات متواضعة. نقيّم بياناتكم في الاستشارة المجانية.' }, link: '#/contact' },
  { id: 'ai_privacy', tags: 'ai privacy our data training leak خصوصية بيانات الذكاء الاصطناعي تسريب تدريب',
    q: { en: 'Will our data be used to train public AI models?', ar: 'هل تُستخدم بياناتنا لتدريب نماذج عامة؟' },
    a: { en: 'Never — we use enterprise/no-training endpoints or self-hosted models; your data stays yours under NDA.', ar: 'أبداً — نستخدم واجهات مؤسسية لا تتدرب على بياناتكم أو نماذج مستضافة ذاتياً؛ بياناتكم ملككم وتحت اتفاقية سرية.' }, link: '#/faq' },

  /* ---- Web (7) ---- */
  { id: 'pwa', tags: 'pwa progressive web app installable offline تطبيق ويب تقدمي يثبت بدون متجر',
    q: { en: 'What is a PWA and do I need one?', ar: 'ما هو تطبيق الويب التقدمي PWA وهل أحتاجه؟' },
    a: { en: 'A PWA installs like an app from the browser — no app store, one codebase, offline support. Great for content and commerce.', ar: 'تطبيق يُثبّت من المتصفح كأنه تطبيق — بدون متجر، كود واحد، ويعمل أوفلاين. ممتاز للمحتوى والتجارة.' }, link: '#/services' },
  { id: 'site_speed', tags: 'site slow speed pagespeed core web vitals تحسين سرعة الموقع بطيء',
    q: { en: 'Can you make our website faster?', ar: 'هل يمكنكم تسريع موقعنا؟' },
    a: { en: 'Yes — we optimize Core Web Vitals: images, caching, code splitting, and server tuning, with before/after reports.', ar: 'نعم — نحسّن مؤشرات الأداء: الصور والتخزين المؤقت وتقسيم الكود وضبط السيرفر، مع تقارير قبل/بعد.' }, link: '#/contact' },
  { id: 'redesign_migration', tags: 'redesign without losing seo rankings migrate content اعادة تصميم بدون خسارة السيو محتوى',
    q: { en: 'Can we redesign without losing SEO rankings?', ar: 'هل نعيد التصميم دون خسارة ترتيب السيو؟' },
    a: { en: 'Yes — 301 maps, content parity, and staged rollout keep rankings safe during redesigns.', ar: 'نعم — خرائط تحويل 301 ومطابقة المحتوى وإطلاق مرحلي تحفظ الترتيب أثناء إعادة التصميم.' }, link: '#/services' },
  { id: 'cms_compare', tags: 'wordpress custom cms which better ووردبريس ام نظام مخصص ادارة محتوى',
    q: { en: 'WordPress or custom build?', ar: 'ووردبريس أم نظام مخصص؟' },
    a: { en: 'WordPress for content sites on a budget; custom for products, portals, and anything with complex logic. We advise honestly per case.', ar: 'ووردبريس للمواقع المحتوى بميزانية محدودة؛ والمخصص للمنتجات والبوابات والمنطق المعقد. ننصح بصدق حسب الحالة.' }, link: '#/faq' },
  { id: 'accessibility_compliance', tags: 'accessibility wcag disabled users compliance وصول ذوي الاعاقة معايير',
    q: { en: 'Do you build accessible (WCAG) websites?', ar: 'هل تبنون مواقع متوافقة مع معايير الوصول؟' },
    a: { en: 'Yes — WCAG-aware builds: keyboard navigation, screen-reader labels, contrast, and RTL accessibility.', ar: 'نعم — بناء مراعٍ لمعايير WCAG: تنقل بلوحة المفاتيح ووسوم قارئ الشاشة والتباين ووصولية RTL.' }, link: '#/services' },
  { id: 'multilang_seo', tags: 'multilingual seo hreflang arabic english google سيو متعدد اللغات عربي انجليزي',
    q: { en: 'How does SEO work for Arabic + English sites?', ar: 'كيف يعمل السيو لموقع عربي وإنجليزي؟' },
    a: { en: 'hreflang tags, mirrored sitemaps, localized metadata, and RTL-aware performance — we ship it all by default.', ar: 'وسوم hreflang وخرائط موقع متطابقة وبيانات وصفية مترجمة وأداء مراعٍ للعربية — نسلمها كلها افتراضياً.' }, link: '#/services' },
  { id: 'landing_pages', tags: 'landing page campaign ads conversion صفحة هبوط حملة اعلانات تحويل',
    q: { en: 'Do you build campaign landing pages?', ar: 'هل تصممون صفحات هبوط للحملات؟' },
    a: { en: 'Yes — fast, tracked, A/B-testable landing pages delivered in days, wired to your ads and analytics.', ar: 'نعم — صفحات هبوط سريعة مقاسة قابلة لاختبار A/B تُسلّم خلال أيام، مربوطة بإعلاناتكم وتحليلاتكم.' }, link: '#/services' },

  /* ---- Mobile (6) ---- */
  { id: 'flutter_vs_native', tags: 'flutter react native swift kotlin which فلاتر ام اصلي نيتف مقارنة',
    q: { en: 'Flutter/React Native or fully native?', ar: 'فلاتر أم تطوير أصلي؟' },
    a: { en: 'Cross-platform (Flutter/RN) covers 90% of apps at ~60% of the cost; fully native only for heavy graphics/hardware needs.', ar: 'التقنيات الهجينة تغطي 90% من التطبيقات بنحو 60% من التكلفة؛ الأصلي فقط للرسوميات الثقيلة أو العتاد الخاص.' }, link: '#/faq' },
  { id: 'app_publish', tags: 'publish app store google play rejected account نشر التطبيق المتاجر رفض حساب مطور',
    q: { en: 'Do you handle App Store / Google Play publishing?', ar: 'هل تتولون النشر في المتاجر؟' },
    a: { en: 'Yes — developer accounts, store listings, screenshots, review compliance, and fixing rejections until approval.', ar: 'نعم — حسابات المطورين وصفحات المتجر واللقطات ومتطلبات المراجعة ومعالجة الرفض حتى القبول.' }, link: '#/services' },
  { id: 'push_notifications', tags: 'push notifications engagement remind users اشعارات تنبيهات تفاعل',
    q: { en: 'Can the app send push notifications?', ar: 'هل يرسل التطبيق إشعارات؟' },
    a: { en: 'Yes — targeted, scheduled, and triggered pushes with analytics on opens and conversions.', ar: 'نعم — إشعارات مستهدفة ومجدولة ومشروطة مع تحليلات للفتح والتحويل.' }, link: '#/services' },
  { id: 'offline_apps', tags: 'offline app no internet sync later بدون انترنت اوفلاين مزامنة',
    q: { en: 'Can the app work offline?', ar: 'هل يعمل التطبيق بدون إنترنت؟' },
    a: { en: 'Yes — offline-first storage with automatic sync when connection returns; essential for field teams.', ar: 'نعم — تخزين محلي أولاً بمزامنة تلقائية عند عودة الاتصال؛ أساسي للفرق الميدانية.' }, link: '#/services' },
  { id: 'app_maintenance', tags: 'app updates os versions maintain crash تحديثات التطبيق اصدارات النظام صيانة',
    q: { en: 'Who keeps the app working after OS updates?', ar: 'من يضمن عمل التطبيق بعد تحديثات النظام؟' },
    a: { en: 'Our maintenance plans cover OS updates, SDK upgrades, crash monitoring, and store policy changes.', ar: 'عقود صيانتنا تغطي تحديثات النظام وترقيات الحزم ومراقبة الأعطال وتغيرات سياسات المتاجر.' }, link: '#/pricing' },
  { id: 'app_mvp', tags: 'app mvp first version minimum launch نسخة اولى تطبيق تجريبي اطلاق سريع',
    q: { en: 'How small can a first app version be?', ar: 'ما أصغر نسخة أولى ممكنة للتطبيق؟' },
    a: { en: 'One core flow done well — typically 6-10 weeks. Real users then decide the roadmap, not guesses.', ar: 'مسار أساسي واحد متقن — عادة 6-10 أسابيع. بعدها المستخدمون الحقيقيون يحددون الخارطة لا التخمين.' }, link: '#/solutions' },

  /* ---- E-commerce (6) ---- */
  { id: 'ecommerce_platform', tags: 'shopify salla zid custom store which platform متجر شوبيفاي سلة زد مخصص',
    q: { en: 'Shopify/Salla or a custom store?', ar: 'شوبيفاي/سلة أم متجر مخصص؟' },
    a: { en: 'Platforms launch fast with monthly fees and limits; custom stores win on unique flows, integrations, and zero commissions.', ar: 'المنصات تطلق سريعاً برسوم شهرية وقيود؛ والمتجر المخصص يتفوق في المسارات الفريدة والتكاملات وصفر عمولات.' }, link: '#/faq' },
  { id: 'payments_fail', tags: 'payment failing declined checkout errors مشاكل الدفع فشل عمليات رفض بطاقات',
    q: { en: 'Our checkout payments keep failing — can you fix it?', ar: 'مدفوعات متجرنا تفشل — هل تصلحونها؟' },
    a: { en: 'Yes — we audit gateway configs, 3DS flows, and error handling; most stores recover 5-15% of lost checkouts.', ar: 'نعم — نفحص إعدادات البوابة ومسارات 3DS ومعالجة الأخطاء؛ معظم المتاجر تستعيد 5-15% من الطلبات المفقودة.' }, link: '#/contact' },
  { id: 'shipping_integration', tags: 'shipping couriers aramex smsa dhl tracking شحن شركات توصيل تتبع بوليصة',
    q: { en: 'Can you integrate shipping companies?', ar: 'هل تربطون شركات الشحن؟' },
    a: { en: 'Yes — Aramex, SMSA, DHL and local couriers: auto waybills, live tracking, and COD reconciliation.', ar: 'نعم — أرامكس وسمسا وDHL والشركات المحلية: بوالص تلقائية وتتبع مباشر وتسوية الدفع عند الاستلام.' }, link: '#/services' },
  { id: 'multi_currency', tags: 'multi currency vat tax countries عملات متعددة ضريبة دول بيع خارجي',
    q: { en: 'Can we sell in multiple currencies and handle VAT?', ar: 'هل نبيع بعملات متعددة مع الضرائب؟' },
    a: { en: 'Yes — geo-based currency, per-country tax rules, and compliant invoices out of the box.', ar: 'نعم — عملة حسب الموقع وقواعد ضريبية لكل دولة وفواتير متوافقة جاهزة.' }, link: '#/services' },
  { id: 'abandoned_cart', tags: 'abandoned cart recovery whatsapp email remind سلة متروكة استرجاع تذكير',
    q: { en: 'Can we recover abandoned carts?', ar: 'هل نسترجع السلات المتروكة؟' },
    a: { en: 'Yes — timed WhatsApp/email/SMS sequences with incentives; typical recovery is 8-20% of abandoned carts.', ar: 'نعم — تسلسلات واتساب/بريد/رسائل مجدولة بحوافز؛ الاسترجاع المعتاد 8-20% من السلات.' }, link: '#/services' },
  { id: 'product_sync', tags: 'sync products inventory erp store marketplaces مزامنة منتجات مخزون متجر',
    q: { en: 'Can store inventory sync with our ERP?', ar: 'هل يتزامن مخزون المتجر مع نظام ERP؟' },
    a: { en: 'Yes — two-way sync of products, prices, and stock between ERP, store, and marketplaces.', ar: 'نعم — مزامنة ثنائية للمنتجات والأسعار والمخزون بين ERP والمتجر والأسواق.' }, link: '#/services' },

  /* ---- ERP & Operations (7) ---- */
  { id: 'odoo_custom', tags: 'odoo customize modules implement اودو تخصيص وحدات تطبيق',
    q: { en: 'Do you customize Odoo?', ar: 'هل تخصصون أودو Odoo؟' },
    a: { en: 'Yes — Odoo implementation and custom modules, plus honest advice when fully-custom beats Odoo for your case.', ar: 'نعم — تطبيق أودو ووحدات مخصصة، مع نصيحة صادقة إذا كان المخصص الكامل أنسب لحالتكم.' }, link: '#/services' },
  { id: 'erp_migration', tags: 'migrate old erp data move system ترحيل نظام قديم بيانات الى جديد',
    q: { en: 'Can you migrate us from an old ERP?', ar: 'هل ترحلوننا من نظام قديم؟' },
    a: { en: 'Yes — mapped data migration with validation runs, parallel operation, and zero-loss cutover plans.', ar: 'نعم — ترحيل بيانات ممنهج بجولات تحقق وتشغيل متوازٍ وخطط انتقال بدون فقد.' }, link: '#/services' },
  { id: 'barcode_inventory', tags: 'barcode scanner warehouse count stock باركود مستودع جرد مخزون قارئ',
    q: { en: 'Barcode scanning for the warehouse?', ar: 'هل تدعمون الباركود للمستودعات؟' },
    a: { en: 'Yes — barcode/QR receiving, picking, and cycle counts from any phone camera or scanner gun.', ar: 'نعم — استلام وصرف وجرد بالباركود/QR من كاميرا الجوال أو جهاز المسح.' }, link: '#/solutions' },
  { id: 'e_invoice', tags: 'zatca e invoice fatoora compliance فاتورة الكترونية زاتكا فوترة هيئة الزكاة',
    q: { en: 'Are your systems ZATCA e-invoice compliant?', ar: 'هل أنظمتكم متوافقة مع الفوترة الإلكترونية (زاتكا)؟' },
    a: { en: 'Yes — Phase 2 ZATCA integration: QR, cryptographic stamps, and reporting APIs built into invoicing.', ar: 'نعم — تكامل المرحلة الثانية من زاتكا: QR والختم التشفيري وواجهات الإبلاغ مدمجة في الفوترة.' }, link: '#/solutions' },
  { id: 'hr_payroll', tags: 'hr payroll attendance leaves gosi رواتب حضور اجازات موارد بشرية تامينات',
    q: { en: 'Do you build HR & payroll systems?', ar: 'هل تبنون أنظمة موارد بشرية ورواتب؟' },
    a: { en: 'Yes — attendance, shifts, leaves, payroll with local rules (GOSI/WPS), and employee self-service portals.', ar: 'نعم — حضور وورديات وإجازات ورواتب بالقواعد المحلية (تأمينات/حماية أجور) وبوابة خدمة ذاتية للموظفين.' }, link: '#/solutions' },
  { id: 'approvals_workflow', tags: 'approvals workflow requests manager chain موافقات طلبات سلسلة اعتماد',
    q: { en: 'Can requests follow approval chains?', ar: 'هل تمر الطلبات بسلاسل موافقات؟' },
    a: { en: 'Yes — multi-level approvals with delegation, SLAs, reminders, and full audit trails.', ar: 'نعم — موافقات متعددة المستويات مع تفويض ومهل زمنية وتذكيرات وسجل تدقيق كامل.' }, link: '#/solutions' },
  { id: 'procurement', tags: 'procurement purchase orders suppliers rfq مشتريات اوامر شراء موردين عروض',
    q: { en: 'Do you cover procurement (POs, suppliers, RFQs)?', ar: 'هل تغطون المشتريات (أوامر شراء وموردين)؟' },
    a: { en: 'Yes — supplier registry, RFQ comparisons, PO approvals, receiving, and 3-way invoice matching.', ar: 'نعم — سجل موردين ومقارنة عروض واعتماد أوامر الشراء والاستلام ومطابقة الفواتير الثلاثية.' }, link: '#/solutions' },

  /* ---- Cloud & Security (7) ---- */
  { id: 'aws_vs_azure', tags: 'aws azure gcp which cloud choose افضل سحابة اختيار مقارنة',
    q: { en: 'AWS, Azure, or Google Cloud?', ar: 'أي سحابة نختار؟' },
    a: { en: 'All three are solid — we choose by region availability, your team\'s skills, existing licenses, and cost profile.', ar: 'الثلاثة ممتازة — نختار حسب توفر المنطقة ومهارات فريقكم والتراخيص الحالية وملف التكلفة.' }, link: '#/faq' },
  { id: 'kubernetes_docker', tags: 'docker kubernetes containers need دوكر كوبرنيتس حاويات هل نحتاج',
    q: { en: 'Do we actually need Kubernetes?', ar: 'هل نحتاج كوبرنيتس فعلاً؟' },
    a: { en: 'Only at scale — most products run great on simpler containers/PaaS. We right-size infrastructure to your stage.', ar: 'فقط عند التوسع — معظم المنتجات تعمل ممتازاً على حاويات أبسط. نطابق البنية مع مرحلتكم.' }, link: '#/faq' },
  { id: 'serverless', tags: 'serverless lambda functions pay per use بدون خوادم دفع بالاستخدام',
    q: { en: 'Is serverless right for us?', ar: 'هل السيرفرلس مناسب لنا؟' },
    a: { en: 'Great for spiky/event workloads with near-zero idle cost; we mix it with servers where latency or cost dictates.', ar: 'ممتاز للأحمال المتقطعة بتكلفة خمول شبه صفرية؛ نمزجه مع الخوادم حيث يفرض زمن الاستجابة أو التكلفة.' }, link: '#/services' },
  { id: 'backups_policy', tags: 'backup restore how often retention نسخ احتياطي استرجاع كم مرة',
    q: { en: 'What is your backup policy?', ar: 'ما سياسة النسخ الاحتياطي؟' },
    a: { en: 'Automated daily (or hourly) encrypted backups, off-site copies, retention tiers, and tested restores — not just backups.', ar: 'نسخ يومية (أو كل ساعة) مشفرة تلقائياً، نسخ خارجية، مدد احتفاظ، واسترجاع مُختبَر — لا مجرد نسخ.' }, link: '#/faq' },
  { id: 'pentest', tags: 'penetration test security audit vulnerabilities اختبار اختراق ثغرات فحص امني',
    q: { en: 'Do you do penetration testing?', ar: 'هل تجرون اختبارات اختراق؟' },
    a: { en: 'Yes — OWASP-based app pentests with a findings report, severity ranking, and fix verification round.', ar: 'نعم — اختبارات وفق OWASP مع تقرير نتائج وترتيب خطورة وجولة تحقق من الإصلاح.' }, link: '#/services' },
  { id: 'ddos_protection', tags: 'ddos attack protection cloudflare waf حماية هجمات حجب الخدمة',
    q: { en: 'How do you protect against DDoS?', ar: 'كيف تحمون من هجمات حجب الخدمة؟' },
    a: { en: 'Edge protection (Cloudflare/WAF), rate limiting, and auto-scaling absorb attacks before they reach your app.', ar: 'حماية الحافة (Cloudflare/WAF) وتحديد المعدل والتوسع التلقائي تمتص الهجمات قبل وصولها لتطبيقكم.' }, link: '#/faq' },
  { id: 'monitoring', tags: 'monitoring alerts uptime logs errors مراقبة تنبيهات سجلات اخطاء',
    q: { en: 'Will we know when something breaks?', ar: 'هل نعرف فور حدوث عطل؟' },
    a: { en: 'Yes — uptime checks, error tracking, and log alerts page the right person before customers notice.', ar: 'نعم — فحوصات التوفر وتتبع الأخطاء وتنبيهات السجلات تُخطر الشخص المناسب قبل أن يلاحظ العملاء.' }, link: '#/services' },

  /* ---- Process (6) ---- */
  { id: 'agile_sprints', tags: 'agile sprints demos weekly how work سبرنت اجايل عروض اسبوعية طريقة عمل',
    q: { en: 'How do your sprints work?', ar: 'كيف تعمل السبرنتات لديكم؟' },
    a: { en: 'Weekly sprints: planned scope, built, demoed to you every week — you steer priorities continuously.', ar: 'سبرنتات أسبوعية: نطاق مخطط يُبنى ويُعرض عليكم كل أسبوع — وتوجهون الأولويات باستمرار.' }, link: '#/about' },
  { id: 'fixed_vs_tm', tags: 'fixed price time materials hourly contract سعر ثابت بالساعة عقد',
    q: { en: 'Fixed price or time & materials?', ar: 'سعر ثابت أم بالوقت والجهد؟' },
    a: { en: 'Fixed for well-defined scopes; T&M for evolving products. Both come with weekly transparency.', ar: 'ثابت للنطاقات المحددة جيداً؛ وبالوقت للمنتجات المتطورة. وكلاهما بشفافية أسبوعية.' }, link: '#/pricing' },
  { id: 'mvp_scope', tags: 'mvp scope what include first minimum ماذا نضمن النسخة الاولى نطاق',
    q: { en: 'How do you decide what goes in the MVP?', ar: 'كيف تحددون نطاق النسخة الأولى؟' },
    a: { en: 'We map user journeys, keep the single money-making flow, and defer everything else to data-driven iterations.', ar: 'نرسم رحلات المستخدم ونبقي المسار المدر للقيمة، ونؤجل الباقي لتحديثات مبنية على البيانات.' }, link: '#/solutions' },
  { id: 'change_requests', tags: 'change request scope creep new features تغيير نطاق طلبات جديدة اثناء المشروع',
    q: { en: 'What happens when we want changes mid-project?', ar: 'ماذا لو طلبنا تغييرات أثناء المشروع؟' },
    a: { en: 'Small tweaks flow into sprints; bigger changes get a mini-estimate you approve before we build.', ar: 'التعديلات الصغيرة تدخل السبرنت؛ والكبيرة تأخذ تقديراً مصغراً توافقون عليه قبل التنفيذ.' }, link: '#/faq' },
  { id: 'project_kickoff', tags: 'kickoff start first week onboarding بداية المشروع اول اسبوع انطلاق',
    q: { en: 'What does the first week look like?', ar: 'كيف يبدو الأسبوع الأول؟' },
    a: { en: 'Kickoff workshop, access setup, backlog agreement, and design starts — you see progress in week one.', ar: 'ورشة انطلاق وتجهيز الوصول والاتفاق على قائمة المهام وبدء التصميم — ترون تقدماً من الأسبوع الأول.' }, link: '#/about' },
  { id: 'staging_env', tags: 'staging test environment before live بيئة تجريبية اختبار قبل الاطلاق',
    q: { en: 'Can we test before things go live?', ar: 'هل نجرب قبل الإطلاق؟' },
    a: { en: 'Always — a staging environment mirrors production; nothing ships until you approve it there.', ar: 'دائماً — بيئة تجريبية مطابقة للإنتاج؛ لا شيء يُطلق قبل موافقتكم عليها.' }, link: '#/faq' },

  /* ---- Industries (8) ---- */
  { id: 'telehealth', tags: 'telehealth video consultation doctors remote استشارات طبية عن بعد فيديو اطباء',
    q: { en: 'Do you build telehealth platforms?', ar: 'هل تبنون منصات طب عن بعد؟' },
    a: { en: 'Yes — video consults, e-prescriptions, scheduling, and records with healthcare-grade privacy.', ar: 'نعم — استشارات فيديو ووصفات إلكترونية ومواعيد وسجلات بخصوصية طبية.' }, link: '#/industries' },
  { id: 'school_management', tags: 'school management students grades parents مدرسة طلاب درجات اولياء امور',
    q: { en: 'Do you build school management systems?', ar: 'هل تبنون أنظمة إدارة مدارس؟' },
    a: { en: 'Yes — enrollment, grades, timetables, parent apps, and fee management for schools and academies.', ar: 'نعم — تسجيل ودرجات وجداول وتطبيق أولياء الأمور وإدارة الرسوم للمدارس والأكاديميات.' }, link: '#/industries' },
  { id: 'fintech_compliance', tags: 'fintech sama license compliance payments تقنية مالية ساما ترخيص امتثال',
    q: { en: 'Can you build SAMA/central-bank compliant fintech?', ar: 'هل تبنون حلول تقنية مالية متوافقة مع الجهات التنظيمية؟' },
    a: { en: 'Yes — audit trails, encryption, and reporting aligned with regulator sandboxes; we\'ve shipped banking-grade systems.', ar: 'نعم — سجلات تدقيق وتشفير وتقارير متوافقة مع البيئات التنظيمية؛ سلمنا أنظمة بمستوى بنكي.' }, link: '#/industries' },
  { id: 'logistics_fleet', tags: 'fleet tracking drivers routes fuel اسطول مركبات سائقين مسارات وقود',
    q: { en: 'Do you build fleet management systems?', ar: 'هل تبنون أنظمة إدارة أساطيل؟' },
    a: { en: 'Yes — live GPS, route optimization, fuel/maintenance logs, and driver scorecards.', ar: 'نعم — تتبع مباشر وتحسين مسارات وسجلات وقود وصيانة وتقييم سائقين.' }, link: '#/industries' },
  { id: 'hospitality_pms', tags: 'hotel booking pms rooms channel فنادق حجوزات غرف ادارة فندق',
    q: { en: 'Do you build hotel/property systems?', ar: 'هل تبنون أنظمة فنادق وعقارات؟' },
    a: { en: 'Yes — room booking engines, channel-manager sync, housekeeping, and folio billing.', ar: 'نعم — محركات حجز الغرف ومزامنة القنوات وتدبير الغرف والفوترة.' }, link: '#/industries' },
  { id: 'government_portals', tags: 'government portal services digital حكومة بوابة خدمات رقمية',
    q: { en: 'Do you work on government digital services?', ar: 'هل تعملون على خدمات حكومية رقمية؟' },
    a: { en: 'Yes — citizen portals, service workflows, and integrations with national identity/payment rails.', ar: 'نعم — بوابات مستفيدين ومسارات خدمات وتكاملات مع منصات الهوية والدفع الوطنية.' }, link: '#/industries' },
  { id: 'gym_membership', tags: 'gym membership subscriptions classes check in نادي رياضي اشتراكات حصص دخول',
    q: { en: 'Do you build gym/membership systems?', ar: 'هل تبنون أنظمة أندية واشتراكات؟' },
    a: { en: 'Yes — memberships, class booking, QR check-in, freezes, and renewal automations.', ar: 'نعم — عضويات وحجز حصص ودخول بـQR وتجميد وتجديد تلقائي.' }, link: '#/solutions' },
  { id: 'charity_donations', tags: 'charity donations campaigns receipts جمعية تبرعات حملات ايصالات',
    q: { en: 'Do you build donation platforms?', ar: 'هل تبنون منصات تبرعات؟' },
    a: { en: 'Yes — campaigns, recurring donations, instant receipts, and transparent impact dashboards.', ar: 'نعم — حملات وتبرعات دورية وإيصالات فورية ولوحات أثر شفافة.' }, link: '#/solutions' },

  /* ---- Integrations (5) ---- */
  { id: 'google_maps', tags: 'google maps location tracking geocoding خرائط جوجل مواقع تتبع',
    q: { en: 'Can you integrate Google Maps features?', ar: 'هل تدمجون خرائط جوجل؟' },
    a: { en: 'Yes — pickers, live tracking, distance pricing, geofencing, and route drawing.', ar: 'نعم — اختيار المواقع والتتبع المباشر والتسعير بالمسافة والنطاقات الجغرافية ورسم المسارات.' }, link: '#/services' },
  { id: 'sms_otp', tags: 'sms otp verification login phone رسائل تحقق رمز دخول جوال',
    q: { en: 'Can users verify by SMS OTP?', ar: 'هل يتحقق المستخدمون برمز SMS؟' },
    a: { en: 'Yes — OTP via local SMS gateways or WhatsApp, with rate limits and fraud protection.', ar: 'نعم — رمز تحقق عبر بوابات الرسائل المحلية أو واتساب، مع حدود معدل وحماية احتيال.' }, link: '#/services' },
  { id: 'erp_ecom_sync', tags: 'connect erp website store sync orders ربط النظام بالمتجر مزامنة طلبات',
    q: { en: 'Can our website talk to our internal systems?', ar: 'هل يرتبط موقعنا بأنظمتنا الداخلية؟' },
    a: { en: 'Yes — orders, customers, and stock flow automatically between site and ERP/CRM in real time.', ar: 'نعم — الطلبات والعملاء والمخزون تتدفق تلقائياً بين الموقع وأنظمة ERP/CRM لحظياً.' }, link: '#/services' },
  { id: 'zapier_automation', tags: 'zapier make automation connect tools زابير اتمتة ربط ادوات',
    q: { en: 'Can you connect our existing tools together?', ar: 'هل تربطون أدواتنا الحالية ببعضها؟' },
    a: { en: 'Yes — native APIs where possible, Zapier/Make where speed matters; forms→sheets→CRM→WhatsApp, automated.', ar: 'نعم — واجهات مباشرة حيث أمكن وZapier/Make للسرعة؛ نماذج→جداول→CRM→واتساب، آلياً.' }, link: '#/services' },
  { id: 'social_login', tags: 'login google apple social single sign دخول جوجل ابل تسجيل اجتماعي',
    q: { en: 'Can users sign in with Google/Apple?', ar: 'هل يسجل المستخدمون بجوجل/آبل؟' },
    a: { en: 'Yes — Google, Apple, and enterprise SSO (SAML/OIDC) for B2B products.', ar: 'نعم — جوجل وآبل ودخول موحد مؤسسي (SSO) لمنتجات الشركات.' }, link: '#/services' },

  /* ---- Data (3) ---- */
  { id: 'data_migration', tags: 'data migration clean import old system ترحيل بيانات تنظيف استيراد',
    q: { en: 'Our data is messy — can you migrate it?', ar: 'بياناتنا فوضوية — هل ترحلونها؟' },
    a: { en: 'Yes — cleaning, deduplication, mapping, and validated imports with rollback safety.', ar: 'نعم — تنظيف وإزالة تكرار وموائمة واستيراد مُتحقق منه مع إمكانية تراجع آمنة.' }, link: '#/services' },
  { id: 'etl_warehouse', tags: 'data warehouse etl reports unify sources مستودع بيانات توحيد مصادر',
    q: { en: 'Can you unify data from many systems?', ar: 'هل توحدون البيانات من عدة أنظمة؟' },
    a: { en: 'Yes — ETL pipelines into a warehouse so every report reads one clean source of truth.', ar: 'نعم — خطوط ETL إلى مستودع بيانات لتقرأ كل التقارير مصدراً واحداً نظيفاً.' }, link: '#/services' },
  { id: 'ai_dashboards', tags: 'ask data natural language dashboard اسال بياناتك لوحة ذكية لغة طبيعية',
    q: { en: 'Can we ask questions to our data in plain language?', ar: 'هل نسأل بياناتنا بلغة طبيعية؟' },
    a: { en: 'Yes — AI dashboards where "sales in Riyadh last month?" returns charts, in Arabic or English.', ar: 'نعم — لوحات ذكية حيث "مبيعات الرياض الشهر الماضي؟" تعيد رسوماً، بالعربية أو الإنجليزية.' }, link: '#/services' },

  /* ---- Acknowledgment & Service Agreement ---- */
  { id: 'ack_overview', tags: 'acknowledgment agreement terms conditions service contract إقرار موافقة شروط اتفاقية عقد خدمة',
    q: { en: 'What is the Noviq service acknowledgment agreement?', ar: 'ما هو إقرار وموافقة الخدمة من نوفيك؟' },
    a: { en: 'The Noviq Service Acknowledgment is a legally binding agreement governing every engagement. It covers intellectual property transfer, confidentiality, warranty, milestone payments, dispute resolution, data privacy, and force majeure. By starting a project or signing a SOW you accept all terms in full.', ar: 'إقرار الخدمة من نوفيك هو اتفاقية ملزمة قانوناً تحكم كل تعاقد. يشمل نقل الملكية الفكرية والسرية والضمان والدفعات المرحلية وفض النزاعات وخصوصية البيانات والقوة القاهرة. ببدء المشروع أو توقيع وثيقة نطاق العمل فأنت تقبل جميع الشروط بالكامل.' }, link: '#/contact' },

  { id: 'ack_ip', tags: 'intellectual property source code ownership transfer ملكية فكرية كود مصدري ملكية نقل',
    q: { en: 'Who owns the code and IP after the project?', ar: 'من يملك الكود والملكية الفكرية بعد انتهاء المشروع؟' },
    a: { en: '100% yours. All custom source code, database schemas, designs, and documentation transfer to you as exclusive intellectual property upon final payment. We deliver full Git repositories at handover with no licensing fees or vendor lock-in.', ar: '100% ملكك. جميع الأكواد المصدرية المخصصة ومخططات قواعد البيانات والتصاميم والوثائق تنتقل إليك كملكية فكرية حصرية عند سداد الدفعة النهائية. نسلمك مستودعات Git الكاملة بدون رسوم ترخيص أو احتكار خدمات.' }, link: '#/contact' },

  { id: 'ack_nda_conf', tags: 'nda confidentiality non-disclosure secret agreement سرية عدم إفصاح أسرار تجارية',
    q: { en: 'Do you sign an NDA and keep everything confidential?', ar: 'هل توقعون اتفاقية عدم إفصاح وتحافظون على السرية؟' },
    a: { en: 'Yes. We sign a mutual NDA before any proprietary information is exchanged. Access is limited to active team members only. Confidentiality obligations remain for five years after project completion. Your ideas, data, and files are 100% protected.', ar: 'نعم. نوقع اتفاقية عدم إفصاح متبادلة قبل تبادل أي معلومات خاصة. الوصول مقتصر على أعضاء الفريق النشطين فقط. تستمر التزامات السرية لخمس سنوات بعد انتهاء المشروع. أفكارك وبياناتك وملفاتك محمية بنسبة 100%.' }, link: '#/contact' },

  { id: 'ack_privacy', tags: 'data privacy gdpr hipaa security compliance encryption خصوصية بيانات أمن امتثال تشفير',
    q: { en: 'How do you handle data privacy and security compliance?', ar: 'كيف تتعاملون مع خصوصية البيانات والامتثال الأمني؟' },
    a: { en: 'We build Privacy by Design: PII encrypted in transit (SSL/TLS) and at rest, GDPR/HIPAA alignment, role-based access controls, and audit logs. For ISO 27001 or SOC 2 certifications we provide full technical assistance including documentation and penetration test support.', ar: 'نبني بمبدأ الخصوصية من التصميم: تشفير البيانات الشخصية أثناء النقل (SSL/TLS) وأثناء التخزين والتوافق مع GDPR وHIPAA وضوابط الوصول وسجلات التدقيق. لشهادات ISO 27001 أو SOC 2 نقدم مساعدة فنية كاملة تشمل التوثيق ودعم اختبارات الاختراق.' }, link: '#/services' },

  { id: 'ack_warranty_detail', tags: 'warranty bug fix guarantee 90 days post launch defect ضمان إصلاح أخطاء تسعون يوماً ما بعد الإطلاق',
    q: { en: 'What exactly does the 90-day warranty cover?', ar: 'ماذا يغطي ضمان الـ 90 يوماً بالضبط؟' },
    a: { en: 'The warranty covers any SOW-defined functionality that fails, throws a coding error, or breaks under normal use — fixed at no cost. It includes logic bugs, interface misalignments, database bottlenecks, and security patches on the delivered code. It excludes client-side modifications, hosting changes, or third-party API deprecations after delivery.', ar: 'يغطي الضمان أي وظيفة محددة في وثيقة نطاق العمل تفشل أو تظهر خطأ برمجياً أو تتعطل في الاستخدام العادي — يُصلَح مجاناً. يشمل أخطاء المنطق وعدم اتساق الواجهات واختناقات قواعد البيانات والرقع الأمنية. لا يغطي تعديلات العميل أو تغييرات الاستضافة أو توقف APIs الخارجية بعد التسليم.' }, link: '#/contact' },

  { id: 'ack_payment_terms', tags: 'payment milestone invoice deposit billing 30 percent دفعات مرحلية فاتورة دفعة مقدمة ثلاثون بالمائة',
    q: { en: 'What are the payment terms and billing structure?', ar: 'ما هي شروط الدفع وهيكل الفوترة؟' },
    a: { en: 'Billing is milestone-based: 30% deposit before work starts, then payments at design approval, development midpoint, staging, and final handover. Invoices are due within 7 calendar days. Late payments may pause development. Pricing excludes VAT, currency conversion fees, and third-party licensing costs.', ar: 'الفوترة مرتبطة بالمراحل: دفعة مقدمة 30% قبل البدء ثم دفعات عند الموافقة على التصاميم ومنتصف التطوير والبيئة التجريبية والتسليم النهائي. الفواتير تستحق خلال 7 أيام تقويمية. التأخر في الدفع قد يوقف التطوير. الأسعار لا تشمل ضريبة القيمة المضافة أو رسوم تحويل العملات أو تكاليف تراخيص خارجية.' }, link: '#/contact' },

  { id: 'ack_termination', tags: 'cancel terminate refund exit project إلغاء إنهاء استرداد الخروج من المشروع',
    q: { en: 'Can I cancel the project midway and what happens?', ar: 'هل يمكنني إلغاء المشروع في منتصفه وماذا يحدث؟' },
    a: { en: 'Yes, with written notice. You pay only for completed milestones. Deposits for phases not yet started are refunded minus admin and active design costs. We hand over all source code, designs, and DB schemas built to that point. You own everything delivered in paid milestones and can continue independently.', ar: 'نعم بإشعار كتابي. تدفع فقط عن المراحل المكتملة. الدفعات المقدمة للمراحل غير المبدوءة تُسترد مخصوماً منها الرسوم الإدارية وتكاليف التصميم النشط. نسلمك الأكواد والتصاميم ومخططات قواعد البيانات المنجزة. أنت تمتلك كل ما سُلّم في المراحل المدفوعة ويمكنك المتابعة باستقلالية.' }, link: '#/contact' },

  { id: 'ack_dispute', tags: 'dispute arbitration law legal conflict negotiation نزاع تحكيم قانون خلاف تفاوض',
    q: { en: 'How are disputes between client and Noviq resolved?', ar: 'كيف يتم حل النزاعات بين العميل ونوفيك؟' },
    a: { en: 'Disputes are first addressed through good-faith negotiation between senior representatives. If unresolved within 30 days, the matter proceeds to binding arbitration in English or Arabic. The agreement is governed by the laws of the jurisdiction where Noviq\'s main office is registered.', ar: 'تُعالج النزاعات أولاً عبر التفاوض بحسن نية بين ممثلين رفيعي المستوى. إذا لم تُحل خلال 30 يوماً يُحال الأمر للتحكيم الملزم بالإنجليزية أو العربية. تخضع الاتفاقية لقوانين الولاية القضائية لمقر المكتب الرئيسي لنوفيك.' }, link: '#/contact' },

  { id: 'ack_sla_maintenance', tags: 'sla maintenance support uptime plan monitoring اتفاقية مستوى خدمة صيانة دعم وقت تشغيل مراقبة',
    q: { en: 'What maintenance and SLA plans do you offer after launch?', ar: 'ما هي خطط الصيانة واتفاقية مستوى الخدمة بعد الإطلاق؟' },
    a: { en: 'Monthly plans covering monitoring, backups, server audits, package upgrades, and security patches. SLAs guarantee response from 24 hours down to 1 hour for critical emergencies, and uptime up to 99.9% with automatic failover. Clients without a plan are billed hourly for support requests.', ar: 'خطط شهرية تشمل المراقبة والنسخ الاحتياطية وتدقيق الخوادم وترقية الحزم والرقع الأمنية. تضمن اتفاقيات SLA استجابة من 24 ساعة حتى ساعة للحالات الحرجة ووقت تشغيل 99.9% مع تجاوز الأعطال التلقائي. العملاء بدون خطة يُفوتَرون بالساعة.' }, link: '#/contact' },

  { id: 'ack_scope', tags: 'scope sow change request out of scope extra work نطاق عمل طلب تغيير خارج النطاق عمل إضافي',
    q: { en: 'What happens if I need features outside the original scope?', ar: 'ماذا يحدث إذا احتجت ميزات خارج النطاق الأصلي؟' },
    a: { en: 'Any work outside the SOW triggers a formal Change Request (CR). We estimate hours, cost, and timeline impact then proceed only after your written approval. This keeps billing fully transparent and prevents unexpected delays at handover.', ar: 'أي عمل خارج وثيقة نطاق العمل يطلق طلب تغيير رسمي (CR). نقدر الساعات والتكلفة وتأثير الجدول الزمني ونمضي قدماً فقط بعد موافقتك الكتابية. هذا يبقي الفوترة شفافة تماماً ويمنع التأخيرات غير المتوقعة عند التسليم.' }, link: '#/contact' },

  { id: 'ack_hosting', tags: 'hosting deployment infrastructure cloud server domain ssl استضافة نشر بنية تحتية سحابية خادم نطاق',
    q: { en: 'Who pays for hosting and infrastructure after delivery?', ar: 'من يدفع تكاليف الاستضافة والبنية التحتية بعد التسليم؟' },
    a: { en: 'We configure your cloud infrastructure (AWS, Azure, GCP, or shared hosting) with SSL and deployment pipelines. Unless you sign a managed infrastructure plan, all hosting and domain costs are paid directly by you to the provider. We are not liable for downtime or data loss on client-owned infrastructure.', ar: 'نقوم بتكوين بنيتك التحتية السحابية (AWS أو Azure أو GCP أو استضافة مشتركة) مع SSL ومسارات النشر. ما لم توقع عقد إدارة بنية تحتية مخصص تُدفع تكاليف الاستضافة والنطاق مباشرة منك للمزود. لا نتحمل مسؤولية التعطل أو فقدان البيانات على البنية التحتية المملوكة من العميل.' }, link: '#/services' },

  { id: 'ack_liability', tags: 'liability limit indemnify damages compensation cap مسؤولية تعويض أضرار حد أقصى',
    q: { en: 'What is Noviq\'s liability cap for project issues?', ar: 'ما هو الحد الأقصى لمسؤولية نوفيك عن مشاكل المشروع؟' },
    a: { en: 'Our total liability is capped at the total amount paid under the active SOW. We are not liable for indirect or consequential damages such as lost profits or revenue. The Client indemnifies Noviq against third-party claims from misuse of delivered software or violation of third-party IP rights.', ar: 'إجمالي مسؤوليتنا محدودة بإجمالي المبلغ المدفوع بموجب وثيقة نطاق العمل النشطة. لا نتحمل مسؤولية الأضرار غير المباشرة أو التبعية كفقدان الأرباح أو الإيرادات. يُعوّض العميل نوفيك ضد مطالبات الأطراف الثالثة الناشئة عن سوء استخدام البرمجيات المسلمة أو انتهاك حقوق الملكية الفكرية.' }, link: '#/contact' },

  { id: 'ack_force_majeure', tags: 'force majeure disaster emergency delay act of god war قوة قاهرة كارثة طارئة تأخير حرب',
    q: { en: 'What happens if an emergency delays the project?', ar: 'ماذا يحدث إذا تسببت حالة طارئة في تأخير المشروع؟' },
    a: { en: 'Neither party is liable for delays caused by events beyond reasonable control — acts of God, war, terrorism, natural disasters, government restrictions, or internet outages. The affected party notifies the other in writing within 5 business days. All other agreement terms remain in full force.', ar: 'لا يتحمل أي طرف مسؤولية التأخيرات الناجمة عن أحداث خارجة عن السيطرة المعقولة — قضاء وقدر أو حرب أو إرهاب أو كوارث طبيعية أو قيود حكومية أو انقطاع الإنترنت. يُخطَر الطرف الآخر كتابةً خلال 5 أيام عمل. تبقى جميع شروط الاتفاقية الأخرى سارية.' }, link: '#/contact' },

  { id: 'ack_client_duties', tags: 'client obligations feedback access project manager responsibilities واجبات العميل ملاحظات صلاحيات مدير مشروع مسؤوليات',
    q: { en: 'What are my responsibilities as a client during the project?', ar: 'ما هي مسؤولياتي كعميل خلال المشروع؟' },
    a: { en: 'Assign a decision-making Project Manager, provide feedback within 3 business days, and deliver required access (APIs, credentials, brand assets) on time. Delays on your side auto-adjust the timeline. You also warrant ownership of all content and data you provide us for inclusion in the project.', ar: 'عيّن مدير مشروع لديه صلاحية اتخاذ القرار وقدم ملاحظاتك خلال 3 أيام عمل وسلّم الوصول المطلوب (APIs وبيانات الاعتماد والأصول البصرية) في الوقت المناسب. التأخيرات من جانبك تُعدّل الجدول الزمني تلقائياً. كما تضمن ملكيتك لجميع المحتوى والبيانات التي تزودنا بها.' }, link: '#/contact' },

  { id: 'ack_agile', tags: 'agile sprint methodology demo qa testing review منهجية مرنة سبرنت عرض اختبار جودة مراجعة',
    q: { en: 'How does the agile sprint development process work?', ar: 'كيف تعمل منهجية التطوير المرن بالسبرنت؟' },
    a: { en: 'We run weekly or bi-weekly sprints: features are built, tested by a QA engineer on a staging server, then demoed to you. You steer priorities each cycle. Minor tweaks happen within the sprint; significant changes go through a Change Request process with cost and timeline estimates agreed before proceeding.', ar: 'نعمل بسبرنتات أسبوعية أو نصف شهرية: تُبنى الميزات ويختبرها مهندس ضمان جودة على خادم تجريبي ثم تُعرض عليك. أنت تحدد الأولويات في كل دورة. التعديلات الطفيفة تتم داخل السبرنت؛ التغييرات الكبيرة تمر عبر طلب تغيير مع تقديرات تكلفة وجدول زمني قبل المتابعة.' }, link: '#/contact' },

  { id: 'ack_entire_agreement', tags: 'agreement binding legal enforceable electronic signature entire اتفاقية ملزمة قانونية توقيع إلكتروني شاملة',
    q: { en: 'Is the Noviq acknowledgment legally binding and complete?', ar: 'هل إقرار نوفيك ملزم قانوناً وشامل؟' },
    a: { en: 'Yes. This Acknowledgment is the entire binding agreement between you and Noviq Solutions. Electronic signatures carry the same legal weight as handwritten ones. No modification is valid unless in writing and signed by authorised executives of both parties. It supersedes all prior oral or written understandings.', ar: 'نعم. هذا الإقرار هو الاتفاقية الملزمة الكاملة بينك وبين نوفيك سوليوشنز. التوقيعات الإلكترونية تحمل نفس الثقل القانوني للتوقيعات المكتوبة بخط اليد. لا يصح أي تعديل ما لم يكن مكتوباً وموقعاً من مسؤولين مفوضين من الطرفين. يلغي جميع التفاهمات السابقة.' }, link: '#/contact' },
];

for (const f of FAQS_EXTRA) FAQS.push(f);

/* ============================================================
   GENERATED KEYWORD EXPANSION — compositional tree
   ------------------------------------------------------------
   verbs/askers/pricers/timers × product-phrases per intent.
   Deterministic at load; adds 4000+ phrases (GENERATED_COUNT)
   on top of the hand-written base without bloating this file.
   ============================================================ */

const GEN_PARTS = {
  ar: {
    want: ['ابغى', 'ابي', 'اريد', 'نريد', 'نبغى', 'نبي', 'محتاج', 'محتاجين', 'عايز', 'عايزين', 'ودي في', 'ناوي على'],
    make: ['بناء', 'تطوير', 'تصميم', 'برمجة', 'انشاء', 'عمل', 'تنفيذ', 'اطلاق', 'تجهيز'],
    ask: ['كيف اعمل', 'كيف اسوي', 'هل تعملون', 'هل تسوون', 'هل تبنون', 'تفاصيل عن', 'عرض سعر', 'خدمة'],
    price: ['كم سعر', 'كم تكلفة', 'بكم', 'كم يكلف', 'وش سعر', 'ايش تكلفة', 'اسعار', 'تكلفة'],
    time: ['كم مدة', 'متى يجهز', 'كم يستغرق', 'مدة تنفيذ', 'وقت تنفيذ'],
  },
  en: {
    want: ['i want', 'we want', 'i need', 'we need', 'looking for', 'searching for', 'id like', 'we would like', 'planning to build', 'thinking about'],
    make: ['build', 'develop', 'create', 'make', 'design', 'launch', 'set up', 'implement'],
    ask: ['do you build', 'can you build', 'can you make', 'do you develop', 'details about', 'quote for a', 'help me build', 'service for'],
    price: ['price of', 'cost of', 'how much is', 'how much for', 'pricing for', 'budget for', 'quote for', 'estimate for'],
    time: ['how long to build', 'time to develop', 'timeline for', 'delivery time for', 'duration of'],
  },
};

const GEN_PRODUCTS = {
  service_web: {
    ar: ['موقع', 'موقع الكتروني', 'موقع شركة', 'متجر', 'متجر الكتروني', 'منصة الكترونية', 'بوابة الكترونية', 'لوحة تحكم', 'صفحة هبوط', 'ويب سايت', 'موقع تعريفي'],
    en: ['website', 'web app', 'company website', 'online store', 'ecommerce website', 'web platform', 'web portal', 'dashboard', 'landing page', 'corporate site', 'business website'],
  },
  service_mobile: {
    ar: ['تطبيق', 'تطبيق جوال', 'تطبيق موبايل', 'تطبيق ايفون', 'تطبيق اندرويد', 'ابلكيشن', 'تطبيق متجر', 'تطبيق توصيل', 'تطبيق حجز', 'تطبيق مطعم'],
    en: ['mobile app', 'iphone app', 'android app', 'ios app', 'delivery app', 'booking app', 'shopping app', 'restaurant app', 'fitness app', 'taxi app'],
  },
  service_erp: {
    ar: ['نظام erp', 'نظام محاسبة', 'نظام مخزون', 'نظام موارد بشرية', 'نظام مشتريات', 'نظام رواتب', 'نظام ادارة شركة', 'نظام فواتير', 'نظام مستودعات'],
    en: ['erp system', 'accounting system', 'inventory system', 'hr system', 'payroll system', 'invoicing system', 'procurement system', 'company management system', 'warehouse system'],
  },
  service_crm: {
    ar: ['نظام crm', 'نظام مبيعات', 'نظام عملاء', 'نظام تذاكر', 'نظام دعم فني', 'نظام متابعة عملاء'],
    en: ['crm system', 'sales system', 'ticketing system', 'customer support system', 'lead management system', 'client tracking system'],
  },
  service_ai: {
    ar: ['شات بوت', 'بوت واتساب', 'نظام ذكاء اصطناعي', 'نموذج ذكاء اصطناعي', 'مساعد ذكي', 'نظام توصيات', 'نظام تنبؤ', 'روبوت محادثة'],
    en: ['chatbot', 'ai chatbot', 'whatsapp bot', 'ai model', 'ai assistant', 'recommendation system', 'prediction system', 'ai agent'],
  },
  service_saas: {
    ar: ['منصة ساس', 'منصة اشتراكات', 'نظام اشتراكات', 'منصة خدمية'],
    en: ['saas platform', 'subscription platform', 'saas product', 'subscription service'],
  },
  service_cloud: {
    ar: ['بنية سحابية', 'سيرفرات', 'استضافة سحابية', 'خوادم'],
    en: ['cloud infrastructure', 'cloud setup', 'server setup', 'devops pipeline'],
  },
  service_automation: {
    ar: ['اتمتة', 'اتمتة عمليات', 'اتمتة اعمال', 'سير عمل الي'],
    en: ['automation', 'process automation', 'workflow automation', 'business automation'],
  },
};

let GENERATED_COUNT = 0;
(function expandIntentKeywords() {
  for (const [intent, prods] of Object.entries(GEN_PRODUCTS)) {
    if (!INTENTS[intent]) continue;
    for (const lang of ['ar', 'en']) {
      const existing = new Set(INTENTS[intent][lang]);
      const parts = GEN_PARTS[lang];
      for (const p of prods[lang]) {
        const phrases = [p];
        for (const v of parts.want) phrases.push(v + ' ' + p);
        for (const v of parts.make) phrases.push(v + ' ' + p);
        for (const v of parts.ask) phrases.push(v + ' ' + p);
        for (const v of parts.price) phrases.push(v + ' ' + p);
        for (const v of parts.time) phrases.push(v + ' ' + p);
        for (const ph of phrases) {
          if (!existing.has(ph)) {
            existing.add(ph);
            INTENTS[intent][lang].push(ph);
            GENERATED_COUNT++;
          }
        }
      }
    }
  }
})();

/* ============================================================
   TOPIC TREE — 150 topics organized for structured access
   (10 categories → intents + FAQ topics). Powers /chatbot/topics.
   ============================================================ */

const TOPIC_TREE = [
  { id: 'general', label: { en: 'General & Chat', ar: 'عام ومحادثة' }, icon: 'message-circle',
    intents: ['greeting', 'goodbye', 'thanks', 'help', 'bot_identity', 'language_switch'] , faqs: [] },
  { id: 'services', label: { en: 'Services', ar: 'الخدمات' }, icon: 'layers',
    intents: ['services_overview', 'service_ai', 'service_erp', 'service_crm', 'service_cloud', 'service_saas', 'service_web', 'service_mobile', 'service_api', 'service_automation', 'service_custom'], faqs: [] },
  { id: 'ai', label: { en: 'AI & Data', ar: 'الذكاء الاصطناعي والبيانات' }, icon: 'brain',
    intents: [], faqs: ['rag_chatbot', 'custom_gpt', 'arabic_nlp', 'computer_vision_qc', 'demand_forecasting', 'recommender', 'ai_cost_data', 'ai_privacy', 'ai_dashboards', 'data_migration', 'etl_warehouse'] },
  { id: 'web_mobile', label: { en: 'Web & Mobile', ar: 'الويب والجوال' }, icon: 'smartphone',
    intents: [], faqs: ['pwa', 'site_speed', 'redesign_migration', 'cms_compare', 'accessibility_compliance', 'multilang_seo', 'landing_pages', 'seo', 'flutter_vs_native', 'app_publish', 'push_notifications', 'offline_apps', 'app_maintenance', 'app_mvp', 'multilingual', 'cms'] },
  { id: 'commerce', label: { en: 'E-commerce', ar: 'التجارة الإلكترونية' }, icon: 'shopping-bag',
    intents: ['industry_ecommerce'], faqs: ['ecommerce_platform', 'payments_fail', 'shipping_integration', 'multi_currency', 'abandoned_cart', 'product_sync', 'payment_gateways', 'marketplace'] },
  { id: 'operations', label: { en: 'ERP & Operations', ar: 'الأنظمة والعمليات' }, icon: 'settings',
    intents: [], faqs: ['odoo_custom', 'erp_migration', 'barcode_inventory', 'e_invoice', 'hr_payroll', 'approvals_workflow', 'procurement', 'migration_excel', 'pos', 'reports', 'legacy', 'takeover', 'performance'] },
  { id: 'infra', label: { en: 'Cloud & Security', ar: 'السحابة والأمان' }, icon: 'shield-check',
    intents: ['technology', 'security'], faqs: ['aws_vs_azure', 'kubernetes_docker', 'serverless', 'backups_policy', 'pentest', 'ddos_protection', 'monitoring', 'hosting', 'scalability', 'uptime', 'data_privacy'] },
  { id: 'engagement', label: { en: 'Working With Us', ar: 'العمل معنا' }, icon: 'handshake',
    intents: ['pricing', 'payment', 'timeline', 'process', 'meeting', 'support', 'start_project', 'team'], faqs: ['agile_sprints', 'fixed_vs_tm', 'mvp_scope', 'change_requests', 'project_kickoff', 'staging_env', 'warranty', 'nda', 'source_code', 'maintenance', 'discount', 'revisions', 'small_budget', 'contract', 'dedicated_team', 'code_quality', 'communication', 'vs_freelancer', 'consulting', 'free_consultation', 'refund', 'start_today', 'handover', 'remote', 'hours', 'cost_estimator', 'solution_builder', 'ack_overview', 'ack_ip', 'ack_nda_conf', 'ack_privacy', 'ack_warranty_detail', 'ack_payment_terms', 'ack_termination', 'ack_dispute', 'ack_sla_maintenance', 'ack_scope', 'ack_hosting', 'ack_liability', 'ack_force_majeure', 'ack_client_duties', 'ack_agile', 'ack_entire_agreement'] },
  { id: 'industries', label: { en: 'Industries', ar: 'القطاعات' }, icon: 'building-2',
    intents: ['industries', 'industry_healthcare', 'industry_finance', 'industry_other'], faqs: ['telehealth', 'school_management', 'fintech_compliance', 'logistics_fleet', 'hospitality_pms', 'government_portals', 'gym_membership', 'charity_donations', 'lms', 'booking', 'delivery', 'real_estate', 'restaurant'] },
  { id: 'company', label: { en: 'Company & Integrations', ar: 'الشركة والتكاملات' }, icon: 'globe',
    intents: ['about_company', 'stats', 'locations', 'contact', 'careers', 'testimonials', 'why_us', 'newsletter', 'ai_lab', 'portfolio'], faqs: ['google_maps', 'sms_otp', 'erp_ecom_sync', 'zapier_automation', 'social_login', 'whatsapp', 'languages_spoken', 'account_benefits', 'resources', 'code_quality'] },
];

/* Validate tree integrity + compute topic count (dedup across categories) */
const TOPIC_COUNT = (() => {
  const faqIds = new Set(FAQS.map(f => f.id));
  const seen = new Set();
  for (const cat of TOPIC_TREE) {
    for (const i of cat.intents) {
      if (!INTENTS[i]) console.warn('[Knowledge] TOPIC_TREE unknown intent:', i);
      seen.add('i:' + i);
    }
    for (const f of cat.faqs) {
      if (!faqIds.has(f)) console.warn('[Knowledge] TOPIC_TREE unknown faq:', f);
      seen.add('f:' + f);
    }
  }
  /* Any intent/FAQ not placed in the tree still counts as a topic */
  for (const i of Object.keys(INTENTS)) seen.add('i:' + i);
  for (const f of faqIds) seen.add('f:' + f);
  return seen.size;
})();

/* Intent metadata for the admin panel — category + human-readable labels.
   Categories: company | services | business | general
   Powers the "Chatbot Replies" editor in the admin dashboard. */
const INTENT_META = {
  greeting:          { category: 'general',  label: { en: 'Greeting',                 ar: 'الترحيب' } },
  goodbye:           { category: 'general',  label: { en: 'Goodbye',                  ar: 'الوداع' } },
  thanks:            { category: 'general',  label: { en: 'Thanks',                   ar: 'الشكر' } },
  help:              { category: 'general',  label: { en: 'Help / Capabilities',       ar: 'المساعدة والقدرات' } },
  bot_identity:      { category: 'general',  label: { en: 'Bot Identity',             ar: 'هوية المساعد' } },
  language_switch:   { category: 'general',  label: { en: 'Language Switch',           ar: 'تبديل اللغة' } },

  about_company:     { category: 'company',  label: { en: 'About the Company',        ar: 'عن الشركة' } },
  stats:             { category: 'company',  label: { en: 'Company Statistics',       ar: 'إحصائيات الشركة' } },
  team:              { category: 'company',  label: { en: 'The Team',                 ar: 'الفريق' } },
  locations:         { category: 'company',  label: { en: 'Offices / Locations',      ar: 'المكاتب والمواقع' } },
  contact:           { category: 'company',  label: { en: 'Contact Info',             ar: 'معلومات التواصل' } },
  careers:           { category: 'company',  label: { en: 'Careers / Jobs',           ar: 'الوظائف' } },
  testimonials:      { category: 'company',  label: { en: 'Client Testimonials',      ar: 'آراء العملاء' } },
  why_us:            { category: 'company',  label: { en: 'Why Choose Noviq',         ar: 'لماذا نوفيك' } },
  newsletter:        { category: 'company',  label: { en: 'Newsletter / Resources',   ar: 'النشرة والمصادر' } },
  ai_lab:            { category: 'company',  label: { en: 'AI Lab',                   ar: 'مختبر الذكاء' } },
  technology:        { category: 'company',  label: { en: 'Tech Stack',               ar: 'التقنيات المستخدمة' } },

  services_overview: { category: 'services', label: { en: 'Services Overview',        ar: 'نظرة على الخدمات' } },
  service_ai:        { category: 'services', label: { en: 'AI Solutions',             ar: 'حلول الذكاء الاصطناعي' } },
  service_erp:        { category: 'services', label: { en: 'ERP Systems',              ar: 'أنظمة ERP' } },
  service_crm:        { category: 'services', label: { en: 'CRM Platforms',            ar: 'منصات CRM' } },
  service_cloud:     { category: 'services', label: { en: 'Cloud Solutions',           ar: 'الحلول السحابية' } },
  service_saas:      { category: 'services', label: { en: 'SaaS Development',          ar: 'تطوير SaaS' } },
  service_web:       { category: 'services', label: { en: 'Web Development',          ar: 'تطوير الويب' } },
  service_mobile:    { category: 'services', label: { en: 'Mobile Apps',               ar: 'تطبيقات الجوال' } },
  service_api:       { category: 'services', label: { en: 'API Development',           ar: 'تطوير الواجهات البرمجية' } },
  service_automation:{ category: 'services', label: { en: 'Automation',               ar: 'الأتمتة' } },
  service_custom:    { category: 'services', label: { en: 'Custom Software',           ar: 'برمجيات مخصصة' } },
  industries:        { category: 'services', label: { en: 'Industries Served',         ar: 'القطاعات المخدومة' } },
  industry_healthcare:{ category: 'services', label: { en: 'Healthcare Industry',     ar: 'قطاع الرعاية الصحية' } },
  industry_finance:  { category: 'services', label: { en: 'Finance Industry',         ar: 'القطاع المالي' } },
  industry_ecommerce:{ category: 'services', label: { en: 'E-commerce Industry',       ar: 'التجارة الإلكترونية' } },
  industry_other:    { category: 'services', label: { en: 'Other Industries',          ar: 'قطاعات أخرى' } },

  pricing:           { category: 'business', label: { en: 'Pricing',                  ar: 'الأسعار' } },
  payment:           { category: 'business', label: { en: 'Payment Terms',           ar: 'شروط الدفع' } },
  timeline:          { category: 'business', label: { en: 'Project Timeline',        ar: 'مدة المشروع' } },
  process:           { category: 'business', label: { en: 'Work Process',             ar: 'منهجية العمل' } },
  portfolio:         { category: 'business', label: { en: 'Portfolio / Projects',     ar: 'الأعمال والمشاريع' } },
  meeting:           { category: 'business', label: { en: 'Book a Meeting',           ar: 'حجز اجتماع' } },
  support:           { category: 'business', label: { en: 'Support / SLA',            ar: 'الدعم والصيانة' } },
  start_project:     { category: 'business', label: { en: 'Start a Project',          ar: 'بدء مشروع' } },
  security:          { category: 'business', label: { en: 'Security / NDA',           ar: 'الأمان والسرية' } },
};

/* Map FAQ ids to admin categories (mirrors TOPIC_TREE groupings). */
const FAQ_CATEGORIES = {
  ai: 'services', web_mobile: 'services', commerce: 'services',
  operations: 'services', infra: 'services', industries: 'services',
  engagement: 'business', company: 'company', general: 'general',
};

module.exports = { INTENTS, FAQS, SUGGESTS, TOPIC_TREE, TOPIC_COUNT, GENERATED_COUNT, INTENT_META, FAQ_CATEGORIES };
