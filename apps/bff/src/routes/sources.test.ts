import { createServer, type IncomingHttpHeaders, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { randomBytes } from 'node:crypto';
import Fastify, { type FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createStorage, type Storage } from '../storage/client';
import { createSourceRepository } from '../sources/repository';
import { createSourceService } from '../sources/service';
import { sourceRoutes } from './sources';

const SECRET = 'sk-super-secret-value';

describe('source routes', () => {
  let storage: Storage;
  let app: FastifyInstance;
  let stub: Server;
  let stubUrl: string;
  let seen: { headers: IncomingHttpHeaders; body: unknown }[] = [];
  let reply: { status: number; body: string } = { status: 200, body: '{"data":{"ok":true}}' };
  const logs: string[] = [];

  beforeAll(async () => {
    stub = createServer((req, res) => {
      let raw = '';
      req.on('data', (c) => (raw += c));
      req.on('end', () => {
        seen.push({ headers: req.headers, body: JSON.parse(raw) });
        res.writeHead(reply.status, { 'content-type': 'application/json' }).end(reply.body);
      });
    });
    await new Promise<void>((r) => stub.listen(0, '127.0.0.1', r));
    stubUrl = `http://127.0.0.1:${(stub.address() as AddressInfo).port}/graphql`;

    storage = createStorage({ kind: 'pglite', dataDir: 'memory://' });
    await storage.init();
    const key = randomBytes(32);
    const service = createSourceService(createSourceRepository(storage.prisma), () => key, { timeoutMs: 500 });
    app = Fastify({
      logger: { level: 'trace', stream: { write: (line: string) => void logs.push(line) } },
    });
    await app.register(sourceRoutes, { service });
    await app.ready();
  });
  afterAll(async () => {
    await app.close();
    await storage.close();
    await new Promise((r) => stub.close(r));
  });
  beforeEach(() => {
    seen = [];
    reply = { status: 200, body: '{"data":{"ok":true}}' };
  });

  const create = async (extra: object = {}) => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/sources',
      payload: { name: 'S', url: stubUrl, authKind: 'header', secret: SECRET, ...extra },
    });
    return res.json() as { id: string };
  };
  const run = (id: string, payload: object = { query: '{ ok }' }) =>
    app.inject({ method: 'POST', url: `/api/sources/${id}/graphql`, payload });

  it('keeps the secret write-only and encrypted at rest', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/sources',
      payload: { name: 'S', url: stubUrl, authKind: 'header', secret: SECRET },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({ hasSecret: true, headerName: 'Authorization' });
    const { id } = res.json() as { id: string };
    for (const url of ['/api/sources', `/api/sources/${id}`]) {
      expect((await app.inject({ url })).body).not.toContain(SECRET);
    }
    const stored = await storage.prisma.sourceConfig.findUnique({ where: { id } });
    expect(stored?.secret).toBeTruthy();
    expect(stored?.secret).not.toContain(SECRET);
    // A secret rejected by validation is not echoed either.
    const bad = await app.inject({ method: 'POST', url: '/api/sources', payload: { name: 'x', url: 'ftp://h', secret: SECRET } });
    expect(bad.statusCode).toBe(400);
    expect(bad.body).not.toContain(SECRET);
  });

  it('forwards query, variables and operationName with the bearer header', async () => {
    const { id } = await create();
    const res = await run(id, { query: 'query Q($a:Int){ok}', variables: { a: 1 }, operationName: 'Q' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ data: { ok: true } });
    expect(seen).toHaveLength(1);
    expect(seen[0].headers.authorization).toBe(`Bearer ${SECRET}`);
    expect(seen[0].body).toEqual({ query: 'query Q($a:Int){ok}', variables: { a: 1 }, operationName: 'Q' });
  });

  it('sends a custom header as is, and nothing for kind none', async () => {
    const { id } = await create({ headerName: 'X-Api-Key' });
    await run(id);
    expect(seen[0].headers['x-api-key']).toBe(SECRET);
    expect(seen[0].headers.authorization).toBeUndefined();
    const none = await create({ authKind: 'none', secret: undefined });
    await run(none.id);
    expect(seen[1].headers.authorization).toBeUndefined();
  });

  it('rejects an unknown source and invalid bodies', async () => {
    expect((await run('nope')).statusCode).toBe(404);
    expect(seen).toHaveLength(0);
    const { id } = await create();
    expect((await run(id, { variables: {} })).statusCode).toBe(400);
  });

  it('passes an upstream 401 and GraphQL errors through', async () => {
    const { id } = await create();
    reply = { status: 401, body: '{"errors":[{"message":"bad token"}]}' };
    const res = await run(id);
    expect(res.statusCode).toBe(401);
    expect(res.json()).toEqual({ errors: [{ message: 'bad token' }] });
    reply = { status: 401, body: 'Unauthorized' };
    const plain = await run(id);
    expect(plain.statusCode).toBe(401);
    expect(plain.json().errors[0].message).toContain('401');
    reply = { status: 200, body: '<html>' };
    expect((await run(id)).statusCode).toBe(502);
  });

  it('reports an unreachable source as 502 without leaking the secret', async () => {
    const { id } = await create({ url: 'http://127.0.0.1:1/graphql' });
    const res = await run(id);
    expect(res.statusCode).toBe(502);
    expect(res.body).not.toContain(SECRET);
  });

  it('updates with keep/replace/remove secret semantics, and deletes', async () => {
    const { id } = await create();
    const renamed = await app.inject({ method: 'PUT', url: `/api/sources/${id}`, payload: { name: 'R' } });
    expect(renamed.json()).toMatchObject({ name: 'R', hasSecret: true });
    const removed = await app.inject({ method: 'PUT', url: `/api/sources/${id}`, payload: { secret: null } });
    expect(removed.json()).toMatchObject({ hasSecret: false });
    expect((await app.inject({ method: 'PUT', url: '/api/sources/nope', payload: { name: 'x' } })).statusCode).toBe(404);
    expect((await app.inject({ method: 'DELETE', url: `/api/sources/${id}` })).statusCode).toBe(204);
    expect((await app.inject({ method: 'DELETE', url: `/api/sources/${id}` })).statusCode).toBe(404);
  });

  it('never logs the secret', () => {
    expect(logs.length).toBeGreaterThan(0);
    expect(logs.join('')).not.toContain(SECRET);
  });
});
