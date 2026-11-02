#!/usr/bin/env node
/* ============================================================
   gen-endpoints.js — generate the frontend endpoint client from
   the contract specs in ../../contracts/api/*.json

   The contract is the single source of truth. This script turns it
   into Endpoints, one function per endpoint, so the frontend never
   hand-writes a URL, a method or an auth token. Re-run after any
   contract change. There is no build step: it just writes one file.

   Output:  frontend/js/services/endpoints.js
   Usage:    node backend/scripts/gen-endpoints.js
   ============================================================ */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const SPEC_DIR = path.join(ROOT, 'contracts', 'api');
const OUT = path.join(ROOT, 'frontend', 'js', 'services', 'endpoints.js');

/* Parse-tolerant: a malformed spec is skipped with a warning instead of
   crashing the whole client, so one bad contract cannot break the build. */
const skipped = [];
const specs = fs.readdirSync(SPEC_DIR)
  .filter(f => f.endsWith('.json'))
  .map(f => {
    try {
      return JSON.parse(fs.readFileSync(path.join(SPEC_DIR, f), 'utf8'));
    } catch (e) {
      skipped.push(f);
      return null;
    }
  })
  .filter(s => s && s.name && s.path && s.method)
  .sort((a, b) => a.name.localeCompare(b.name));
if (skipped.length) {
  console.warn('warn: skipped ' + skipped.length + ' unparseable spec(s): ' + skipped.join(', '));
}

function esc(str) {
  return str.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$/g, '\\$');
}

/* method -> transport shorthand */
const SH = { GET: 'get', POST: 'post', PUT: 'put', PATCH: 'patch', DELETE: 'del' };

/* Resource names must be valid JS identifiers for the generated object keys.
   `agent-bus` would emit `const agent-bus`, so map a hyphen to camelCase.
   A resource that is also a reserved word (`export`) would emit
   `const export = {}`, which breaks — so those get a `Group` suffix on the
   binding while keeping the original key on the returned object. */
function ident(name) {
  return name.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}
const RESERVED = new Set([
  'export', 'import', 'let', 'const', 'var', 'function', 'return', 'if',
  'else', 'switch', 'case', 'default', 'for', 'while', 'do', 'in', 'of',
  'new', 'delete', 'typeof', 'instanceof', 'this', 'super', 'class',
  'extends', 'yield', 'await', 'null', 'undefined', 'true', 'false', 'void',
]);
function bindingFor(key) {
  return RESERVED.has(key) ? key + 'Group' : key;
}

/* Group specs by resource = the token before the first dot in the name. */
const groups = new Map();
for (const s of specs) {
  const res = ident(s.name.split('.')[0]);
  const act = ident(s.name.split('.').slice(1).join('.'));
  if (!groups.has(res)) groups.set(res, []);
  groups.get(res).push({ act, spec: s });
}

/* A path that contains {param} slots becomes a template literal that reads
   the param off an args object; a static path becomes a plain string. */
function pathExprFor(p, params) {
  if (!params.length) return JSON.stringify(p);
  const parts = p.split(/(\{[^}]+\})/g);
  let out = '`';
  for (const seg of parts) {
    const mm = seg.match(/^\{(.+)\}$/);
    if (mm) {
      out += '${encodeURIComponent(args.' + mm[1] + ')}';
    } else {
      out += seg.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${');
    }
  }
  out += '`';
  return out;
}

function emit(spec, action) {
  const method = spec.method.toUpperCase();
  const p = spec.path.replace(/^\/api/, '');         // transport takes the /api part
  const req = spec.request || {};

  /* Path params come from the {slot}s actually present in the path. Any
     request.params entry that is NOT a path slot is really a query field
     (some specs declare it under params), so it is demoted to query. */
  const pathParams = [...p.matchAll(/\{([^}]+)\}/g)].map(m => m[1]);
  const query = Object.keys(req.query || {});
  const extraQuery = Object.keys(req.params || {}).filter(k => !pathParams.includes(k));
  const allQuery = [...new Set([...query, ...extraQuery])];
  const hasBody = !!(req.body && req.body.type);
  const isAdmin = /admin\s+JWT/i.test(spec.summary || '');

  const sigParts = [];
  if (pathParams.length) sigParts.push('args');
  if (hasBody) sigParts.push('body');
  if (allQuery.length) sigParts.push('query');

  const pathExpr = pathExprFor(p, pathParams);
  const optParts = [];
  if (allQuery.length) optParts.push('params: query');
  if (isAdmin) optParts.push("auth: 'admin'");
  const optStr = optParts.length ? ', { ' + optParts.join(', ') + ' }' : '';
  const bodyExpr = hasBody ? ', body' : '';

  const callLine = `return NoviqAPI.${SH[method]}(${pathExpr}${bodyExpr}${optStr});`;
  const summary = esc((spec.summary || '').replace(/\s+/g, ' ').trim());
  const head = `/** ${method} ${spec.path}${summary ? '  —  ' + summary : ''} */`;
  return `    ${head}\n    ${action}(${sigParts.join(', ')}) {\n      ${callLine}\n    },`;
}

/* Build the file. */
const lines = [];
lines.push('/* ============================================================');
lines.push('   NOVIQ ENDPOINTS — generated client, one function per endpoint.');
lines.push('   ------------------------------------------------------------');
lines.push('   GENERATED from ../contracts/api/*.json by tools/gen-endpoints.js.');
lines.push('   Do not edit by hand: update the spec, then re-run the');
lines.push('   generator. It is the wire-level mirror of the backend routes,');
lines.push('   so a contract change stays a spec change plus one re-run.');
lines.push('');
lines.push('   Each function returns the transport result');
lines.push('   ({ ok, status, json, text, header }) from NoviqAPI. Read errors');
lines.push('   with NoviqAPI.isError(res.json) and NoviqAPI.errMsg(res.json).');
lines.push('   ============================================================ */');
lines.push('');
lines.push('const Endpoints = (() => {');
lines.push('');

// resources in a stable, readable order
const resOrder = [...groups.keys()].sort();
for (const res of resOrder) {
  const items = groups.get(res);
  const binding = bindingFor(res);
  lines.push(`  /* ---- ${res} (${items.length}) ---- */`);
  lines.push(`  const ${binding} = {`);
  for (const { act, spec } of items) {
    lines.push('  ' + emit(spec, act).replace(/\n/g, '\n  '));
  }
  lines.push('  };');
  lines.push('');
}

// Keys stay the resource names (so Endpoints.export / Endpoints.agentBus work
// via property access); values bind to the safe local identifiers.
lines.push('  return {');
lines.push(resOrder.map(r => `    ${JSON.stringify(r)}: ${bindingFor(r)},`).join('\n'));
lines.push('  };');
lines.push('})();');

const outSrc = lines.join('\n') + '\n';

fs.writeFileSync(OUT, outSrc, 'utf8');
console.log('wrote ' + path.relative(ROOT, OUT));
console.log('  ' + specs.length + ' endpoints in ' + resOrder.length + ' resource groups');
