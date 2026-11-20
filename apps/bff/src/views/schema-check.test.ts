import { buildSchema, graphqlSync, getIntrospectionQuery } from 'graphql';
import { describe, expect, it } from 'vitest';
import { checkQueries, createSchemaLookup, schemaFromIntrospection, schemaSdl } from './schema-check';

const schema = buildSchema(`
  type Character { id: ID! name: String }
  type Query { characters(take: Int): [Character] }
  type Mutation { renameCharacter(id: ID!, name: String!): Character }
`);
const introspection = graphqlSync({ schema, source: getIntrospectionQuery({ descriptions: false }) });

describe('checkQueries', () => {
  it('reports unknown fields and syntax errors, and skips plugin data sources', () => {
    const issues = checkQueries(schema, {
      ok: { query: '{ characters(take: 3) { id name } }' },
      wrong: { query: '{ characters { id species } }' },
      broken: { query: '{ characters {' },
      plugin: { query: 'select 1', source: 'open-views' },
      write: { query: 'mutation { renameCharacter(id: "1", name: "x") { id } }' },
    });
    expect(issues).toHaveLength(3);
    expect(issues[2]).toMatch(/^queries\.write: must be exactly one query operation/);
    expect(issues[0]).toMatch(/^queries\.wrong: .*species/);
    expect(issues[1]).toMatch(/^queries\.broken: /);
  });
});

describe('schemaFromIntrospection', () => {
  it('builds the schema and lists the mutation fields', () => {
    const out = schemaFromIntrospection(introspection as { data?: unknown });
    expect('schema' in out && out.mutationFields).toEqual(['renameCharacter']);
  });

  it('says why when the source refused the introspection', () => {
    expect(schemaFromIntrospection({ errors: [{ message: 'depth' }] })).toEqual({ error: 'the source refused the introspection query' });
    expect(schemaFromIntrospection({ data: { nope: true } })).toEqual({ error: 'the introspection answer is not a usable schema' });
  });
});

describe('createSchemaLookup', () => {
  it('keeps a schema for the ttl and does not keep failures', async () => {
    let calls = 0;
    let fail = true;
    let t = 0;
    const lookup = createSchemaLookup(
      {
        runGraphql: async () => {
          calls++;
          return { status: 200, body: fail ? { errors: [{ message: 'no' }] } : (introspection as { data: unknown }) };
        },
      },
      1000,
      () => t,
    );
    expect(await lookup('s')).toHaveProperty('error');
    fail = false;
    expect(await lookup('s')).toHaveProperty('schema');
    await lookup('s');
    expect(calls).toBe(2);
    t = 2000;
    await lookup('s');
    expect(calls).toBe(3);
  });
});

describe('schemaSdl', () => {
  it('prints the schema and cuts it past the limit', () => {
    expect(schemaSdl(schema)).toMatchObject({ truncated: false, sdl: expect.stringContaining('type Character') });
    expect(schemaSdl(schema, 10)).toEqual({ sdl: expect.any(String), truncated: true });
    expect(schemaSdl(schema, 10).sdl).toHaveLength(10);
  });
});
