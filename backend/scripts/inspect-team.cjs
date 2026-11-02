/* Inspect the backend SQLite content store — team payload + tables. */
const Database = require('better-sqlite3');

const db = new Database('C:/Downloads/Noviq - final/backend/data/noviq.db', { readonly: true });

const tables = db.prepare("select name from sqlite_master where type='table' order by name").all();
console.log('TABLES:', tables.map((t) => t.name).join(', '));

const cols = db.prepare('pragma table_info(content)').all();
console.log('content columns:', cols.map((c) => c.name).join(', '));

const rows = db.prepare('select * from content order by 1').all();
console.log('\nCONTENT ROWS:');
for (const r of rows) {
  const v = r.value ?? r.data ?? r.content ?? '';
  console.log(`  ${r.key}  (${String(v).length} bytes)  ${r.updated_at || ''}`);
}

const teamRow = db.prepare("select * from content where key = 'team'").get();
if (teamRow) {
  const parsed = JSON.parse(teamRow.value ?? teamRow.data);
  console.log('\n=== TEAM PAYLOAD ===');
  console.log(JSON.stringify(parsed, null, 2).slice(0, 4000));
} else {
  console.log('\n=== no team row in content table ===');
}
db.close();
