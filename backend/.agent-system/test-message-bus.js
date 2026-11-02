/* ============================================================
   NOVIQ AGENT COLLABORATION — Message Bus Tests
   ------------------------------------------------------------
   Unit tests for the message bus, lock manager, and schema registry.
   Run with: node .agent-system/test-message-bus.js
   ============================================================ */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const { app, agentRegistry, eventStore, lockManager, schemaRegistry, loadSchemas } = require('./message-bus');

/* ---- Test Helpers ---- */
let testCount = 0;
let passCount = 0;
let failCount = 0;

function test(name, fn) {
  testCount++;
  try {
    fn();
    console.log(`✅  ${name}`);
    passCount++;
  } catch (err) {
    console.error(`❌  ${name}`);
    console.error(`    ${err.message}`);
    failCount++;
  }
}

function assertEqual(actual, expected, msg = '') {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${msg} Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function assertTrue(value, msg = '') {
  if (!value) throw new Error(`${msg} Expected truthy value`);
}

/* ---- Mock HTTP Server for integration tests ---- */
const http = require('http');
let server = null;
const TEST_PORT = 34567;

function startTestServer() {
  return new Promise((resolve) => {
    const express = require('express');
    const testApp = express();
    testApp.use(express.json());
    testApp.use('/api/agent-bus', app);
    server = testApp.listen(TEST_PORT, () => resolve());
  });
}

function stopTestServer() {
  return new Promise((resolve) => {
    if (server) server.close(() => resolve());
    else resolve();
  });
}

async function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: TEST_PORT,
      path: `/api/agent-bus${path}`,
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-Agent-Name': 'test-agent'
      }
    };
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

/* ============================================================
   TEST SUITE
   ============================================================ */

console.log('\n🧪  NOVIQ Agent Collaboration — Test Suite\n');
console.log('='.repeat(60));

/* ---- Agent Registry Tests ---- */
console.log('\n📋  Agent Registry');

test('AgentRegistry: join returns unique ID', () => {
  const reg = new (require('./agent-registry'))();
  const id1 = reg.join('frontend');
  const id2 = reg.join('backend');
  assertTrue(id1 && id2);
  assertTrue(id1 !== id2);
});

test('AgentRegistry: duplicate name refreshes heartbeat', () => {
  const reg = new (require('./agent-registry'))();
  const id1 = reg.join('frontend');
  const id2 = reg.join('frontend', ['new-cap']);
  assertEqual(id1, id2);
  const agents = reg.list();
  assertEqual(agents.length, 1);
  assertEqual(agents[0].capabilities, ['new-cap']);
});

test('AgentRegistry: leave removes agent', () => {
  const reg = new (require('./agent-registry'))();
  const id = reg.join('tester');
  reg.leave(id);
  assertEqual(reg.list().length, 0);
});

test('AgentRegistry: stale detection works', () => {
  const reg = new (require('./agent-registry'))();
  const id = reg.join('debugger');
  // Manually set old heartbeat
  const rec = reg.agents.get(id);
  rec.last_heartbeat = Date.now() - 200000; // > 2 min
  assertTrue(!reg.isAlive('debugger'));
});

/* ---- Event Store Tests ---- */
console.log('\n📜  Event Store');

test('EventStore: append and tail', () => {
  const tmpLog = path.join(__dirname, 'events', 'test-events.log');
  if (fs.existsSync(tmpLog)) fs.unlinkSync(tmpLog);
  
  const store = new (require('./event-store'))(tmpLog, 100);
  store.append('TEST_EVENT', { foo: 'bar' }, 'test-agent');
  const events = store.tail(10);
  assertEqual(events.length, 1);
  assertEqual(events[0].type, 'TEST_EVENT');
  assertEqual(events[0].payload.foo, 'bar');
  
  if (fs.existsSync(tmpLog)) fs.unlinkSync(tmpLog);
});

