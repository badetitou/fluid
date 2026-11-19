import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { main } from './main';

const runMcp = vi.hoisted(() => vi.fn(async (_url: string, _version: string) => 0));
vi.mock('./mcp/run', () => ({ runMcp, DEFAULT_FLUID_URL: 'http://localhost:4001' }));

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

describe('main in mcp mode', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    runMcp.mockClear();
  });

  function runWith(argv: string[], env: Record<string, string>) {
    const out = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    return main(argv, env, emptyInstall()).then((code) => ({ code, out, err }));
  }

  it('prefers --url over FLUID_URL over the default', async () => {
    await runWith(['mcp', '--url', 'http://a:1'], { FLUID_URL: 'http://b:2' });
    expect(runMcp).toHaveBeenLastCalledWith('http://a:1', '9.9.9', expect.stringMatching(/viewer\.html$/));
    await runWith(['mcp'], { FLUID_URL: 'http://b:2/' });
    expect(runMcp).toHaveBeenLastCalledWith('http://b:2', '9.9.9', expect.stringMatching(/viewer\.html$/));
    await runWith(['mcp'], {});
    expect(runMcp).toHaveBeenLastCalledWith('http://localhost:4001', '9.9.9', expect.stringMatching(/viewer\.html$/));
  });

  it('exits 2 on an invalid FLUID_URL without echoing it, and writes nothing to stdout', async () => {
    const r = await runWith(['mcp'], { FLUID_URL: 'http://user:secret@h/' });
    expect(r.code).toBe(2);
    expect(runMcp).not.toHaveBeenCalled();
    expect(JSON.stringify(r.err.mock.calls)).not.toContain('secret');
    expect(r.out).not.toHaveBeenCalled();
  });
});
