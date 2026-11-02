/* ============================================================
   NOVIQ — backup archive
   ------------------------------------------------------------
   Produces ONE zip holding everything needed to rebuild this install on
   another host, plus the uploaded media in its original layout:

     manifest.json     schema + row counts + the exact tables/columns
                       exported, so restore can refuse a mismatched file
     db/tables/*.json  every user table, rows as JSON
     images/uploads/*  UPLOADS_DIR verbatim, so a file stored as
                       `images/uploads/<name>` comes back at that exact
                       relative path

   Why not just copy the .db file? A live SQLite database in WAL mode
   holds recent writes in noviq.db-wal; copying only the .db loses every
   edit since the last checkpoint. This reads through better-sqlite3 with
   the connection open, so the snapshot is consistent by construction.

   The zip is written by a dependency-free store/deflate writer rather
   than a new package: the backend deliberately ships few dependencies,
   and a backup tool that cannot install is a backup tool that is missing
   when it is needed.

       node scripts/backup.js --out <dir> [--label <name>] [--quiet]

   Writes:  <dir>/noviq-backup-<label>.zip
   ============================================================ */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const Database = require('better-sqlite3');

const config = require('../config');

/** Quote an identifier for SQLite.
 *
 *  Not JSON.stringify: that yields "contacts" with double quotes, which is
 *  NOT valid SQL and fails with `unrecognized token: "{"` or similar. SQL
 *  string literals take single quotes; identifiers take double quotes, and
 *  an embedded quote is doubled. Every table/column name interpolated into
 *  a statement goes through here. */
function quoteIdent(name) {
  return `"${String(name).replace(/"/g, '""')}"`;
}

/* ---------- minimal zip writer (store + deflate) ---------- */
/* Layout: local file header | data | central directory | EOCD.
   Fixed timestamps keep the archive byte-stable for identical input,
   which makes "did anything actually change?" checkable. */
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function zip(entries) {
  const DOS_TIME = 0x0000;        /* 00:00:00 */
  const DOS_DATE = 0x0021;        /* 1980-01-01 */
  const locals = [];
  const centrals = [];
  let offset = 0;

  for (const e of entries) {
    const nameBuf = Buffer.from(e.name, 'utf8');
    const raw = e.data;
    const deflated = zlib.deflateRawSync(raw, { level: 9 });
    /* Only compress when it actually helps; otherwise store. */
    const useDeflate = deflated.length < raw.length;
    const body = useDeflate ? deflated : raw;
    const method = useDeflate ? 8 : 0;
    const crc = crc32(raw);

    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0);
    lh.writeUInt16LE(20, 4);           /* version needed */
    lh.writeUInt16LE(0x0800, 6);       /* UTF-8 name flag */
    lh.writeUInt16LE(method, 8);
    lh.writeUInt16LE(DOS_TIME, 10);
    lh.writeUInt16LE(DOS_DATE, 12);
    lh.writeUInt32LE(crc, 14);
    lh.writeUInt32LE(body.length, 18);
    lh.writeUInt32LE(raw.length, 22);
    lh.writeUInt16LE(nameBuf.length, 26);
    lh.writeUInt16LE(0, 28);
    locals.push(lh, nameBuf, body);

    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0);
    ch.writeUInt16LE(20, 4);           /* version made by */
    ch.writeUInt16LE(20, 6);           /* version needed */
    ch.writeUInt16LE(0x0800, 8);
    ch.writeUInt16LE(method, 10);
    ch.writeUInt16LE(DOS_TIME, 12);
    ch.writeUInt16LE(DOS_DATE, 14);
    ch.writeUInt32LE(crc, 16);
    ch.writeUInt32LE(body.length, 20);
    ch.writeUInt32LE(raw.length, 24);
    ch.writeUInt16LE(nameBuf.length, 28);
    ch.writeUInt16LE(0, 30);           /* extra */
    ch.writeUInt16LE(0, 32);           /* comment */
    ch.writeUInt16LE(0, 34);           /* disk */
    ch.writeUInt16LE(0, 36);           /* internal attrs */
    ch.writeUInt32LE(0o644 << 16, 38); /* external attrs */
    ch.writeUInt32LE(offset, 42);
    centrals.push(ch, nameBuf);

    offset += lh.length + nameBuf.length + body.length;
  }

  const centralBuf = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralBuf.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...locals, centralBuf, eocd]);
}