test('EventStore: since filter', () => {
  const tmpLog = path.join(__dirname, 'events', 'test-events2.log');
  if (fs.existsSync(tmpLog)) fs.unlinkSync(tmpLog);
  
  const store = new (require('./event-store'))(tmpLog, 100);
  store.append('EVT1', {}, 'a');
  store.append('EVT2', {}, 'a');
  store.append('EVT3', {}, 'a');
  const since2 = store.since(2);
  assertEqual(since2.length, 1);
  assertEqual(since2[0].type, 'EVT3');
  
  if (fs.existsSync(tmpLog)) fs.unlinkSync(tmpLog);
});

/* ---- File Lock Manager Tests ---- */
console.log('\n🔒  File Lock Manager');

test('FileLockManager: exclusive lock granted', () => {
  const lm = new (require('./file-lock-manager'))();
  const result = lm.acquire('test.txt', 'agent1', 'exclusive', 60, 'test');
  assertEqual(result.status, 'granted');
  assertTrue(result.lock_token);
  assertTrue(result.expires_at);
});

test('FileLockManager: shared lock allows multiple readers', () => {
  const lm = new (require('./file-lock-manager'))();
  const r1 = lm.acquire('shared.txt', 'agent1', 'shared', 60);
  const r2 = lm.acquire('shared.txt', 'agent2', 'shared', 60);
  assertEqual(r1.status, 'granted');
  assertEqual(r2.status, 'granted');
  const status = lm.status('shared.txt');
  assertEqual(status.lock_type, 'shared');
  assertEqual(status.agents.length, 2);
});

test('FileLockManager: exclusive blocks shared', () => {
  const lm = new (require('./file-lock-manager'))();
  lm.acquire('conflict.txt', 'agent1', 'exclusive', 60);
  const result = lm.acquire('conflict.txt', 'agent2', 'shared', 60);
  assertEqual(result.status, 'conflict');
  assertEqual(result.locked_by, 'agent1');
});

test('FileLockManager: shared blocks exclusive', () => {
  const lm = new (require('./file-lock-manager'))();
  lm.acquire('conflict2.txt', 'agent1', 'shared', 60);
  const result = lm.acquire('conflict2.txt', 'agent2', 'exclusive', 60);
  assertEqual(result.status, 'conflict');
});

test('FileLockManager: release works', () => {
  const lm = new (require('./file-lock-manager'))();
  const lock = lm.acquire('release.txt', 'agent1', 'exclusive', 60);
  const released = lm.release('release.txt', 'agent1', lock.lock_token);
  assertTrue(released);
  assertEqual(lm.status('release.txt').locked, false);
});

test('FileLockManager: renew extends expiry', () => {
  const lm = new (require('./file-lock-manager'))();
  const lock = lm.acquire('renew.txt', 'agent1', 'exclusive', 1); // 1 sec
  const before = lm.status('renew.txt').expires_at;
  // Wait a bit and renew
  setTimeout(() => {
    const renewed = lm.renew('renew.txt', 'agent1', lock.lock_token, 60);
    assertTrue(renewed);
    const after = lm.status('renew.txt').expires_at;
    assertTrue(new Date(after) > new Date(before));
  }, 50);
});

test('FileLockManager: invalid token rejected', () => {
  const lm = new (require('./file-lock-manager'))();
  const released = lm.release('fake.txt', 'agent1', 'invalid-token');
  assertTrue(!released);
});

test('FileLockManager: unregisterAgent releases locks', () => {
  const lm = new (require('./file-lock-manager'))();
  lm.acquire('agent-lock.txt', 'agent1', 'exclusive', 60);
  lm.unregisterAgent('agent1');
  assertEqual(lm.status('agent-lock.txt').locked, false);
});

/* ---- Schema Registry Tests ---- */
console.log('\n📐  Schema Registry');

test('SchemaRegistry: loadSchemas loads existing files', () => {
  loadSchemas();
  assertTrue(schemaRegistry.has('content'));
  assertTrue(schemaRegistry.has('api-endpoints'));
  assertTrue(schemaRegistry.has('db-schema'));
  assertTrue(schemaRegistry.has('design-tokens'));
});

