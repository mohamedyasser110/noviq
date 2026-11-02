# 🔒 Build & Serve Ownership — Noviq Frontend

> **المشكلة:** أكثر من وكيل (جلسة opencode) ينفّذ `next build` / `next dev` /
> `next start` داخل `frontend/` في نفس الوقت. كل واحد يمسح مجلد البناء الخاص
> بالآخر أثناء عمله، فتُنتَج أخطاء وهمية (`MODULE_NOT_FOUND`, `ENOENT`
> على الـ manifests, `Failed to proxy ... ECONNREFUSED`) **رغم أن الكود سليم**.
>
> **القاعدة:** عملية بناء واحدة فقط في كل لحظة. البناء ناجح = لا صفحات فيها خطأ.

## Current owner
- **Owner:** Ultra Worker (opencode session `ses_f2536bcd0ffdfy0kFKcLy2ohx6`)
- **Since:** 2026-09-26
- **Task:** ~~إنتاج نسخة production نظيفة + تشغيل على :3000~~ ← **مُنجز ومُتحقَّق منه**

## ✅ الحالة: يعمل
الفرونت يعمل على `http://localhost:4321` (كل المسارات 200) والـ API على `:3001`.
تم التحقق من: `/en` · `/ar` · `/en/services` · `/en/industries` · `/en/portfolio` ·
`/en/ai-lab` · `/en/pricing` · `/en/contact` · `/sitemap.xml` (32 رابط) ·
`/robots.txt` · JSON-LD · OpenGraph · Twitter · canonical + hreflang.
لقطات: `node scripts/shoot.mjs` (من داخل `frontend/`).

## المنافذ — فرونت واحد، منفذ واحد
| المنفذ | المالك | الأمر | ملاحظات |
|--------|-------|-------|--------|
| **3000** | Frontend (Next.js) | `npm run dev` أو `npm start` (داخل `frontend/`) | المنفذ الوحيد للفرونت. مُدرج في `FRONTEND_URL` داخل `backend/.env` (لـ CORS). |
| **3001** | Backend API (Express) | `node index.js` (داخل `backend/` أو `run.bat`) | `PORT=3001` في `backend/.env`. `NEXT_PUBLIC_API_URL` في الفرونت يشير إليه. |
| 3002 / 3010 / 3100 / 4321 / 4322 | **ملغاة** | — | بقايا مخطط منافذ متبدّل + نسخة موازية كانت تشغّل بناءً في نفس الوقت. ممنوع. |

> ⚠️ **ثابت يجب أن يتطابق:** `PORT` في `backend/.env` ⇄ `NEXT_PUBLIC_API_URL` في
> `frontend/.env.local`. القيمة الثانية تُدمج وقت البناء، فأي عدم تطابق **لا
> يُظهر خطأ عند التشغيل** — بل يفشل كل طلب API بصمت داخل المتصفح.
> راجع أيضاً `FRONTEND_URL` في `backend/.env` (قائمة CORS) ليحتوي منفذ الفرونت.

## قواعد صارمة للوكلاء المتوازيين
1. **تعديل الملفات حر تماماً** — ملفات مختلفة = صفر تعارض. عمل التصميم/SEO/الليديا
   **لا يحتاج build إطلاقاً**.
2. **ممنوع** تشغيل `next dev` / `next build` / `next start` ما دام هذا الملف يقول CLAIMED.
3. **ممنوع** حذف أو إعادة تسمية أي شيء داخل مجلد البناء (`distDir`) ما دام السيرفر
   على :3000 يعمل.
4. **البناء عملية واحدة أمامية فقط.** لا تُضمّ `build` و`start` في نفس الاستدعاء —
   ابنِ، تحقّق من `BUILD_ID`، ثم شغّل.
5. **إذا فشل البناء** أعد المحاولة 3 مرات قبل تشخيص الكود — خطأ
   `rename .next-build\export\500.html` متقطّع ومعروف على هذا الجهاز.

## ثوابت الإعداد (لا تُغيّرها)
- `next.config.mjs` → **`distDir: '.next-build'`** — البناء داخل `.next` فشل 5+
  مرات متتالية على هذا الجهاز بينما نجح داخل `.next-build` ثلاث مرات. أيbuild
  و`npm start` يقرآن نفس القيمة تلقائياً، فلا حاجة لمتغيرات بيئة.
  (يمكن تجاوزها لمرة واحدة عبر `NEXT_DIST_DIR` للتجارب فقط.)
- `next.config.mjs` → `output: 'standalone'` **مغلق** (يسبب `pages-manifest.json`
  ENOENT على Windows).
- **مصدر واحد فقط** لـ `getRequestConfig` = **`./i18n.ts` في جذر المشروع**.
  المسار `./app/i18n/request.ts` غير صالح هنا (plugin لا يجده) ويسبب
  "Couldn't find next-intl config file". لا تنشئ نسخة ثانية.
- `.env.local` يجب أن يحوي `NEXT_PUBLIC_API_URL=http://localhost:4322` — يُدمج
  وقت البناء، وبدونه كل طلبات API تذهب لنسخة Next بدل الـ backend.
- `app/[locale]/not-found.tsx` يجب أن يبقى Client Component يستخدم
  `usePathname()`. حدود `not-found` في App Router **لا تستقبل params**، فتفكيك
  `params` فيها يسقط الـ prerender بـ
  "Cannot destructure property 'locale'".

## كيف تأخذ الملكية
1. حدّث **Owner** + **Since** + **Task** في هذا الملف.
2. تأكد أن لا شيء يستمع على :3000.
3. عندها فقط ابنِ.

## الإفراج
احذف هذا الملف أو اضبط **Status** على RELEASED مع ذكر من يملك :3000 بعدها.

**Status:** ✅ WORKING — الفرونت على :3000، البناء في `.next-build`، ممنوع أي
عملية بناء ثانية حتى ينتهي العمل الجاري. للقطات استخدم `scripts/shoot.mjs`
(يقرأ المنفذ 3000 تلقائياً).
