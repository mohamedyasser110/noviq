# 🤝 نظام تعاون الوكلاء في الوقت الحقيقي — Noviq Agent System

> **نظام مركزي لتنسيق الوكلاء المتعددين** يعمل عبر Message Bus + File Locks + Schema Registry.  
> يحل مشكلة التداخل على الملفات والـ Schema بين وكلاء: Frontend, Backend, Architect, Debugger, Tester, Reviewer, Ultra Plan, Ultra Build.

---

## 📁 هيكل المجلد

```
.agent-system/
├── message-bus.js           # خادم الرسائل الرئيسي (Express router)
├── agent-sdk.js             # SDK خفيف للوكلاء
├── agent-registry.js        # سجل الوكلاء النشطين
├── event-store.js           # مخزن الأحداث (JSONL + SSE)
├── file-lock-manager.js     # مدير القفوف (Shared/Exclusive + TTL)
├── test-message-bus.js      # اختبارات الوحدة والتكامل
├── AGENTS_COORDINATION.md   # قواعد التنسيق الإلزامية
├── README.md                # هذا الملف
└── schemas/                 # Schema Registry (مصدر الحقيقة الوحيد)
    ├── content.json                  # محتوى الموقع
    ├── api-endpoints.json          # نقاط النهاية API (OpenAPI 3.1)
    ├── db-schema.json              # مخطط قاعدة البيانات
    ├── design-tokens.json          # الرموز التصميمية (W3C Format)
    └── versions/                   # نسخ احتياطية بإصدار
```

---

## 🚀 التشغيل السريع

### 1. تثبيت التبعيات (إذا لم تكن موجودة)
```bash
cd C:\Downloads\Noviq - final
npm install express cors helmet morgan compression express-rate-limit
```

### 2. تشغيل خادم الرسائل
```bash
# من جذر المشروع
node .agent-system/message-bus.js
```

الخادم سيعمل كجزء من Express app الرئيسي عبر `app.use('/api/agent-bus', agentBus)`.

### 3. تشغيل الاختبارات
```bash
node .agent-system/test-message-bus.js
```

---

## 🔧 التكامل مع المشروع الحالي

### في `backend/app.js`:
```js
const { app: agentBus } = require('../.agent-system/message-bus');

// ... existing code ...

/* توجيه الرسائل المركزية */
app.use('/api/agent-bus', agentBus);
```

### في أي وكيل (باستخدام SDK):
```js
const { createAgent } = require('../.agent-system/agent-sdk');

const sdk = createAgent('frontend', { baseUrl: 'http://localhost:4322' });

// الانضمام
await sdk.join(['content-editing', 'design-tokens']);

// قفل ملف وتعديله
const lock = await sdk.acquireLock('frontend/data/content.config.js', 'exclusive', 60, 'Update hero');
try {
  const content = await readFile(...);
  const updated = modify(content);
  await writeFile(...);
  await sdk.notifyFileChanged('frontend/data/content.config.js', 'updated', 'Hero updated');
} finally {
  await sdk.releaseLock('frontend/data/content.config.js', lock.lock_token);
}

// المغادرة
await sdk.leave();
```

---

## 📡 API Reference

### Base URL: `http://localhost:4322/api/agent-bus`

| Endpoint | Method | الوصف |
|----------|--------|-------|
| `/message` | POST | إرسال رسالة للـ Bus |
| `/lock?action=acquire` | POST | طلب قفل ملف |
| `/lock?action=release` | POST | إطلاق قفل |
| `/lock?action=renew` | POST | تجديد قفل |
| `/lock?action=status` | POST | حالة القفل |
| `/schema/:resource` | GET | قراءة Schema |
| `/schema/:resource` | PUT | تحديث Schema (بـ lock_token) |
| `/events` | GET | SSE event stream |
| `/agents` | GET | قائمة الوكلاء النشطين |
| `/health` | GET | فحص الصحة |

### أنواع الرسائل المدعومة
```json
{
  "type": "AGENT_JOIN | AGENT_LEAVE | LOCK_ACQUIRE | LOCK_RELEASE | FILE_CHANGED | SCHEMA_UPDATED | ERROR_REPORTED | SCHEMA_VERSION_REQUEST",
  "source_agent": "frontend",
  "target_agent": "backend",  // null = broadcast
  "correlation_id": "uuid",
  "payload": { ... },
  "timestamp": "2026-09-26T10:00:00.000Z"
}
```

---

## 📐 Schema Registry

أربعة schemas مركزية — **مصدر الحقيقة الوحيد**:

| الملف | الوصف | الوكلاء المالكون |
|--------|-------|-----------------|
| `content.json` | محتوى الموقع (services, projects, team, testimonials, industries, stats, hero, brand) | Frontend, Backend, Debugger |
| `api-endpoints.json` | جميع endpoints بصيغة OpenAPI 3.1 | Backend, Architect, Tester |
| `db-schema.json` | جداول SQLite، الأعمدة، الفهارس، migrations | Backend, Debugger |
| `design-tokens.json` | ألوان، خطوط، مسافات، ظلال، انتقالات (W3C Design Tokens) | Frontend, Reviewer |

