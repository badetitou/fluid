import { ALL_EXAMPLE_VIEWS, type ViewSpec, type Widget } from '@fluid/shared';
import Fastify, { type FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createStorage, type Storage } from '../storage/client';
import { createViewRepository } from '../views/repository';
import { createViewService } from '../views/service';
import { prefRoutes } from './prefs';
import { createPrefRepository } from '../prefs/repository';
import { createPrefService } from '../prefs/service';
import { viewRoutes } from './views';

const example = ALL_EXAMPLE_VIEWS.find((v) => v.widgets.length >= 2) as ViewSpec;
const spec = (over: Partial<ViewSpec> = {}): ViewSpec => ({ ...example, ...over });

describe('view and pref routes', () => {
  let storage: Storage;
  let app: FastifyInstance;

  beforeAll(async () => {
    storage = createStorage({ kind: 'pglite', dataDir: 'memory://' });
    await storage.init();
    app = Fastify();
    await app.register(viewRoutes, { service: createViewService(createViewRepository(storage.prisma)) });
    await app.register(prefRoutes, { service: createPrefService(createPrefRepository(storage.prisma)) });
    await app.ready();
  });
  afterAll(async () => {
    await app.close();
    await storage.close();
  });
  beforeEach(async () => {
    await storage.prisma.view.deleteMany();
    await storage.prisma.preference.deleteMany();
  });

  const create = async (body: object) => app.inject({ method: 'POST', url: '/api/views', payload: body });

  it('creates, lists by concept, reads and deletes a view', async () => {
    const res = await create({ spec: spec() });
    expect(res.statusCode).toBe(201);
    const view = res.json();
    expect(view).toMatchObject({ concept: example.concept, title: example.title, isDefault: false });
    await create({ spec: spec({ concept: 'Other' }) });

    const listed = (await app.inject(`/api/views?concept=${example.concept}`)).json();
    expect(listed.map((v: { id: string }) => v.id)).toEqual([view.id]);
    expect((await app.inject('/api/views')).json()).toHaveLength(2);
    expect((await app.inject(`/api/views/${view.id}`)).json().spec).toEqual(spec());

    expect((await app.inject({ method: 'DELETE', url: `/api/views/${view.id}` })).statusCode).toBe(204);
    expect((await app.inject(`/api/views/${view.id}`)).statusCode).toBe(404);
    expect((await app.inject({ method: 'DELETE', url: `/api/views/${view.id}` })).statusCode).toBe(404);
  });

  it('rejects an invalid spec or update', async () => {
    expect((await create({ spec: { title: 'no concept' } })).statusCode).toBe(400);
    const { id } = (await create({ spec: spec() })).json();
    expect((await app.inject({ method: 'PUT', url: `/api/views/${id}`, payload: {} })).statusCode).toBe(400);
    expect((await app.inject({ method: 'PUT', url: '/api/views/nope', payload: { title: 'x' } })).statusCode).toBe(404);
  });

  it('keeps one default view per concept', async () => {
    const a = (await create({ spec: spec(), isDefault: true })).json();
    const b = (await create({ spec: spec(), isDefault: true })).json();
    expect((await app.inject(`/api/views/${a.id}`)).json().isDefault).toBe(false);
    await app.inject({ method: 'PUT', url: `/api/views/${a.id}`, payload: { isDefault: true } });
    expect((await app.inject(`/api/views/${b.id}`)).json().isDefault).toBe(false);
    expect((await app.inject(`/api/views/${a.id}`)).json().isDefault).toBe(true);
  });

  it('renames a view and its stored spec', async () => {
    const { id } = (await create({ spec: spec() })).json();
    const renamed = (await app.inject({ method: 'PUT', url: `/api/views/${id}`, payload: { title: 'Renamed' } })).json();
    expect(renamed.title).toBe('Renamed');
    expect(renamed.spec.title).toBe('Renamed');
    expect(renamed.spec.widgets).toEqual(example.widgets);
  });

  it('replaces one widget, keeping its id and place on the grid', async () => {
    const withLayout = spec({ widgets: example.widgets.map((w, i) => ({ ...w, layout: { x: 0, y: i, w: 6, h: 4 } })) });
    const { id } = (await create({ spec: withLayout })).json();
    const target = withLayout.widgets[1];
    const replacement = { ...withLayout.widgets[0], id: 'ignored', layout: undefined, title: 'Replaced' } as Widget;
    const patch = (widgetId: string, payload: object) =>
      app.inject({ method: 'PATCH', url: `/api/views/${id}/widgets/${widgetId}`, payload });

    const res = await patch(target.id, { widget: replacement });
    expect(res.statusCode).toBe(200);
    const updated = res.json().spec.widgets[1];
    expect(updated).toMatchObject({ id: target.id, title: 'Replaced', layout: target.layout });

    expect((await patch(target.id, {})).statusCode).toBe(400);
    expect((await patch(target.id, { widget: { type: 'nope' } })).statusCode).toBe(400);
    expect((await patch('missing', { widget: replacement })).json()).toEqual({ error: 'Widget not found in view' });
    const noView = await app.inject({ method: 'PATCH', url: `/api/views/nope/widgets/x`, payload: { widget: replacement } });
    expect(noView.json()).toEqual({ error: 'View not found' });
  });

  it('merges preferences and refuses anything but an object', async () => {
    expect((await app.inject('/api/prefs')).json()).toEqual({});
    await app.inject({ method: 'PUT', url: '/api/prefs', payload: { side: 'left', n: 1 } });
    const res = await app.inject({ method: 'PUT', url: '/api/prefs', payload: { side: 'right' } });
    expect(res.json()).toEqual({ side: 'right', n: 1 });
    for (const payload of [[1, 2], '"x"']) {
      const bad = await app.inject({ method: 'PUT', url: '/api/prefs', payload, headers: { 'content-type': 'application/json' } });
      expect(bad.statusCode).toBe(400);
    }
  });
});
