import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import type { DraftOutcome, SaveOutcome, SchemaOutcome, ViewDraftService } from '../views/draft-service';
import { viewDraftRoutes } from './view-draft';

function appWith(answers: { draft?: DraftOutcome; save?: SaveOutcome; schema?: SchemaOutcome }) {
  const service: ViewDraftService = {
    schema: async () => answers.schema ?? { kind: 'source-not-found' },
    draft: async () => answers.draft ?? { kind: 'source-not-found' },
    save: async () => answers.save ?? { kind: 'source-not-found' },
  };
  const app = Fastify();
  app.register(viewDraftRoutes, { service });
  return app;
}
const body = { sourceId: 's', concept: 'C', request: 'r', view: {} };

describe('view draft routes', () => {
  it('rejects a body with unknown fields', async () => {
    const res = await appWith({}).inject({ method: 'POST', url: '/api/views/draft', payload: { ...body, query: '{ a }' } });
    expect(res.statusCode).toBe(400);
  });

  it('maps draft outcomes to statuses', async () => {
    const post = (draft: DraftOutcome) => appWith({ draft }).inject({ method: 'POST', url: '/api/views/draft', payload: body });
    expect((await post({ kind: 'source-not-found' })).statusCode).toBe(404);
    const invalid = await post({ kind: 'invalid', issues: ['widgets.0: bad'] });
    expect([invalid.statusCode, invalid.json()]).toEqual([422, { error: 'Invalid view draft', issues: ['widgets.0: bad'] }]);
    const ok = await post({ kind: 'ok', spec: { id: 'd' } as never, data: {}, issues: [] });
    expect([ok.statusCode, ok.json()]).toEqual([200, { spec: { id: 'd' }, results: {}, issues: [] }]);
  });

  it('answers 201 with the saved row', async () => {
    const res = await appWith({ save: { kind: 'ok', view: { id: 'v', title: 'T', concept: 'C' } } }).inject({
      method: 'POST',
      url: '/api/views/from-draft',
      payload: body,
    });
    expect([res.statusCode, res.json()]).toEqual([201, { id: 'v', title: 'T', concept: 'C' }]);
  });

  it('gives the schema SDL, and 502 when it cannot be read', async () => {
    const ok = await appWith({ schema: { kind: 'ok', sdl: 'type Query', truncated: false } }).inject({ url: '/api/views/draft/schema?sourceId=s' });
    expect(ok.json()).toEqual({ sdl: 'type Query', truncated: false });
    const down = await appWith({ schema: { kind: 'unavailable', error: 'x' } }).inject({ url: '/api/views/draft/schema?sourceId=s' });
    expect(down.statusCode).toBe(502);
  });
});
