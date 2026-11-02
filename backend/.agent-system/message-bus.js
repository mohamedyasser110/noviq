/* ============================================================
   NOVIQ AGENT COLLABORATION — Message Bus Server
   ------------------------------------------------------------
   HTTP + SSE endpoints for centralized agent coordination.
   Implements contracts/api/agent-bus.*.json
   Exports Express router for mounting in backend/app.js
   ============================================================ */

const express = require('express');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

const AgentRegistry = require('./agent-registry');
const EventStore = require('./event-store');
const FileLockManager = require('./file-lock-manager');

/* ---- Configuration ---- */
const PROJECT_ROOT = path.resolve(__dirname, '..');
const SCHEMAS_DIR = path.join(__dirname, 'schemas');

/* Where the append-only event log lives.

   It used to be pinned to `<repo>/.agent-system/events/`, which puts it
   inside the application directory. Locally that is fine, but on Railway
   the app sits in the container image at /app and only STORAGE_DIR is a
   persistent volume — so every redeploy silently discarded the event
   history that SSE clients read on connect, and the log also had to be
   writable inside the image rather than on the volume.

   Resolution order:
     1. AGENT_EVENTS_LOG  — full path to the log file
     2. AGENT_STORAGE_DIR / STORAGE_DIR — log inside it (persistent)
     3. the original in-repo location, so a checkout with no env at all
        behaves exactly as it always did */
const eventsDir = (() => {
  if (process.env.AGENT_EVENTS_LOG) {
    return path.dirname(process.env.AGENT_EVENTS_LOG);
  }
  const base = process.env.AGENT_STORAGE_DIR || process.env.STORAGE_DIR;
  if (base) return path.join(base, 'events');
  return path.join(__dirname, 'events');
})();
const EVENTS_LOG = process.env.AGENT_EVENTS_LOG || path.join(eventsDir, 'recent-events.log');

/* ---- Initialize core services ---- */
const agentRegistry = new AgentRegistry();
const eventStore = new EventStore(EVENTS_LOG);
const lockManager = new FileLockManager();

agentRegistry.startCleanup();
lockManager.startCleanup();

/* ---- Schema Registry ---- */
const schemaRegistry = new Map();

/**
 * Load all schema files from .agent-system/schemas/
 * Expected files: content.json, api-endpoints.json, db-schema.json, design-tokens.json
 */
function loadSchemas() {
  if (!fs.existsSync(SCHEMAS_DIR)) {
    fs.mkdirSync(SCHEMAS_DIR, { recursive: true });
    return;
  }

  const files = fs.readdirSync(SCHEMAS_DIR).filter(f => f.endsWith('.json') && !f.startsWith('.'));
  for (const file of files) {
    const resource = file.replace('.json', '');
    try {
      const content = fs.readFileSync(path.join(SCHEMAS_DIR, file), 'utf8');
      const schema = JSON.parse(content);
      schemaRegistry.set(resource, {
        schema,
        version: schema.version || '1.0.0',
        updated_at: new Date().toISOString(),
        etag: crypto.createHash('md5').update(content).digest('hex').slice(0, 16)
      });
    } catch (err) {
      console.error(`[SchemaRegistry] Failed to load ${file}:`, err.message);
    }
  }
}

/**
 * Save a schema to disk and update registry
 */
function saveSchema(resource, schema, agent) {
  const file = path.join(SCHEMAS_DIR, `${resource}.json`);
  const content = JSON.stringify(schema, null, 2);
  fs.writeFileSync(file, content, 'utf8');

  const etag = crypto.createHash('md5').update(content).digest('hex').slice(0, 16);
  const version = schema.version || `${Date.now()}`;
  const updated_at = new Date().toISOString();

  schemaRegistry.set(resource, { schema, version, updated_at, etag });

  /* Versioned backup */
  const versionsDir = path.join(SCHEMAS_DIR, 'versions');
  if (!fs.existsSync(versionsDir)) fs.mkdirSync(versionsDir, { recursive: true });
  fs.writeFileSync(
    path.join(versionsDir, `${resource}.v${version}.json`),
    content,
    'utf8'
  );

  return { version, updated_at, etag };
}

/* Initialize schemas on startup */
loadSchemas();

/* ---- Express Router ---- */
const router = express.Router();
router.use(express.json({ limit: '1mb' }));

