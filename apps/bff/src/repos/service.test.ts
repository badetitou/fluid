import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { githubRepoSchema } from '@fluid/shared';
import type { GraphqlBody } from '../sources/model';
import { createGithubSource, publicError, type GithubSource } from './service';
import { FakeFetcher, FakeProcesses, gate, testConfig } from './test-fakes';

describe('GitHub source service', () => {
  let dir: string;
  let fetcher: FakeFetcher;
  let processes: FakeProcesses;
  let forwarded: { url: string; body: GraphqlBody }[];
  let service: GithubSource;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'fluid-repos-'));
    fetcher = new FakeFetcher();
    processes = new FakeProcesses();
    forwarded = [];
    service = createGithubSource(testConfig(dir), {
      fetcher,
      processes,
      forward: async (url, body) => {
        forwarded.push({ url, body });
        return { status: 200, body: { data: { ok: true } } };
      },
    });
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('goes queued → downloading → analyzing → ready', async () => {
    const download = gate();
    const analysis = gate();
    fetcher.hold = download.promise;
    processes.hold = analysis.promise;
    const added = service.add({ repo: 'Owner/Name' });
    expect(githubRepoSchema.parse(added)).toMatchObject({
      id: 'owner--name',
      status: 'queued',
      graphqlPath: '/api/github-repos/owner--name/graphql',
    });
    await Promise.resolve();
    expect(service.get('owner--name')?.status).toBe('downloading');
    download.open();
    await new Promise((r) => setTimeout(r, 0));
    expect(service.get('owner--name')?.status).toBe('analyzing');
    analysis.open();
    await service.settled('owner--name');
    expect(service.get('owner--name')?.status).toBe('ready');
    expect(fetcher.calls).toEqual([{ repo: 'Owner/Name', destDir: join(dir, 'owner--name'), maxBytes: 1000 }]);
    expect(processes.starts).toEqual([{ id: 'owner--name', dir: join(dir, 'owner--name') }]);
  });

  it('is idempotent on id and keeps the ref', async () => {
    const a = service.add({ repo: 'o/n', ref: 'v1' });
    const b = service.add({ repo: 'O/N', ref: 'V1' });
    expect(b).toBe(a);
    expect(a).toMatchObject({ id: 'o--n--v1', ref: 'v1' });
    await service.settled('o--n--v1');
    expect(fetcher.calls).toHaveLength(1);
    expect(service.list().map((r) => r.id)).toEqual(['o--n--v1']);
  });

  it('marks a failure without leaking server paths, and retries on a new add', async () => {
    fetcher.failWith = new Error(`cannot write ${dir}/o--n/file: Repository not found or not public`);
    service.add({ repo: 'o/n' });
    await service.settled('o--n');
    const failed = service.get('o--n');
    expect(failed?.status).toBe('failed');
    expect(failed?.error).toBe('cannot write <repos>/o--n/file: Repository not found or not public');
    fetcher.failWith = undefined;
    expect(service.add({ repo: 'o/n' }).status).toBe('queued');
    await service.settled('o--n');
    expect(service.get('o--n')).toMatchObject({ status: 'ready' });
    expect(service.get('o--n')?.error).toBeUndefined();
  });

  it('reports a process start failure', async () => {
    processes.failWith = new Error('model-graphql not found: set FLUID_MODEL_GRAPHQL_BIN');
    service.add({ repo: 'o/n' });
    await service.settled('o--n');
    expect(service.get('o--n')).toMatchObject({ status: 'failed', error: 'model-graphql not found: set FLUID_MODEL_GRAPHQL_BIN' });
  });

  it('answers 409 until ready, then proxies to the process', async () => {
    const download = gate();
    fetcher.hold = download.promise;
    service.add({ repo: 'o/n' });
    const early = await service.runGraphql('o--n', { query: '{ x }' });
    expect(early?.status).toBe(409);
    expect(early?.body.errors?.[0].message).toContain('not ready');
    download.open();
    await service.settled('o--n');
    const res = await service.runGraphql('o--n', { query: '{ x }' });
    expect(res).toEqual({ status: 200, body: { data: { ok: true } } });
    expect(forwarded).toEqual([{ url: 'http://127.0.0.1:91/graphql', body: { query: '{ x }' } }]);
    expect(await service.runGraphql('nope', { query: '{ x }' })).toBeNull();
  });

  it('restarts the server of a ready repository that the manager stopped (LRU)', async () => {
    service.add({ repo: 'o/n' });
    await service.settled('o--n');
    processes.running.clear();
    await Promise.all([service.runGraphql('o--n', { query: '{ a }' }), service.runGraphql('o--n', { query: '{ b }' })]);
    expect(processes.starts).toHaveLength(2);
    expect(forwarded.map((f) => f.url)).toEqual(['http://127.0.0.1:92/graphql', 'http://127.0.0.1:92/graphql']);
  });

  it('answers 502 when the restart fails', async () => {
    service.add({ repo: 'o/n' });
    await service.settled('o--n');
    processes.running.clear();
    processes.failWith = new Error('exited');
    expect(await service.runGraphql('o--n', { query: '{ a }' })).toEqual({ status: 502, body: { errors: [{ message: 'exited' }] } });
  });

  it('remove stops the job and the process and deletes the files', async () => {
    const download = gate();
    fetcher.hold = download.promise;
    service.add({ repo: 'o/n' });
    await mkdir(join(dir, 'o--n'), { recursive: true });
    await writeFile(join(dir, 'o--n', 'a.txt'), 'x');
    expect(await service.remove('o--n')).toBe(true);
    expect(processes.stopped).toEqual(['o--n']);
    expect(existsSync(join(dir, 'o--n'))).toBe(false);
    expect(service.get('o--n')).toBeUndefined();
    expect(await service.remove('o--n')).toBe(false);
  });

  it('stopAll aborts running jobs and stops every process', async () => {
    processes.hold = gate().promise;
    service.add({ repo: 'o/n' });
    await service.stopAll();
    expect(processes.stoppedAll).toBe(true);
  });
});

describe('publicError', () => {
  it('hides the repos dir and the home dir, and caps the length', () => {
    expect(publicError(new Error('/srv/repos/x and /home/me/y'), { reposDir: '/srv/repos' }, '/home/me')).toBe('<repos>/x and ~/y');
    expect(publicError('', { reposDir: '/r' })).toBe('Analysis failed');
    expect(publicError(new Error('a'.repeat(900)), { reposDir: '/r' })).toHaveLength(500);
  });
});
