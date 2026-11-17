import { describe, it, expect } from 'vitest';
import {
  buildConcept,
  buildRootQueries,
  buildWrapperTypesQuery,
  findWrapperCandidates,
  sourceOffsetArg,
  type IntrospectionType,
} from './introspection';

// Shaped like the shallow `__type` results of https://rickandmortyapi.com/graphql.
const ID_REQUIRED = { kind: 'NON_NULL', name: null };
const INT = { kind: 'SCALAR', name: 'Int' };

const queryType: IntrospectionType = {
  kind: 'OBJECT',
  name: 'Query',
  description: null,
  fields: [
    { name: 'character', description: null, args: [{ name: 'id', type: ID_REQUIRED }], type: { kind: 'OBJECT', name: 'Character', ofType: null } },
    { name: 'characters', description: null, args: [{ name: 'page', type: INT }], type: { kind: 'OBJECT', name: 'Characters', ofType: null } },
    { name: 'charactersByIds', description: null, args: [{ name: 'ids', type: ID_REQUIRED }], type: { kind: 'LIST', name: null, ofType: { kind: 'OBJECT', name: 'Character' } } },
    { name: 'accounts', description: null, args: [{ name: 'take', type: INT }], type: { kind: 'LIST', name: null, ofType: { kind: 'OBJECT', name: 'Account' } } },
    { name: 'version', description: null, args: [], type: { kind: 'SCALAR', name: 'String', ofType: null } },
  ],
};

const charactersWrapper: IntrospectionType = {
  kind: 'OBJECT',
  name: 'Characters',
  description: null,
  fields: [
    { name: 'info', description: null, args: [], type: { kind: 'OBJECT', name: 'Info', ofType: null } },
    { name: 'results', description: null, args: [], type: { kind: 'LIST', name: null, ofType: { kind: 'OBJECT', name: 'Character' } } },
  ],
};

describe('findWrapperCandidates', () => {
  it('only keeps single objects callable without id or required args', () => {
    expect([...findWrapperCandidates(queryType).entries()]).toEqual([['Characters', 'characters']]);
  });
});

describe('buildWrapperTypesQuery', () => {
  it('aliases one __type per wrapper and is skipped when there is none', () => {
    const q = buildWrapperTypesQuery(['Characters', 'Episodes'])!;
    expect(q).toContain('t0: __type(name: "Characters")');
    expect(q).toContain('t1: __type(name: "Episodes")');
    expect(buildWrapperTypesQuery([])).toBeNull();
  });
});

describe('sourceOffsetArg', () => {
  it('finds the offset argument of the lists that have a row limit', () => {
    const paged: IntrospectionType = {
      ...queryType,
      fields: [
        { name: 'methods', description: null, args: [{ name: 'take', type: INT }, { name: 'skip', type: INT }], type: { kind: 'LIST', name: null, ofType: { kind: 'OBJECT', name: 'Method' } } },
      ],
    };
    const { queriesByType } = buildRootQueries(paged);
    expect(queriesByType.get('Method')).toEqual({ list: { field: 'methods', limitArg: 'take', offsetArg: 'skip' } });
    expect(sourceOffsetArg(queriesByType)).toBe('skip');
    expect(sourceOffsetArg(buildRootQueries(queryType).queriesByType)).toBeUndefined();
  });
});

describe('buildRootQueries', () => {
  it('maps by-id fields and plain lists, ignoring lists that need arguments', () => {
    const { queriesByType } = buildRootQueries(queryType);
    expect(queriesByType.get('Character')).toEqual({ byId: { field: 'character' } });
    expect(queriesByType.get('Account')).toEqual({ list: { field: 'accounts', limitArg: 'take' } });
    // Not introspected yet: the wrapper is still listed as a concept of its own.
    expect(queriesByType.has('Characters')).toBe(true);
  });

  it('turns a pagination wrapper into the list query of its item type', () => {
    const { queriesByType, wrapperTypes } = buildRootQueries(
      queryType,
      new Map([['Characters', charactersWrapper]]),
    );
    expect(queriesByType.get('Character')).toEqual({
      byId: { field: 'character' },
      list: { field: 'characters', itemsPath: 'results', limitArg: undefined },
    });
    expect(queriesByType.has('Characters')).toBe(false);
    expect([...wrapperTypes]).toEqual(['Characters']);
  });

  it('returns no concept when the root type is not loaded', () => {
    expect(buildRootQueries(null).queriesByType.size).toBe(0);
  });
});

