import { describe, expect, it } from 'vitest';
import {
  alive,
  query,
  spawnedPid,
  until,
  useModelProcessHarness,
} from '../test-support/model-process-harness';

// Races between starts, evictions and stops: no server may outlive the manager's bookkeeping.

const { manager, repoDir } = useModelProcessHarness();

describe('ModelProcessManager races', () => {
  it('keeps maxRunning when starts race: the older pending start is evicted and rejects', async () => {
    const m = manager(1);
    const a = await m.start('a', repoDir('ok-race-a'));
    const pidA = (await query(a.graphqlUrl)).pid;
    const dirB = repoDir('slow-race-b');
    const [b, c] = await Promise.allSettled([
      m.start('b', dirB),
      m.start('c', repoDir('slow-race-c')),
    ]);
    expect(b.status).toBe('rejected');
    expect(c.status).toBe('fulfilled');
    expect(m.url('a')).toBeUndefined();
    expect(m.url('b')).toBeUndefined();
    expect(m.url('c')).toBeDefined();
    expect(alive(pidA)).toBe(false);
    expect(alive(spawnedPid(dirB))).toBe(false);
  });

  it('stopAll stops a start that has not spawned yet, and nothing is spawned after', async () => {
    const m = manager();
    const dir = repoDir('slow-pending');
    const started = m.start('p', dir);
    await m.stopAll();
    await expect(started).rejects.toThrow(/stopped/);
    await new Promise((r) => setTimeout(r, 200));
    expect(spawnedPid(dir)).toBeUndefined();
    expect(m.url('p')).toBeUndefined();
  });

  it('stop(id) kills a server that is spawned but not ready yet', async () => {
    const m = manager();
    const dir = repoDir('never-pending');
    const started = m.start('q', dir);
    await until(() => spawnedPid(dir) !== undefined);
    await m.stop('q');
    await expect(started).rejects.toThrow(/stopped/);
    expect(alive(spawnedPid(dir))).toBe(false);
  });

  it('forgets a ready server that dies, and starts it again', async () => {
    const m = manager();
    const dir = repoDir('ok-dies');
    const first = await m.start('d', dir);
    const pid = (await query(first.graphqlUrl)).pid;
    process.kill(pid, 'SIGKILL');
    await until(() => m.url('d') === undefined);
    const second = await m.start('d', dir);
    expect((await query(second.graphqlUrl)).pid).not.toBe(pid);
  });
});
