/* ============================================================
   NOVIQ AGENT COLLABORATION — File Lock Manager
  ------------------------------------------------------------
   Shared (read) / Exclusive (write) locks with auto-TTL and
   optional renewal. Emits LOCK_CONFLICT events on contention.
   ============================================================ */

const crypto = require('crypto');

const DEFAULT_TTL = 60;        /* seconds */
const MIN_TTL = 30;
const HEALTH_TTL = 30;         /* agent must still be healthy */
const AGENT_TIMEOUT = 120;     /* agent considered stale after 2 min silence */
const CLEANUP_INTERVAL = 10000;/* sweep expired locks every 10s */

class FileLockManager {
  constructor() {
    this.locks = new Map();          /* file path -> { shared:Set, exclusive:?{...} } */
    this.lockTokens = new Map();     /* token -> { file, agent, lock_type, expires_at, health_check } */
    this.agentHeartbeats = new Map();/* agent -> last seen timestamp */
    this.cleanupTimer = null;
  }

  /* ---- agent registry hooks (for liveness) ---- */

  /** Register / refresh an agent's heartbeat. */
  heartbeat(agent) {
    this.agentHeartbeats.set(agent, Date.now());
  }

  /** Returns true if agent was seen within AGENT_TIMEOUT. */
  isAgentAlive(agent) {
    const ts = this.agentHeartbeats.get(agent);
    if (!ts) return false;
    return (Date.now() - ts) < AGENT_TIMEOUT * 1000;
  }

  /** Remove a dead agent entirely (called on AGENT_LEAVE message). */
  unregisterAgent(agent) {
    this.agentHeartbeats.delete(agent);
    /* release any locks held by this agent */
    for (const [token, info] of this.lockTokens) {
      if (info.agent === agent) {
        this._unsafeRemove(token, info);
      }
    }
  }

  /* ---- core lock operations ---- */

  /**
   * Acquire a lock on a file.
   * @param {Object} opts
   * @returns {{ status:'granted'|'conflict'|'error', lock_token?, expires_at?, locked_by?, wait_suggestion? }}
   */
  acquire(file, agent, lockType, ttlSeconds = DEFAULT_TTL, reason = '') {
    ttlSeconds = Math.max(MIN_TTL, Math.min(ttlSeconds, DEFAULT_TTL));
    this.heartbeat(agent);

    let entry = this.locks.get(file);
    if (!entry) {
      entry = { shared: new Set(), exclusive: null };
      this.locks.set(file, entry);
    }

    /* --- conflict detection --- */
    if (lockType === 'exclusive') {
      if (entry.exclusive || entry.shared.size > 0) {
        return this._conflict(file, entry, agent);
      }
    } else {
      /* shared read lock: conflict only with an *exclusive* writer */
      if (entry.exclusive) {
        return this._conflict(file, entry, agent);
      }
    }

    /* --- grant lock --- */
    const token = crypto.randomBytes(24).toString('hex');
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

    if (lockType === 'exclusive') {
      entry.exclusive = { agent, token, reason, expires_at: expiresAt, ttl: ttlSeconds };
    } else {
      entry.shared.add(token);
    }

    this.lockTokens.set(token, {
      file, agent, lock_type: lockType, expires_at: expiresAt,
      health_ttl: HEALTH_TTL, reason
    });

    return { status: 'granted', lock_token: token, expires_at: expiresAt.toISOString() };
  }

  _conflict(file, entry, requestingAgent) {
    let lockedBy = requestingAgent;
    if (entry.exclusive) lockedBy = entry.exclusive.agent;
    else {
      const firstToken = entry.shared.values().next().value;
      const first = this.lockTokens.get(firstToken);
      lockedBy = first ? first.agent : 'unknown';
    }
    const waitSuggestion = 5;
    return {
      status: 'conflict',
      locked_by: lockedBy,
      wait_suggestion: waitSuggestion,
    };
  }

  /**
   * Renew a lock before it expires.
   * Returns true if renewed, false if token invalid or stale.
   */
  renew(file, agent, lockToken, ttlSeconds = DEFAULT_TTL) {
    const info = this.lockTokens.get(lockToken);
    if (!info || info.file !== file || info.agent !== agent) {
      return false;
    }
    ttlSeconds = Math.max(MIN_TTL, Math.min(ttlSeconds, DEFAULT_TTL));
    const newExpires = new Date(Date.now() + ttlSeconds * 1000);

    if (info.lock_type === 'exclusive') {
      const entry = this.locks.get(file);
      if (entry && entry.exclusive && entry.exclusive.token === lockToken) {
        entry.exclusive.expires_at = newExpires;
        entry.exclusive.ttl = ttlSeconds;
      }
    }
    info.expires_at = newExpires;
    info.ttl = ttlSeconds;
    return true;
  }

  /**
   * Release a lock.
   * Returns true if a lock was found and released.
   */
  release(file, agent, lockToken) {
    const info = this.lockTokens.get(lockToken);
    if (!info || info.file !== file || info.agent !== agent) {
      return false;
    }
    this._unsafeRemove(lockToken, info);
    return true;
  }

  _unsafeRemove(token, info) {
    const entry = this.locks.get(info.file);
    if (!entry) return;

    if (info.lock_type === 'exclusive') {
      if (entry.exclusive && entry.exclusive.token === token) {
        entry.exclusive = null;
      }
    } else {
      entry.shared.delete(token);
    }
    this.lockTokens.delete(token);

    /* prune empty entries */
    if (!entry.exclusive && entry.shared.size === 0) {
      this.locks.delete(info.file);
    }
  }

  /** Query lock status for a file. */
  status(file) {
    const entry = this.locks.get(file);
    if (!entry) return { locked: false, lock_type: null, agent: null };
    if (entry.exclusive) {
      return { locked: true, lock_type: 'exclusive', agent: entry.exclusive.agent, expires_at: entry.exclusive.expires_at };
    }
    if (entry.shared.size > 0) {
      const agents = [...entry.shared].map(t => this.lockTokens.get(t)?.agent).filter(Boolean);
      return { locked: true, lock_type: 'shared', agents };
    }
    return { locked: false, lock_type: null, agent: null };
  }

  /** Periodically sweep expired locks. */
  startCleanup() {
    if (this.cleanupTimer) return;
    this.cleanupTimer = setInterval(() => {
      const now = Date.now();
      for (const [token, info] of this.lockTokens) {
        if (info.expires_at.getTime() <= now) {
          this._unsafeRemove(token, info);
        }
      }
      /* sweep stale agent heartbeats */
      for (const [agent, ts] of this.agentHeartbeats) {
        if (now - ts > AGENT_TIMEOUT * 1000) {
          this.agentHeartbeats.delete(agent);
        }
      }
    }, CLEANUP_INTERVAL);
    this.cleanupTimer.unref && this.cleanupTimer.unref();
  }

  stopCleanup() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }
}

module.exports = FileLockManager;
