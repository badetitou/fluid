import { useMemo } from 'react';
import { mapExchange, type Exchange } from 'urql';
import { useConnection } from '../../store';
import { useAuthRequired } from './authRequired';
import { authRequiredOf } from './oauth';
import { useSavedSources } from './store';

/** The BFF config id of the connected source, when it is routed through the BFF. */
export function useCurrentBffSourceId(): string | undefined {
  const url = useConnection((s) => s.graphqlUrl);
  return useSavedSources((s) => (url ? s.saved.find((x) => x.url === url)?.bffSourceId : undefined));
}

/** Watches the answers of a source for the BFF's "sign in again" error, and tells the store. */
const authRequiredExchange = (sourceId: string): Exchange =>
  mapExchange({
    onResult(result) {
      const auth = authRequiredOf(result.error?.graphQLErrors);
      const store = useAuthRequired.getState();
      if (auth) store.report(sourceId, auth);
      else if (result.data) store.clear(sourceId);
      return result;
    },
  });

/**
 * What the GraphQL client of the connected source needs to ask for a reconnection: an exchange
 * (only for a source routed through the BFF) and a counter that changes when the user signed in
 * again, so that the client is rebuilt and the queries run anew.
 */
export function useSourceAuthClient(): { exchange: Exchange | null; epoch: number } {
  const id = useCurrentBffSourceId();
  const epoch = useAuthRequired((s) => (id ? (s.epoch[id] ?? 0) : 0));
  const exchange = useMemo(() => (id ? authRequiredExchange(id) : null), [id]);
  return { exchange, epoch };
}
