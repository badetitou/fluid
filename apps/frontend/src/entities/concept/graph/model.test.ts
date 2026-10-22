import { describe, expect, it } from 'vitest';
import type { Concept, ConceptField } from '../../../graphql/introspectionTypes';
import { joinPath, layoutGraph, splitPath, typeLabel, walkSchema } from './model';

const field = (name: string, typeName: string, extra: Partial<ConceptField> = {}): ConceptField => ({
  name,
  description: null,
  typeName,
  typeKind: extra.isScalar ? 'SCALAR' : 'OBJECT',
  isList: false,
  isScalar: false,
  ...extra,
});

const concept = (name: string, fields: ConceptField[]): Concept => ({
  name,
  description: null,
  fields,
  scalarFields: fields.filter((f) => f.isScalar),
  relationFields: fields.filter((f) => !f.isScalar),
  queries: {},
});

// Shaped like https://rickandmortyapi.com/graphql.
const schema = new Map<string, Concept>([
  ['@graph', concept('@graph', [field('character', 'Character'), field('characters', 'Characters')])],
  ['Characters', concept('Characters', [field('results', 'Character', { isList: true })])],
  [
    'Character',
    concept('Character', [
      field('name', 'String', { isScalar: true }),
      field('origin', 'Location'),
      field('episode', 'Episode', { isList: true }),
    ]),
  ],
  ['Location', concept('Location', [field('name', 'String', { isScalar: true })])],
]);
const lookup = (name: string) => schema.get(name);

describe('splitPath / joinPath', () => {
  it('round-trips dot paths, empty included', () => {
    expect(splitPath('characters.results')).toEqual(['characters', 'results']);
    expect(splitPath(undefined)).toEqual([]);
    expect(joinPath(splitPath('a.b.c'))).toBe('a.b.c');
  });
});

describe('walkSchema', () => {
  it('follows relations to the focused concept', () => {
    expect(walkSchema('@graph', ['characters', 'results'], lookup)).toEqual({
      types: ['@graph', 'Characters', 'Character'],
      walked: ['characters', 'results'],
      loading: false,
      unresolved: [],
    });
  });

  it('ends on a property as the leaf', () => {
    const walk = walkSchema('@graph', splitPath('character.origin.name'), lookup);
    expect(walk.types).toEqual(['@graph', 'Character', 'Location']);
    expect(walk.leaf).toBe('name');
  });

  it('waits for a concept not introspected yet', () => {
    const walk = walkSchema('@graph', ['character', 'episode', 'name'], lookup);
    expect(walk).toMatchObject({ types: ['@graph', 'Character', 'Episode'], walked: ['character', 'episode'], loading: true });
  });

  it('reports segments matching no field (aliases, typos)', () => {
    const walk = walkSchema('@graph', ['character', 'nope', 'name'], lookup);
    expect(walk).toMatchObject({ walked: ['character'], unresolved: ['nope', 'name'], loading: false });
    expect(walk.leaf).toBeUndefined();
  });

  it('does not take a property in the middle of a path as a leaf', () => {
    expect(walkSchema('@graph', ['character', 'name', 'x'], lookup).unresolved).toEqual(['name', 'x']);
  });
});

describe('layoutGraph', () => {
  const character = schema.get('Character')!;

  it('puts relations on the right and properties on the left', () => {
    const layout = layoutGraph(character, '', { width: 400 });
    const sides = Object.fromEntries(layout.nodes.map((n) => [n.field.name, n.side]));
    expect(sides).toEqual({ origin: 'right', episode: 'right', name: 'left' });
    for (const node of layout.nodes) {
      expect(node.side === 'right' ? node.x > layout.center.x : node.x < layout.center.x).toBe(true);
    }
  });

  it('filters fields by name or type', () => {
    expect(layoutGraph(character, 'epis', { width: 400 }).nodes.map((n) => n.field.name)).toEqual(['episode']);
    expect(layoutGraph(character, 'location', { width: 400 }).nodes.map((n) => n.field.name)).toEqual(['origin']);
  });

  it('caps each side and counts what is hidden', () => {
    const many = concept('Many', Array.from({ length: 5 }, (_, i) => field(`f${i}`, 'Int', { isScalar: true })));
    const layout = layoutGraph(many, '', { width: 400, maxPerSide: 3 });
    expect(layout.nodes).toHaveLength(3);
    expect(layout.hidden).toBe(2);
  });

  it('grows taller with the number of rows', () => {
    const many = concept('Many', Array.from({ length: 12 }, (_, i) => field(`f${i}`, 'Int', { isScalar: true })));
    expect(layoutGraph(many, '', { width: 400 }).height).toBeGreaterThan(layoutGraph(character, '', { width: 400 }).height);
  });
});

describe('typeLabel', () => {
  it('brackets lists', () => {
    expect(typeLabel(field('episode', 'Episode', { isList: true }))).toBe('[Episode]');
    expect(typeLabel(field('origin', 'Location'))).toBe('Location');
  });
});

describe('layoutGraph spacing', () => {
  it('keeps a few nodes close to the center rather than at the far ends', () => {
    const many = concept('Many', [
      ...Array.from({ length: 10 }, (_, i) => field(`p${i}`, 'Int', { isScalar: true })),
      field('a', 'A'),
      field('b', 'B'),
    ]);
    const layout = layoutGraph(many, '', { width: 400, rowHeight: 30 });
    const [a, b] = layout.nodes.filter((n) => n.kind === 'relation');
    expect(Math.abs(b.y - a.y)).toBeCloseTo(30, 0);
  });
});
