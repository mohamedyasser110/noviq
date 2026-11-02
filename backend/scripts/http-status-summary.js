/* Summarise Railway's HTTP log export: status distribution and the paths
   behind every 4xx, so a dashboard counter can be explained rather than
   guessed at.

   Usage:
     railway logs --http -s api --lines 1000 > http.txt
     node scripts/http-status-summary.js http.txt */
const fs = require('fs');

const file = process.argv[2];
if (!file) {
  console.error('usage: node scripts/http-status-summary.js <log-file>');
  process.exit(1);
}

const raw = fs.readFileSync(file, 'utf8');
/* Format: <iso-timestamp> <METHOD> <path> <status> <duration> <requestId> */
const lines = raw.split(/\r?\n/).filter((l) => /^\d{4}-\d{2}-\d{2}T/.test(l));

if (!lines.length) {
  console.log('no parseable HTTP log lines — check the file was written by `railway logs --http`');
  process.exit(1);
}

const byStatus = new Map();
const byPath = new Map();
const userAgents = new Map();

for (const line of lines) {
  const parts = line.trim().split(/\s+/);
  const method = parts[1];
  const path = parts[2];
  const status = parts[3];
  if (!status) continue;

  byStatus.set(status, (byStatus.get(status) || 0) + 1);

  if (/^4/.test(status) || /^5/.test(status)) {
    const key = `${status} ${method} ${path}`;
    byPath.set(key, (byPath.get(key) || 0) + 1);
    /* The raw line carries only 6 fields, so the agent is not available
       here; that is why classification below is by path shape. */
  }
  if (parts[5]) userAgents.set(parts[5], (userAgents.get(parts[5]) || 0) + 1);
}

console.log(`sampled ${lines.length} HTTP log lines\n`);
console.log('=== status distribution ===');
for (const [status, count] of [...byStatus].sort((a, b) => a[0].localeCompare(b[0]))) {
  const pct = ((count / lines.length) * 100).toFixed(1);
  const bar = '#'.repeat(Math.round((count / lines.length) * 40));
  console.log(`  ${status}  ${String(count).padStart(5)}  ${pct.padStart(5)}%  ${bar}`);
}

const bad = [...byPath].sort((a, b) => b[1] - a[1]);
if (bad.length) {
  console.log('\n=== every 4xx / 5xx, most frequent first ===');
  for (const [key, count] of bad) console.log(`  ${String(count).padStart(5)}x  ${key}`);
  console.log('\n=== how to read these ===');
  console.log('  401  unauthenticated admin call — expected when a session expires,');
  console.log('       and when a scanner probes /api/admin/*. Harmless.');
  console.log('  403  authenticated but refused (agent-bus locks, etc).');
  console.log('  404  a URL that does not exist. Worth finding the source: a typo in a');
  console.log('       rewrite target, a stale bookmark, or a crawler.');
  console.log('  429  rate limited. Legitimate traffic hitting the API bucket means the');
  console.log('       limit is too low for real usage (see scripts/raise-rate-limit.js).');
} else {
  console.log('\nno 4xx or 5xx in this sample');
}
