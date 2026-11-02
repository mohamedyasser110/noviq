/* Fills in the real, empirically-verified contract for the agent-bus paths
   (and /imagegen) in .agent-system/schemas/api-endpoints.json.

   Every status code and response shape below was confirmed by running
   backend/tests/agent-bus-smoke.test.js and backend/tests/imagegen-route.test.js
   against the live implementation. The other 71 paths in this spec are still
   summary-only skeletons and are intentionally left untouched.
*/
const fs = require('fs');
const path = require('path');

const FILE = path.resolve(__dirname, '..', '..', '.agent-system', 'schemas', 'api-endpoints.json');
const spec = JSON.parse(fs.readFileSync(FILE, 'utf8'));

const json = (schema) => ({ content: { 'application/json': { schema } } });
const ref = (name) => ({ $ref: `#/components/schemas/${name}` });
const str = (description) => ({ type: 'string', description });
const int = (description) => ({ type: 'integer', description });
const bool = (description) => ({ type: 'boolean', description });
const arr = (items, description) => ({ type: 'array', items, description });

/* ---- shared component schemas ---- */
spec.components = spec.components || {};
spec.components.schemas = {
  ...(spec.components.schemas || {}),

  AgentError: {
    type: 'object',
    required: ['error'],
    properties: {
      error: {
        type: 'object',
        required: ['code', 'message'],
        properties: {
          code: {
            type: 'string',
            enum: [
              'VALIDATION_ERROR',
              'LOCK_CONFLICT',
              'INVALID_TOKEN',
              'SCHEMA_NOT_FOUND',
              'VERSION_CONFLICT',
              'RATE_LIMITED',
              'UPSTREAM_ERROR',
            ],
          },
          message: str('Human-readable explanation.'),
          details: { type: 'object', additionalProperties: true },
        },
      },
    },
  },

  AgentLock: {
    type: 'object',
    required: ['status'],
    properties: {
      status: { type: 'string', enum: ['granted', 'conflict', 'released', 'renewed'] },
      lock_token: str('Opaque token proving lock ownership. Required to release or renew.'),
      expires_at: str('ISO-8601 expiry timestamp.'),
      locked_by: str('Agent currently holding the lock (on conflict).'),
      wait_suggestion: int('Seconds to wait before retrying (on conflict).'),
    },
  },

  AgentLockStatus: {
    type: 'object',
    required: ['locked'],
    properties: {
      locked: bool('Whether the file currently has any lock.'),
      lock_type: { type: ['string', 'null'], enum: ['exclusive', 'shared', null] },
      agent: str('Holder of the exclusive lock.'),
      agents: arr(str(), 'Holders when the lock is shared.'),
      expires_at: str('ISO-8601 expiry timestamp.'),
    },
  },

  AgentInfo: {
    type: 'object',
    required: ['id', 'name', 'capabilities'],
    properties: {
      id: str('Stable agent identifier (uuid).'),
      name: str('Unique agent name.'),
      joined_at: str('ISO-8601 join timestamp.'),
      last_heartbeat: str('ISO-8601 timestamp of the last heartbeat seen.'),
      capabilities: arr(str(), 'Declared capabilities.'),
    },
  },

  SchemaEnvelope: {
    type: 'object',
    required: ['resource', 'version', 'etag', 'schema'],
    properties: {
      resource: str('Schema resource name (the file basename without .json).'),
      version: str('Opaque version string. Semver by convention, NOT a number.'),
      updated_at: str('ISO-8601 timestamp of the last write.'),
      schema: { type: 'object', additionalProperties: true },
      etag: str('16-char md5 of the raw file content. Use for change detection.'),
    },
  },
};

