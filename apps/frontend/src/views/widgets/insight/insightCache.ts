import type { InsightAnalysis } from '@fluid/shared';

// Analyses already made, so that a view shown again (another column, back
// navigation, a re-render) does not ask the model again for the same data.
// An entry belongs to one analyser: the app hands a new analyser when the LLM
// settings change (provider, model…), whose analyses are made anew.

export const MAX_CACHED = 50;

export interface InsightCache {
  get: (key: string) => InsightAnalysis | undefined;
  set: (key: string, analysis: InsightAnalysis) => void;
  delete: (key: string) => void;
  clear: () => void;
}

/** A cache of at most `max` analyses, the least recently used dropped first. */
export function createInsightCache(max = MAX_CACHED): InsightCache {
  const entries = new Map<string, InsightAnalysis>();
  return {
    get: (key) => {
      const hit = entries.get(key);
      if (hit) {
        entries.delete(key);
        entries.set(key, hit);
      }
      return hit;
    },
    set: (key, analysis) => {
      entries.delete(key);
      entries.set(key, analysis);
      if (entries.size > max) entries.delete(entries.keys().next().value!);
    },
    delete: (key) => void entries.delete(key),
    clear: () => entries.clear(),
  };
}

const ids = new WeakMap<object, number>();
let nextId = 0;

/** A number identifying `analyzer` for as long as it lives. */
function analyzerId(analyzer: object): number {
  let id = ids.get(analyzer);
  if (id === undefined) ids.set(analyzer, (id = nextId++));
  return id;
}

/** The cache key of a request analysed by `analyzer`. */
export const cacheKey = (analyzer: object, requestKey: string): string => `${analyzerId(analyzer)}|${requestKey}`;
