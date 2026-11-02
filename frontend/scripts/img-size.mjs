/* Portable roots (no machine paths): override with NOVIQ_FRONTEND / NOVIQ_BACKEND / NOVIQ_TMP env. */
import { fileURLToPath as __f2p } from 'node:url';
import { dirname as __dn, join as __join } from 'node:path';
import { tmpdir as __tmp } from 'node:os';
const __HERE = __dn(__f2p(import.meta.url));
const PORTABLE_FRONTEND = process.env.NOVIQ_FRONTEND || __join(__HERE, '..');
const PORTABLE_BACKEND = process.env.NOVIQ_BACKEND || __join(__HERE, '..', '..', 'backend');
const PORTABLE_TMP = process.env.NOVIQ_TMP || __join(__tmp(), 'noviq-shots');
import { readFileSync } from 'node:fs';

/* read intrinsic size straight from the file headers */
function size(p) {
  const b = readFileSync(p);
  if (b.slice(0, 4).toString('ascii') === 'RIFF' && b.slice(8, 12).toString('ascii') === 'WEBP') {
    const fmt = b.slice(12, 16).toString('ascii');
    if (fmt === 'VP8 ') return [b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff];
    if (fmt === 'VP8L') {
      const v = b.readUInt32LE(21);
      return [(v & 0x3fff) + 1, ((v >> 14) & 0x3fff) + 1];
    }
    if (fmt === 'VP8X') {
      const w = 1 + (b[24] | (b[25] << 8) | (b[26] << 16));
      const h = 1 + (b[27] | (b[28] << 8) | (b[29] << 16));
      return [w, h];
    }
  }
  if (b[0] === 0x89 && b.slice(1, 4).toString('ascii') === 'PNG') {
    return [b.readUInt32BE(16), b.readUInt32BE(20)];
  }
  return null;
}

for (const f of ['project-ai', 'project-fintech', 'project-healthcare', 'project-retail']) {
  for (const ext of ['webp', 'png']) {
    const p = `${PORTABLE_FRONTEND}/public/images/${f}.${ext}`;
    try { console.log(`${f}.${ext}`.padEnd(30), size(p)); } catch { /* missing */ }
  }
}
