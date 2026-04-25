import { webcrypto } from 'node:crypto';

// Always call via the object to preserve 'this' binding (required on Windows)
const subtle = webcrypto.subtle;
const getRandomValues = (arr) => webcrypto.getRandomValues(arr);

// ─── Buffer helpers ──────────────────────────────────────────────────────────

export function arrayBufferToBase64(buffer) {
  // Always work from a proper Uint8Array view with correct offset/length
  if (buffer instanceof ArrayBuffer) {
    return Buffer.from(buffer).toString('base64');
  }
  // Uint8Array or similar typed array — use its exact byte range
  return Buffer.from(buffer.buffer, buffer.byteOffset, buffer.byteLength).toString('base64');
}

export function base64ToUint8Array(base64) {
  const buf = Buffer.from(base64, 'base64');
  // Return a Uint8Array that owns its own ArrayBuffer (no offset issues)
  return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
}

export function base64ToArrayBuffer(base64) {
  return base64ToUint8Array(base64).buffer;
}

// ─── Encryption ──────────────────────────────────────────────────────────────

export async function generateEncryptionKey() {
  return subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
}

export async function encryptData(data, key, iv) {
  return subtle.encrypt({ name: 'AES-GCM', iv }, key, data);
}

export async function decryptData(encryptedData, key, iv) {
  return subtle.decrypt({ name: 'AES-GCM', iv }, key, encryptedData);
}

export async function exportKey(key) {
  // exportKey returns an ArrayBuffer — convert cleanly via Uint8Array
  const exported = await subtle.exportKey('raw', key);
  const bytes = new Uint8Array(exported);
  return Buffer.from(bytes).toString('base64');
}

export async function importKey(keyBase64) {
  // Decode base64 → fresh ArrayBuffer with no offset ambiguity
  const bytes = Buffer.from(keyBase64, 'base64');
  const rawBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  return subtle.importKey('raw', rawBuffer, { name: 'AES-GCM' }, true, ['encrypt', 'decrypt']);
}

export function generateIV(length = 12) {
  const iv = new Uint8Array(length);
  getRandomValues(iv);
  return iv;
}

export function ivToBase64(iv) {
  // iv is a Uint8Array — serialize only its exact bytes
  return Buffer.from(iv.buffer, iv.byteOffset, iv.byteLength).toString('base64');
}

export function ivFromBase64(base64) {
  const buf = Buffer.from(base64, 'base64');
  // Return a fresh Uint8Array with clean backing buffer
  return new Uint8Array(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
}

// ─── Password hashing (PBKDF2) ───────────────────────────────────────────────

export async function hashPassword(password) {
  const encoder = new TextEncoder();
  const passwordData = encoder.encode(password);
  const salt = new Uint8Array(16);
  getRandomValues(salt);

  const baseKey = await subtle.importKey('raw', passwordData, 'PBKDF2', false, ['deriveBits']);
  const derivedBits = await subtle.deriveBits(
    { name: 'PBKDF2', salt, hash: 'SHA-256', iterations: 100000 },
    baseKey,
    256
  );

  const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('');
  const keyHex = Array.from(new Uint8Array(derivedBits)).map(b => b.toString(16).padStart(2, '0')).join('');
  return `${saltHex}:${keyHex}`;
}

export async function verifyPassword(password, hash) {
  try {
    const [saltHex, keyHex] = hash.split(':');
    const salt = new Uint8Array(saltHex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
    const encoder = new TextEncoder();
    const passwordData = encoder.encode(password);

    const baseKey = await subtle.importKey('raw', passwordData, 'PBKDF2', false, ['deriveBits']);
    const derivedBits = await subtle.deriveBits(
      { name: 'PBKDF2', salt, hash: 'SHA-256', iterations: 100000 },
      baseKey,
      256
    );

    const computedKeyHex = Array.from(new Uint8Array(derivedBits)).map(b => b.toString(16).padStart(2, '0')).join('');
    return computedKeyHex === keyHex;
  } catch {
    return false;
  }
}

// ─── Random UUID ─────────────────────────────────────────────────────────────

export function randomUUID() {
  return webcrypto.randomUUID();
}