describe('buildConcept', () => {
  it('splits scalar fields from relations and ignores unresolved wrapper types', () => {
    const concept = buildConcept(
      {
        kind: 'OBJECT',
        name: 'Character',
        description: null,
        fields: [
          { name: 'id', description: null, args: [], type: { kind: 'SCALAR', name: 'ID', ofType: null } },
          { name: 'origin', description: null, args: [], type: { kind: 'OBJECT', name: 'Location', ofType: null } },
          { name: 'episode', description: null, args: [], type: { kind: 'LIST', name: null, ofType: { kind: 'OBJECT', name: 'Episode' } } },
          // `[X!]!` is deeper than the shallow introspection resolves.
          { name: 'tags', description: null, args: [], type: { kind: 'NON_NULL', name: null, ofType: { kind: 'LIST', name: null } } },
        ],
      },
      { byId: { field: 'character' } },
    )!;
    expect(concept.scalarFields.map((f) => f.name)).toEqual(['id']);
    expect(concept.relationFields.map((f) => `${f.name}:${f.typeName}:${f.isList}`)).toEqual([
      'origin:Location:false',
      'episode:Episode:true',
    ]);
    expect(concept.fields).toHaveLength(4);
    expect(concept.queries).toEqual({ byId: { field: 'character' } });
  });

  it('rejects non-object and root types', () => {
    expect(buildConcept({ kind: 'SCALAR', name: 'String', description: null, fields: null })).toBeNull();
    expect(buildConcept({ kind: 'OBJECT', name: 'Query', description: null, fields: [] })).toBeNull();
    expect(buildConcept(null)).toBeNull();
  });
});

// Shaped like a Moose model server: traits and superclasses are interfaces.
describe('interfaces', () => {
  const list = (kind: string, name: string) => ({
    kind: 'NON_NULL',
    name: null,
    ofType: { kind: 'LIST', name: null, ofType: { kind: 'NON_NULL', name: null, ofType: { kind, name } } },
  });
  const mooseRoot: IntrospectionType = {
    kind: 'OBJECT',
    name: 'Query',
    description: null,
    fields: [
      { name: 'classes', description: null, args: [{ name: 'take', type: INT }], type: list('OBJECT', 'Class') },
      { name: 'class', description: null, args: [{ name: 'id', type: ID_REQUIRED }], type: { kind: 'OBJECT', name: 'Class', ofType: null } },
      { name: 'namedEntities', description: null, args: [{ name: 'take', type: INT }], type: list('INTERFACE', 'NamedEntity') },
      { name: 'namedEntity', description: null, args: [{ name: 'id', type: ID_REQUIRED }], type: { kind: 'INTERFACE', name: 'NamedEntity', ofType: null } },
      { name: 'rootEntities', description: null, args: [{ name: 'take', type: INT }], type: list('INTERFACE', 'MooseEntity') },
    ],
  };

  it('lists interface root fields as concepts', () => {
    const { queriesByType } = buildRootQueries(mooseRoot);
    expect(queriesByType.get('NamedEntity')).toEqual({
      list: { field: 'namedEntities', limitArg: 'take' },
      byId: { field: 'namedEntity', idType: undefined },
    });
    expect(queriesByType.get('MooseEntity')).toEqual({ list: { field: 'rootEntities', limitArg: 'take' } });
    expect(queriesByType.has('Class')).toBe(true);
  });

  it('builds an interface concept with its concrete types, and an object with its supertypes', () => {
    const iface = buildConcept({
      kind: 'INTERFACE',
      name: 'MooseEntity',
      description: null,
      interfaces: [],
      possibleTypes: [{ name: 'Class' }, { name: 'Method' }],
      fields: [
        { name: 'id', description: null, args: [], type: { kind: 'SCALAR', name: 'ID', ofType: null } },
        { name: 'children', description: null, args: [{ name: 'take', type: INT }], type: list('INTERFACE', 'MooseEntity') },
      ],
    })!;
    expect(iface.possibleTypes).toEqual(['Class', 'Method']);
    expect(iface.relationFields.map((f) => `${f.name}:${f.typeName}:${f.typeKind}`)).toEqual(['children:MooseEntity:INTERFACE']);

    const cls = buildConcept({
      kind: 'OBJECT',
      name: 'Class',
      description: null,
      interfaces: [{ name: 'MooseEntity' }, { name: 'NamedEntity' }],
      possibleTypes: null,
      fields: [],
    })!;
    expect(cls.possibleTypes).toBeUndefined();
    expect(cls.interfaces).toEqual(['MooseEntity', 'NamedEntity']);
  });
});

