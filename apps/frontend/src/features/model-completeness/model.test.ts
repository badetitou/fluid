import { describe, expect, it } from 'vitest';
import { isSyntacticOnly, provenanceCountsSchema } from './model';

describe('isSyntacticOnly', () => {
  it('flags a model whose relations only come from tree-sitter', () => {
    const counts = provenanceCountsSchema.parse({ tree_sitter: 12, derived: 3 });
    expect(isSyntacticOnly(counts)).toBe(true);
  });

  it('does not flag a model with at least one SCIP-resolved relation', () => {
    expect(isSyntacticOnly({ tree_sitter: 12, scip: 1 })).toBe(false);
  });

  it('does not flag an empty or non-syntactic model', () => {
    expect(isSyntacticOnly({})).toBe(false);
    expect(isSyntacticOnly({ frontend: 9 })).toBe(false);
  });

  it('accepts GraphQL enum-style keys as well', () => {
    expect(isSyntacticOnly({ TREE_SITTER: 2, SCIP: 0 })).toBe(true);
  });
});
