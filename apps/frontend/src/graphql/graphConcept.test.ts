import { describe, expect, it } from 'vitest';
import { GRAPH_CONCEPT } from '@fluid/shared';
import { buildGraphConcept } from './graphConcept';
import type { IntrospectionType } from './introspectionTypes';

const ID_REQUIRED = { kind: 'NON_NULL', name: null, ofType: { kind: 'SCALAR', name: 'ID' } };
const rootType: IntrospectionType = {
  kind: 'OBJECT',
  name: 'Query',
  description: null,
  fields: [
    { name: 'character', description: null, args: [{ name: 'id', type: ID_REQUIRED }], type: { kind: 'OBJECT', name: 'Character', ofType: null } },
    { name: 'characters', description: null, args: [], type: { kind: 'OBJECT', name: 'Characters', ofType: null } },
  ],
};

describe('buildGraphConcept', () => {
  it('exposes the root query fields as relations of the graph pseudo-concept', () => {
    const graph = buildGraphConcept(rootType);
    expect(graph?.name).toBe(GRAPH_CONCEPT);
    expect(graph?.relationFields.map((f) => [f.name, f.typeName, f.hasRequiredArgs])).toEqual([
      ['character', 'Character', true],
      ['characters', 'Characters', false],
    ]);
    expect(graph?.queries).toEqual({});
  });

  it('is absent until the root type is known', () => {
    expect(buildGraphConcept(null)).toBeNull();
  });
});
