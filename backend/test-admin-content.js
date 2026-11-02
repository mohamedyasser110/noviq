const assert = require('assert');
const fs = require('fs');
const http = require('http');
const path = require('path');
const { spawn } = require('child_process');

const port = 3197;
const root = path.join(__dirname, '.tmp-content-test');
const frontend = path.join(root, 'frontend');
const password = 'test-admin-content-2026';
let server;

function request(method, requestPath, body, token) {
  return new Promise((resolve, reject) => {
    const data = body === undefined ? null : JSON.stringify(body);
    const req = http.request({
      hostname: '127.0.0.1',
      port,
      path: requestPath,
      method,
      headers: {
        ...(data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    }, res => {
      let raw = '';
      res.on('data', chunk => { raw += chunk; });
      res.on('end', () => {
        let json;
        try { json = raw ? JSON.parse(raw) : null; } catch { json = null; }
        resolve({ status: res.statusCode, json, raw });
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function waitForServer() {
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      const response = await request('GET', '/api/health');
      if (response.status === 200) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('Test server did not start.');
}

(async () => {
  fs.rmSync(root, { recursive: true, force: true });
  fs.mkdirSync(frontend, { recursive: true });
  server = spawn(process.execPath, ['index.js'], {
    cwd: __dirname,
    env: {
      ...process.env,
      PORT: String(port),
      DB_PATH: path.join(root, 'noviq.db'),
      FRONTEND_DIR: frontend,
      UPLOADS_DIR: path.join(frontend, 'images', 'uploads'),
      SERVE_FRONTEND: 'false',
      ADMIN_PASSWORD: password,
      JWT_SECRET: 'test-content-secret-with-sufficient-length',
      NODE_ENV: 'test',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let errors = '';
  server.stderr.on('data', chunk => { errors += chunk; });
  await waitForServer();

  const login = await request('POST', '/api/admin/login', { username: 'admin', password });
  assert.equal(login.status, 200, errors || login.raw);
  const token = login.json.token;

  const resourcesResponse = await request('GET', '/api/admin/content/resources', undefined, token);
  assert.equal(resourcesResponse.status, 200);
  const resources = resourcesResponse.json.value;
  assert.deepEqual(resources.tabs.map(tab => tab.id), ['news', 'blog', 'whitepapers', 'downloads']);

  resources.items.news.push({
    id: 'launch-news',
    title: { en: 'Noviq Launch', ar: 'إطلاق نوفيك' },
    excerpt: { en: 'Launch details.', ar: 'تفاصيل الإطلاق.' },
    content: { en: 'Full launch story.', ar: 'خبر الإطلاق الكامل.' },
    cat: { en: 'Company', ar: 'الشركة' },
    date: '2026-07-23',
    author: 'Noviq',
    link: '',
    file: '',
    image: '',
    status: 'published',
    featured: true,
  });
  const saveResources = await request('PUT', '/api/admin/content/resources', { value: resources }, token);
  assert.equal(saveResources.status, 200, saveResources.raw);

  const publicContent = await request('GET', '/api/content');
  assert.equal(publicContent.status, 200);
  assert.equal(publicContent.json.resources.items.news[0].id, 'launch-news');

  const unsafeResources = JSON.parse(JSON.stringify(resources));
  unsafeResources.items.news[0].link = 'javascript:alert(1)';
  const unsafeSave = await request('PUT', '/api/admin/content/resources', { value: unsafeResources }, token);
  assert.equal(unsafeSave.status, 400);

  const upload = await request('POST', '/api/admin/upload', {
    filename: 'guide.txt',
    data: `data:text/plain;base64,${Buffer.from('Noviq guide').toString('base64')}`,
  }, token);
  assert.equal(upload.status, 200, upload.raw);
  assert.match(upload.json.path, /^images\/uploads\/.+\.txt$/);
  assert.equal(fs.existsSync(path.join(frontend, upload.json.path)), true);

  const svgUpload = await request('POST', '/api/admin/upload', {
    filename: 'unsafe.svg',
    data: `data:image/svg+xml;base64,${Buffer.from('<svg onload="alert(1)"/>').toString('base64')}`,
  }, token);
  assert.equal(svgUpload.status, 400);

  const projectsResponse = await request('GET', '/api/admin/content/projects', undefined, token);
  assert.equal(projectsResponse.status, 200);
  assert.equal(Object.hasOwn(projectsResponse.json.value[0], 'link'), true);
  assert.equal(Object.hasOwn(projectsResponse.json.value[0], 'challengeAr'), true);

  const promptResponse = await request('GET', '/api/admin/content/promptBuilder', undefined, token);
  assert.equal(promptResponse.status, 200);
  const promptBuilder = promptResponse.json.value;
  promptBuilder.active = false;
  const savePrompt = await request('PUT', '/api/admin/content/promptBuilder', { value: promptBuilder }, token);
  assert.equal(savePrompt.status, 200, savePrompt.raw);
  assert.equal(savePrompt.json.value.active, false);
  assert.equal(savePrompt.json.value.revision, promptBuilder.revision + 1);

  const solutionResponse = await request('GET', '/api/admin/content/solutionBuilder', undefined, token);
  assert.equal(solutionResponse.status, 200);
  const solutionBuilder = solutionResponse.json.value;
  solutionBuilder.steps[0].title = 'Updated test question';
  const saveSolution = await request('PUT', '/api/admin/content/solutionBuilder', { value: solutionBuilder }, token);
  assert.equal(saveSolution.status, 200, saveSolution.raw);
  assert.equal(saveSolution.json.value.steps[0].title, 'Updated test question');

  const invalidSolution = JSON.parse(JSON.stringify(solutionBuilder));
  invalidSolution.steps[0].options.push({ ...invalidSolution.steps[0].options[0] });
  const rejectSolution = await request('PUT', '/api/admin/content/solutionBuilder', { value: invalidSolution }, token);
  assert.equal(rejectSolution.status, 400);

  console.log('Admin content integration tests passed.');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
}).finally(() => {
  if (server) server.kill();
  setTimeout(() => fs.rmSync(root, { recursive: true, force: true }), 100);
});
