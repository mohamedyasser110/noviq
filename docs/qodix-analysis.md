# Qodix.tech — تحليل نظام اللونين + ما تم أخذه لموقع Noviq

> التاريخ: 2026-09-26 | الموقع المحلل: https://qodix.tech/ | موقعنا: `C:\Downloads\Noviq - final\frontend`
> القاعدة: **الحفاظ على ألوان Noviq** (navy + gold + blue) مع تعلم **إدارة** Qodix للونين — لا نسخ للأكواد اللونية.

## 1) ألوان Qodix الحقيقية (من CSS المبني)

```
--qodix-navy: #06205D      (الهيكل: خلفيات داكنة + نصوص + هيدر)
--qodix-royal: #0133A2     (تأكيد هيكلي: أرقام Stats + hover + روابط)
--qodix-cyan: #01A7E1       (الإشارة: eyebrow + السطر الثاني في Hero + أرقام 01-04 على الداكن)
--qodix-crimson: #EB0045    (إجراء واحد فقط: CTA — hover يغمق #c9003b)
--qodix-warm-grey: #D9D8D6  (فواصل 1px)
--qodix-light-grey: #EEE    (خلفية قسم بديل)
--background: #fff
theme-color: #06205D
```

## 2) كيف أدار اللونين؟ (الدرس)

1. **لون إجراء واحد (Single Action):** crimson فقط للأزرار الرئيسية (الهيدر + Hero + الشريط الأخير). الزر الثانوي = outline أبيض، لا لون صلب ثانٍ. Hover = تغميق فقط.
2. **لون إشارة واحد (Single Signal):** cyan فقط لـ eyebrows + ثاني سطر في العنوان + الأرقام الشبحية على الداكن. ممنوع للجسم، ممنوع للمساحات الكبيرة، ممنوع للأزرار.
3. **التدرج بالشفافية لا بألوان جديدة:** `text-navy/65` للجسم، `/45` للـ eyebrow المكتوم، `/70` لوصف Hero، `white/70` و `white/85` و `white/35` للحدود. لا رماديات جديدة.
4. **نظام Hairline:** سطر 1px بلون warm-grey فوق الكروت (`rule-draw` يرسم بـ scaleX)، و `border-t` للمقاييس، و `border-cyan/40` أعلى خطوات العمل على الداكن.
5. **إيقاع الأقسام:** `max-w 1280px + px-6 + py-24 md:py-32`، تناوب أبيض / light-grey / navy / crimson. مساحات تنفس كبيرة.
6. **انضباط الكروت:** `rounded-lg (8px) + border warm-grey + bg-white + p-8`، والـ hover = تغير لون الحد فقط (`hover:border-royal`) + سهم يتحرك `translate-x`. لا رفع، لا توهج، لا ظل.
7. **انضباط الأرقام:** أرقام Stats بلون royal كبير `5xl-6xl extrabold`، والوصف صغير `navy/65` — بدون صناديق أو كروت، typography صرف.
8. **مكون Eyebrow:** `.eyebrow { uppercase, tracking .15em, 12px, bold }` — وفي العربية يلغي التحويل والتباعد.
9. **خط:** Montserrat extrabold بعناوين ضيقة `leading 1.05-1.08` و `max-w-2xl/3xl`. لا نص متدرج.
10. **تفاصيل صغيرة:** سكرول بار رفيع (thumb warm-grey و hover royal)، وتحديد نص cyan، ونمط خلفية خفيف `opacity .08-.12` فقط أعلى القسم.

## 3) خريطة التطبيق على Noviq (بدون تغيير الهوية)

| درس Qodix | مقابل Noviq (ألواننا محفوظة) |
|---|---|
| navy = هيكل | primary الأزرق `210 85% 48%` + navy المؤسسي للخلفيات الداكنة |
| crimson = إجراء واحد | primary الأزرق للأزرار الصلبة فقط (`noviq-cta-primary` مسطح، uppercase، tracking، 8px) |
| cyan = إشارة | gold `accent-action / accent-bright` للإشارات فقط: eyebrows، الأرقام الشبحية، شرطة Stats، top-rule الكروت |
| warm-grey hairline | `hsl(var(--color-border))` بسماكة 1px (`.noviq-rule-draw`) |
| opacity scale | `text-secondary` للجسم بدل إدخال رماديات جديدة |
| py-24/32 + max-w 1280 | `.noviq-section-qodix` + `.noviq-wrap` |
| card hover border-only | `hover:border-primary` + سهم `.noviq-card-arrow` ينزلق |
| stats typography | أرقام `primary-strong 5xl-6xl extrabold` + شرطة ذهبية سفلية |

