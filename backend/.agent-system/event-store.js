/* ============================================================
   NOVIQ AGENT COLLABORATION — Event Store
  ------------------------------------------------------------
   Persists events to events/recent-events.log (append-only,
   JSONL) and keeps the last N events in-memory for SSE replay.
   ============================================================ */

const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');

class EventStore extends EventEmitter {
  /**
   * @param {string} logPath — absolute path to recent-events.log
   * @param {number} maxRecent — in-memory ring buffer size
   */
  constructor(logPath, maxRecent = 500) {
    super();
    this.logPath = logPath;
    this.maxRecent = maxRecent;
    this.recent = [];        /* in-memory ring */
    this._seq = 0;

    /* ensure directory + file exist */
    fs.mkdirSync(path.dirname(logPath), { recursive: true });
    if (!fs.existsSync(logPath)) {
      fs.writeFileSync(logPath, '', { flag: 'wx' });
    }
    /* load tail of existing log so SSE clients get recent history on connect */
    this._loadTail();
  }

  _loadTail() {
    try {
      const stat = fs.statSync(this.logPath);
      /* read last 64KB to avoid huge memory on startup */
      const maxRead = Math.min(stat.size, 0x10000);
      const fh = fs.openSync(this.logPath, 'r');
      const buf = Buffer.alloc(maxRead);
      fs.readSync(fh, buf, 0, maxRead, stat.size - maxRead);
      fs.closeSync(fh);

      const raw = buf.toString('utf8').split(/\r?\n/).filter(Boolean);
      for (const line of raw) {
        try {
          const evt = JSON.parse(line);
          this.recent.push(evt);
          if (this.recent.length > this.maxRecent) this.recent.shift();
          this._seq = Math.max(this._seq, evt.seq || 0);
        } catch { /* ignore malformed lines */ }
      }
    } catch (err) {
      /* first run, empty file — fine */
    }
  }

  /**
   * Append a domain event and broadcast.
   * @param {string} type — e.g. LOCK_ACQUIRE, AGENT_JOIN, FILE_CHANGED
   * @param {object} [payload]
   * @param {string} [source_agent]
   * @param {string} [target_agent] — null = broadcast
   * @param {string} [correlation_id]
   * @returns {object} the persisted event (with seq, timestamp)
   */
  append(type, payload = {}, source_agent = 'system', target_agent = null, correlation_id = null) {
    const seq = ++this._seq;
    const event = {
      seq,
      type,
      source_agent,
      target_agent,
      payload,
      correlation_id,
      timestamp: new Date().toISOString(),
    };

    /* append to log (JSONL) */
    const line = JSON.stringify(event) + '\n';
    try {
      fs.appendFileSync(this.logPath, line, 'utf8');
    } catch (err) {
      console.error('[EventStore] Failed to append:', err.message);
    }

    /* ring buffer */
    this.recent.push(event);
    if (this.recent.length > this.maxRecent) this.recent.shift();

    /* emit for SSE + any listeners */
    this.emit('event', event);

    return event;
  }

  /** Return the last N events (oldest first). */
  tail(n = this.maxRecent) {
    return this.recent.slice(-n);
  }

  /** Get events from a specific seq onward (for reconnect / since= query). */
  since(seq) {
    return this.recent.filter(e => e.seq > seq);
  }

  /** All events matching a type filter, newest first. */
  byType(type, limit = 100) {
    return this.recent.filter(e => e.type === type).reverse().slice(0, limit);
  }
}

module.exports = EventStore;
