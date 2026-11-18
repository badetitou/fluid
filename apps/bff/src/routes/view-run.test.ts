import { createServer, type IncomingHttpHeaders, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { randomBytes } from 'node:crypto';
import Fastify, { type FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createStorage, type Storage } from '../storage/client';
import { startHarness, type Harness } from '../test-support/oauth-harness';
import { createSourceRepository } from '../sources/repository';
import { createSourceService } from '../sources/service';
import { createViewReader } from '../views/repository';
import { createViewRunService } from '../views/run-service';
import { sourceRoutes } from './sources';
import { viewRunRoutes } from './view-run';

const spec = (queries: object) => ({ id: 'v1', concept: 'Account', title: 'Accounts', queries, widgets: [] });
const STORED = {
  accounts: { query: 'query($take: Int, $kind: String) { accounts(take: $take, kind: $kind) { id } }', variables: { kind: 'a' } },
  total: { query: '{ total }' },
  fromPlugin: { query: 'select 1', source: 'spec-fluid' },
};

describe('POST /api/views/:id/run (header source)', () => {
  let storage: Storage;
  let app: FastifyInstance;
  let stub: Server;
  let sourceId: string;
  let seen: { headers: IncomingHttpHeaders; body: { query: string; variables?: Record<string, unknown> } }[] = [];

  beforeAll(async () => {
    stub = createServer((req, res) => {
      let raw = '';
      req.on('data', (c) => (raw += c));
      req.on('end', () => {
        const body = JSON.parse(raw);
        seen.push({ headers: req.headers, body });
        const data = body.query.includes('total') ? { total: 7 } : { accounts: [{ id: '1' }] };
        res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ data }));
      });
    });
    await new Promise<void>((r) => stub.listen(0, '127.0.0.1', r));
    storage = createStorage({ kind: 'pglite', dataDir: 'memory://' });
    await storage.init();
    const key = randomBytes(32);
    const service = createSourceService(createSourceRepository(storage.prisma), () => key, { timeoutMs: 500 });
    app = Fastify();
    await app.register(sourceRoutes, { service });
    await app.register(viewRunRoutes, { service: createViewRunService(createViewReader(storage.prisma), service) });
    await app.ready();
    const url = `http://127.0.0.1:${(stub.address() as AddressInfo).port}/graphql`;
    const created = await app.inject({
      method: 'POST',
      url: '/api/sources',
      payload: { name: 'S', url, authKind: 'header', headerName: 'X-Key', secret: 'sk-1' },
    });
    sourceId = created.json().id;
  });
  afterAll(async () => {
    await app.close();
    await storage.close();
    await new Promise((r) => stub.close(r));
  });
  beforeEach(() => {
    seen = [];
  });

  const saveView = async (queries: object = STORED) =>
    (await storage.prisma.view.create({ data: { concept: 'Account', title: 'Accounts', spec: spec(queries) } })).id;
  // jsonb does not keep the key order, so compare the sent queries sorted.
  const sent = () => seen.map((s) => s.body.query).sort();
  const run = (id: string, payload: object) => app.inject({ method: 'POST', url: `/api/views/${id}/run`, payload });

  it('runs the stored queries with the source credentials, skipping plugin sources', async () => {
    const res = await run(await saveView(), { sourceId });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      results: { accounts: { data: { accounts: [{ id: '1' }] } }, total: { data: { total: 7 } } },
      skipped: ['fromPlugin'],
    });
    expect(seen).toHaveLength(2);
    expect(seen.every((s) => s.headers['x-key'] === 'sk-1')).toBe(true);
    expect(sent()).toEqual([STORED.accounts.query, STORED.total.query].sort());
  });

  it('lets request variables override and injects take only when declared', async () => {
    await run(await saveView(), { sourceId, variables: { kind: 'b' }, take: 5 });
    const vars = (q: string) => seen.find((s) => s.body.query === q)?.body.variables;
    expect(vars(STORED.accounts.query)).toEqual({ kind: 'b', take: 5 });
    expect(vars(STORED.total.query)).toEqual({ kind: 'b' });
  });

  it('does not accept query text and never forwards any other text than the stored one', async () => {
    const res = await run(await saveView(), { sourceId, query: '{ evil }', operationName: 'x' });
    expect(res.statusCode).toBe(400);
    expect(seen).toHaveLength(0);
    await run(await saveView(), { sourceId, variables: { query: '{ evil }' } });
    expect(sent()).toEqual([STORED.accounts.query, STORED.total.query].sort());
  });

  it('answers 404 for an unknown view or source, 422 for an invalid stored spec', async () => {
    expect((await run('nope', { sourceId })).statusCode).toBe(404);
    expect((await run(await saveView(), { sourceId: 'nope' })).statusCode).toBe(404);
    const bad = await storage.prisma.view.create({ data: { concept: 'A', title: 'B', spec: { nonsense: true } } });
    expect((await run(bad.id, { sourceId })).statusCode).toBe(422);
    expect(seen).toHaveLength(0);
  });
});

describe('POST /api/views/:id/run (OAuth source)', () => {
  let h: Harness;
  beforeAll(async () => {
    h = await startHarness();
  });
  afterAll(() => h.close());
  beforeEach(() => h.reset());

  const saveView = async () =>
    (await h.storage.prisma.view.create({ data: { concept: 'A', title: 'T', spec: spec(STORED) } })).id;
  const run = (id: string, payload: object) => h.app.inject({ method: 'POST', url: `/api/views/${id}/run`, payload });

  it('attaches the bearer token and returns the data, never the token', async () => {
    const { id: sourceId } = await h.createSource();
    await h.signIn(sourceId);
    const res = await run(await saveView(), { sourceId, take: 3 });
    expect(res.statusCode).toBe(200);
    expect(res.json().results.total).toEqual({ data: { ok: true } });
    expect(h.resource.state.seen).toHaveLength(2);
    expect(h.resource.state.seen[0]).toMatch(/^Bearer at-/);
    expect(res.body).not.toContain('at-');
  });

  it('propagates FLUID_AUTH_REQUIRED when signed out, without calling the source', async () => {
    const { id: sourceId } = await h.createSource();
    const res = await run(await saveView(), { sourceId });
    expect(res.statusCode).toBe(401);
    expect(res.json().errors[0].extensions).toEqual({ code: 'FLUID_AUTH_REQUIRED', reason: 'signin' });
    expect(h.resource.state.seen).toHaveLength(0);
  });

  it('propagates an upstream 401 as reason expired', async () => {
    const { id: sourceId } = await h.createSource();
    await h.signIn(sourceId);
    h.resource.state.mode = 'unauthorized';
    const res = await run(await saveView(), { sourceId });
    expect(res.statusCode).toBe(401);
    expect(res.json().errors[0].extensions.reason).toBe('expired');
  });
});
