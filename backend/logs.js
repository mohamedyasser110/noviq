const db = require('./db/init');

function logEvent(level, source, message, req) {
  try {
    db.prepare('INSERT INTO admin_logs (level, source, message, ip, path) VALUES (?, ?, ?, ?, ?)').run(
      level || 'info',
      source || 'admin',
      String(message || '').slice(0, 500),
      (req && req.ip) || '',
      (req && req.originalUrl) || ''
    );
  } catch {}
}

function listLogs(limit) {
  return db.prepare('SELECT id, level, source, message, ip, path, created_at FROM admin_logs ORDER BY id DESC LIMIT ?').all(limit || 200);
}

function deleteLog(id) {
  return db.prepare('DELETE FROM admin_logs WHERE id = ?').run(id).changes > 0;
}

function clearLogs() {
  return db.prepare('DELETE FROM admin_logs').run().changes;
}

function exportCsv() {
  const rows = db.prepare('SELECT id, created_at, level, source, message, ip, path FROM admin_logs ORDER BY id DESC').all();
  const esc = v => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;
  const lines = ['id,created_at,level,source,message,ip,path'];
  for (const r of rows) {
    lines.push([r.id, r.created_at, r.level, r.source, r.message, r.ip, r.path].map(esc).join(','));
  }
  return lines.join('\n');
}

function limitHandler(source) {
  return (req, res, next, opts) => {
    logEvent('warning', 'rate-limit', `${source} limit hit for ${req.ip}`, req);
    const status = (opts && opts.statusCode) || 429;
    const message = (opts && opts.message) || { error: 'Too many requests, please try again later.' };
    res.status(status).json(typeof message === 'object' ? message : { error: String(message) });
  };
}

module.exports = { logEvent, listLogs, deleteLog, clearLogs, exportCsv, limitHandler };