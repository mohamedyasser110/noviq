#!/usr/bin/env node
/* ============================================================
   NOVIQ — SQLite snapshot for Railway volume migration
   ------------------------------------------------------------
   The local dev database runs in WAL mode, so noviq.db alone is
   NOT the whole story: recent writes may still sit in
   noviq.db-wal. Copying only the .db file to the server silently
   loses every edit made since the last checkpoint.

   This script checkpoints + closes the database so noviq.db becomes
   a single self-contained file, then prints its size. Run it with
   the backend STOPPED, then upload the resulting noviq.db to the
   Railway volume (see docs/DEPLOYMENT-RAILWAY.md).

     node scripts/snapshot-db.js
   ============================================================ */
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DB_PATH
  ? path.resolve(process.env.DB_PATH)
  : path.join(__dirname, '..', 'data', 'noviq.db');

if (!fs.existsSync(DB_PATH)) {
  console.error('[snapshot] no database at ' + DB_PATH);
  process.exit(1);
}

const Database = require('better-sqlite3');
const db = new Database(DB_PATH);

const mode = db.pragma('journal_mode', { simple: true });
console.log('[snapshot] journal_mode =', mode);

/* Fold the WAL back into the main file, then fully close. After this,
   the -wal file is empty and noviq.db holds every committed row. */
const result = db.pragma('wal_checkpoint(TRUNCATE)', { simple: true });
console.log('[snapshot] wal_checkpoint =', JSON.stringify(result));

/* Sanity check: the schema and a row count we can quote afterwards. */
const tables = db
  .prepare("SELECT count(*) AS n FROM sqlite_master WHERE type = 'table'")
  .get();
console.log('[snapshot] tables =', tables.n);

db.close();

const bytes = fs.statSync(DB_PATH).size;
console.log('[snapshot] wrote ' + DB_PATH + ' (' + (bytes / 1048576).toFixed(2) + ' MB)');
console.log('[snapshot] upload this single file — the -wal/-shm siblings are NOT needed.');
