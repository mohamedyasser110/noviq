/* ============================================================
   NOVIQ AGENT COLLABORATION — Agent Registry
  ------------------------------------------------------------
   Tracks active agents, emits AGENT_JOIN / AGENT_LEAVE events.
   Each agent is identified by a UUID assigned on join.
   ============================================================ */

const crypto = require('crypto');
const EventEmitter = require('events');

class AgentRegistry extends EventEmitter {
  constructor() {
    super();
    /** Map<agentId, { name, joined_at, last_heartbeat, capabilities:[] }> */
    this.agents = new Map();
    this.cleanupTimer = null;
    this.HEARTBEAT_TIMEOUT = 120000; /* 2 min */
  }

  /**
   * Register a new agent.
   * @param {string} name — human-readable agent id (frontend, backend, debugger, etc.)
   * @param {string[]} [capabilities] — optional capabilities list
   * @returns {string} agentId — the stable UUID for this agent session
   */
  join(name, capabilities = []) {
    const existingId = this._findByName(name);
    if (existingId) {
      /* refresh heartbeat & capabilities */
      const rec = this.agents.get(existingId);
      rec.last_heartbeat = Date.now();
      rec.capabilities = capabilities;
      return existingId;
    }

    const agentId = crypto.randomUUID();
    this.agents.set(agentId, {
      name,
      joined_at: new Date().toISOString(),
      last_heartbeat: Date.now(),
      capabilities,
    });
    this.emit('agent:joined', { agentId, name, capabilities });
    return agentId;
  }

  _findByName(name) {
    for (const [id, rec] of this.agents) {
      if (rec.name === name) return id;
    }
    return null;
  }

  /** Remove an agent. */
  leave(agentId) {
    const rec = this.agents.get(agentId);
    if (!rec) return false;
    this.agents.delete(agentId);
    this.emit('agent:left', { agentId, name: rec.name });
    return true;
  }

  /** Heartbeat refresh — called on every message from the agent. */
  heartbeat(agentId) {
    const rec = this.agents.get(agentId);
    if (rec) {
      rec.last_heartbeat = Date.now();
      return true;
    }
    return false;
  }

  /** List all active agents. */
  list() {
    const now = Date.now();
    const result = [];
    for (const [id, rec] of this.agents) {
      const stale = now - rec.last_heartbeat > this.HEARTBEAT_TIMEOUT;
      result.push({
        id,
        name: rec.name,
        joined_at: rec.joined_at,
        last_heartbeat: new Date(rec.last_heartbeat).toISOString(),
        capabilities: rec.capabilities,
        stale,
      });
    }
    return result;
  }

  /** Check if agent is registered & alive. */
  isAlive(name) {
    const id = this._findByName(name);
    if (!id) return false;
    const rec = this.agents.get(id);
    return (Date.now() - rec.last_heartbeat) < this.HEARTBEAT_TIMEOUT;
  }

  /** Periodic cleanup of stale agents. */
  startCleanup() {
    if (this.cleanupTimer) return;
    this.cleanupTimer = setInterval(() => {
      const now = Date.now();
      for (const [id, rec] of this.agents) {
        if (now - rec.last_heartbeat > this.HEARTBEAT_TIMEOUT) {
          this.leave(id);
        }
      }
    }, 30000);
    this.cleanupTimer.unref && this.cleanupTimer.unref();
  }

  stopCleanup() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }
}

module.exports = AgentRegistry;