/* ---- agent-bus paths ---- */
spec.paths['/agent-bus/message'] = {
  post: {
    summary: 'Send a message to the central agent message bus',
    description:
      'Single entry point for agent coordination messages. Side effects are applied for\n' +
      'AGENT_JOIN, AGENT_LEAVE, LOCK_ACQUIRE, LOCK_RELEASE, SCHEMA_UPDATED and\n' +
      'ERROR_REPORTED; every accepted message is appended to the event store and\n' +
      'broadcast on the /agent-bus/events SSE stream.\n\n' +
      'Note: the REST /agent-bus/lock endpoint is an equivalent, more direct way to manage\n' +
      'locks; both paths now write to the event store.',
    tags: ['agent-bus'],
    requestBody: {
      required: true,
      ...json({
        type: 'object',
        required: ['type', 'source_agent', 'correlation_id', 'payload'],
        properties: {
          type: {
            type: 'string',
            enum: [
              'LOCK_ACQUIRE', 'LOCK_RELEASE', 'FILE_CHANGED', 'SCHEMA_UPDATED',
              'AGENT_JOIN', 'AGENT_LEAVE', 'ERROR_REPORTED', 'SCHEMA_VERSION_REQUEST',
            ],
          },
          source_agent: str('Agent sending the message.'),
          target_agent: { type: ['string', 'null'], description: 'Optional intended recipient.' },
          correlation_id: str('Caller-supplied id used to correlate the audit-trail entry.'),
          timestamp: str('Optional ISO-8601 timestamp; defaults to now.'),
          payload: { type: 'object', additionalProperties: true, description: 'Type-specific body.' },
        },
      }),
    },
    responses: {
      201: {
        description: 'Message accepted and applied.',
        ...json({
          type: 'object',
          required: ['status', 'message_id', 'event'],
          properties: {
            status: { type: 'string', enum: ['accepted'] },
            message_id: str('Server-assigned id, e.g. m_<hex>.'),
            event: str('Event type actually recorded (may differ from `type` for LOCK_*).'),
            payload: { type: 'object', additionalProperties: true, description: 'Result data, e.g. { agentId }.' },
          },
        }),
      },
      400: { description: 'Missing required fields or unknown message type.', ...json(ref('AgentError')) },
      403: { description: 'LOCK_RELEASE with an invalid or expired lock token.', ...json(ref('AgentError')) },
      404: { description: 'SCHEMA_UPDATED for an unknown resource.', ...json(ref('AgentError')) },
      409: { description: 'LOCK_ACQUIRE conflicting with an existing lock.', ...json(ref('AgentError')) },
    },
  },
};

spec.paths['/agent-bus/lock'] = {
  post: {
    summary: 'Acquire, release, renew or inspect a file lock',
    description:
      'The `action` query parameter selects the operation. Locks are advisory and shared\n' +
      'across the whole agent fleet; an exclusive lock blocks every other agent until it\n' +
      'is released or its TTL expires. All successful operations are recorded in the event\n' +
      'store and broadcast on the SSE stream.',
    tags: ['agent-bus'],
    parameters: [
      {
        name: 'action',
        in: 'query',
        required: true,
        schema: { type: 'string', enum: ['acquire', 'release', 'renew', 'status'] },
      },
    ],
    requestBody: {
      required: true,
      ...json({
        type: 'object',
        required: ['file', 'agent'],
        properties: {
          file: str('Path being locked, relative to the project root.'),
          agent: str('Agent requesting the operation.'),
          lock_type: { type: 'string', enum: ['shared', 'exclusive'], description: 'Required for action=acquire.' },
          ttl_seconds: int('Requested TTL, clamped to the server minimum and maximum.'),
          reason: str('Free-text justification, recorded in the audit trail.'),
          lock_token: str('Required for action=release and action=renew.'),
        },
      }),
    },
    responses: {
      200: {
        description:
          'acquire -> { status:"granted", lock_token, expires_at } | release -> { status:"released" } | ' +
          'renew -> { status:"renewed" } | status -> lock status object.',
        ...json({ oneOf: [ref('AgentLock'), ref('AgentLockStatus')] }),
      },
      400: { description: 'Missing file/agent, invalid lock_type, missing lock_token, or unknown action.', ...json(ref('AgentError')) },
      403: { description: 'Invalid or expired lock token.', ...json(ref('AgentError')) },
      409: { description: 'Lock conflict: another agent already holds a conflicting lock.', ...json({ oneOf: [ref('AgentLock'), ref('AgentError')] }) },
    },
  },
};

spec.paths['/agent-bus/schema/{resource}'] = {
  get: {
    summary: 'Read a shared schema from the registry',
    description:
      'The resource name is the schema filename without its `.json` suffix, e.g. `content`\n' +
      'resolves to `.agent-system/schemas/content.json`.',
    tags: ['agent-bus'],
    parameters: [
      { name: 'resource', in: 'path', required: true, schema: { type: 'string' }, example: 'content' },
    ],
    responses: {
      200: { description: 'Current schema envelope.', ...json(ref('SchemaEnvelope')) },
      404: { description: 'No such resource.', ...json(ref('AgentError')) },
    },
  },
  put: {
    summary: 'Update a shared schema (lock-protected, optimistic concurrency)',
    description:
      'Writes are cooperative: the caller must first hold a lock on `<resource>.json` and\n' +
      'send that `lock_token` in the body. Supplying `version` enables optimistic\n' +
      'concurrency — if the stored version differs, the write is rejected with 409 instead\n' +
      'of clobbering a concurrent change. There is no `etag` query parameter; the etag in\n' +
      'the GET response is for change detection only.\n\n' +
      'A versioned backup is written to `.agent-system/schemas/versions/`.',
    tags: ['agent-bus'],
    parameters: [
      { name: 'resource', in: 'path', required: true, schema: { type: 'string' } },
    ],
    requestBody: {
      required: true,
      ...json({
        type: 'object',
        required: ['agent', 'lock_token', 'schema'],
        properties: {
          agent: str('Agent performing the write.'),
          lock_token: str('Token from a lock acquired on `<resource>.json`.'),
          version: str('Expected current version. Mismatch -> 409 VERSION_CONFLICT.'),
          schema: { type: 'object', additionalProperties: true, description: 'Full replacement document.' },
        },
      }),
    },
    responses: {
      200: {
        description: 'Schema written.',
        ...json({
          type: 'object',
          required: ['status', 'version', 'etag'],
          properties: {
            status: { type: 'string', enum: ['updated'] },
            version: str('New version string.'),
            changed_at: str('ISO-8601 write timestamp.'),
            etag: str('md5 of the newly written content.'),
            notify_targets: arr(str(), 'Agents that should re-read the schema.'),
          },
        }),
      },
      400: { description: 'Missing agent, lock_token or schema.', ...json(ref('AgentError')) },
      403: { description: 'Lock token invalid, or it does not cover `<resource>.json` for this agent.', ...json(ref('AgentError')) },
      404: { description: 'No such resource.', ...json(ref('AgentError')) },
      409: { description: 'Version conflict.', ...json(ref('AgentError')) },
    },
  },
};

