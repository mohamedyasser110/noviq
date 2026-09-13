const fs = require('fs');
const path = require('path');
const db = require('./db/init');
const config = require('./config');

function getContent() {
  const rows = db.prepare('SELECT key, value FROM content ORDER BY key').all();
  const content = {};

  for (const row of rows) {
    try {
      content[row.key] = JSON.parse(row.value);
    } catch {
      content[row.key] = row.value;
    }
  }

  return content;
}

function getSettings() {
  const rows = db.prepare('SELECT key, value FROM settings ORDER BY key').all();
  const settings = {};
  for (const row of rows) {
    try { settings[row.key] = JSON.parse(row.value); } catch { settings[row.key] = row.value; }
  }
  return settings;
}

function buildConfigSource() {
  const content = getContent();
  const settings = getSettings();
  return [
    '/* NOVIQ CONTENT CONFIG - Auto-generated from SQLite */',
    '',
    `const NOVIQ_CONTENT = ${JSON.stringify(content, null, 2)};`,
    '',
    `const NOVIQ_SETTINGS = ${JSON.stringify(settings, null, 2)};`,
    '',
    'if (typeof window !== "undefined") { window.NOVIQ_CONTENT = NOVIQ_CONTENT; window.NOVIQ_SETTINGS = NOVIQ_SETTINGS; }',
    '',
  ].join('\n');
}

function rebuildConfigFile() {
  const source = buildConfigSource();
  const keys = Object.keys(getContent()).length;
  const configPath = path.join(config.FRONTEND_DIR, 'data', 'content.config.js');
  /* Hosting-safe: DB is the source of truth and is already saved.
     The flat file is only a static-fallback for separately-hosted
     frontends. Never throw — report fileWritten so routes can warn
     the admin instead of pretending everything synced. */
  try {
    fs.mkdirSync(path.dirname(configPath), { recursive: true });
    fs.writeFileSync(configPath, source, 'utf8');
    return { source, keys, fileWritten: true, filePath: configPath };
  } catch (err) {
    console.error('[content] rebuildConfigFile: DB saved, file sync failed: ' + configPath + ' — ' + err.message);
    console.error('[content] Fix: set FRONTEND_DIR to the served frontend folder and make data/ writable.');
    return { source, keys, fileWritten: false, fileError: err.message, filePath: configPath };
  }
}

module.exports = { getContent, getSettings, buildConfigSource, rebuildConfigFile };
