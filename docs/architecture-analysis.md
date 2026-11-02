# 📐 تحليل معماري نظام تعاون الوكلاء — التصور المقترح

> **الملخص التنفيذي**:  
> الوثيقة الأصلية (`AGENT_COLLABORATION_SYSTEM.md`) تصف مشكلة حقيقية: تداخل الوكلاء على الملفات والـ Schema. الحل المقترح (Message Bus + File Locks) جيد، لكنه يحتاج إلى توسيع إلى بنية مركزية مستندة إلى عقود (contract-first) ويجب ربطه بأنماط معمارية الفريق (feature-sliced) وطبقة API الموحدة (3-tier + Query Keys + Zod).  
> ما يلي التحديث المعماري للنظام مع مخططات، API، توصيات، جدول زمني، ومخاطر.

---

## 1. المخطط المركزي — تفاعل الوكلاء (Mermaid)

```mermaid
%%{init: {"theme":"base", "themeVariables":{"primaryColor":"#0B192C","edgeLabelBackground":"#f5f5f5","nodeBorder":"#000","clusterBkg":"#f0f4f8","clusterBorder":"#C5A059"}}}%%
graph TB
  subgraph "🖥️ وكلاء الذكاء الاصطناعي"
    direction LR
    subgraph "🔧 وكلاء التنفيذ"
      FE [Frontend\nAgent\n(AI Elements / Design)"]
      BE [Backend\nAgent\n(Contracts / Laravel / FastAPI)"]
      DBG [Debugger\nAgent\n(PHP / JS errors)"]
      TST [Tester\nAgent\n(PHPUnit / Playwright)"]
      ARC [Architect\nAgent\n(Contract-First / DDD)"]
      REV [Reviewer\nAgent\n(MD3 / WCAG audit)"]
    end
  end

  subgraph ".agent-system 🧩"
    MB["🔵 Message Bus Server\n(/api/agent-bus)\nHTTP + WebSocket + SSE"]
    REG["📓 Agent Registry\nagent-registry.json"]
    LOCK["🔒 File Lock Manager\nfile-locks/active-locks.json"]
    SCHEMA["📜 Schema Registry\n.schemas/*.json"]
    EVENTS["📜 Event Store\nevents/recent-events.log"]
    PATCH["🧩 Patch Feed\npatches/{pending,applied}/"]
  end

  subgraph "📁 ملفات المشروع Noviq"
    SRC["src/app web & backend\n(contracts/, frontend/, backend/)"]
    DB["SQLite\n(.db)"]
    CSS["css/tokens.css\ntheme-simple.css"]
    ENV["⚙️ .env / config"]
  end

  %% تفاعل الوكلاء مع الـ Bus
  FE   -- "JOIN / LOCK / CHANGED" --> MB
  BE   -- "JOIN / SCHEMA_UPDATED / CHANGED" --> MB
  DBG  -- "JOIN / FILE_CHANGED (errors) / CHANGED" --> MB
  TST  -- "JOIN / SCHEMA_UPDATED (test contracts) / CHANGED" --> MB
  ARC  -- "JOIN / SCHEMA_UPDATED / CHANGED" --> MB
  REV  -- "JOIN / FILE_CHANGED / CHANGED" --> MB

  %% الـ Bus يدير الحالة المركزية
  MB   -- "manages" --> REG
  MB   -- "manages" --> LOCK
  MB   -- "manages" --> SCHEMA
  MB   -- "manages" --> EVENTS
  MB   -- "manages" --> PATCH

  %% الـ Bus يرسل إشعارات للوكلاء
  MB   -- "SSE notify" --> FE
  MB   --> BE
  MB   --> DBG
  MB   --> TST
  MB   --> ARC
  MB   --> REV

  %% الوكلاء يقرئون / يكتبون الملفات
  FE   -- "reads/writes" --> CSS
  FE   -- "reads" --> SCHEMA
  FE   -- "calls APIs" --> BE
  BE   -- "reads/writes" --> SRC
  BE   -- "migrates" --> DB
  BE   -- "reads/writes contracts" --> ARC
  DBG  -- "reads errors from" --> SRC
  TST  -- "tests" --> SRC
  TST  -- "asserts contracts" --> SCHEMA
  ARC  -- "writes contracts" --> SCHEMA
  REV  -- "audits" --> SRC
  REV  -- "audits tokens" --> CSS

  %% Schema Registry يُعيد توحيد المورد المشترك
  SCHEMA -- "content\napi-endpoints\ndb-schema\ndesign-tokens" --> SRC
  SCHEMA --> DB
  SCHEMA --> CSS

  %% الـ Bus يكتب/يقرأ patches
  MB -- "queues/patches" --> PATCH
  PATCH -- "applied →" --> SRC
```