/* ---- Middleware: Agent heartbeat on every request ---- */
router.use((req, res, next) => {
  const agent = req.headers['x-agent-name'] || req.body?.source_agent;
  if (agent) {
    agentRegistry.heartbeat(agent);
    lockManager.heartbeat(agent);
  }
  next();
});

/* ============================================================
   ENDPOINT: POST /api/agent-bus/message
   Send a message to the central message bus
   ============================================================ */
router.post('/message', (req, res) => {
  const { type, source_agent, target_agent, correlation_id, payload, timestamp } = req.body;

  /* Validate required fields */
  if (!type || !source_agent || !correlation_id || !payload) {
    return res.status(400).json({
      status: 'rejected',
      error: { code: 'VALIDATION_ERROR', message: 'Missing required fields: type, source_agent, correlation_id, payload' }
    });
  }

  const validTypes = [
    'LOCK_ACQUIRE', 'LOCK_RELEASE', 'FILE_CHANGED', 'SCHEMA_UPDATED',
    'AGENT_JOIN', 'AGENT_LEAVE', 'ERROR_REPORTED', 'SCHEMA_VERSION_REQUEST'
  ];
  if (!validTypes.includes(type)) {
    return res.status(400).json({
      status: 'rejected',
      error: { code: 'VALIDATION_ERROR', message: `Invalid message type: ${type}` }
    });
  }

  const messageId = `m_${crypto.randomBytes(8).toString('hex')}`;
  const ts = timestamp || new Date().toISOString();

  /* Handle special message types */
  let eventType = type;
  let responsePayload = {};

  switch (type) {
    case 'AGENT_JOIN': {
      const capabilities = payload.capabilities || [];
      const agentId = agentRegistry.join(source_agent, capabilities);
      eventStore.append('AGENT_JOIN', { agentId, name: source_agent, capabilities }, source_agent, null, correlation_id);
      responsePayload = { agentId };
      break;
    }

    case 'AGENT_LEAVE': {
      const agentId = payload.agentId;
      if (agentId) agentRegistry.leave(agentId);
      lockManager.unregisterAgent(source_agent);
      eventStore.append('AGENT_LEAVE', { name: source_agent }, source_agent, null, correlation_id);
      responsePayload = { left: true };
      break;
    }

    case 'LOCK_ACQUIRE': {
      const { file, lock_type, ttl_seconds, reason } = payload;
      const result = lockManager.acquire(file, source_agent, lock_type, ttl_seconds, reason);
      if (result.status === 'conflict') {
        eventStore.append('LOCK_CONFLICT', { file, locked_by: result.locked_by }, source_agent, target_agent, correlation_id);
        return res.status(409).json({
          status: 'rejected',
          message_id: messageId,
          event: 'LOCK_CONFLICT',
          error: {
            code: 'LOCK_CONFLICT',
            message: `File is currently locked by agent '${result.locked_by}'`,
            details: { locked_by: result.locked_by, wait_suggestion: result.wait_suggestion }
          }
        });
      }
      eventStore.append('LOCK_GRANTED', { file, lock_type, token: result.lock_token }, source_agent, target_agent, correlation_id);
      responsePayload = {
        file,
        lock_token: result.lock_token,
        expires_at: result.expires_at
      };
      eventType = 'LOCK_GRANTED';
      break;
    }

    case 'LOCK_RELEASE': {
      const { file, lock_token } = payload;
      const released = lockManager.release(file, source_agent, lock_token);
      if (!released) {
        return res.status(403).json({
          status: 'rejected',
          message_id: messageId,
          error: { code: 'INVALID_TOKEN', message: 'Invalid or expired lock token' }
        });
      }
      eventStore.append('LOCK_RELEASED', { file }, source_agent, target_agent, correlation_id);
      responsePayload = { file, released: true };
      eventType = 'LOCK_RELEASED';
      break;
    }

    case 'FILE_CHANGED': {
      const { file, change_type, diff_summary } = payload;
      eventStore.append('FILE_CHANGED', { file, change_type, diff_summary, by: source_agent }, source_agent, target_agent, correlation_id);
      responsePayload = { notified: true };
      break;
    }

    case 'SCHEMA_UPDATED': {
      const { resource, schema, lock_token } = payload;
      const info = schemaRegistry.get(resource);
      if (!info) {
        return res.status(404).json({
          status: 'rejected',
          message_id: messageId,
          error: { code: 'SCHEMA_NOT_FOUND', message: `Schema '${resource}' not found` }
        });
      }
      /* Verify lock token if provided (for write operations) */
      if (lock_token) {
        const lockInfo = lockManager.lockTokens.get(lock_token);
        if (!lockInfo || lockInfo.file !== `${resource}.json` || lockInfo.agent !== source_agent) {
          return res.status(403).json({
            status: 'rejected',
            message_id: messageId,
            error: { code: 'INVALID_TOKEN', message: 'Invalid schema lock token' }
          });
        }
      }
      const saved = saveSchema(resource, schema, source_agent);
      eventStore.append('SCHEMA_UPDATED', { resource, version: saved.version, by: source_agent }, source_agent, target_agent, correlation_id);
      responsePayload = {
        status: 'updated',
        version: saved.version,
        changed_at: saved.updated_at,
        etag: saved.etag,
        notify_targets: ['frontend', 'backend', 'architect', 'debugger', 'tester', 'reviewer']
      };
      eventType = 'SCHEMA_UPDATED';
      break;
    }

    case 'SCHEMA_VERSION_REQUEST': {
      const { resource, since_version } = payload;
      const info = schemaRegistry.get(resource);
      if (!info) {
        return res.status(404).json({
          status: 'rejected',
          message_id: messageId,
          error: { code: 'SCHEMA_NOT_FOUND', message: `Schema '${resource}' not found` }
        });
      }
      responsePayload = { resource, ...info };
      eventType = 'SCHEMA_VERSION_RESPONSE';
      break;
    }

    case 'ERROR_REPORTED': {
      const { error, context, severity } = payload;
      eventStore.append('ERROR_REPORTED', { error, context, severity, by: source_agent }, source_agent, target_agent, correlation_id);
      responsePayload = { logged: true };
      break;
    }

    default:
      eventStore.append(type, payload, source_agent, target_agent, correlation_id);
      responsePayload = { received: true };
  }

  res.status(201).json({
    status: 'accepted',
    message_id: messageId,
    event: eventType,
    payload: responsePayload
  });
});

