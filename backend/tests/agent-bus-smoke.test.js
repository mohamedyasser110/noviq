/* ============================================================
   NOVIQ AGENT COLLABORATION — Smoke Test
  ------------------------------------------------------------
   Run from the backend directory:
      cd backend
      node tests/agent-bus-smoke.test.js

   These assertions are written against the REAL implemented
   contract of `.agent-system/message-bus.js`:
     - POST /message            -> 201 { status:'accepted' }
     - POST /lock?action=...    -> 200/400/403/409
     - GET  /schema/:resource   -> 200 { resource, version, etag, schema }
     - PUT  /schema/:resource   -> 200 (needs agent+lock_token in BODY;
                                   `version` mismatch -> 409)
     - GET  /events             -> SSE stream (never JSON)
     - GET  /agents, /health    -> 200

   NOTE: the schema write tests run against a throwaway resource
   (`__smoke_tmp__`) that is created before and deleted after, so the
   real schemas in .agent-system/schemas/ are never modified.
   ============================================================ */

const assert = require('assert');
const http = require('http');
const path = require('path');
const fs = require('fs');

const PORT = 3099;
const BASE = `http://localhost:${PORT}`;

/* we must load the app, not run index.js, to attach our test port */
process.env.PORT = PORT;
delete process.env.SERVE_FRONTEND; /* avoid static file serving */

const AGENT_SYSTEM_DIR = path.resolve(__dirname, '..', '.agent-system');
const SCHEMAS_DIR = path.join(AGENT_SYSTEM_DIR, 'schemas');
const TMP_RESOURCE = '__smoke_tmp__';
const TMP_SCHEMA_FILE = path.join(SCHEMAS_DIR, `${TMP_RESOURCE}.json`);
const TMP_VERSIONS_DIR = path.join(SCHEMAS_DIR, 'versions');

const app = require('../app');
const { schemaRegistry, eventStore } = require(path.join(AGENT_SYSTEM_DIR, 'message-bus.js'));
const server = http.createServer(app);

let passed = 0;
let failed = 0;

async function request(method, url, body) {
  const data = body ? JSON.stringify(body) : null;
  const parsed = new URL(url, BASE);
  const options = {
    hostname: parsed.hostname,
    port: parsed.port,
    path: parsed.pathname + parsed.search,
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
    },
  };
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let chunks = '';
      res.on('data', (c) => chunks += c);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, json: JSON.parse(chunks), headers: res.headers });
        } catch {
          resolve({ status: res.statusCode, text: chunks, headers: res.headers });
        }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

/** Open the SSE stream, collect events for a short window, then abort. */
function readSse(url, ms = 400) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url, BASE);
    const events = [];
    const req = http.request(
      {
        hostname: parsed.hostname,
        port: parsed.port,
        path: parsed.pathname + parsed.search,
        method: 'GET',
        headers: { Accept: 'text/event-stream' },
      },
      (res) => {
        let buf = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          buf += chunk;
          let idx;
          while ((idx = buf.indexOf('\n\n')) !== -1) {
            const frame = buf.slice(0, idx);
            buf = buf.slice(idx + 2);
            const line = frame.split('\n').find((l) => l.startsWith('data: '));
            if (line) {
              try { events.push(JSON.parse(line.slice(6))); } catch { /* ignore partial */ }
            }
          }
        });
        res.on('error', () => { /* aborted on purpose */ });
      }
    );
    req.on('error', (err) => { if (err.code !== 'ECONNRESET') reject(err); });
    req.end();
    setTimeout(() => { req.destroy(); resolve(events); }, ms);
  });
}

async function test(name, fn) {
  try {
    await fn();
    console.log(`  \u2705 ${name}`);
    passed++;
  } catch (err) {
    console.error(`  \u274c ${name}`);
    console.error(`     ${err.message}`);
    failed++;
  }
}

function createTempSchema() {
  if (!fs.existsSync(SCHEMAS_DIR)) fs.mkdirSync(SCHEMAS_DIR, { recursive: true });
  fs.writeFileSync(
    TMP_SCHEMA_FILE,
    JSON.stringify({ title: 'Smoke temp', type: 'object', version: '0.0.1', properties: {} }, null, 2),
    'utf8'
  );
}

