const db = require('../db/init');
const row = db.prepare("SELECT value FROM content WHERE key = 'brand'").get();
if (row) {
  console.log(JSON.stringify(JSON.parse(row.value), null, 2));
} else {
  console.log('No brand entry found');
}
process.exit(0);
