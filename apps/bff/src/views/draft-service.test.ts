import { buildSchema } from 'graphql';
import { describe, expect, it } from 'vitest';
import type { ViewSpec } from '@fluid/shared';
import { createViewDraftService } from './draft-service';
import type { SchemaLookup } from './schema-check';

const schema = buildSchema('type Character { id: ID! name: String } type Query { characters(take: Int): [Character] }');
const table = { id: 'chars', type: 'table', title: 'Characters', data: { query: 'list', path: 'characters' }, columns: [{ key: 'name', title: 'Name' }] };
const draft = (query = 'query($take: Int) { characters(take: $take) { id name } }', widgets: unknown[] = [table]) => ({
  title: 'Characters',
  queries: { list: { query } },
  widgets,
});
const base = { sourceId: 's', concept: 'Character', request: 'show me the characters' };

function setup(schemas: SchemaLookup = async () => ({ schema, mutationFields: [] })) {
  const ran: ViewSpec[] = [];
  const saved: ViewSpec[] = [];
  const service = createViewDraftService({
    sources: { get: async (id) => (id === 's' ? ({ id } as never) : null) },
    schemas,
    runs: {
      runSpec: async (spec) => {
        ran.push(spec);
        return { kind: 'ok', results: { list: { data: { characters: [{ id: '1', name: 'Rick' }] } } } };
      },
    },
    writer: {
      create: async (spec) => {
        saved.push(spec);
        return { id: 'row1', title: spec.title, concept: spec.concept };
      },
    },
  });
  return { service, ran, saved };
}

describe('view draft service', () => {
  it('finalizes a valid draft with the request as intent, runs it and returns its data', async () => {
    const { service, ran } = setup();
    const out = await service.draft({ ...base, scope: 'list', view: draft() });
    expect(out).toMatchObject({ kind: 'ok', issues: [], data: { list: { data: { characters: [{ name: 'Rick' }] } } } });
    expect(ran[0]).toMatchObject({ concept: 'Character', scope: 'list', intent: 'show me the characters', id: expect.stringMatching(/^draft-/) });
  });

  it('refuses a draft the assistant validation rejects, without running it', async () => {
    const { service, ran } = setup();
    const out = await service.draft({ ...base, view: draft(undefined, [{ ...table, type: 'network' }]) });
    expect(out.kind).toBe('invalid');
    expect(ran).toHaveLength(0);
  });

  it('runs a draft whose queries the schema rejects, and reports them', async () => {
    const { service } = setup();
    const out = await service.draft({ ...base, view: draft('{ characters { species } }') });
    expect(out.kind === 'ok' && out.issues[0]).toMatch(/queries\.list: .*species/);
  });

  it('notes an unreadable schema without blocking', async () => {
    const { service, saved } = setup(async () => ({ error: 'nope' }));
    const out = await service.draft({ ...base, view: draft() });
    expect(out.kind === 'ok' && out.issues).toEqual([expect.stringContaining('could not be read (nope)')]);
    expect((await service.save({ ...base, view: draft() })).kind).toBe('ok');
    expect(saved).toHaveLength(1);
  });

  it('answers source-not-found for an unknown source', async () => {
    const { service } = setup();
    expect(await service.draft({ ...base, sourceId: 'x', view: draft() })).toEqual({ kind: 'source-not-found' });
  });

  it('saves a valid draft with its intent, and refuses one whose queries the schema rejects', async () => {
    const { service, saved } = setup();
    expect(await service.save({ ...base, view: draft() })).toEqual({ kind: 'ok', view: { id: 'row1', title: 'Characters', concept: 'Character' } });
    expect(saved[0]).toMatchObject({ intent: 'show me the characters', id: expect.stringMatching(/^mcp-/) });
    expect((await service.save({ ...base, view: draft('{ nope }') })).kind).toBe('invalid');
    expect(saved).toHaveLength(1);
  });

  it('gives the source schema as SDL, or why it cannot', async () => {
    expect(await setup().service.schema('s')).toMatchObject({ kind: 'ok', truncated: false, sdl: expect.stringContaining('characters(take: Int)') });
    expect(await setup(async () => ({ error: 'nope' })).service.schema('s')).toEqual({ kind: 'unavailable', error: 'nope' });
    expect(await setup().service.schema('x')).toEqual({ kind: 'source-not-found' });
  });
});
