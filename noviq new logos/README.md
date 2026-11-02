# دليل لوجوهات Noviq والأصول البصرية (Noviq Logos & Brand Assets Guide)

تم تحديث وتطوير لوجوهات شركة Noviq بالكامل باستخدام الأصول فائقة الدقة المباشرة من المجلد `noviq new logos/New` (`icon-master.png` و `wordmark-master.png`) بدقة 4K وتفريغ خلفية نقي بنسبة 100% مع الحفاظ التام على أصول الزوايا (90° / 180° / 270°) والتوافق مع جميع مقاسات المتصفحات والأجهزة.

---

## 1. بنية اللوجوهات والمواقع المستخدمة فيها (Asset Mapping)

| نوع اللوجو | الملف في المشروع | الأبعاد | الاستخدام في الموقع واللوحة |
|---|---|---|---|
| **اللوجو الصغير (Icon Mark)** | `frontend/public/logo/noviq-icon.webp`<br>`frontend/public/logo/noviq-icon.png` | 512×512 (مفرغ وممركز) | شريط التنقل العلوي (`Navbar.tsx`)<br>شارة الهيرو (`TypewriterBadge.tsx`)<br>لوحة الإدارة (`admin/logo/noviq-icon.webp`) |
| **الأيقونات المفضلة (Favicons)** | `frontend/public/favicon.ico`<br>`frontend/public/favicon.png`<br>`frontend/public/favicon.svg`<br>`frontend/public/icon-192.png`<br>`frontend/public/apple-touch-icon.png` | متعددة (16/32/48/140/180/192) | أيقونة التبويب في المتصفح، ومفضلة الهواتف الذكية (iOS & Android) |
| **اللوجو الكامل (Full Wordmark)** | `frontend/public/logo/noviq-wordmark.webp`<br>`frontend/public/logo/noviq-wordmark.png`<br>`frontend/public/logo/noviq-logo.webp`<br>`frontend/public/logo/noviq-logo.png` | عالي الدقة (مع هوامش أمان) | تذييل الصفحة (`Footer.tsx`)<br>لوحة الإدارة (`admin/logo/noviq-wordmark.webp`) |

---

## 2. زوايا الدوران المحفوظة للتحديثات القادمة (Angle Variants)

تم تجهيز وتفريغ جميع النسخ ذات الزوايا بدقة فائقة، وحفظها بصيغتي `PNG` و `WebP` في مسارين:
- المسار المباشر للفرونت إند: `frontend/public/logo/angles/`
- مسار مجلد الأصول الأصلية: `noviq new logos/processed/`

| الملف | الزاوية | الوصف والشكل | إمكانية الاستخدام في التحديث القادم |
|---|---|---|---|
| `noviq-icon-90deg` | 90° | استقامة رأسية حادة (قمم السهام موجهة للأعلى والأسفل) | رائعة للمؤشرات الرأسية، شاشات التحميل (Loaders)، أو قواطع الأقسام |
| `noviq-icon-180deg` | 180° | دوران بزاوية 180 درجة (أعلى دقة 1600×1600) | دوران كامل 3D للأنيميشن عند مرور الماوس (Hover state) أو التبديل |
| `noviq-icon-270deg` | 270° | انحناء أفقي ديناميكي على شكل حرف S / Z | استخدامها كعلامة رمزية في الواجهات الجانبية أو خلفيات البطاقات |

---

## 3. تقنية تفريغ الخلفية وجودة العرض (Matting & Resolution Engineering)

تم استخدام خوارزمية **Triangulation Alpha Matting (Smith & Blinn)** المتقدمة:
1. **حل ثنائي الخلفية (Dual-Background Solving):**
   - تم استخدام النسخة ذات الخلفية السوداء النقية `(0,0,0)` والنسخة ذات الخلفية البيضاء النقية `(255,255,255)`.
   - حساب قيمة الشفافية الدقيقة رياضياً: $\alpha = 1 - (C_{white} - C_{black})$.
   - هذا يضمن **عدم وجود أي هالة سوداء (Dark Fringe)** عند وضع اللوجو على خلفية بيضاء، و**عدم وجود أي هالة بيضاء (Light Fringe)** عند وضعه على خلفية داكنة.
2. **استقراء الألوان عند الحواف (Color Inpainting on Fringe):**
   - معالجة البكسلات شبه الشفافة عند الحواف لمنع التلاشي الرمادي وضمان تدرج لوني فائق النقاء.
3. **أفضل جودة وضغط (Lossless LANCZOS & High-Quality WebP):**
   - الحفظ بجودة 95% بصيغة WebP الحديثة مع الحفاظ على نسخ PNG فائقة الدقة لضمان سرعة التحميل القصوى وأعلى دقة على شاشات Retina و 4K.

---

## 4. كيفية إعادة التوليد أو التحديث مستقبلاً (Rebuilding Assets)

إذا أردت تعديل أو إعادة توليد جميع الأصول دفعة واحدة بأمر واحد:
```bash
python frontend/scripts/build-logos.py
```
يقوم السكريبت تلقائياً بقراءة الصور المصدرية من مجلد `noviq new logos`، ومعالجتها، وتوزيعها على جميع مجلدات الفرونت إند والباك إند بدقة متناهية.