function cleanupTempSchema() {
  try {
    if (fs.existsSync(TMP_SCHEMA_FILE)) fs.unlinkSync(TMP_SCHEMA_FILE);
    if (fs.existsSync(TMP_VERSIONS_DIR)) {
      for (const f of fs.readdirSync(TMP_VERSIONS_DIR)) {
        if (f.startsWith(`${TMP_RESOURCE}.`)) {
          fs.unlinkSync(path.join(TMP_VERSIONS_DIR, f));
        }
      }
    }
  } catch { /* best effort */ }
  schemaRegistry.delete(TMP_RESOURCE);
}

async function run() {
  console.log('\n\u{1F916} Agent Bus Smoke Test\n');

  createTempSchema();
  loadTempIntoRegistry();

  /* ---- HEALTH ---- */
  await test('GET /health', async () => {
    const res = await request('GET', '/api/agent-bus/health');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.json.status, 'healthy');
    assert.ok(Array.isArray(res.json.schemas));
  });

  /* ---- MESSAGE VALIDATION ---- */
  await test('POST /message rejects invalid type (400)', async () => {
    const res = await request('POST', '/api/agent-bus/message', {
      type: 'NOT_A_REAL_TYPE',
      source_agent: 'test-agent',
      correlation_id: 'bad-1',
      payload: {},
    });
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.json.status, 'rejected');
    assert.strictEqual(res.json.error.code, 'VALIDATION_ERROR');
  });

  await test('POST /message rejects missing fields (400)', async () => {
    const res = await request('POST', '/api/agent-bus/message', { type: 'AGENT_JOIN' });
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.json.error.code, 'VALIDATION_ERROR');
  });

  /* ---- AGENT JOIN ---- */
  await test('AGENT_JOIN (201 + agentId)', async () => {
    const res = await request('POST', '/api/agent-bus/message', {
      type: 'AGENT_JOIN',
      source_agent: 'test-agent',
      correlation_id: 'test-1',
      payload: { capabilities: ['test'] },
    });
    assert.strictEqual(res.status, 201, `expected 201, got ${res.status}`);
    assert.strictEqual(res.json.status, 'accepted');
    assert.strictEqual(res.json.event, 'AGENT_JOIN');
    assert.ok(res.json.message_id, 'message_id should be present');
    assert.ok(res.json.payload.agentId, 'agentId should be returned');
    global.__agentId = res.json.payload.agentId;
  });

  /* ---- AGENT LIST ---- */
  await test('GET /agents', async () => {
    const res = await request('GET', '/api/agent-bus/agents');
    assert.strictEqual(res.status, 200);
    assert.ok(res.json.agents.length > 0);
    const agent = res.json.agents.find((a) => a.name === 'test-agent');
    assert.ok(agent, 'test-agent should be in the list');
    assert.deepStrictEqual(agent.capabilities, ['test']);
  });

  /* ---- LOCK ACQUIRE ---- */
  await test('LOCK_ACQUIRE (exclusive)', async () => {
    const res = await request('POST', '/api/agent-bus/lock?action=acquire', {
      file: 'test-smoke-file.txt',
      agent: 'test-agent',
      lock_type: 'exclusive',
      reason: 'smoke test',
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.json.status, 'granted');
    assert.ok(res.json.lock_token);
    assert.ok(res.json.expires_at);
    global.__lockToken = res.json.lock_token;
  });

  /* ---- LOCK CONFLICT ---- */
  await test('LOCK_ACQUIRE conflict (second exclusive -> 409)', async () => {
    const res = await request('POST', '/api/agent-bus/lock?action=acquire', {
      file: 'test-smoke-file.txt',
      agent: 'second-agent',
      lock_type: 'exclusive',
    });
    assert.strictEqual(res.status, 409);
    assert.strictEqual(res.json.status, 'conflict');
    assert.strictEqual(res.json.locked_by, 'test-agent');
  });

  /* ---- SHARED LOCK COEXISTENCE ---- */
  await test('LOCK_ACQUIRE shared coexists with exclusive (409 expected here)', async () => {
    /* an exclusive lock blocks even a shared request from another agent */
    const res = await request('POST', '/api/agent-bus/lock?action=acquire', {
      file: 'test-smoke-file.txt',
      agent: 'second-agent',
      lock_type: 'shared',
    });
    assert.strictEqual(res.status, 409);
    assert.strictEqual(res.json.status, 'conflict');
  });

  /* ---- LOCK BAD TYPE ---- */
  await test('LOCK_ACQUIRE invalid lock_type (400)', async () => {
    const res = await request('POST', '/api/agent-bus/lock?action=acquire', {
      file: 'other-file.txt',
      agent: 'test-agent',
      lock_type: 'nonsense',
    });
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.json.error.code, 'VALIDATION_ERROR');
  });

  /* ---- LOCK STATUS ---- */
  await test('LOCK_STATUS', async () => {
    const res = await request('POST', '/api/agent-bus/lock?action=status', {
      file: 'test-smoke-file.txt',
      agent: 'test-agent',
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.json.locked, true);
    assert.strictEqual(res.json.lock_type, 'exclusive');
    assert.strictEqual(res.json.agent, 'test-agent');
  });

  /* ---- LOCK RENEW ---- */
  await test('LOCK_RENEW', async () => {
    const res = await request('POST', '/api/agent-bus/lock?action=renew', {
      file: 'test-smoke-file.txt',
      agent: 'test-agent',
      lock_token: global.__lockToken,
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.json.status, 'renewed');
  });

  /* ---- LOCK RELEASE WRONG TOKEN ---- */
  await test('LOCK_RELEASE wrong token (403)', async () => {
    const res = await request('POST', '/api/agent-bus/lock?action=release', {
      file: 'test-smoke-file.txt',
      agent: 'test-agent',
      lock_token: 'totally-wrong-token',
    });
    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.json.error.code, 'INVALID_TOKEN');
  });

  /* ---- LOCK RELEASE ---- */
  await test('LOCK_RELEASE', async () => {
    const res = await request('POST', '/api/agent-bus/lock?action=release', {
      file: 'test-smoke-file.txt',
      agent: 'test-agent',
      lock_token: global.__lockToken,
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.json.status, 'released');
  });

  /* ---- SCHEMA GET (real resource) ---- */
  await test('GET /schema/content (real schema, semver version)', async () => {
    const res = await request('GET', '/api/agent-bus/schema/content');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.json.resource, 'content');
    assert.strictEqual(typeof res.json.version, 'string', 'version must be a string');
    assert.ok(res.json.etag, 'etag should be present');
    assert.ok(res.json.schema, 'schema body should be present');
  });

  /* ---- SCHEMA PUT without lock token ---- */
  await test('PUT /schema without lock_token (400)', async () => {
    const res = await request('PUT', `/api/agent-bus/schema/${TMP_RESOURCE}`, {
      agent: 'test-agent',
      schema: { version: '0.0.2' },
    });
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.json.error.code, 'VALIDATION_ERROR');
  });

  /* ---- SCHEMA PUT with wrong lock token ---- */
  await test('PUT /schema with bad lock_token (403)', async () => {
    const res = await request('PUT', `/api/agent-bus/schema/${TMP_RESOURCE}`, {
      agent: 'test-agent',
      lock_token: 'nope',
      schema: { version: '0.0.2' },
    });
    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.json.error.code, 'INVALID_TOKEN');
  });

  /* ---- SCHEMA VERSION CONFLICT ---- */
  await test('PUT /schema version mismatch (409)', async () => {
    const token = await acquireSchemaLock();
    const res = await request('PUT', `/api/agent-bus/schema/${TMP_RESOURCE}`, {
      agent: 'test-agent',
      lock_token: token,
      version: '99.99.99', /* deliberately wrong */
      schema: { version: '0.0.2' },
    });
    await releaseSchemaLock(token);
    assert.strictEqual(res.status, 409);
    assert.strictEqual(res.json.error.code, 'VERSION_CONFLICT');
  });

  /* ---- SCHEMA UPDATE HAPPY PATH ---- */
  await test('PUT /schema new version (200)', async () => {
    const before = (await request('GET', `/api/agent-bus/schema/${TMP_RESOURCE}`)).json;
    const token = await acquireSchemaLock();
    const res = await request('PUT', `/api/agent-bus/schema/${TMP_RESOURCE}`, {
      agent: 'test-agent',
      lock_token: token,
      version: before.version,
      schema: { title: 'Smoke temp', type: 'object', version: '0.0.2', properties: { added: {} } },
    });
    await releaseSchemaLock(token);
    assert.strictEqual(res.status, 200, `expected 200, got ${res.status}`);
    assert.strictEqual(res.json.status, 'updated');
    assert.strictEqual(res.json.version, '0.0.2');
    assert.ok(res.json.etag);
    assert.ok(res.json.etag !== before.etag, 'etag should change after update');
    global.__newEtag = res.json.etag;
  });

  /* ---- SCHEMA PERSISTED ON DISK ---- */
  await test('Updated schema was persisted to disk', () => {
    const onDisk = JSON.parse(fs.readFileSync(TMP_SCHEMA_FILE, 'utf8'));
    assert.strictEqual(onDisk.version, '0.0.2');
    assert.ok(onDisk.properties.added, 'new property should be on disk');
  });

  /* ---- EVENTS (SSE) ---- */
  await test('GET /events streams SSE', async () => {
    const events = await readSse('/api/agent-bus/events?filter=AGENT_JOIN', 500);
    assert.ok(Array.isArray(events));
    assert.ok(events.length > 0, 'SSE replay should include the earlier AGENT_JOIN');
    assert.ok(events.every((e) => e.type === 'AGENT_JOIN'), 'filter should only return AGENT_JOIN');
  });

  /* ---- EVENTS (store) ---- */
  await test('EventStore recorded the session', () => {
    const types = eventStore.tail(200).map((e) => e.type);
    for (const t of ['AGENT_JOIN', 'LOCK_GRANTED', 'LOCK_CONFLICT', 'LOCK_RELEASED', 'SCHEMA_UPDATED']) {
      assert.ok(types.includes(t), `event store should contain ${t}`);
    }
  });

  /* ---- SCHEMA NOT FOUND ---- */
  await test('GET /schema/invalid-resource (404)', async () => {
    const res = await request('GET', '/api/agent-bus/schema/invalid-resource');
    assert.strictEqual(res.status, 404);
    assert.strictEqual(res.json.error.code, 'SCHEMA_NOT_FOUND');
  });

  await test('PUT /schema/invalid-resource (404)', async () => {
    const res = await request('PUT', '/api/agent-bus/schema/invalid-resource', {
      agent: 'test-agent',
      lock_token: 'x',
      schema: {},
    });
    assert.strictEqual(res.status, 404);
    assert.strictEqual(res.json.error.code, 'SCHEMA_NOT_FOUND');
  });

  /* ---- AGENT LEAVE ---- */
  await test('AGENT_LEAVE (201)', async () => {
    const res = await request('POST', '/api/agent-bus/message', {
      type: 'AGENT_LEAVE',
      source_agent: 'test-agent',
      correlation_id: 'test-leave-1',
      payload: { agentId: global.__agentId },
    });
    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.json.status, 'accepted');
  });

  /* ---- AGENT GONE ---- */
  await test('Agent removed from registry after AGENT_LEAVE', async () => {
    const res = await request('GET', '/api/agent-bus/agents');
    const agent = res.json.agents.find((a) => a.name === 'test-agent');
    assert.ok(!agent, 'test-agent should be gone');
  });

  /* ---- SUMMARY ---- */
  console.log(`\n\u{1F4CA}  ${passed} passed, ${failed} failed\n`);
  return { passed, failed };
}

