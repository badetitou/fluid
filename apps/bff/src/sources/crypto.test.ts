import { mkdtempSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createKeyProvider, decryptSecret, encryptSecret, parseSecretKey, SecretKeyError } from './crypto';

describe('secret encryption', () => {
  const key = randomBytes(32);
  it('round-trips and does not expose the plaintext', () => {
    const enc = encryptSecret('hunter2', key);
    expect(enc).not.toContain('hunter2');
    expect(decryptSecret(enc, key)).toBe('hunter2');
    expect(encryptSecret('hunter2', key)).not.toBe(enc); // fresh IV
  });
  it('rejects a wrong key and tampering', () => {
    const enc = encryptSecret('x', key);
    expect(() => decryptSecret(enc, randomBytes(32))).toThrow(SecretKeyError);
    const parts = enc.split(':');
    parts[3] = Buffer.from('tampered!').toString('base64url');
    expect(() => decryptSecret(parts.join(':'), key)).toThrow(SecretKeyError);
    expect(() => decryptSecret('garbage', key)).toThrow(SecretKeyError);
  });
  it('validates the key format', () => {
    expect(parseSecretKey('ab'.repeat(32))).toHaveLength(32);
    expect(parseSecretKey(randomBytes(32).toString('base64'))).toHaveLength(32);
    expect(() => parseSecretKey('short')).toThrow(/32 bytes/);
  });
});

describe('createKeyProvider', () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'fluid-key-'));
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('uses FLUID_SECRET_KEY when set', () => {
    const hex = 'cd'.repeat(32);
    expect(createKeyProvider({ FLUID_SECRET_KEY: hex }, { kind: 'pglite', dataDir: dir })().toString('hex')).toBe(hex);
  });
  it('generates once in the data dir with 0600 permissions, then reuses it', () => {
    const mode = { kind: 'pglite', dataDir: dir } as const;
    const first = createKeyProvider({}, mode)();
    expect(statSync(join(dir, 'secret.key')).mode & 0o777).toBe(0o600);
    expect(createKeyProvider({}, mode)().equals(first)).toBe(true);
  });
  it('reuses an existing key file, leaves no temp file, and names the file when it is invalid', () => {
    const mode = { kind: 'pglite', dataDir: dir } as const;
    const file = join(dir, 'secret.key');
    writeFileSync(file, 'ef'.repeat(32), { mode: 0o644 });
    expect(createKeyProvider({}, mode)().toString('hex')).toBe('ef'.repeat(32));
    expect(statSync(file).mode & 0o777).toBe(0o600);
    expect(readdirSync(dir)).toEqual(['secret.key']);
    writeFileSync(file, 'garbage');
    expect(() => createKeyProvider({}, mode)()).toThrow(file);
  });
  it('fails clearly with DATABASE_URL and no key, and on an invalid key', () => {
    expect(() => createKeyProvider({}, { kind: 'postgres', url: 'postgresql://h/d' })()).toThrow(
      /FLUID_SECRET_KEY is required/,
    );
    expect(() => createKeyProvider({ FLUID_SECRET_KEY: 'nope' }, { kind: 'pglite', dataDir: dir })()).toThrow(
      SecretKeyError,
    );
  });
});