### قراءة Schema:
```js
const { schema, version, etag } = await sdk.getSchema('content');
```

### تحديث Schema:
```js
const lock = await sdk.acquireLock('.agent-system/schemas/content.json', 'exclusive', 60, 'Add field');
try {
  const { schema } = await sdk.getSchema('content');
  schema.properties.services.items.properties.newField = { type: 'string' };
  schema.version = '1.3.0';
  await sdk.updateSchema('content', schema, lock.lock_token);
} finally {
  await sdk.releaseLock('.agent-system/schemas/content.json', lock.lock_token);
}
```

---

## 🔒 File Lock Protocol

### أنواع القفوف
| النوع | الوصف | يسمح بـ |
|------|-------|---------|
| **Shared** | قراءة | قراءات متعددة متزامنة |
| **Exclusive** | كتابة | وكيل واحد فقط، يمنع القراءات |

### تدفق العمل الصحيح:
```
1. acquireLock(file, 'exclusive', 60, 'reason')
2. قراءة الملف
3. تعديل
4. كتابة الملف
5. notifyFileChanged(file, 'updated', 'summary')
6. releaseLock(file, lock_token)  ← دائماً في finally block
```

### التعامل مع التصادم:
- الرد `409 LOCK_CONFLICT` يحتوي على `locked_by` و `wait_suggestion`
- انتظر ثم أعد المحاولة — **لا تتجاوز القفل**

---

## 📊 المراقبة والتشخيص

### Health Check:
```bash
curl http://localhost:4322/api/agent-bus/health
# {"status":"healthy","uptime":123.4,"agents":6,"schemas":4,"locks":2,"timestamp":"..."}
```

### الوكلاء النشطون:
```bash
curl http://localhost:4322/api/agent-bus/agents
```

### سجل الأحداث (Real-time):
```bash
# SSE stream
curl -N http://localhost:4322/api/agent-bus/events

# أو مع فلتر
curl -N http://localhost:4322/api/agent-bus/events?filter=FILE_CHANGED
```

### حالة قفل محدد:
```bash
curl -X POST http://localhost:4322/api/agent-bus/lock?action=status \
  -H "Content-Type: application/json" \
  -d '{"file": "frontend/data/content.config.js", "agent": "frontend"}'
```

---

## 🧪 الاختبارات

```bash
# تشغيل جميع الاختبارات
node .agent-system/test-message-bus.js

# الناتج المتوقع:
# ✅  AgentRegistry: join returns unique ID
# ✅  AgentRegistry: duplicate name refreshes heartbeat
# ✅  EventStore: append and tail
# ✅  FileLockManager: exclusive lock granted
# ✅  FileLockManager: shared lock allows multiple readers
# ✅  FileLockManager: exclusive blocks shared
# ✅  FileLockManager: shared blocks exclusive
# ✅  FileLockManager: release works
# ✅  FileLockManager: renew extends expiry
# ✅  FileLockManager: invalid token rejected
# ✅  FileLockManager: unregisterAgent releases locks
# ✅  SchemaRegistry: loadSchemas loads existing files
# ✅  SchemaRegistry: saveSchema updates registry and disk
# ✅  HTTP: /health returns healthy
# ✅  HTTP: AGENT_JOIN works
# ✅  HTTP: lock acquire works
# ✅  HTTP: lock conflict returns 409
# ✅  HTTP: lock release works
# ✅  HTTP: schema read works
# ✅  HTTP: agents list works
#
# 📊  Results: 22/22 passed, 0 failed
# ✅  All tests passed!
```

---

## 📋 قواعد التنسيق الإلزامية

راجع **[AGENTS_COORDINATION.md](./AGENTS_COORDINATION.md)** — ملف مرجعي إلزامي لجميع الوكلاء.

ملخص سريع:
1. **لا اتصال مباشر** بين الوكلاء — كل شيء عبر Message Bus
2. **اقفل قبل تعديل** — `acquireLock()` إلزامي للكتابة
3. **أطلق القفل دائماً** — في `finally` block
4. **أبلغ بالتغيير** — `notifyFileChanged()` بعد الكتابة
5. **حدّث Schema أولاً** — ثم أرسل `SCHEMA_UPDATED`
6. **Heartbeat تلقائي** — الـ SDK يرسل `X-Agent-Name` مع كل طلب

---

## 🔮 خارطة الطريق (Roadmap)

- [ ] **Redis Backend** للـ Lock Manager في الإنتاج
- [ ] **WebSocket Support** بالإضافة لـ SSE
- [ ] **Agent Dashboard** واجهة ويب للمراقبة
- [ ] **Audit Trail** تسجيل كامل للتدقيق
- [ ] **CRDTs** للدمج التلقائي لـ `content.config.js`

---

## 📄 الترخيص

جزء من مشروع Noviq — للاستخدام الداخلي فقط.

---

**تم إنشاؤه:** 2026-09-26  
**الإصدار:** 1.0.0  
**المسؤول:** Ultra Worker (Meta-Orchestrator)