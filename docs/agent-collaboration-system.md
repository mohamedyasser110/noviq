# 🤝 نظام تعاون الوكلاء في الوقت الحقيقي — Noviq Project

## 🎯 الهدف
حل مشكلة التداخل بين الوكلاء المتعددين الذين يعملون على نفس الملفات بشكل متزامن، وتقديم آلية اتصال مركزية تتيح للوكلاء بالعمل معاً في الوقت الحقيقي دون تعارضات.

---

## 📊 التحليل الحالي: التداخلات الحاصلة

### 1. التداخل على ملف `content-admin.js`
- **الوكيل Frontend** يقرأ/يقرأ `NOVIQ_CONTENT` العام من `content.config.js`
- **الوكيل Backend** ينشئ `content.config.js` من SQLite عبر `content-store.js`
- **الوكيل Debugger** قد يعدل على منطق الدمج في `applyToLive()`
- **النتيجة**: عند تشغيل كل وكيل في جلسة منفصلة، يعملون بكل منهم على نسخة قديمة ويفوت التوافق

### 2. التداخل على ملفات العقد (Contracts)
- **الوكيل Architect** يحدّث `contracts/api/*.json`
- **الوكيل Backend** ينشئ `backend/routes/*.js` من العقود
- **الوكيل Reviewer** يفحص كلاكماً
- **النتيجة**: لا يوجد ضمان أن العقد والمسارات متزامنة في الوقت الحقيقي

### 3. التداخل على قاعدة البيانات Schema
- **الوكيل Backend** يضيف جداول عبر `db/init.js`
- **الوكيل Frontend** يستهلك API المرتبط بهذه الجداول
- **الوكيل Tester** يكتب اختبارات
- **النتيجة**: التغييرات في Schema ليست مرئية للوكلاء الآخرين فوراً

### 4. التداخل على ملفات CSS/Design Tokens
- **الوكيل Frontend** يعدّل على `css/tokens.css` و `theme-simple.css`
- **الوكيل Reviewer** يفحص التباين والخطوط
- **الوكيل Frontend** الآخر (مع مهارة `design-taste-frontend`) قد يعيد تعريف الون
- **النتيجة**: تعارض في القيم وتكرار العمل

---

## 🏗️ الحل المقترح: نظام رسائل مركزية (Central Message Bus)

### 1. بنية النظام
```
C:\Downloads\Noviq - final\
├── .agent-system/                    # مجلد نظام تعاون الوكلاء
│   ├── message-bus.js               # خادم الرسائل (WebSocket/HTTP)
│   ├── agent-registry.json           # سجل الوكلاء النشطين
│   ├── file-locks/                  # نظام قفل الملفات
│   │   ├── active-locks.json        # القفل الحالي على كل ملف
│   ├── schemas/                     # مخططات Schema المشتركة
│   │   ├── content.json      # مخطط المحتوى الموحد
│   │   ├── api-endpoints.json       # قائمة النقاط النهائية النشطة
│   │   ├── db-schema.json           # مخطط قاعدة البيانات الموحد
│   │   ├── design-tokens.json       # الرموز التصميمية الموحدة
│   ├── events/                      # سجل الأحداث
│   │   ├── recent-events.log
│   ├── patches/                     # تغذية التغييرات
│   │   ├── pending/                 # تغييرات معلقة
│   │   ├── applied/                 # تغييرات مطبقة
│   ├── README.md                    # دليل الاستخدام
│   └── AGENTS_COORDINATION.md       # قواعد التنسيق بين الوكلاء
```

### 2. بروتوكول الرسائل (Message Protocol)

جميع الرسائل تمر عبر HTTP POST إلى `/api/agent-bus/message` مع شكل موحد:

```json
{
  "type": "LOCK_ACQUIRE | LOCK_RELEASE | FILE_CHANGED | SCHEMA_UPDATED | AGENT_JOIN | AGENT_LEAVE",
  "source_agent": "frontend",
  "target_agent": "backend",  // null = إرسال للكل
  "payload": { ... },         // بيانات الرسالة
  "timestamp": "2026-09-26T10:00:00.000Z",
  "correlation_id": "uuid"    // لربط الرسائل ذات الصلة
}
```

### 3. نظام قفل الملفات (File Locking)

