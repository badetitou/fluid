import { describe, expect, it } from 'vitest';
import type { Concept, ConceptQueries } from '../../../../graphql/introspection';
import { MODEL_QUERIES } from './fixtures';
import { looksLikeModel, modelLookup } from './detect';

const concept = (name: string, interfaces?: string[]): Concept =>
  ({ name, description: null, fields: [], scalarFields: [], relationFields: [], queries: {}, interfaces }) as Concept;

describe('Model schema detection', () => {
  it('recognises the by-key lookups of a Model source', () => {
    expect(looksLikeModel(MODEL_QUERIES)).toBe(true);
  });

  it('ignores other sources, even with Class and Method concepts', () => {
    const moose = new Map<string, ConceptQueries>([
      ['Class', { byId: { field: 'class' } }],
      ['Method', { byId: { field: 'method' } }],
      ['Namespace', { byId: { field: 'namespace' } }],
    ]);
    expect(looksLikeModel(moose)).toBe(false);
    expect(looksLikeModel(new Map())).toBe(false);
  });

  it('needs every lookup, keyed by "key"', () => {
    const withoutMethods = new Map(MODEL_QUERIES);
    withoutMethods.delete('Method');
    expect(looksLikeModel(withoutMethods)).toBe(false);
    const byId = new Map(MODEL_QUERIES).set('Class', { byId: { field: 'classByKey' } });
    expect(looksLikeModel(byId)).toBe(false);
  });

  it('finds the by-key lookup of a Model entity concept', () => {
    expect(modelLookup(concept('Class', ['Entity']), MODEL_QUERIES)).toBe('classByKey');
    expect(modelLookup(concept('Method'), MODEL_QUERIES)).toBe('methodByKey');
    expect(modelLookup(concept('Class', ['Node']), MODEL_QUERIES)).toBeUndefined();
    expect(modelLookup(concept('Relation'), MODEL_QUERIES)).toBeUndefined();
  });
});
