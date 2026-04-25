#!/usr/bin/env node
/**
 * One-time DB setup script — node src/init-db.js
 */
import { webcrypto } from 'node:crypto';
import { readFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { db, initDb } from './db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env
const envPath = join(__dirname, '..', '.env');
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const idx = t.indexOf('=');
    if (idx < 0) continue;
    const k = t.slice(0, idx).trim(), v = t.slice(idx + 1).trim();
    if (!process.env[k]) process.env[k] = v;
  }
}

// Initialize database
await initDb();
console.log('Database connection ready.');

// Apply schema
const schemaPath = join(__dirname, '..', 'schema.sql');
if (!existsSync(schemaPath)) { console.error('schema.sql not found:', schemaPath); process.exit(1); }

const schema = readFileSync(schemaPath, 'utf8');
for (const stmt of schema.split(';').map(s => s.trim()).filter(Boolean)) {
  try { db.prepare(stmt).run(); }
  catch(e) {
    if (!e.message.includes('UNIQUE') && !e.message.includes('already exists')) {
      console.warn('Schema warning:', e.message.split('\n')[0]);
    }
  }
}
console.log('Schema applied.');

async function hashPassword(password) {
  const enc = new TextEncoder();
  const salt = new Uint8Array(16);
  webcrypto.getRandomValues(salt);
  const key = await webcrypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await webcrypto.subtle.deriveBits({ name: 'PBKDF2', salt, hash: 'SHA-256', iterations: 100000 }, key, 256);
  const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2,'0')).join('');
  const keyHex  = Array.from(new Uint8Array(bits)).map(b => b.toString(16).padStart(2,'0')).join('');
  return `${saltHex}:${keyHex}`;
}

const setting = db.prepare("SELECT value FROM settings WHERE key='superadmin_password_hash'").first();
if (!setting?.value || !setting.value.includes(':') || setting.value === 'NEEDS_INITIALIZATION') {
  const hash = await hashPassword('superadmin123');
  db.prepare('UPDATE settings SET value=?,updated_at=CURRENT_TIMESTAMP WHERE key=?').bind(hash, 'superadmin_password_hash').run();
  db.prepare("DELETE FROM password_history WHERE password_hash='NEEDS_INITIALIZATION'").run();
  try { db.prepare('INSERT INTO password_history (password_hash,changed_by) VALUES (?,?)').bind(hash, 'system').run(); } catch {}
  console.log('✅ Superadmin password initialized (default: superadmin123)');
} else {
  console.log('ℹ️  Superadmin password already set.');
}

console.log('✅ Database ready at:', resolve(process.env.DB_PATH || './data/storage.db'));
process.exit(0);
