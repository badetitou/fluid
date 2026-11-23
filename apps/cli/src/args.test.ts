import { describe, expect, it } from 'vitest';
import { parseCliArgs, parseFluidUrl } from './args';

const run = (argv: string[]) => {
  const r = parseCliArgs(argv);
  if (r.kind !== 'run') throw new Error(`expected run, got ${r.kind}`);
  return r.options;
};

describe('parseCliArgs', () => {
  it('has sane defaults', () => {
    expect(run([])).toEqual({
      port: 4001,
      host: '127.0.0.1',
      dataDir: undefined,
      envFile: undefined,
      open: true,
      verbose: false,
      github: true,
      modelGraphql: undefined,
    });
  });
  it('handles --no-github and --model-graphql', () => {
    expect(run(['--no-github']).github).toBe(false);
    expect(run(['--model-graphql', '/x/model-graphql']).modelGraphql).toBe('/x/model-graphql');
    expect(parseCliArgs(['mcp', '--no-github']).kind).toBe('error');
  });
  it('accepts ports 0 and 65535', () => {
    expect(run(['--port', '0']).port).toBe(0);
    expect(run(['--port', '65535']).port).toBe(65535);
  });
  it.each(['-1', '70000', 'abc', '1.5', ''])('rejects port %j', (p) => {
    expect(parseCliArgs(['--port', p]).kind).toBe('error');
  });
  it('handles --no-open and the value flags', () => {
    const o = run(['--no-open', '--host', '0.0.0.0', '--data-dir', 'd', '--env-file', 'e', '--verbose']);
    expect(o).toMatchObject({ open: false, host: '0.0.0.0', dataDir: 'd', envFile: 'e', verbose: true });
  });
  it('reports unknown flags and positionals as errors', () => {
    expect(parseCliArgs(['--nope']).kind).toBe('error');
    expect(parseCliArgs(['extra']).kind).toBe('error');
  });
  it('recognises help and version', () => {
    expect(parseCliArgs(['-h']).kind).toBe('help');
    expect(parseCliArgs(['--help']).kind).toBe('help');
    expect(parseCliArgs(['-v']).kind).toBe('version');
    expect(parseCliArgs(['--version']).kind).toBe('version');
  });
  it('trims the port, defaults an empty host, and lets --help win over a bad port', () => {
    expect(run(['--port', ' 80 ']).port).toBe(80);
    expect(run(['--host', '']).host).toBe('127.0.0.1');
    expect(parseCliArgs(['--help', '--port', 'abc']).kind).toBe('help');
  });
});

describe('parseCliArgs: mcp', () => {
  it('parses the mcp command, normalising --url', () => {
    expect(parseCliArgs(['mcp'])).toEqual({ kind: 'mcp' });
    expect(parseCliArgs(['mcp', '--url', 'http://localhost:5000/'])).toEqual({ kind: 'mcp', url: 'http://localhost:5000' });
    expect(parseCliArgs(['mcp', '--url', 'https://h.example/fluid//'])).toEqual({ kind: 'mcp', url: 'https://h.example/fluid' });
  });

  it('rejects a bad, credentialed, query or hash URL without echoing it', () => {
    for (const url of ['ftp://x', 'nope', 'http://user:pw@h/', 'http://h/?a=1', 'http://h/#x']) {
      const r = parseCliArgs(['mcp', '--url', url]);
      expect(r.kind).toBe('error');
      if (r.kind === 'error') expect(r.message).not.toContain('pw');
    }
  });

  it('rejects unknown commands, extra positionals and --url without mcp', () => {
    expect(parseCliArgs(['serve']).kind).toBe('error');
    expect(parseCliArgs(['mcp', 'extra']).kind).toBe('error');
    expect(parseCliArgs(['--url', 'http://x']).kind).toBe('error');
  });

  it('rejects run-only options in mcp mode', () => {
    for (const extra of [['--port', '1'], ['--host', 'h'], ['--data-dir', 'd'], ['--env-file', 'f'], ['--no-open'], ['--verbose']]) {
      expect(parseCliArgs(['mcp', ...extra]).kind).toBe('error');
    }
  });

  it('keeps --help for mcp and the default run unchanged', () => {
    expect(parseCliArgs(['mcp', '--help']).kind).toBe('help');
    expect(run([]).port).toBe(4001);
  });
});

describe('parseFluidUrl', () => {
  it('keeps origin and path only', () => {
    expect(parseFluidUrl(' http://127.0.0.1:4001/ ')).toBe('http://127.0.0.1:4001');
  });
});
