/* ============================================================
   NOVIQ AGENT COLLABORATION — Schema Registry
  ------------------------------------------------------------
   Versioned schemas for: content, api-endpoints, db-schema,
   design-tokens. Each resource is stored as JSON with an
   auto-incrementing version number and an etag for optimistic
   concurrency.
  ============================================================ */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const VALID_RESOURCES = ['content', 'api-endpoints', 'db-schema', 'design-tokens'];

class SchemaRegistry {
  /**
   * @param {string} versionsDir — directory holding per-resource version dirs
   */
  constructor(versionsDir) {
    this.versionsDir = versionsDir;
    fs.mkdirSync(versionsDir, { recursive: true });

    for (const res of VALID_RESOURCES) {
      const dir = path.join(versionsDir, res);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        /* seed an empty v1 if none exists */
        const initial = res === 'content' ? {} : res === 'api-endpoints' ? [] : res === 'db-schema' ? [] : {};
        this._write(res, 1, initial, crypto.randomUUID());
      }
    }
    this._index = this._buildIndex();
  }

  _buildIndex() {
    const idx = {};
    for (const res of VALID_RESOURCES) {
      const dir = path.join(this.versionsDir, res);
      const files = fs.readdirSync(dir).filter(f => f.match(/^\d+\.json$/));
      const versions = files.map(f => parseInt(f)).sort((a, b) => a - b);
      const latest = versions.length ? versions[versions.length - 1] : 0;
      idx[res] = { versions, latest };
    }
    return idx;
  }

  _versionPath(resource, version) {
    return path.join(this.versionsDir, resource, `${version}.json`);
  }

  _read(resource, version) {
    const p = this._versionPath(resource, version);
    if (!fs.existsSync(p)) return null;
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  }

  _write(resource, version, schema, etag) {
    fs.mkdirSync(path.join(this.versionsDir, resource), { recursive: true });
    const doc = {
      resource,
      version,
      etag,
      schema,
      updated_at: new Date().toISOString(),
    };
    fs.writeFileSync(this._versionPath(resource, version), JSON.stringify(doc, null, 2), 'utf8');
    this._index[resource].versions.push(version);
    this._index[resource].versions.sort((a, b) => a - b);
    this._index[resource].latest = Math.max(this._index[resource].latest, version);
  }

  /**
   * Get all versions of a resource, or a specific version.
   * @param {string} resource
   * @param {number} [version] — defaults to latest
   */
  get(resource, version) {
    if (!VALID_RESOURCES.includes(resource)) {
      return { error: 'SCHEMA_NOT_FOUND', message: `'${resource}' is not a valid schema resource. Valid: ${VALID_RESOURCES.join(', ')}` };
    }
    const meta = this._index[resource];
    const ver = version || meta.latest;
    const doc = this._read(resource, ver);
    if (!doc) return { error: 'SCHEMA_NOT_FOUND', message: `Version ${ver} of '${resource}' not found.` };

    return {
      resource,
      version: doc.version,
      updated_at: doc.updated_at,
      schema: doc.schema,
      etag: doc.etag,
    };
  }

  /**
   * Create a new version of a schema.
   * @param {string} resource
   * @param {object} schema
   * @param {string} [expectedEtag] — for optimistic concurrency; if mismatch → 409
   * @returns {{ ok:boolean, version:number, etag:string, error?:string }}
   */
  createVersion(resource, schema, expectedEtag) {
    if (!VALID_RESOURCES.includes(resource)) {
      return { ok: false, error: `'${resource}' is not a valid schema resource. Valid: ${VALID_RESOURCES.join(', ')}` };
    }

    const meta = this._index[resource];
    const latestVer = meta.latest;
    let currentEtag = null;

    if (expectedEtag) {
      const current = this._read(resource, latestVer);
      currentEtag = current?.etag;
      if (currentEtag !== expectedEtag) {
        return { ok: false, error: 'ETAG_MISMATCH', status: 409, message: 'Schema was modified by another agent. Fetch the latest version and retry.' };
      }
    }

    const newVersion = latestVer + 1;
    const newEtag = crypto.randomUUID();
    this._write(resource, newVersion, schema, newEtag);

    return { ok: true, version: newVersion, etag: newEtag };
  }

  /** List available resources with their version counts. */
  list() {
    const result = {};
    for (const res of VALID_RESOURCES) {
      const meta = this._index[res];
      result[res] = { versions: meta.versions, latest: meta.latest };
    }
    return result;
  }
}

module.exports = SchemaRegistry;
module.exports.VALID_RESOURCES = VALID_RESOURCES;
