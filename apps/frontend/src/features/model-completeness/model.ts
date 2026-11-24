import { z } from 'zod';

/** `analysis.metrics.relationsByProvenance`, as Model serialises it (snake_case keys). */
export const provenanceCountsSchema = z.record(z.string(), z.number().int().nonnegative());

export type ProvenanceCounts = Record<string, number>;

const sum = (counts: ProvenanceCounts, keys: string[]): number =>
  keys.reduce((total, key) => total + (counts[key] ?? 0), 0);

/**
 * True when a Model has syntax-only relations and no SCIP-resolved one. The browser and GitHub
 * sources run Model without an indexer, so those relations are best effort. A model with no
 * relations says nothing about SCIP: don't warn in that case.
 */
export function isSyntacticOnly(counts: ProvenanceCounts): boolean {
  return sum(counts, ['tree_sitter', 'TREE_SITTER']) > 0 && sum(counts, ['scip', 'SCIP']) === 0;
}
