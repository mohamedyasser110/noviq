/* ============================================================
   NOVIQ AGENT COLLABORATION — Agent SDK
   ------------------------------------------------------------
   Lightweight client library for agents to interact with the
   Message Bus without dealing with raw HTTP.
   Usage: const sdk = require('.agent-system/agent-sdk');
   ============================================================ */

const crypto = require('crypto');

class AgentSDK {
  /**
   * @param {Object} options
   * @param {string} options.agentName - Unique agent identifier (e.g., 'frontend', 'backend')
   * @param {string} options.baseUrl - Base URL of the message bus (default: 'http://localhost:4322')
   * @param {number} options.timeout - Request timeout in ms (default: 10000)
   */
  constructor({ agentName, baseUrl = 'http://localhost:4322', timeout = 10000 }) {
    this.agentName = agentName;
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.timeout = timeout;
    this.correlationId = null;
  }

  /** Generate a new correlation ID for a task */
  newCorrelationId() {
    this.correlationId = crypto.randomUUID();
    return this.correlationId;
  }

  /** Internal HTTP helper */
  async _request(method, path, body = null) {
    const url = `${this.baseUrl}${path}`;
    const headers = {
      'Content-Type': 'application/json',
      'X-Agent-Name': this.agentName
    };
    if (this.correlationId) headers['X-Correlation-ID'] = this.correlationId;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error?.message || `HTTP ${response.status}`);
      }
      return data;
    } catch (err) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') throw new Error('Request timeout');
      throw err;
    }
  }

  /* ============================================================
     AGENT LIFECYCLE
     ============================================================ */

  /** Register this agent with the bus */
  async join(capabilities = []) {
    const correlationId = this.newCorrelationId();
    return this._request('POST', '/api/agent-bus/message', {
      type: 'AGENT_JOIN',
      source_agent: this.agentName,
      target_agent: null,
      correlation_id: correlationId,
      payload: { capabilities },
      timestamp: new Date().toISOString()
    });
  }

  /** Unregister this agent */
  async leave() {
    const correlationId = this.newCorrelationId();
    return this._request('POST', '/api/agent-bus/message', {
      type: 'AGENT_LEAVE',
      source_agent: this.agentName,
      target_agent: null,
      correlation_id: correlationId,
      payload: {},
      timestamp: new Date().toISOString()
    });
  }

  /* ============================================================
     FILE LOCKING
     ============================================================ */

  /**
   * Acquire a lock on a file
   * @param {string} file - File path relative to project root
   * @param {'shared'|'exclusive'} lockType - Lock type
   * @param {number} ttlSeconds - Time to live (default: 60)
   * @param {string} reason - Human-readable reason
   * @returns {Object} { lock_token, expires_at }
   */
  async acquireLock(file, lockType = 'exclusive', ttlSeconds = 60, reason = '') {
    const correlationId = this.newCorrelationId();
    const result = await this._request('POST', '/api/agent-bus/lock?action=acquire', {
      file,
      agent: this.agentName,
      lock_type: lockType,
      ttl_seconds: ttlSeconds,
      reason
    });
    return result;
  }

  /**
   * Release a lock
   * @param {string} file - File path
   * @param {string} lockToken - Token from acquireLock
   */
  async releaseLock(file, lockToken) {
    return this._request('POST', '/api/agent-bus/lock?action=release', {
      file,
      agent: this.agentName,
      lock_token: lockToken
    });
  }

  /**
   * Renew a lock before expiry
   * @param {string} file - File path
   * @param {string} lockToken - Token from acquireLock
   * @param {number} ttlSeconds - New TTL
   */
  async renewLock(file, lockToken, ttlSeconds = 60) {
    return this._request('POST', '/api/agent-bus/lock?action=renew', {
      file,
      agent: this.agentName,
      lock_token: lockToken,
      ttl_seconds: ttlSeconds
    });
  }

  /**
   * Check lock status for a file
   * @param {string} file - File path
   */
  async getLockStatus(file) {
    return this._request('POST', '/api/agent-bus/lock?action=status', {
      file,
      agent: this.agentName
    });
  }

  /* ============================================================
     SCHEMA REGISTRY
     ============================================================ */

  /**
   * Read a schema from the registry
   * @param {string} resource - Schema name (content, api-endpoints, db-schema, design-tokens)
   */
  async getSchema(resource) {
    return this._request('GET', `/api/agent-bus/schema/${resource}`);
  }

  /**
   * Update a schema (requires exclusive lock on the schema file)
   * @param {string} resource - Schema name
   * @param {Object} schema - New schema object
   * @param {string} lockToken - Lock token from acquireLock on {resource}.json
   */
  async updateSchema(resource, schema, lockToken) {
    return this._request('PUT', `/api/agent-bus/schema/${resource}`, {
      agent: this.agentName,
      lock_token: lockToken,
      schema
    });
  }

  /* ============================================================
     EVENTS & NOTIFICATIONS
     ============================================================ */

  /**
   * Notify that a file was changed
   * @param {string} file - File path
   * @param {string} changeType - 'created' | 'updated' | 'deleted'
   * @param {string} diffSummary - Brief description of changes
   */
  async notifyFileChanged(file, changeType, diffSummary = '') {
    const correlationId = this.newCorrelationId();
    return this._request('POST', '/api/agent-bus/message', {
      type: 'FILE_CHANGED',
      source_agent: this.agentName,
      target_agent: null,
      correlation_id: correlationId,
      payload: { file, change_type: changeType, diff_summary: diffSummary },
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Report an error to the bus
   * @param {Error|Object} error - Error object
   * @param {Object} context - Additional context
   * @param {'low'|'medium'|'high'|'critical'} severity - Error severity
   */
  async reportError(error, context = {}, severity = 'medium') {
    const correlationId = this.newCorrelationId();
    return this._request('POST', '/api/agent-bus/message', {
      type: 'ERROR_REPORTED',
      source_agent: this.agentName,
      target_agent: null,
      correlation_id: correlationId,
      payload: {
        error: error.message || String(error),
        stack: error.stack,
        context,
        severity
      },
      timestamp: new Date().toISOString()
    });
  }

  /* ============================================================
     SSE EVENT STREAM
     ============================================================ }

  /**
   * Subscribe to real-time events via SSE
   * @param {Object} options
   * @param {number} [options.since] - Sequence number to resume from
   * @param {string} [options.filter] - Event type filter
   * @param {Function} options.onEvent - Callback for each event
   * @returns {Function} Unsubscribe function
   */
  subscribeToEvents({ since, filter, onEvent }) {
    const params = new URLSearchParams();
    if (since) params.set('since', since);
    if (filter) params.set('filter', filter);

    const url = `${this.baseUrl}/api/agent-bus/events?${params}`;
    const eventSource = new EventSource(url);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        onEvent(data);
      } catch (err) {
        console.error('[AgentSDK] Failed to parse SSE event:', err);
      }
    };

    eventSource.onerror = (err) => {
      console.error('[AgentSDK] SSE connection error:', err);
    };

    return () => eventSource.close();
  }

  /* ============================================================
     UTILITY: WORKFLOW HELPERS
     ============================================================ */

  /**
   * Execute a complete read-modify-write cycle with proper locking
   * @param {string} file - File path
   * @param {Function} modifier - Async function(currentContent) => newContent
   * @param {string} reason - Reason for the change
   */
  async withFileLock(file, modifier, reason = 'Agent modification') {
    const lock = await this.acquireLock(file, 'exclusive', 60, reason);
    try {
      // Read current content (agent-specific implementation)
      const currentContent = await this._readFile(file);
      const newContent = await modifier(currentContent);
      // Write new content (agent-specific implementation)
      await this._writeFile(file, newContent);
      // Notify change
      await this.notifyFileChanged(file, 'updated', reason);
      return newContent;
    } finally {
      await this.releaseLock(file, lock.lock_token);
    }
  }

  /** Placeholder - agents implement their own file read */
  async _readFile(file) {
    throw new Error('_readFile not implemented - agent must provide file reading logic');
  }

  /** Placeholder - agents implement their own file write */
  async _writeFile(file, content) {
    throw new Error('_writeFile not implemented - agent must provide file writing logic');
  }
}

/* Convenience factory */
function createAgent(agentName, options = {}) {
  return new AgentSDK({ agentName, ...options });
}

module.exports = { AgentSDK, createAgent };