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
});
