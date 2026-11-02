/* ============================================================
   NOVIQ AGENT COLLABORATION — Client SDK (for sub-agents)
  ------------------------------------------------------------
   Usage (in any agent script, after the bus is mounted):

     const { AgentBusClient } = require('../.agent-system/client');
     const bus = new AgentBusClient('my-agent', 'http://localhost:4322');
     await bus.connect();
     const lock = await bus.acquireLock('path/to/file.txt', 'exclusive');
     await bus.fileChanged('path/to/file.txt', 'created');
     await bus.releaseLock('path/to/file.txt', lock.lock_token);
     await bus.disconnect();
  ============================================================ */

const crypto = require('crypto');

class AgentBusClient {
  /**
   * @param {string} agentName — human-readable agent name
   * @param {string} baseUrl  — e.g. http://localhost:4322
   */
  constructor(agentName, baseUrl) {
    this.agentName = agentName;
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.agentId = null;
    this.locks = new Map(); /* file -> lock_token */
    this.eventSource = null;
  }

  async _post(path, body) {
    const res = await fetch(this.baseUrl + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return { status: res.status, json: await res.json().catch(() => ({})) };
  }

  async _get(path) {
    const res = await fetch(this.baseUrl + path);
    return { status: res.status, json: await res.json().catch(() => ({})) };
  }

  /** Register this agent with the bus. */
  async connect(capabilities = []) {
    const res = await this._post('/api/agent-bus/message', {
      type: 'AGENT_JOIN',
      source_agent: this.agentName,
      correlation_id: crypto.randomUUID(),
      payload: { capabilities },
    });
    return res;
  }

  /** Acquire a file lock. Returns { status, lock_token, expires_at } or { status: 'conflict', locked_by, wait_suggestion }. */
  async acquireLock(file, lockType = 'exclusive', ttlSeconds = 45, reason = '') {
    const res = await this._post('/api/agent-bus/lock?action=acquire', {
      file, agent: this.agentName, lock_type: lockType, ttl_seconds: ttlSeconds, reason,
    });

    if (res.status === 200 && res.json.status === 'granted') {
      this.locks.set(file, res.json.lock_token);
    }
    return res.json;
  }

  /** Release a previously acquired lock. */
  async releaseLock(file, lockToken = this.locks.get(file)) {
    if (!lockToken) return { status: 'error', message: 'No lock_token provided and none recorded.' };
    const res = await this._post('/api/agent-bus/lock?action=release', {
      file, agent: this.agentName, lock_token: lockToken,
    });
    this.locks.delete(file);
    return res.json;
  }

  /** Broadcast a file change event to all agents. */
  async fileChanged(file, action = 'updated', extra = {}) {
    return await this._post('/api/agent-bus/message', {
      type: 'FILE_CHANGED',
      source_agent: this.agentName,
      correlation_id: crypto.randomUUID(),
      payload: { file, action, ...extra },
    });
  }

  /** Notify agents that a schema was updated. */
  async schemaUpdated(resource, version, etag) {
    return await this._post('/api/agent-bus/message', {
      type: 'SCHEMA_UPDATED',
      source_agent: this.agentName,
      correlation_id: crypto.randomUUID(),
      payload: { resource, version, etag },
    });
  }

  /** Fetch the latest schema version. */
  async getSchema(resource) {
    return await this._get(`/api/agent-bus/schema/${resource}`);
  }

  /** Upload a new schema version. */
  async updateSchema(resource, schema, expectedEtag) {
    const params = expectedEtag ? `?etag=${encodeURIComponent(expectedEtag)}` : '';
    const res = await fetch(this.baseUrl + `/api/agent-bus/schema/${resource}${params}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ schema }),
    });
    return { status: res.status, json: await res.json().catch(() => ({})) };
  }

  /** Report an error to the bus. */
  async reportError(message, details = {}) {
    return await this._post('/api/agent-bus/message', {
      type: 'ERROR_REPORTED',
      source_agent: this.agentName,
      correlation_id: crypto.randomUUID(),
      payload: { message, details },
    });
  }

  /** Subscribe to SSE events. Returns an EventSource. */
  sse(cb) {
    if (typeof window !== 'undefined') {
      const evtSource = new EventSource(this.baseUrl + '/api/agent-bus/events');
      evtSource.onmessage = (e) => cb(JSON.parse(e.data));
      return evtSource;
    }
    /* Node: use EventSource polyfill or raw HTTP */
    throw new Error('SSE client requires browser EventSource or a polyfill in Node.');
  }

  /** Disconnect / leave the bus. */
  async disconnect() {
    await this._post('/api/agent-bus/message', {
      type: 'AGENT_LEAVE',
      source_agent: this.agentName,
      correlation_id: crypto.randomUUID(),
      payload: {},
    });
  }

  /** Heartbeat — call periodically to stay alive. */
  async heartbeat() {
    return await this._post('/api/agent-bus/message', {
      type: 'HEARTBEAT',
      source_agent: this.agentName,
      correlation_id: crypto.randomUUID(),
      payload: {},
    });
  }
}

module.exports = { AgentBusClient };