#### قبل أي تعديل:
```js
// 1. طلب القفل
const lockResult = await fetch('/api/agent-bus/lock', {
  method: 'POST',
  body: JSON.stringify({
    file: 'frontend/data/content.config.js',
    reason: 'Adding new services section',
    agent: 'ultra-build'
  })
});

// 2. إذا نجح القفل → نفّذ التعديل
// 3. بعد الانتهاء → أطلق القفل
const releaseResult = await fetch('/api/agent-bus/lock/release', {
  method: 'POST',
  body: JSON.stringify({
    file: 'frontend/data/content.config.js',
    agent: 'ultra-build'
  })
});
```

#### آلية القفل:
- **قفل مشاركة (Shared Lock)**: للقراءة — يسمح بقراءة متعددة وكيل
- **قفل كتابة (Exclusive Lock)**: للكتابة — يمنع أي وكيل آخر من القراءة أو الكتابة
- **انتهاء صلاحية تلقائياً**: 30 ثانية إذا لم يتم الإطلاق يدوياً
- **إشعار على التصادم**: إذا حاول وكيل القفل على ملف مقفل → يتلقى إشعاراً بالوكيل الحالي

### 4. نظام التخطيط الموحد (Unified Schema Registry)

كل موارد المشروع تُدار من خلال مخطط Schema مركزي:

| المورد | الملف | المسؤولية |
|--------|-------|-----------|
| المحتوى | `schemas/content.json` | Frontend + Backend + Debugger |
| نقاط النهاية | `schemas/api-endpoints.json` | Backend + Architect + Tester |
| قاعدة البيانات | `schemas/db-schema.json` | Backend + Debugger |
| الرموز التصمينية | `schemas/design-tokens.json` | Frontend + Reviewer |

---

## 📝 تطبيق عملي على مشروع Noviq

### التحديث 1: خادم رسائل مركزي
```js
// .agent-system/message-bus.js
const express = require('express');
const http = require('http');
const path = require('path');

const app = express();
app.use(express.json());

// ... (تفاصيل التنفيذ كاملة أدناه)

module.exports = { app, startMessageBus };
```

### التحديث 2: تكامل مع ملف `app.js` الحالي
```js
// backend/app.js - إضافة توجيه الرسائل
const { app: agentBus } = require('../.agent-system/message-bus');
app.use('/api/agent-bus', agentBus);
```

### التحديث 3: ملخص بروتوكول الوكلاء
```js
// كل وكيل يستخدم هذا القالب عند التعامل مع ملفات:
// 1. طلب القفل
// 2. تحديث الـ Schema إذا لزم الأمر  
// 3. تنفيذ التغيير
// 4. إرسال إشعار بـ FILE_CHANGED
// 5. إطلاق القفل
```

---

## 🔄 سير العمل المقترح للوكلاء

### سير عمل Ultra Worker (المنسق الرئيسي):
1. **بدء المهمة**: إنشاء/تحديث Schema ذو الصلة
2. **تخصيص المهام**: إرسال LOCK_ACQUIRE لكل وكيل مطلوب
3. **مراقبة التقدم**: مراقبة FILE_CHANGED و SCHEMA_UPDATED
4. **دمج النتائج**: استخدام Fan-In عند حاجة دمج التغييرات
5. **التحقق النهائي**: إرسال AGENT_LEAVE وتنظيف القفوف

### سير عمل كل وكيل متخصص:
1. **الاتصال**: إرسال AGENT_JOIN عند بدء المهمة
2. **القراءة**: استخدام Shared Lock للقراءة من الملفات
3. **الكتابة**: استخدام Exclusive Lock + تحديث Schema أولاً
4. **الإبلاغ**: إرسال FILE_CHANGED بعد كل تعديل
5. **الانتهاء**: إرسال AGENT_LEAVE عند الانتهاء

---

## 🧪 التحقق والاختبار

سيتم إنشاء:
- اختبار وحدة لخادم الرسائل (`test-message-bus.js`)
- سيناريوهات اختبار تداخل (lock contention test)
- نظام تسجيل أحداث مرئي لمراقبة الوكلاء

---

*تم إنشاء هذا النظام بناءً على التحليل الفعلي لبنية وتفاعل الوكلاء في المشروع Noviq.*