test('SchemaRegistry: saveSchema updates registry and disk', () => {
  const testSchema = {
    version: '9.9.9',
    title: 'Test Schema',
    type: 'object',
    properties: { test: { type: 'string' } }
  };
  const saved = require('./message-bus').saveSchema('test-schema', testSchema, 'test-agent');
  assertEqual(saved.version, '9.9.9');
  assertTrue(schemaRegistry.has('test-schema'));
  assertTrue(fs.existsSync(path.join(__dirname, 'schemas', 'test-schema.json')));
  // Cleanup
  fs.unlinkSync(path.join(__dirname, 'schemas', 'test-schema.json'));
  schemaRegistry.delete('test-schema');
});

/* ---- Integration Tests (HTTP) ---- */
console.log('\n🌐  HTTP Integration Tests');

async function runIntegrationTests() {
  await startTestServer();
  console.log(`   Test server started on port ${TEST_PORT}`);

  try {
    // Test health endpoint
    const health = await request('GET', '/health');
    test('HTTP: /health returns healthy', () => {
      assertEqual(health.status, 200);
      assertEqual(health.data.status, 'healthy');
    });

    // Test agent join
    const join = await request('POST', '/message', {
      type: 'AGENT_JOIN',
      source_agent: 'integration-test',
      target_agent: null,
      correlation_id: 'test-1',
      payload: { capabilities: ['testing'] },
      timestamp: new Date().toISOString()
    });
    test('HTTP: AGENT_JOIN works', () => {
      assertEqual(join.status, 201);
      assertEqual(join.data.status, 'accepted');
      assertEqual(join.data.event, 'AGENT_JOIN');
    });

    // Test lock acquire
    const lock = await request('POST', '/lock?action=acquire', {
      file: 'test-integration.txt',
      agent: 'integration-test',
      lock_type: 'exclusive',
      ttl_seconds: 60,
      reason: 'integration test'
    });
    test('HTTP: lock acquire works', () => {
      assertEqual(lock.status, 200);
      assertEqual(lock.data.status, 'granted');
      assertTrue(lock.data.lock_token);
    });

    // Test lock conflict
    const conflict = await request('POST', '/lock?action=acquire', {
      file: 'test-integration.txt',
      agent: 'another-agent',
      lock_type: 'exclusive',
      ttl_seconds: 60
    });
    test('HTTP: lock conflict returns 409', () => {
      assertEqual(conflict.status, 409);
      assertEqual(conflict.data.status, 'conflict');
    });

    // Test lock release
    const release = await request('POST', '/lock?action=release', {
      file: 'test-integration.txt',
      agent: 'integration-test',
      lock_token: lock.data.lock_token
    });
    test('HTTP: lock release works', () => {
      assertEqual(release.status, 200);
      assertEqual(release.data.status, 'released');
    });

    // Test schema read
    const schema = await request('GET', '/schema/content');
    test('HTTP: schema read works', () => {
      assertEqual(schema.status, 200);
      assertEqual(schema.data.resource, 'content');
      assertTrue(schema.data.schema);
    });

    // Test agents list
    const agents = await request('GET', '/agents');
    test('HTTP: agents list works', () => {
      assertEqual(agents.status, 200);
      assertTrue(Array.isArray(agents.data.agents));
    });

  } finally {
    await stopTestServer();
  }
}

// Run async integration tests
runIntegrationTests().then(() => {
  /* ---- Summary ---- */
  console.log('\n' + '='.repeat(60));
  console.log(`📊  Results: ${passCount}/${testCount} passed, ${failCount} failed`);
  if (failCount > 0) {
    console.log('❌  Some tests failed');
    process.exit(1);
  } else {
    console.log('✅  All tests passed!');
    process.exit(0);
  }
}).catch(err => {
  console.error('Test runner error:', err);
  process.exit(1);
});