> **ملاحظة**: جميع الرسائل بين الوكلاء تمر عبر الـ **Message Bus** — لا توجد اتصالات مباشرة بين الوكلاء — مبدأ **مركزي (Centralized)**.

---

## 2. API لخادم الرسائل (Message Bus API)

مُصمم وفقاً لمبدأ **contract-first** باستخدام Zod + JSON Schema. كل endpoint معرّف في `contracts/api/agent-bus.*.json`.

### 2.1. `POST /api/agent-bus/message` — إرسال رسالة

**Request:**
```json
{
  "type": "LOCK_ACQUIRE",
  "source_agent": "frontend",
  "target_agent": "backend",
  "correlation_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "payload": {
    "file": "frontend/data/content.config.js",
    "lock_type": "exclusive",
    "reason": "Updating services section content",
    "ttl_seconds": 30
  },
  "timestamp": "2026-09-26T10:30:00.000Z"
}
```

**Response (success — 201):**
```json
{
  "status": "accepted",
  "message_id": "m_9876543210",
  "event": "LOCK_GRANTED",
  "payload": {
    "file": "frontend/data/content.config.js",
    "lock_token": "lt_abcdef123456",
    "expires_at": "2026-09-26T10:30:30.000Z"
  }
}
```

**Response (conflict — 409):**
```json
{
  "status": "rejected",
  "error": {
    "code": "LOCK_CONFLICT",
    "message": "File is currently locked by agent 'backend'",
    "details": {
      "locked_by": "backend",
      "expires_at": "2026-09-26T10:30:12.000Z",
      "wait_suggestion": 5
    }
  }
}
```

### 2.2. `POST /api/agent-bus/lock` — الحصول على قفل ملف

**Request:**
```json
POST /api/agent-bus/lock
{
  "file": "frontend/data/content.config.js",
  "agent": "frontend",
  "lock_type": "shared", // or "exclusive"
  "ttl_seconds": 60,
  "reason": "Reading for build step"
}
```
*(إلزامي `directory` — الجذر المشروع — وفقاً لمتطلبات MCP الأصلية.)*

**Response (200 OK):**
```json
{
  "status": "granted",
  "lock_token": "lt_123456abcdef",
  "expires_at": "2026-09-26T10:31:00.000Z"
}
```

### 2.3. `POST /api/agent-bus/lock/release` — إطلاق القفل

**Request:**
```json
POST /api/agent-bus/lock/release
{
  "file": "frontend/data/content.config.js",
  "agent": "frontend",
  "lock_token": "lt_123456abcdef"
}
```

**Response (200 OK):**
```json
{
  "status": "released"
}
```

### 2.4. `GET /api/agent-bus/schema/{resource}` — قراءة Schema مركزي

**Request:** `GET /api/agent-bus/schema/content`

**Response (200 OK):**
```json
{
  "resource": "content",
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "services": { "type": "array", "items": { "type": "object", ... } },
    ...
  }
}
```

### 2.5. `PUT /api/agent-bus/schema/{resource}` — تحديث Schema