/* helpers for the schema-write tests */
async function acquireSchemaLock() {
  const res = await request('POST', '/api/agent-bus/lock?action=acquire', {
    file: `${TMP_RESOURCE}.json`,
    agent: 'test-agent',
    lock_type: 'exclusive',
    reason: 'schema smoke test',
  });
  assert.strictEqual(res.status, 200, `schema lock failed: ${res.status}`);
  return res.json.lock_token;
}

async function releaseSchemaLock(token) {
  await request('POST', '/api/agent-bus/lock?action=release', {
    file: `${TMP_RESOURCE}.json`,
    agent: 'test-agent',
    lock_token: token,
  });
}

/* make the freshly written temp file visible to the in-memory registry */
function loadTempIntoRegistry() {
  const { loadSchemas } = require(path.join(AGENT_SYSTEM_DIR, 'message-bus.js'));
  loadSchemas();
}

server.listen(PORT, async () => {
  console.log(`[SmokeTest] Server on :${PORT}\n`);
  setTimeout(async () => {
    let result = { passed: 0, failed: 1 };
    try {
      result = await run();
    } catch (err) {
      console.error('\n\u274c Smoke test crashed:', err);
    } finally {
      cleanupTempSchema();
      server.close();
      process.exit(result.failed > 0 ? 1 : 0);
    }
  }, 500); /* give server a moment to be ready */
});