spec.paths['/agent-bus/events'] = {
  get: {
    summary: 'Server-Sent Events stream of the agent event log',
    description:
      'Opens a long-lived `text/event-stream`. On connect the last 100 events are replayed\n' +
      'as `data: <json>` frames, then new events are streamed live. Comment frames\n' +
      '(`: heartbeat`) are sent every 15s. The connection is never closed by the server.\n\n' +
      'This endpoint does NOT return JSON and never completes a normal request; do not\n' +
      'assert on it as a JSON API.',
    tags: ['agent-bus'],
    parameters: [
      { name: 'since', in: 'query', schema: { type: 'integer' }, description: 'Replay only events after this sequence number.' },
      { name: 'filter', in: 'query', schema: { type: 'string' }, description: 'Only stream events of this type.' },
    ],
    responses: {
      200: {
        description: 'An open SSE stream.',
        content: { 'text/event-stream': { schema: { type: 'string' } } },
      },
    },
  },
};

spec.paths['/agent-bus/agents'] = {
  get: {
    summary: 'List agents currently registered on the bus',
    tags: ['agent-bus'],
    responses: {
      200: {
        description: 'Registered agents.',
        ...json({ type: 'object', required: ['agents'], properties: { agents: arr(ref('AgentInfo')) } }),
      },
    },
  },
};

spec.paths['/agent-bus/health'] = {
  get: {
    summary: 'Message bus health and registry sizes',
    tags: ['agent-bus'],
    responses: {
      200: {
        description: 'Bus is healthy.',
        ...json({
          type: 'object',
          required: ['status', 'agents', 'schemas', 'locks'],
          properties: {
            status: { type: 'string', enum: ['healthy'] },
            uptime: { type: 'number' },
            agents: int('Number of registered agents.'),
            schemas: arr(str(), 'Known schema resource names.'),
            locks: int('Number of files currently locked.'),
            timestamp: str('ISO-8601 timestamp.'),
          },
        }),
      },
    },
  },
};

/* ---- /imagegen: document the real failure modes ---- */
spec.paths['/imagegen'] = {
  get: {
    summary: 'Generate an image via the server-side Pollinations proxy',
    description:
      'The browser never contacts the upstream directly. The prompt is sanitised, then\n' +
      'several model variants (flux, flux-realism, turbo, flux-anime) are tried in order\n' +
      'until one returns a real image.\n\n' +
      'Content policy: prompts requesting women/girls/females (English or Arabic) or unsafe\n' +
      'categories are rejected with 400. Rate limited to 1 request / 60s per IP by default\n' +
      '(configurable via the `rl_imagegen` setting).',
    tags: ['imagegen'],
    parameters: [
      { name: 'prompt', in: 'query', required: true, schema: { type: 'string' }, description: 'Image description. Max 480 chars; 200 used after sanitising.' },
      { name: 'seed', in: 'query', schema: { type: 'integer' }, description: 'Deterministic seed. Random when omitted.' },
    ],
    responses: {
      200: {
        description: 'The generated image bytes.',
        content: { 'image/*': { schema: { type: 'string', format: 'binary' } } },
      },
      400: { description: 'Prompt missing, or blocked by the content policy.', ...json(ref('AgentError')) },
      429: { description: 'Image generation rate limit exceeded.', ...json(ref('AgentError')) },
      502: { description: 'Every upstream variant failed or timed out.', ...json(ref('AgentError')) },
    },
  },
};

spec.info = spec.info || {};
spec.info.version = '1.1.0';
spec.info['x-contract-status'] =
  'agent-bus/* and /imagegen are fully specified and verified against the running ' +
  'implementation (backend/tests/agent-bus-smoke.test.js, backend/tests/imagegen-route.test.js). ' +
  'All other paths are summary-only placeholders.';

fs.writeFileSync(FILE, JSON.stringify(spec, null, 2) + '\n', 'utf8');
console.log('Updated', FILE);
console.log('paths:', Object.keys(spec.paths).length, '| component schemas:', Object.keys(spec.components.schemas).length);
