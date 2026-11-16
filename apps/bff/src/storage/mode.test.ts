import { describe, expect, it } from 'vitest';
import { resolveStorageMode } from './mode';

describe('resolveStorageMode', () => {
  it('picks postgres when DATABASE_URL is set, with the schema', () => {
    const url = 'postgresql://u:p@h:5432/db?schema=fluid';
    expect(resolveStorageMode({ DATABASE_URL: url })).toEqual({ kind: 'postgres', url, schema: 'fluid' });
  });
  it('ignores FLUID_DATA_DIR when DATABASE_URL is set', () => {
    expect(resolveStorageMode({ DATABASE_URL: 'postgresql://h/db', FLUID_DATA_DIR: '/x' }).kind).toBe('postgres');
  });
  it('picks pglite with FLUID_DATA_DIR', () => {
    expect(resolveStorageMode({ FLUID_DATA_DIR: '/tmp/d' })).toEqual({ kind: 'pglite', dataDir: '/tmp/d' });
  });
  it('defaults the data dir to ~/.fluid/data', () => {
    const mode = resolveStorageMode({});
    expect(mode.kind === 'pglite' && mode.dataDir.endsWith('/.fluid/data')).toBe(true);
  });
  it('treats an empty DATABASE_URL as unset', () => {
    expect(resolveStorageMode({ DATABASE_URL: '' }).kind).toBe('pglite');
  });
});
