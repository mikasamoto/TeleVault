import { createRequire } from 'module';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, resolve, join } from 'path';
import { fileURLToPath } from 'url';

const require   = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));

export const DB_PATH = resolve(process.env.DB_PATH || './data/storage.db');
const dataDir = dirname(DB_PATH);
if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });

let _db = null;
let _initPromise = null;

export async function initDb() {
  if (_db) return _db;
  if (_initPromise) return _initPromise;

  _initPromise = (async () => {
    const initSqlJs = require('sql.js');

    // Find the WASM file — works in dev and when packaged
    const candidates = [
      join(__dirname, '..', 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm'),
      join(__dirname, 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm'),
      join(process.resourcesPath || '', 'app', 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm'),
    ];

    let wasmBinary;
    for (const p of candidates) {
      if (existsSync(p)) { wasmBinary = readFileSync(p); break; }
    }
    if (!wasmBinary) throw new Error('sql-wasm.wasm not found. Checked:\n' + candidates.join('\n'));

    const SQL = await initSqlJs({ wasmBinary });

    _db = existsSync(DB_PATH)
      ? new SQL.Database(readFileSync(DB_PATH))
      : new SQL.Database();

    _db.run('PRAGMA foreign_keys = ON;');

    // ─── Integrity Check: Clean up orphan chunks ─────────────────────
    // If a file was deleted but chunks remained, clean them up now
    try {
      _db.run('DELETE FROM chunks WHERE file_id NOT IN (SELECT id FROM files)');
      console.log('✅ DB Integrity: Orphan chunks cleaned');
    } catch(e) {
      // Tables might not exist yet on first run, ignore
    }

    // Save to disk after every write
    const _origRun = _db.run.bind(_db);
    _db.run = (...a) => { const r = _origRun(...a); _save(); return r; };

    return _db;
  })();

  return _initPromise;
}

export async function reloadDb() {
  _db = null;
  _initPromise = null;
  return initDb();
}

function _save() {
  if (!_db) return;
  try { writeFileSync(DB_PATH, Buffer.from(_db.export())); } catch(e) { console.error('DB save:', e.message); }
}

// Safety flush every 10s
setInterval(() => _save(), 10000).unref();

class DbQuery {
  constructor(sql, params = []) { this._sql = sql; this._params = params; }
  bind(...p) { return new DbQuery(this._sql, p); }

  _db() {
    if (!_db) throw new Error('DB not ready — await initDb() first');
    return _db;
  }

  all() {
    const stmt = this._db().prepare(this._sql);
    stmt.bind(this._params);
    const rows = [];
    while (stmt.step()) rows.push(stmt.getAsObject());
    stmt.free();
    return { results: rows };
  }

  first() {
    const stmt = this._db().prepare(this._sql);
    stmt.bind(this._params);
    const row = stmt.step() ? stmt.getAsObject() : null;
    stmt.free();
    return row;
  }

  run() {
    this._db().run(this._sql, this._params);
  }
}

export const db = { prepare: sql => new DbQuery(sql) };
