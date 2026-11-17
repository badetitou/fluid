import { useCallback, useEffect, useState } from 'react';
import type { AnalyzeViewRequest, InsightAnalysis } from '@fluid/shared';
import { useInsightAnalyzer } from '../../plugin-api/insightContext';
import { insightKey } from './insightModel';

export type InsightState =
  | { status: 'empty' }
  | { status: 'unavailable' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'done'; analysis: InsightAnalysis };

// Analyses already made, by request: a view shown again (another column, back
// navigation, a re-render) does not ask the model again for the same data.
const cache = new Map<string, InsightAnalysis>();
const MAX_CACHED = 50;

function remember(key: string, analysis: InsightAnalysis) {
  cache.set(key, analysis);
  if (cache.size > MAX_CACHED) cache.delete(cache.keys().next().value!);
}

/** Clears the remembered analyses (tests). */
export const clearInsightCache = () => cache.clear();

/**
 * Runs the analysis of `request` once its data is there, and again when it
 * changes. `refresh` asks the model again, bypassing what it remembered.
 */
export function useInsight(request: AnalyzeViewRequest | null): { state: InsightState; refresh: () => void } {
  const analyze = useInsightAnalyzer();
  const key = request ? insightKey(request) : null;
  const [round, setRound] = useState(0);
  const [state, setState] = useState<InsightState>({ status: 'loading' });

  useEffect(() => {
    if (!request || !key) return setState({ status: 'empty' });
    if (!analyze) return setState({ status: 'unavailable' });
    const known = cache.get(key);
    if (known) return setState({ status: 'done', analysis: known });
    const controller = new AbortController();
    setState({ status: 'loading' });
    analyze(request, controller.signal).then(
      (analysis) => {
        remember(key, analysis);
        if (!controller.signal.aborted) setState({ status: 'done', analysis });
      },
      (err: unknown) => {
        if (!controller.signal.aborted) setState({ status: 'error', message: (err as Error).message });
      },
    );
    return () => controller.abort();
    // `request` is identified by `key`: a new object with the same data is the same request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, analyze, round]);

  const refresh = useCallback(() => {
    if (key) cache.delete(key);
    setRound((r) => r + 1);
  }, [key]);

  return { state, refresh };
}
