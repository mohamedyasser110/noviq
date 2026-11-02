import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Bot, BarChart3, Brain, Code2, FileText, Play, Settings } from 'lucide-react';
import { isPageEnabled } from '@/lib/pages-content';

export default async function AILabPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  /* Retired from the site: the admin marks ai-lab closed
     (Site Content → Pages). Direct URLs render the locale 404. */
  if (!(await isPageEnabled('ai-lab'))) notFound();
  const isRTL = locale === 'ar';

  const modules = [
    {
      id: 'ocr',
      icon: FileText,
      title: isRTL ? 'معالجة الوثائق الضوئية OCR' : 'AI Document Processing (OCR)',
      desc: isRTL ? 'استخراج وفهرسة النصوص والجداول والبيانات من المستندات.' : 'Extract and index text, tables, and data from documents automatically.',
    },
    {
      id: 'chatbot',
      icon: Bot,
      title: isRTL ? 'مساعد ذكاء اصطناعي' : 'AI Chat Assistant',
      desc: isRTL ? 'دردشة ذكية مدعومة بـ LLM تدعم البحث الدلالي وذاكرة الجلسات.' : 'LLM-powered conversational assistant with semantic search and session memory.',
    },
    {
      id: 'predict',
      icon: BarChart3,
      title: isRTL ? 'تنبؤات الأعمال' : 'Business Forecasting',
      desc: isRTL ? 'نماذج تنبؤية للطلب، المخزون، والمصاريف.' : 'Predictive models for demand, inventory, and cost forecasting.',
    },
    {
      id: 'optimize',
      icon: Settings,
      title: isRTL ? 'التحسين الذكي' : 'Smart Optimization',
      desc: isRTL ? 'تحسين سير العمل والعمليات باستخدام الخوارزميات.' : 'Workflow and process optimization using advanced algorithms.',
    },
    {
      id: 'insights',
      icon: Brain,
      title: isRTL ? 'استخراج الأفكار' : 'Insight Extraction',
      desc: isRTL ? 'تحويل البيانات غير المنظمة إلى رؤى قابلة للعمل.' : 'Turn unstructured data into actionable insights.',
    },
    {
      id: 'builder',
      icon: Code2,
      title: isRTL ? 'منشئ حلول AI' : 'AI Solution Builder',
      desc: isRTL ? 'أداة سحب وإفلات لبناء حلول ذكاء اصطناعي مخصصة.' : 'Drag-and-drop tool to build custom AI solutions without coding.',
    },
  ];

  return (
    <div className="min-h-screen">
      <header className="bg-slate-50 dark:bg-slate-900 py-16 md:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white mb-4">
            {isRTL ? 'مختبر الذكاء الاصطناعي' : 'AI Lab'}
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-300 max-w-3xl mx-auto">
            {isRTL ? 'أدوات ذكاء اصطناعي متطورة مبنية على منصتنا لتمكين الابتكار والأتمتة.' : 'Advanced AI tools built on our platform to drive innovation and automation.'}
          </p>
        </div>
      </header>

      <section className="py-16 md:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {modules.map((mod) => (
              <article
                key={mod.id}
                className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 hover:shadow-xl transition-shadow duration-300"
              >
                <div className="h-14 w-14 rounded-xl bg-primary/10 flex items-center justify-center text-primary mb-4">
                  <mod.icon className="h-7 w-7" aria-hidden="true" />
                </div>
                <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
                  {mod.title}
                </h2>
                <p className="text-slate-600 dark:text-slate-400 mb-6">{mod.desc}</p>
                <Link
                  href={`/${locale}/builder`}
                  className="inline-flex items-center gap-2 min-h-[44px] text-primary font-medium hover:underline"
                >
                  {isRTL ? 'جرّبه الآن' : 'Try It Now'}
                  <Play className="h-4 w-4" aria-hidden="true" />
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
