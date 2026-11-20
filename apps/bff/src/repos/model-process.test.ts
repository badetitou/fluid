import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { LineTail, redactPaths } from './model-process-support';
import {
  alive,
  query,
  spawnedPid,
  until,
  useModelProcessHarness,
} from '../test-support/model-process-harness';

const { manager, repoDir, root } = useModelProcessHarness();

describe('ModelProcessManager', () => {
  it('spawns the binary on 127.0.0.1 and a free port, with --no-scip, and waits for /graphql', async () => {
    const m = manager();
    const dir = repoDir('slow-a');
    const { graphqlUrl } = await m.start('a', dir);
    expect(graphqlUrl).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/graphql$/);
    const port = graphqlUrl.match(/:(\d+)\//)?.[1];
    expect((await query(graphqlUrl)).argv).toEqual([
      dir,
      '--host',
      '127.0.0.1',
      '--port',
      port,
      '--no-scip',
    ]);
    expect(m.url('a')).toBe(graphqlUrl);
  });

  it('returns the running URL on a second start, and shares concurrent starts', async () => {
    const m = manager();
    const dir = repoDir('slow-b');
    const [first, second] = await Promise.all([m.start('b', dir), m.start('b', dir)]);
    expect(second).toEqual(first);
    const pid = (await query(first.graphqlUrl)).pid;
    expect(await m.start('b', dir)).toEqual(first);
    expect((await query(first.graphqlUrl)).pid).toBe(pid);
  });

  it('stops the least recently used server beyond maxRunning', async () => {
    const m = manager(2);
    const a = await m.start('a', repoDir('ok-lru-a'));
    const b = await m.start('b', repoDir('ok-lru-b'));
    const pidA = (await query(a.graphqlUrl)).pid;
    const pidB = (await query(b.graphqlUrl)).pid;
    m.url('a'); // a is now more recent than b
    await m.start('c', repoDir('ok-lru-c'));
    expect(m.url('b')).toBeUndefined();
    expect(m.url('a')).toBe(a.graphqlUrl);
    expect(m.url('c')).toBeDefined();
    expect(alive(pidA)).toBe(true);
    expect(alive(pidB)).toBe(false);
  });

  it('stop kills the process, with SIGKILL when SIGTERM is ignored', async () => {
    const m = manager();
    const { graphqlUrl } = await m.start('s', repoDir('stubborn-s'));
    const pid = (await query(graphqlUrl)).pid;
    await m.stop('s');
    expect(m.url('s')).toBeUndefined();
    expect(alive(pid)).toBe(false);
  });

  it('stopAll kills every process', async () => {
    const m = manager();
    const pids = await Promise.all(
      ['x', 'y'].map(
        async (id) => (await query((await m.start(id, repoDir(`ok-all-${id}`))).graphqlUrl)).pid,
      ),
    );
    await m.stopAll();
    expect(pids.map(alive)).toEqual([false, false]);
    expect(m.url('x')).toBeUndefined();
  });

  it('rejects with the last stderr lines, without leaking server paths, when the process exits', async () => {
    const m = manager();
    const error = await m.start('c', repoDir('crash-c')).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(Error);
    const message = (error as Error).message;
    expect(message).toContain('exit code 3');
    expect(message).toContain('fatal: giving up');
    expect(message).toContain('<repo>/Cargo.toml');
    expect(message).not.toContain(root());
    expect(m.url('c')).toBeUndefined();
  });

  it('says to set FLUID_MODEL_GRAPHQL_BIN when the binary is missing', async () => {
    const m = manager(3, {}, join(root(), 'no-such-model-graphql'));
    const error = await m.start('m', repoDir('ok-m')).catch((e: unknown) => e);
    expect((error as Error).message).toMatch(/not found.*FLUID_MODEL_GRAPHQL_BIN/);
    expect((error as Error).message).not.toContain(root());
  });

  it('rejects after the timeout and kills a server that never answers', async () => {
    const m = manager(3, { readyTimeoutMs: 1_500 });
    const dir = repoDir('never-n');
    await expect(m.start('n', dir)).rejects.toThrow(/did not answer/);
    expect(m.url('n')).toBeUndefined();
    expect(spawnedPid(dir)).toBeDefined();
    expect(alive(spawnedPid(dir))).toBe(false);
  });

  it('cancels a start when the signal aborts', async () => {
    const m = manager();
    const controller = new AbortController();
    const dir = repoDir('never-abort');
    const started = m.start('n', dir, { signal: controller.signal });
    await until(() => spawnedPid(dir) !== undefined);
    controller.abort();
    await expect(started).rejects.toThrow(/cancelled/);
    expect(m.url('n')).toBeUndefined();
    expect(spawnedPid(dir)).toBeDefined();
    expect(alive(spawnedPid(dir))).toBe(false);
  });
});

describe('model-process support', () => {
  it('redacts known and absolute paths', () => {
    expect(redactPaths('read /srv/repos/x/a.rs and /usr/bin/model', ['/srv/repos/x'])).toBe(
      'read <repo>/a.rs and <path>',
    );
  });

  it('keeps the last lines of a stream', () => {
    const tail = new LineTail(3);
    tail.push('one\ntwo\nthr');
    tail.push('ee\nfour\nfive');
    expect(tail.last(2)).toEqual(['four', 'five']);
    expect(tail.last(10)).toEqual(['two', 'three', 'four', 'five']);
  });
});
