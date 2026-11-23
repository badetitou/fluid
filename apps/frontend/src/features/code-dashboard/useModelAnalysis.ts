import { useEffect, useState } from 'react';
import { useClient } from 'urql';
import { toArchitecture, type Architecture } from './analysisModel';
import { ANALYSIS_QUERY, analysisSchema } from './analysisSchema';

export type ArchitectureState =
  | { status: 'loading' }
  | { status: 'ready'; architecture: Architecture }
  /** The source has no analysis fields (a Model server older than them, or not a Model server). */
  | { status: 'unavailable' };

/** Reads what Model's `Query.analysis` finds in the connected source. */
export function useModelAnalysis(): ArchitectureState {
  const client = useClient();
  const [state, setState] = useState<ArchitectureState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    client
      .query(ANALYSIS_QUERY, {})
      .toPromise()
      .then((result) => {
        if (cancelled) return;
        const parsed = analysisSchema.safeParse(result.data);
        setState(parsed.success ? { status: 'ready', architecture: toArchitecture(parsed.data.analysis) } : { status: 'unavailable' });
      })
      .catch(() => !cancelled && setState({ status: 'unavailable' }));
    return () => {
      cancelled = true;
    };
  }, [client]);

  return state;
}