/* ============================================================
   ENDPOINT: POST /api/agent-bus/lock
   Acquire/release/renew/status file locks (unified endpoint)
   ============================================================ */
router.post('/lock', (req, res) => {
  const { action } = req.query;
  const { file, agent, lock_type, ttl_seconds, reason, lock_token } = req.body;

  /* Correlate the audit-trail entry with the caller's X-Correlation-ID header
     (the Agent SDK sets it); fall back to a generated id for raw HTTP clients. */
  const correlationId = req.headers['x-correlation-id'] || crypto.randomUUID();

  if (!file || !agent) {
    return res.status(400).json({ status: 'error', error: { code: 'VALIDATION_ERROR', message: 'file and agent are required' } });
  }

  switch (action) {
    case 'acquire': {
      if (!lock_type || !['shared', 'exclusive'].includes(lock_type)) {
        return res.status(400).json({ status: 'error', error: { code: 'VALIDATION_ERROR', message: 'lock_type must be shared or exclusive' } });
      }
      const result = lockManager.acquire(file, agent, lock_type, ttl_seconds, reason);
      if (result.status === 'conflict') {
        eventStore.append('LOCK_CONFLICT', { file, locked_by: result.locked_by, requested_by: agent }, agent, null, correlationId);
        return res.status(409).json(result);
      }
      eventStore.append('LOCK_GRANTED', { file, lock_type, token: result.lock_token, reason }, agent, null, correlationId);
      return res.json(result);
    }

    case 'release': {
      if (!lock_token) {
        return res.status(400).json({ status: 'error', error: { code: 'VALIDATION_ERROR', message: 'lock_token required for release' } });
      }
      const released = lockManager.release(file, agent, lock_token);
      if (!released) {
        return res.status(403).json({ status: 'error', error: { code: 'INVALID_TOKEN', message: 'Invalid or expired lock token' } });
      }
      eventStore.append('LOCK_RELEASED', { file }, agent, null, correlationId);
      return res.json({ status: 'released' });
    }

    case 'renew': {
      if (!lock_token) {
        return res.status(400).json({ status: 'error', error: { code: 'VALIDATION_ERROR', message: 'lock_token required for renew' } });
      }
      const renewed = lockManager.renew(file, agent, lock_token, ttl_seconds);
      if (!renewed) {
        return res.status(403).json({ status: 'error', error: { code: 'INVALID_TOKEN', message: 'Invalid or expired lock token' } });
      }
      eventStore.append('LOCK_RENEWED', { file, lock_type, ttl_seconds }, agent, null, correlationId);
      return res.json({ status: 'renewed' });
    }

    case 'status': {
      const status = lockManager.status(file);
      return res.json(status);
    }

    default:
      return res.status(400).json({ status: 'error', error: { code: 'VALIDATION_ERROR', message: 'action must be acquire, release, renew, or status' } });
  }
});

