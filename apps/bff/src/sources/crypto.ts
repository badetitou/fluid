import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { StorageMode } from '../storage/mode';

// AES-256-GCM envelope for source secrets: "v1:<iv>:<tag>:<ciphertext>" (base64url parts).
// Pure helpers first; key resolution (env or data-dir file) at the bottom.

const KEY_BYTES = 32;
const IV_BYTES = 12;
const KEY_FILE = 'secret.key';

export class SecretKeyError extends Error {}

/** Parses a 32-byte key given as 64 hex chars or base64 (standard or url-safe). */
export function parseSecretKey(raw: string): Buffer {
  const text = raw.trim();
  const key = /^[0-9a-fA-F]{64}$/.test(text) ? Buffer.from(text, 'hex') : Buffer.from(text, 'base64');
  if (key.length !== KEY_BYTES) {
    throw new SecretKeyError(
      'FLUID_SECRET_KEY must be 32 bytes, as 64 hex characters or base64 (e.g. `openssl rand -base64 32`)',
    );
  }
  return key;
}

export function encryptSecret(plain: string, key: Buffer): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const parts = [iv, cipher.getAuthTag(), data].map((p) => p.toString('base64url'));
  return ['v1', ...parts].join(':');
}

export function decryptSecret(payload: string, key: Buffer): string {
  const [version, iv, tag, data] = payload.split(':');
  if (version !== 'v1' || !iv || !tag || data === undefined) throw new SecretKeyError('Unreadable stored secret');
  try {
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64url'));
    decipher.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([decipher.update(Buffer.from(data, 'base64url')), decipher.final()]).toString('utf8');
  } catch {
    throw new SecretKeyError('Stored secret cannot be decrypted with the current FLUID_SECRET_KEY');
  }
}

/** Source of the encryption key; called only when a secret is written or read. */
export type KeyProvider = () => Buffer;

/**
 * FLUID_SECRET_KEY when set. Otherwise, in local (PGlite) mode, a key generated once and kept in
 * `<dataDir>/secret.key` (mode 0600); in memory mode an ephemeral one. With DATABASE_URL and no
 * key, fails clearly.
 */
export function createKeyProvider(env: Record<string, string | undefined>, mode: StorageMode): KeyProvider {
  let cached: Buffer | undefined;
  return () => {
    if (cached) return cached;
    const fromEnv = env.FLUID_SECRET_KEY?.trim();
    if (fromEnv) return (cached = parseSecretKey(fromEnv));
    if (mode.kind === 'postgres') {
      throw new SecretKeyError('FLUID_SECRET_KEY is required to store source secrets when DATABASE_URL is set');
    }
    if (mode.dataDir.startsWith('memory://')) return (cached = randomBytes(KEY_BYTES));
    const file = join(mode.dataDir, KEY_FILE);
    if (!existsSync(file)) {
      mkdirSync(mode.dataDir, { recursive: true });
      writeFileSync(file, randomBytes(KEY_BYTES).toString('base64'), { mode: 0o600, flag: 'wx' });
    }
    chmodSync(file, 0o600);
    return (cached = parseSecretKey(readFileSync(file, 'utf8')));
  };
}
