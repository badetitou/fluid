import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { main } from './main';

// An entry URL inside an empty package: dist/fluid.mjs with no web/ or migrations/.
function emptyInstall(): string {
  const root = mkdtempSync(join(tmpdir(), 'fluid-cli-main-'));
  mkdirSync(join(root, 'dist'));
  writeFileSync(join(root, 'package.json'), JSON.stringify({ version: '9.9.9' }));
  return pathToFileURL(join(root, 'dist', 'fluid.mjs')).href;
}

describe('main exit codes', () => {
  afterEach(() => vi.restoreAllMocks());

  it('returns 0 for --help and prints the usage', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    expect(await main(['--help'], {}, emptyInstall())).toBe(0);
    expect(log.mock.calls[0]?.[0]).toContain('Usage: fluid');
  });

  it('returns 0 for --version and prints the package version', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    expect(await main(['--version'], {}, emptyInstall())).toBe(0);
    expect(log).toHaveBeenCalledWith('9.9.9');
  });

  it('returns 2 on a usage error', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await main(['--nope'], {}, emptyInstall())).toBe(2);
    expect(String(err.mock.calls[0]?.[0])).toContain('Usage: fluid');
  });

  it('returns 1 on a corrupted install without starting a server', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await main(['--no-open'], {}, emptyInstall())).toBe(1);
    expect(String(err.mock.calls[0]?.[0])).toContain('corrupted install');
  });

  it('returns 1 when --env-file cannot be read', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await main(['--env-file', '/nonexistent/fluid.env'], {}, emptyInstall())).toBe(1);
    expect(String(err.mock.calls[0]?.[0])).toContain('cannot read --env-file');
  });
});
