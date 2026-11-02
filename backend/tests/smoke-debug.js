console.log('[smoke-debug] step 1: loading db');
const db = require('../db/init');
console.log('[smoke-debug] step 2: db loaded');

console.log('[smoke-debug] step 3: loading config');
const config = require('../config');
console.log('[smoke-debug] step 4: config loaded, FRONTEND_DIR:', config.FRONTEND_DIR);

console.log('[smoke-debug] step 5: loading content-store');
const { buildConfigSource } = require('../services/content-store');
console.log('[smoke-debug] step 6: content-store loaded');
const src = buildConfigSource();
console.log('[smoke-debug] step 7: buildConfigSource returned', src.length, 'chars');

console.log('[smoke-debug] step 8: requiring auth');
const { ensureAdminUser } = require('../middleware/auth');
console.log('[smoke-debug] step 9: calling ensureAdminUser');
ensureAdminUser();
console.log('[smoke-debug] step 10: ensureAdminUser done');

console.log('[smoke-debug] step 11: loading app');
const app = require('../app');
console.log('[smoke-debug] step 12: app loaded');

console.log('[smoke-debug] step 13: creating server');
const http = require('http');
const srv = http.createServer(app);
console.log('[smoke-debug] step 14: listening');
srv.listen(3099, () => {
  console.log('[smoke-debug] server up on 3099');
  setTimeout(() => { srv.close(); console.log('[smoke-debug] server closed'); process.exit(0); }, 500);
});