## 4) ملفات تم تعديلها

- `frontend/styles/globals.css` — طبقة `QODIX DISCIPLINE LAYER`: bridge لمتغيرات Tailwind (`--primary` إلخ)، `.eyebrow`، إيقاع الأقسام، hairline، **ستايل navbar كامل (كان مفقوداً — `noviq-navbar` و `noviq-header-search` و `noviq-theme-toggle` بلا تعريف، لأن بقية ملفات `styles/*.css` ميتة ولا يُستورد منها شيء)**، CTA مسطح، حقول الفورم 8px، `.noviq-footer`، سكرول بار Qodix، وحماية من تجاوز العرض الأفقي.
- `components/sections/Hero.tsx` — eyebrow بدل pill، عنوان `5xl-7xl extrabold leading 1.05`، السطر المميز بلون gold-signal، أزرار `noviq-cta-*`، سهم ينعكس بالعربية، صورة `rounded-lg`، توهج مخفف `opacity .08`.
- `components/sections/Stats.tsx` — أرقام `primary-strong 5xl-6xl extrabold` + شبكة Qodix.
- `components/sections/ServicesGrid.tsx` — eyebrow + `noviq-h2` + `noviq-lead`، كروت `rounded-lg p-8 hover:border-primary` + سهم سفلي.
- `components/sections/Industries.tsx` — نفس الانضباط + `noviq-view-all` + `p-5 sm:p-6` و `text-base sm:text-lg` (إصلاح تجاوز العرض على الموبايل).
- `components/sections/Process.tsx` — **أُعيد بناؤه** كشبكة `sm:2 / lg:4`: رقم شبحي ذهبي + ميدالية زرقاء في سطر واحد + خط علوي ذهبي لكل خطوة (بديل عن العمود الزمني المكسور).
- `components/sections/Contact.tsx` — eyebrow + إيقاع + فورم `rounded-lg` + زر `noviq-cta-primary`.
- `components/sections/Testimonials.tsx` — eyebrow + إيقاع + علامة اقتباس ذهبية + `rounded-lg` + أسهم carousel محدّدة الإزاحة حسب العرض (كانت تتجاوز 768px) مع انعكاس كامل بالعربية.
- `components/layout/Navbar.tsx` — 6 روابط سطح المكتب فقط (الباقي لقائمة الموبايل) + CTA `noviq-nav-cta` + `.noviq-search-icon` على الـ SVG.
- `components/layout/Footer.tsx` — `.noviq-footer` + عناوين `eyebrow` ذهبية + جدول روابط كامل (Careers / Why Noviq لم يكونا موجودين فيظهران كمسار خام) + CTA صغير.
- `frontend/tsconfig.json` — حذف `"../../.noviq-build/types/**/*.ts"` (مجلد غير موجود خارج المشروع كان يولّد أخطاء TS2307).
- `frontend/i18n.ts` — **كان مفقوداً**، أُعيد من `i18n.ts.bak` (كان يوقف `next dev` و `next start`).
- `frontend/scripts/{mkpreview,shots,audit,probe}.mjs` — أدوات فحص بصري/تخطيط **بدون سيرفر** (انظر §6).

## 5) ما لم نأخذه عمداً (للحفاظ على الهوية)

- لم ننسخ `#06205D / #EB0045 / #01A7E1` — ألوان Noviq باقية.
- لم ننسخ خط Montserrat — بقينا على Space Grotesk + Inter + Cairo.
- لم نحول الموقع للأبيض الكامل — الوضع الداكن موجود في التوكنات (gold يفتح إلى `accent-bright` على الداكن).
- لم نزل شريط Liftoff الداكن المميز — هو مقابل شريط Qodix القرمزي الأخير، لكن بهوية Noviq.
- لم نضف pattern SVG خارجي — استخدمنا توهجاً مخففاً بنفس اللون الأساسي.

## 6) تحقق (فُحص بصرياً وتخطيطياً فعلياً)