/* ---------- walk the uploads directory ---------- */
function walk(dir, base = dir, out = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    /* Resolve before following, so a symlink inside the uploads folder
       cannot walk the backup out to /etc or the volume root. */
    if (e.isSymbolicLink()) continue;
    if (e.isDirectory()) walk(full, base, out);
    else if (e.isFile()) out.push(path.relative(base, full).split(path.sep).join('/'));
  }
  return out;
}

/* ---------- main ---------- */
function parseArgs(argv) {
  const out = { dir: path.join(process.cwd(), 'backups'), label: null, quiet: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--out' || a === '-o') out.dir = path.resolve(argv[++i]);
    else if (a === '--label' || a === '-l') out.label = argv[++i];
    else if (a === '--quiet' || a === '-q') out.quiet = true;
  }
  if (!out.label) {
    const d = new Date();
    const p = (n) => String(n).padStart(2, '0');
    out.label = `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
  }
  return out;
}

/**
 * Create the archive and return its path.
 *
 * `opts` is an override for `parseArgs` so callers embedding this (the
 * admin route) do not have to fake `process.argv`. Defaults match the CLI.
 */
function main(argv = process.argv, opts = {}) {
  const args = { ...parseArgs(argv || ['node', 'backup.js']), ...opts };
  const log = args.quiet ? () => {} : (m) => console.log(m);

  if (!fs.existsSync(config.DB_PATH)) {
    console.error(`[backup] no database at ${config.DB_PATH}`);
    process.exit(1);
  }

  const db = new Database(config.DB_PATH, { readonly: true });

  /* A table we do not know about is not exported silently — an admin
     table added later must not vanish from the archive. */
  const tables = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
    .all()
    .map((r) => r.name);

  const entries = [];
  const manifest = {
    format: 'noviq-backup',
    version: 1,
    createdAt: new Date().toISOString(),
    database: path.basename(config.DB_PATH),
    uploadsDir: path.basename(config.UPLOADS_DIR),
    tables: {},
    images: 0,
  };

  for (const table of tables) {
    const id = quoteIdent(table);
    const columns = db.prepare(`PRAGMA table_info(${id})`).all().map((c) => c.name);
    const rows = db.prepare(`SELECT * FROM ${id}`).all();
    manifest.tables[table] = { columns, rows: rows.length };
    entries.push({
      name: `db/tables/${table}.json`,
      data: Buffer.from(JSON.stringify(rows, null, 0), 'utf8'),
    });
    log(`  ${table.padEnd(20)} ${String(rows.length).padStart(6)} rows`);
  }
  db.close();

  /* Media, at its original relative path. */
  const images = walk(config.UPLOADS_DIR);
  for (const rel of images) {
    const full = path.join(config.UPLOADS_DIR, rel);
    entries.push({ name: `images/uploads/${rel}`, data: fs.readFileSync(full) });
  }
  manifest.images = images.length;
  log(`  ${'images'.padEnd(20)} ${String(images.length).padStart(6)} files`);

  /* manifest.json is added LAST so it can describe everything above. */
  entries.push({ name: 'manifest.json', data: Buffer.from(JSON.stringify(manifest, null, 2), 'utf8') });

  const buf = zip(entries);
  fs.mkdirSync(args.dir, { recursive: true });
  const outFile = path.join(args.dir, `noviq-backup-${args.label}.zip`);
  fs.writeFileSync(outFile, buf);

  log(`\n[backup] ${outFile}`);
  log(`[backup] ${(buf.length / 1048576).toFixed(2)} MB, ${tables.length} tables, ${images.length} images`);
  return outFile;
}

if (require.main === module) main();
module.exports = { zip, crc32, walk, quoteIdent, main };
