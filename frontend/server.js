const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const PORT = 8765;
const ANALYTICS_FILE = path.join(ROOT, 'analytics-visits.json');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
};

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

http.createServer((req, res) => {
  const url = req.url.split('?')[0];
  const method = req.method || 'GET';

  if (method === 'OPTIONS' && url.startsWith('/api/')) {
    res.writeHead(204, CORS);
    res.end();
    return;
  }

  if (url.startsWith('/api/')) {
    if (url === '/api/analytics/visit' && method === 'POST') {
      let body = '';
      req.on('data', c => { body += c; if (body.length > 1e5) req.destroy(); });
      req.on('end', () => {
        let rec = {};
        try { rec = JSON.parse(body || '{}'); } catch {}
        rec.t = Date.now();
        fs.appendFile(ANALYTICS_FILE, JSON.stringify(rec) + '\n', () => {});
        res.writeHead(200, Object.assign({ 'Content-Type': 'application/json' }, CORS));
        res.end(JSON.stringify({ ok: true }));
      });
      return;
    }
    res.writeHead(404, Object.assign({ 'Content-Type': 'application/json' }, CORS));
    res.end(JSON.stringify({ error: 'Not found' }));
    return;
  }

  if (url === '/favicon.ico') {
    res.writeHead(301, { Location: '/favicon.svg' });
    res.end();
    return;
  }

  const fp = path.normalize(path.join(ROOT, url === '/' ? 'index.html' : url));
  if (!fp.startsWith(ROOT)) { res.writeHead(403); res.end('Forbidden'); return; }
  fs.readFile(fp, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    const ext = path.extname(fp);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Access-Control-Allow-Origin': '*' });
    res.end(data);
  });
}).listen(PORT, () => console.log('Serving on http://localhost:' + PORT));