/* ============================================================
   ENDPOINT: GET /api/agent-bus/schema/{resource}
   Read a schema from the registry
   ============================================================ */
router.get('/schema/:resource', (req, res) => {
  const { resource } = req.params;
  const info = schemaRegistry.get(resource);

  if (!info) {
    return res.status(404).json({ error: { code: 'SCHEMA_NOT_FOUND', message: `Schema '${resource}' not found` } });
  }

  res.json({
    resource,
    version: info.version,
    updated_at: info.updated_at,
    schema: info.schema,
    etag: info.etag
  });
});

/* ============================================================
   ENDPOINT: PUT /api/agent-bus/schema/{resource}
   Update a schema (requires valid lock_token)
   ============================================================ */
router.put('/schema/:resource', (req, res) => {
  const { resource } = req.params;
  const { agent, lock_token, version, schema } = req.body;

  if (!agent || !lock_token || !schema) {
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'agent, lock_token, and schema are required' } });
  }

  const info = schemaRegistry.get(resource);
  if (!info) {
    return res.status(404).json({ error: { code: 'SCHEMA_NOT_FOUND', message: `Schema '${resource}' not found` } });
  }

  /* Verify lock token */
  const lockInfo = lockManager.lockTokens.get(lock_token);
  if (!lockInfo || lockInfo.file !== `${resource}.json` || lockInfo.agent !== agent) {
    return res.status(403).json({ error: { code: 'INVALID_TOKEN', message: 'Invalid schema lock token' } });
  }

  /* Optimistic concurrency: check ETag if version provided */
  if (version && version !== info.version) {
    return res.status(409).json({ error: { code: 'VERSION_CONFLICT', message: `Schema version mismatch: expected ${info.version}, got ${version}` } });
  }

  const saved = saveSchema(resource, schema, agent);
  eventStore.append('SCHEMA_UPDATED', { resource, version: saved.version, by: agent }, agent, null, req.headers['x-correlation-id'] || crypto.randomUUID());

  res.json({
    status: 'updated',
    version: saved.version,
    changed_at: saved.updated_at,
    etag: saved.etag,
    notify_targets: ['frontend', 'backend', 'architect', 'debugger', 'tester', 'reviewer']
  });
});

/* ============================================================
   ENDPOINT: GET /api/agent-bus/events
   SSE endpoint for real-time event streaming
   Query params: since=seq (optional), filter=type (optional)
   ============================================================ */
router.get('/events', (req, res) => {
  const { since, filter } = req.query;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  /* Send initial events */
  let events = eventStore.tail(100);
  if (since) {
    const seq = parseInt(since, 10);
    events = eventStore.since(seq);
  }
  if (filter) {
    events = events.filter(e => e.type === filter);
  }

  for (const event of events) {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  }

  /* Listen for new events */
  const listener = (event) => {
    if (filter && event.type !== filter) return;
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };
  eventStore.on('event', listener);

  /* Heartbeat every 15 seconds */
  const heartbeat = setInterval(() => {
    res.write(`: heartbeat\n\n`);
  }, 15000);

  /* Cleanup on disconnect */
  req.on('close', () => {
    eventStore.off('event', listener);
    clearInterval(heartbeat);
  });
});

/* ============================================================
   ENDPOINT: GET /api/agent-bus/agents
   List all registered agents
   ============================================================ */
router.get('/agents', (req, res) => {
  res.json({ agents: agentRegistry.list() });
});

/* ============================================================
   ENDPOINT: GET /api/agent-bus/health
   Health check for the message bus
   ============================================================ */
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    uptime: process.uptime(),
    agents: agentRegistry.list().length,
    schemas: Array.from(schemaRegistry.keys()),
    locks: lockManager.locks.size,
    timestamp: new Date().toISOString()
  });
});

/* ============================================================
   Export router and core services for testing/integration
   ============================================================ */
module.exports = {
  app: router,
  agentRegistry,
  eventStore,
  lockManager,
  schemaRegistry,
  loadSchemas,
  saveSchema,
  PROJECT_ROOT,
  SCHEMAS_DIR
};