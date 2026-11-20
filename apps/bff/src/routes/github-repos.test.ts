import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Fastify, { type FastifyInstance } from 'fastify';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { githubRepoListSchema, githubRepoSchema } from '@fluid/shared';
import { createGithubSource, type GithubSource } from '../repos/service';
import { FakeFetcher, FakeProcesses, gate, testConfig } from '../repos/test-fakes';
import { githubRepoRoutes } from './github-repos';

describe('GitHub repo routes', () => {
  let stub: Server;
  let stubUrl: string;
  let seen: unknown[];
  let dir: string;
  let fetcher: FakeFetcher;
  let processes: FakeProcesses;
  let service: GithubSource;
  let app: FastifyInstance;

  beforeAll(async () => {
    stub = createServer((req, res) => {
      let raw = '';
      req.on('data', (c) => (raw += c));
      req.on('end', () => {
        seen.push(JSON.parse(raw));
        res.writeHead(200, { 'content-type': 'application/json' }).end('{"data":{"__typename":"Query"}}');
      });
    });
    await new Promise<void>((r) => stub.listen(0, '127.0.0.1', r));
    stubUrl = `http://127.0.0.1:${(stub.address() as AddressInfo).port}/graphql`;
  });
  afterAll(() => new Promise<void>((r) => stub.close(() => r())));

  beforeEach(async () => {
    seen = [];
    dir = await mkdtemp(join(tmpdir(), 'fluid-repo-routes-'));
    fetcher = new FakeFetcher();
    processes = new FakeProcesses();
    processes.start = async (id) => {
      processes.running.set(id, stubUrl);
      return { graphqlUrl: stubUrl };
    };
    service = createGithubSource(testConfig(dir), { fetcher, processes });
    app = Fastify();
    await app.register(githubRepoRoutes, { service });
    await app.ready();
  });
  afterEach(async () => {
    await app.close();
    await rm(dir, { recursive: true, force: true });
  });

  const add = (body: unknown) => app.inject({ method: 'POST', url: '/api/github-repos', payload: body as object });

  it('adds a repository (202) idempotently and lists it', async () => {
    const first = await add({ repo: 'badetitou/Model' });
    expect(first.statusCode).toBe(202);
    const repo = githubRepoSchema.parse(first.json());
    expect(repo).toMatchObject({ id: 'badetitou--model', status: 'queued' });
    expect((await add({ repo: 'badetitou/model' })).json().id).toBe('badetitou--model');
    await service.settled('badetitou--model');
    const list = githubRepoListSchema.parse((await app.inject('/api/github-repos')).json());
    expect(list).toHaveLength(1);
    expect(list[0].status).toBe('ready');
    expect(fetcher.calls).toHaveLength(1);
    const one = await app.inject('/api/github-repos/badetitou--model');
    expect(one.json()).toMatchObject({ id: 'badetitou--model', status: 'ready' });
  });

  it('rejects an invalid body with 400', async () => {
    expect((await add({ repo: 'not a repo' })).statusCode).toBe(400);
    expect((await add({ repo: 'a/b', ref: '../x' })).statusCode).toBe(400);
    expect((await add({})).statusCode).toBe(400);
  });

  it('answers 404 for an unknown id', async () => {
    expect((await app.inject('/api/github-repos/nope')).statusCode).toBe(404);
    expect((await app.inject({ method: 'DELETE', url: '/api/github-repos/nope' })).statusCode).toBe(404);
    const gql = await app.inject({ method: 'POST', url: '/api/github-repos/nope/graphql', payload: { query: '{ a }' } });
    expect(gql.statusCode).toBe(404);
  });

  it('answers 409 on graphql until ready, then proxies to the Model server', async () => {
    const download = gate();
    fetcher.hold = download.promise;
    await add({ repo: 'o/n' });
    const url = '/api/github-repos/o--n/graphql';
    const early = await app.inject({ method: 'POST', url, payload: { query: '{ __typename }' } });
    expect(early.statusCode).toBe(409);
    download.open();
    await service.settled('o--n');
    const bad = await app.inject({ method: 'POST', url, payload: { query: '' } });
    expect(bad.statusCode).toBe(400);
    const res = await app.inject({ method: 'POST', url, payload: { query: '{ __typename }', variables: { a: 1 } } });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ data: { __typename: 'Query' } });
    expect(seen).toEqual([{ query: '{ __typename }', variables: { a: 1 } }]);
  });

  it('proxies to loopback even when private hosts are blocked', async () => {
    process.env.FLUID_BLOCK_PRIVATE_HOSTS = '1';
    try {
      await add({ repo: 'o/n' });
      await service.settled('o--n');
      const res = await app.inject({ method: 'POST', url: '/api/github-repos/o--n/graphql', payload: { query: '{ a }' } });
      expect(res.statusCode).toBe(200);
    } finally {
      delete process.env.FLUID_BLOCK_PRIVATE_HOSTS;
    }
  });

  it('deletes a repository (204) and stops its process', async () => {
    await add({ repo: 'o/n' });
    await service.settled('o--n');
    expect((await app.inject({ method: 'DELETE', url: '/api/github-repos/o--n' })).statusCode).toBe(204);
    expect(processes.stopped).toEqual(['o--n']);
    expect((await app.inject('/api/github-repos/o--n')).statusCode).toBe(404);
  });

  it('stops every process when the app closes', async () => {
    await app.close();
    expect(processes.stoppedAll).toBe(true);
  });
});

describe('GitHub repo routes registration', () => {
  const build = async (enabled: string | undefined) => {
    process.env.DATABASE_URL ??= 'postgresql://x:x@127.0.0.1:1/x';
    if (enabled === undefined) delete process.env.FLUID_REPOS_ENABLED;
    else process.env.FLUID_REPOS_ENABLED = enabled;
    const { buildApp } = await import('../app');
    const app = buildApp({ logLevel: 'silent' });
    await app.ready();
    return app;
  };
  afterEach(() => {
    delete process.env.FLUID_REPOS_ENABLED;
  });

  it('registers the routes only when FLUID_REPOS_ENABLED is true', async () => {
    const off = await build(undefined);
    expect((await off.inject('/api/github-repos')).statusCode).toBe(404);
    await off.close();
    const on = await build('true');
    const res = await on.inject('/api/github-repos');
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([]);
    await on.close();
  });
});