```bash
cd frontend
npm run type-check        # tsc --noEmit — نظيف (TC_EXIT:0)
npm run build             # 66/66 صفحة ستاتيك
node scripts/mkpreview.mjs # .next/server/app/{en,ar}.html -> HTML مستقل (CSS مدمج)
node scripts/shots.mjs     # لقطات: en (1440) + ar (1440) + en-m (390)
node scripts/audit.mjs     # فحص تجاوز العرض الأفقي @ 390 / 768 / 1440
node scripts/probe.mjs     # قراءات CSS محسوبة (ألوان/أحجام/أنصاف أقطار)
```

اللقطات: `C:\Users\LapShop\AppData\Local\Temp\opencode\shots\`
(`en-0..7.png` + `en-full.png`، `ar-0..7.png` + `ar-full.png`، `en-m-0..13.png` بعرض 390px)

**نتيجة `audit.mjs`: `ALL CLEAN`** — صفر تجاوز أفقي في 6 تركيبات (لغتان × 3 عروض).

### ما ظهر في الفحص وتم إصلاحه

| الملاحظة | الإصلاح |
|---|---|
| زر الـ CTA في الهيدر كان يُقصّ على اليمين (12 رابطاً) | قلصنا روابط سطح المكتب إلى 6 عالية الإشارة (Qodix)، والباقي في قائمة الموبايل + الفوتر |
| أدوات الهيدر (ثيم/بحث/لغة/دخول) بلا تنسيق إطلاقاً | طبقة كاملة لها: مربعات 38px + كبسولة بحث + `.noviq-search-icon` |
| قسم Process مكسور على الديسكتوب (الأيقونة طرت لليسار والرقم في الوسط) | أُعيد كشبكة Qodix: `sm:2 / lg:4` أعمدة، رقم شبحي ذهبي + ميدالية زرقاء في سطر واحد، خط علوي ذهبي لكل خطوة، وحُذف الخط الزمني العمودي |
| أسهم الـ carousel تتجاوز حافة الصفحة عند 768px | إزاحة متجاوبة `-translate-x-2 / md:-6 / lg:-12` + انعكاس كامل بالعربية |
| كروت Industries تتجاوز عرض الموبايل ("Manufacturing" مقصوصة) | `p-5 sm:p-6` + `text-base sm:text-lg` + `min-width: 0` و `overflow-wrap` على كل شبكات الأقسام |
| عناوين الفوتر رمادية + `careers` / `why` يظهران كمسمار خام | `eyebrow` ذهبي + جدول روابط كامل + CTA صغير |
| السهم في زر Hero لا ينعكس بالعربية | `rtl:rotate-180` |

## 7) ملاحظات بيئية مهمة (هذا الجهاز)

1. **`i18n.ts` كان مفقوداً** — فشّل `next dev` بـ "Could not find i18n config" و `next start` بـ "no production build". **أُعيد من `i18n.ts.bak`.** لو ظهر الخطأ نفسه راجع هذا الملف أولاً.
2. **`next build` يفشل أحياناً** بأخطاء كتابة عشوائية (`ENOENT ... pages-manifest.json`، `Unexpected end of JSON input`، `middleware-manifest.json` مفقود) — سببها تقطيع النظام لا الكود. الحل: أعد البناء حتى ينجح (نجح دائماً خلال 1–3 محاولات من 5). **مهم:** لا تثق بوجود `.next\server\app\en.html` كدليل على حداثة البناء — احذف `.next` قبل البناء للتحقق.
3. **السيرفرات الطويلة لا تصمد** على هذا الجهاز: `next dev` / `next start` يموتون خلال ثوانٍ. لذلك أدوات الفحص لا تعتمد على سيرفر إطلاقاً — تقرأ HTML المولّد وتدمج CSS داخله ثم تفتحه من `file://`.
4. **`tsconfig.json` كان يشير** إلى `"../../.noviq-build/types/**/*.ts"` أي `C:\.noviq-build` (خارج المشروع، ومجلد لا وجود له) وكان يسبّب أخطاء `TS2307`. حُذف السطر.
5. **`styles/*.css` كلها ميتة** — المستورد الوحيد هو `styles/globals.css` عبر `app/[locale]/layout.tsx`. لهذا كانت classes مثل `noviq-navbar` و `noviq-header-search` بلا تعريف؛ طبقة Qodix تعرّفها الآن داخل `globals.css`.
