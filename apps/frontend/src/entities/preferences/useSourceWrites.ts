import { useCallback, useState } from 'react';
import { bffClient } from '../../bff/client';
import { useConnection, useWritableSources } from '../../store';
import { useSavedSources } from '../source/store';

export interface SourceWrites {
  writable: boolean;
  setWritable: (writable: boolean) => void;
  /** Set when the BFF did not take the change (the source is routed through it). */
  syncError: string | null;
}

/**
 * Whether the connected source accepts writes from fluid, and how to change it. A source routed
 * through the BFF also gets the setting there: it is what the BFF checks before running a view
 * action for an MCP host.
 */
export function useSourceWrites(): SourceWrites {
  const graphqlUrl = useConnection((s) => s.graphqlUrl);
  const writable = useWritableSources((s) => (graphqlUrl ? s.byUrl[graphqlUrl] === true : false));
  const set = useWritableSources((s) => s.setWritable);
  const bffId = useSavedSources((s) => s.saved.find((x) => x.url === graphqlUrl)?.bffSourceId);
  const [syncError, setSyncError] = useState<string | null>(null);
  const setWritable = useCallback(
    (on: boolean) => {
      if (!graphqlUrl) return;
      set(graphqlUrl, on);
      setSyncError(null);
      if (!bffId) return;
      bffClient.sources.update(bffId, { allowWrites: on }).catch((err: unknown) => {
        setSyncError(`The BFF did not take the change: ${err instanceof Error ? err.message : 'no answer'}`);
      });
    },
    [graphqlUrl, set, bffId],
  );
  return { writable, setWritable, syncError };
}
