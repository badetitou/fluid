import { homedir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { CliOptions } from './args';
import { resolveRunConfig } from './config';

const opts: CliOptions = { port: 4001, host: '127.0.0.1', open: true, verbose: false, github: false };

describe('resolveRunConfig', () => {
  it('prefers the flag, then FLUID_DATA_DIR, then the default', () => {
    const env = { FLUID_DATA_DIR: '/env' };
    expect(resolveRunConfig({ ...opts, dataDir: '/flag' }, env).envOverrides.FLUID_DATA_DIR).toBe('/flag');
    expect(resolveRunConfig(opts, env).envOverrides.FLUID_DATA_DIR).toBe('/env');
    expect(resolveRunConfig(opts, {}).envOverrides.FLUID_DATA_DIR).toBe(join(homedir(), '.fluid', 'data'));
  });
  it('ignores PORT and, with the GitHub source off, only overrides FLUID_DATA_DIR', () => {
    const cfg = resolveRunConfig(opts, { PORT: '9999', HOST: 'x' });
    expect(cfg.port).toBe(4001);
    expect(Object.keys(cfg.envOverrides)).toEqual(['FLUID_DATA_DIR']);
  });
  it('warns when --data-dir is moot because of DATABASE_URL', () => {
    const cfg = resolveRunConfig({ ...opts, dataDir: '/x' }, { DATABASE_URL: 'postgres://h/db' });
    expect(cfg.postgres).toBe(true);
    expect(cfg.warnings).toEqual(['--data-dir ignored: DATABASE_URL is set']);
    expect(resolveRunConfig(opts, { DATABASE_URL: 'postgres://h/db' }).warnings).toEqual([]);
  });
  it('shows localhost for wildcard hosts', () => {
    expect(resolveRunConfig({ ...opts, host: '0.0.0.0' }, {}).displayUrl(5)).toBe('http://localhost:5');
    expect(resolveRunConfig({ ...opts, host: '::' }, {}).displayUrl(5)).toBe('http://localhost:5');
    expect(resolveRunConfig(opts, {}).displayUrl(5)).toBe('http://127.0.0.1:5');
    expect(resolveRunConfig({ ...opts, host: '::1' }, {}).displayUrl(5)).toBe('http://[::1]:5');
  });
});