**Request (محمي — يتطلب `lock_token` صالح):**
```json
PUT /api/agent-bus/schema/content
{
  "agent": "frontend",
  "lock_token": "lt_...",
  "version": "1.0.5",
  "schema": { ...JSON Schema... }
}
```

**Response (200 OK):**
```json
{
  "status": "updated",
  "version": "1.0.5",
  "changed_at": "2026-09-26T10:35:00.000Z",
  "notify_targets": ["backend", "debugger"]
}
```

---

## 3. توحيد الـ Schema — Registry مركزي

| Resource        | File                          | Owner(s)               | Format     |
|-----------------|-------------------------------|------------------------|------------|
| `content`       | `.agent-system/schemas/content.json` | Frontend, Backend, Debugger | JSON Schema |
| `api-endpoints` | `.agent-system/schemas/api-endpoints.json` | Backend, Architect, Tester | OpenAPI 3.1 |
| `db-schema`     | `.agent-system/schemas/db-schema.json`     | Backend, Debugger            | PostgreSQL DDL / Prisma |
| `design-tokens` | `.agent-system/schemas/design-tokens.json` | Frontend, Reviewer           | Style Dictionary / W3C |

هذه الملفات هي **مصدر الحقيقة الوحيد** — جميع الوكلاء يقرأون منها، ويكتبوا عبر API مع قفل.

---

## 4. نظام القفل المحسّن (MCP-Compliant File Lock Manager)

- **Shared Lock (Read)**: يسمح بقراءة متعددة.
- **Exclusive Lock (Write)**: يحجز الكتابة لوكيل واحد.
- **Auto-TTL**: 30-60 ثانية افتراضياً؛ يُجدد تلقائياً بـ `PATCH /lock/renew`.
- **Collision Notification**: إذا حاول وكيل قفل ملف مقفل → يتلقى `LOCK_CONFLICT` مع اقتراح للانتظار.
- **Conflict Resolution**:
  - **Last-Writer-Wins** مع إشعار فوري للوكلاء المتضررين.
  - **Merge Strategy** للـ JSON/Schemas: يستخدم `jsonpatch` أو `ot` (Operational Transformation) للـ content.config.js.

---

## 5. التحليل الحالي للتداخلات — التوصيات الملموسة

| المشكلة الحالية | السبب | التوصية المعمارية |
|----------------|-------|--------------------|
| **تداخل `content-admin.js`** | كل وكيل يقرأ نسخة قديمة من الملف | **مصفوفة حقيقية (Single Source)**: `schemas/content.json` ← كل وكيل يقرأ منه. التغيير يُرسل Schema update أولاً. |
| **تداخل العقود (Contracts)** | Architect + Backend + Reviewer يعملون على نسخ مختلفة | **Pipeline مرحون (Staged)**: 1) Architect يكتب contract → Schema Registry. 2) Backend يستهلكه. 3) Reviewer يفحصه. كل خطوة تُثير `SCHEMA_UPDATED`. |
| **تداخل DB Schema** | التغييرات ليست مرئية للوكلاء الآخرين | **`db-schema.json`** مركزي + Migration Queue. كل تغيير جدول يُرسل `SCHEMA_UPDATED` + Migration Patch. |
| **تداخل CSS Tokens** | قراءة متزامنة وكتابة متعارض | **`design-tokens.json`** مركزي + Build Cache. `tokens.css` يُنشأ تلقائياً منه. |

---

## 6. التطبيق العملي — التكامل مع `app.js`

```js
// backend/app.js
const express = require('express');
const { app: agentBus } = require('../.agent-system/message-bus');

const app = express();
app.use(express.json());

// توجيه الرسائل المركزية
app.use('/api/agent-bus', agentBus);

// API التطبيقي العادي
app.use('/api/v1', apiRouter);
```

---

## 7. جدول التنفيذ المرحلي (Phased Roadmap)

