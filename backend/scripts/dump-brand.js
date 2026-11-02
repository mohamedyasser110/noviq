/* Dump the CMS brand + footer records from a SQLite file, so we can see
   which social fields exist and whether they hold real values.

   node scripts/dump-brand.js [path-to.db] */
const path = require('path');
const Database = require('better-sqlite3');

const dbPath = process.argv[2] || path.join(__dirname, '..', 'data', 'noviq.db');
const db = new Database(dbPath, { readonly: true });

const rows = db
  .prepare("SELECT key, value FROM content WHERE key IN ('brand','footer','brandSettings')")
  .all();

if (!rows.length) {
  console.log('no brand/footer rows; keys present:');
  console.log(
    db.prepare('SELECT key FROM content ORDER BY key').all().map((r) => r.key).join('\n')
  );
} else {
  for (const r of rows) {
    console.log(`--- ${r.key} ---`);
    try {
      console.log(JSON.stringify(JSON.parse(r.value), null, 2));
    } catch {
      console.log(r.value);
    }
  }
}
db.close();
