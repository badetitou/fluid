import { describe, it, expect } from 'vitest';
import { buildDefaultView, buildDetailView } from './registry';
import type { Concept, ConceptField } from '../graphql/introspection';

function field(name: string, typeName = 'String', typeKind = 'SCALAR'): ConceptField {
  return { name, description: null, typeName, typeKind, isList: false, isScalar: true };
}

function makeConcept(overrides: Partial<Concept> = {}): Concept {
  const scalarFields = overrides.scalarFields ?? [
    field('id', 'ID'),
    field('name'),
    field('balance', 'Float'),
    field('iban'),
  ];
  return {
    name: 'Account',
    description: null,
    fields: scalarFields,
    scalarFields,
    relationFields: [],
    queries: { list: { field: 'accounts' }, byId: { field: 'accountById' } },
    ...overrides,
  };
}

describe('buildDefaultView (compact list)', () => {
  it('produces a single compact table with no statistic', () => {
    const view = buildDefaultView(makeConcept())!;
    expect(view).not.toBeNull();
    expect(view.title).toBe('Account list');
    expect(view.scope).toBe('list');
    expect(view.widgets).toHaveLength(1);
    expect(view.widgets[0].type).toBe('table');
    const table = view.widgets[0] as Extract<(typeof view.widgets)[number], { type: 'table' }>;
    expect(table.pageSize).toBe(8);
    // Compact: primary + at most two more columns.
    expect(table.columns!.length).toBeLessThanOrEqual(3);
  });

  it('makes the primary column drill into the same concept', () => {
    const view = buildDefaultView(makeConcept())!;
    const table = view.widgets[0] as Extract<(typeof view.widgets)[number], { type: 'table' }>;
    expect(table.columns![0].linkTo).toEqual({ concept: 'Account', idField: 'id' });
  });

  it('does not add drill-down when the concept has no by-id query', () => {
    const view = buildDefaultView(makeConcept({ queries: { list: { field: 'accounts' } } }))!;
    const table = view.widgets[0] as Extract<(typeof view.widgets)[number], { type: 'table' }>;
    expect(table.columns![0].linkTo).toBeUndefined();
  });

  it('returns null without a list query', () => {
    expect(buildDefaultView(makeConcept({ queries: {} }))).toBeNull();
  });
});

describe('buildDetailView', () => {
  it('binds a descriptions widget to the by-id query', () => {
    const view = buildDetailView(makeConcept())!;
    expect(view).not.toBeNull();
    expect(view.title).toBe('Account detail');
    expect(view.scope).toBe('detail');
    expect(view.widgets[0].type).toBe('descriptions');
    expect(view.widgets[0].data.query).toBe('accountById');
    expect(view.queries.accountById).toBeDefined();
  });

  it('returns null without a by-id query', () => {
    expect(buildDetailView(makeConcept({ queries: { list: { field: 'accounts' } } }))).toBeNull();
  });
  describe('with related concepts', () => {
    const relation = (name: string, typeName: string, isList = false): ConceptField => ({
      name,
      description: null,
      typeName,
      typeKind: 'OBJECT',
      isList,
      isScalar: false,
    });
    const character = makeConcept({
      name: 'Character',
      scalarFields: [field('id', 'ID'), field('name')],
      relationFields: [
        relation('origin', 'Location'),
        relation('episode', 'Episode', true),
        relation('stats', 'Stats'),
        { ...relation('friends', 'Character', true), hasRequiredArgs: true },
      ],
      queries: { byId: { field: 'character' } },
    });
    const related = {
      conceptByName: new Map<string, Concept>([
        ['Location', makeConcept({ name: 'Location', scalarFields: [field('id', 'ID'), field('name')] })],
        [
          'Episode',
          makeConcept({
            name: 'Episode',
            scalarFields: [field('id', 'ID'), field('name'), field('episode'), field('air_date')],
          }),
        ],
        ['Stats', makeConcept({ name: 'Stats', scalarFields: [field('score', 'Int')] })],
        ['Character', character],
      ]),
      queriesByType: new Map([
        ['Location', { byId: { field: 'location' } }],
        ['Episode', { byId: { field: 'episode' } }],
        ['Character', { byId: { field: 'character' } }],
      ]),
    };

    it('lists single relations in the descriptions, linking navigable ones', () => {
      const view = buildDetailView(character, related)!;
      const detail = view.widgets[0];
      if (detail.type !== 'descriptions') throw new Error('expected descriptions');
      const origin = detail.items.find((i) => i.key === 'origin.name');
      expect(origin?.linkTo).toEqual({ concept: 'Location', idField: 'origin.id' });
      // Stats has no id nor by-id query: shown, but not a link.
      const stats = detail.items.find((i) => i.key === 'stats.score');
      expect(stats).toBeDefined();
      expect(stats?.linkTo).toBeUndefined();
    });

    it('gives each list relation a table whose rows link to the target', () => {
      const view = buildDetailView(character, related)!;
      const table = view.widgets.find((w) => w.id === 'rel-episode');
      if (table?.type !== 'table') throw new Error('expected a table');
      expect(table.data).toEqual({ query: 'character', path: 'character.episode' });
      expect(table.columns?.map((c) => c.key)).toEqual(['name', 'episode']);
      expect(table.columns?.[0].linkTo).toEqual({ concept: 'Episode', idField: 'id' });
    });

    it('selects the relations in the by-id query, skipping fields with required args', () => {
      const query = buildDetailView(character, related)!.queries.character.query;
      expect(query).toContain('origin { id name }');
      expect(query).toContain('episode { id name episode }');
      expect(query).toContain('stats { score }');
      expect(query).not.toContain('friends');
    });
  });
});

describe('buildDefaultView with a paginated list query', () => {
  it('reads rows through the wrapper and omits the unsupported limit', () => {
    const view = buildDefaultView(
      makeConcept({ queries: { list: { field: 'characters', itemsPath: 'results' } } }),
    )!;
    const rows = view.queries.rows;
    expect(rows.query).toContain('characters {');
    expect(rows.query).toContain('results {');
    expect(rows.query).not.toContain('$take');
    expect(rows.variables).toEqual({});
    expect(view.widgets[0].data.path).toBe('characters.results');
  });
});
