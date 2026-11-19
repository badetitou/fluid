import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { randomBytes } from 'node:crypto';
import Fastify, { type FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createStorage, type Storage } from '../storage/client';
import { createSourceRepository } from '../sources/repository';
import { createSourceService } from '../sources/service';
import { createViewActionService } from '../views/action-service';
import { createActionLog, createViewReader } from '../views/repository';
import { sourceRoutes } from './sources';
import { viewActionRoutes } from './view-action';

const MUTATION = 'mutation($id: ID!) { deleteTodo(id: $id) }';
const spec = { id: 'v', concept: 'Todo', title: 'Todos', queries: {}, widgets: [], actions: { remove: { mutation: MUTATION, variables: { id: '$target.id' }, confirm: 'Delete?' } } };

describe('POST /api/views/:id/actions/:action', () => {
  let storage: Storage;
  let app: FastifyInstance;
  let stub: Server;
  let sourceId: string;
  let viewId: string;
  const seen: unknown[] = [];

  beforeAll(async () => {
    stub = createServer((req, res) => {
      let raw = '';
      req.on('data', (c) => (raw += c));
      req.on('end', () => {
        seen.push(JSON.parse(raw));
        res.writeHead(200, { 'content-type': 'application/json' }).end('{"data":{"deleteTodo":true}}');
      });
    });
    await new Promise<void>((r) => stub.listen(0, '127.0.0.1', r));
    storage = createStorage({ kind: 'pglite', dataDir: 'memory://' });
    await storage.init();
    const key = randomBytes(32);
    const sources = createSourceService(createSourceRepository(storage.prisma), () => key, { timeoutMs: 500 });
    app = Fastify();
    await app.register(sourceRoutes, { service: sources });
    const service = createViewActionService({ views: createViewReader(storage.prisma), sources, log: createActionLog(storage.prisma) });
    await app.register(viewActionRoutes, { service });
    await app.ready();
    const url = `http://127.0.0.1:${(stub.address() as AddressInfo).port}/graphql`;
    sourceId = (await app.inject({ method: 'POST', url: '/api/sources', payload: { name: 'S', url } })).json().id;
    viewId = (await storage.prisma.view.create({ data: { concept: 'Todo', title: 'Todos', spec } })).id;
  });
  afterAll(async () => {
    await app.close();
    await storage.close();
    await new Promise((r) => stub.close(r));
  });

  const invoke = (action: string, payload: object = { sourceId, variables: { id: '3' } }) =>
    app.inject({ method: 'POST', url: `/api/views/${viewId}/actions/${action}`, payload });

  it('refuses with 403 until the source allows writes', async () => {
    const res = await invoke('remove');
    expect(res.statusCode).toBe(403);
    expect(res.json().error).toContain('Allow changes');
    expect(seen).toHaveLength(0);
  });

  it('runs the stored mutation once writes are allowed, and logs the run', async () => {
    await app.inject({ method: 'PUT', url: `/api/sources/${sourceId}`, payload: { allowWrites: true } });
    const res = await invoke('remove');
    expect([res.statusCode, res.json()]).toEqual([200, { data: { deleteTodo: true } }]);
    expect(seen).toEqual([{ query: MUTATION, variables: { id: '3' } }]);
    const logs = await storage.prisma.actionLog.findMany();
    expect(logs).toMatchObject([{ viewId, action: 'remove', sourceId, variables: { id: '3' }, ok: true, result: { data: { deleteTodo: true } } }]);
  });

  it('answers 404 for an unknown action and 400 for a body carrying a mutation', async () => {
    expect((await invoke('nope')).statusCode).toBe(404);
    expect((await invoke('remove', { sourceId, mutation: 'mutation { dropAll }' })).statusCode).toBe(400);
  });
});