| المرحلة | المدة | المهام | المسؤول |
|---------|--------|--------|---------|
| **المرحلة 0: التحضير** | 1 أسبوع | • مراجعة وتوحيد Schema Registry. <br>• إنشاء `contracts/api/agent-bus.*.json`. <br>• إعداد Zod validators. | Architect |
| **المرحلة 1: الـ Bus الأساسي** | 2 أسبوع | • تنفيذ `message-bus.js` (HTTP + SSE). <br>• `POST /message`, `/lock`, `/lock/release`. <br>• Event Store. <br>• Unit tests (`test-message-bus.js`). | Backend |
| **المرحلة 2: توحيد الـ Schema** | 2 أسبوع | • استقطاع `content.json` من `content.config.js`. <br>• `api-endpoints.json` من OpenAPI. <br>• `db-schema.json` من migrations. <br>• `design-tokens.json` من CSS. <br>• تحويل الوكلاء لاستخدام Schema Registry. | Backend + Frontend + Architect |
| **المرحلة 3: القفل الذكي (Smart Lock)** | 1 أسبوع | • دمج File Lock Manager مع Schema Updates. <br>• إشعارات SSE بين الوكلاء. <br>• Retry + Backoff logic. | Backend |
| **المرحلة 4: التكامل والاختبار** | 2 أسبوع | • Stress test الـ Bus (simultaneous 6 agents). <br>• Lock contention test. <br>• Migration test للـ Frontend ↔ Backend ↔ Architect. | Tester + Debugger |
| **المرحلة 5: النشر** | 1 أسبوع | • Run in production mode داخل المشروع. <br>• Dashboard مراقبة الوكلاء (اختياري). <br>• Documentation: `AGENTS_COORDINATION.md`. | Reviewer |

---

## 8. مخاطر البناء واستراتيجيات التخفيف

| المخاطرة | الاحتمال | التأثير | إستراتيجية التخفيف |
|----------|----------|---------|--------------------|
| **Performance Bottleneck في الـ Bus** | متوسط | عالي | استخدام **Redis** بدلاً من JSON files للـ Lock Manager. فحص `redis` كـ backing store. |
| **Single Point of Failure** | منخفض-متوسط | عالي | تشغيل الـ Bus كـ **microservice** منفصل مع health check. إمكانية fallback إلى file-based locks. |
| **Stale Lock (Agent Crash)** | متوسط | متوسط | استخدام **TTL + Heartbeat**. إذا لم يُجدد الـ lock خلال `ttl * 1.5` → يُفرج تلقائياً. |
| **زيادة التعقيد على الوكلاء** | عالي | متوسط | إنشاء **SDK بسيط** (`@noviq/agent-sdk`) يُحيط الـ Bus API. كل وكيل يستدعي `acquireLock()` / `notifyChange()`. |
| **تعارض الـ Schema (Split-Brain)** | منخفض | عالي | إجبار كل Schema update على **version check** (ETag / Optimistic Concurrency). |
| **إبطاء التطوير** | عالي | منخفض | تشغيل الـ Bus في الـ background فقط أثناء تشغيل الوكلاء المتعددين. لا حاجة له في الـ single-agent mode. |

---

## 9. الخلاصة — ما يجب بنقله إلى الوثيقة الأصلية

1. **Mermaid diagram** — إضافته إلى بداية `AGENT_COLLABORATION_SYSTEM.md`.
2. **Message Bus API specs** — كتابتها كـ `contracts/api/*.json` (contract-first) واستخدامها كـ Zod validators.
3. **Schema Registry** — تحويل الـ content config, API specs, DB schema, CSS tokens إلى Schema مركزية.
4. **Smart Lock with TTL/Heartbeat** — تحديث `file-locks/active-locks.json` ليدعم الـ lock tokens والإشعارات.
5. **Agent SDK** — إنشاء `agent-sdk.js` خفيف يُبسط التكامل لدى الوكلاء.
