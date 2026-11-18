import { useMemo } from 'react';
import { mapExchange, type Exchange } from 'urql';
import { useConnection } from '../../store';
import { useAuthRequired } from './authRequired';
import { browserAuthExchange } from './browserOAuth/exchange';
import { browserAuthKey } from './browserOAuth/model';
import { useBrowserOAuthSettings } from './browserOAuth/store';
import { authRequiredOf } from './oauth';
import { useSavedSources } from './store';

/** The BFF config id of the connected source, when it is routed through the BFF. */
export function useCurrentBffSourceId(): string | undefined {
  const url = useConnection((s) => s.graphqlUrl);
  return useSavedSources((s) => (url ? s.saved.find((x) => x.url === url)?.bffSourceId : undefined));
}

/**
 * Watches the answers of a source for the BFF's "sign in again" error, and tells the store.
 * An answer that reaches an exchange of an older epoch (the user signed in since) is ignored.
 */
export const authRequiredExchange = (sourceId: string, epoch: number): Exchange =>
  mapExchange({
    onResult(result) {
      const store = useAuthRequired.getState();
      if ((store.epoch[sourceId] ?? 0) !== epoch) return result;
      const auth = authRequiredOf(result.error?.graphQLErrors);
      if (auth) store.report(sourceId, auth, String(result.operation.key));
      else if (result.data) store.succeeded(sourceId, String(result.operation.key));
      return result;
    },
  });

/**
 * The source URL of the connected source when it is signed in to from the page (no BFF, browser
 * OAuth settings kept for it); routing through the BFF wins.
 */
export function useCurrentBrowserAuthUrl(): string | undefined {
  const url = useConnection((s) => s.graphqlUrl);
  const routed = useCurrentBffSourceId() !== undefined;
  const configured = useBrowserOAuthSettings((s) => (url ? url in s.byUrl : false));
  return url && !routed && configured ? url : undefined;
}

/**
 * The exchange the GraphQL client of the connected source needs to sign in and to ask for a
 * reconnection: the BFF's when it is routed through it, the page's own for browser OAuth, else
 * `null`. It is a new one each time the user signed in again or out, so that the client built
 * with it is new too and the queries run anew.
 */
export function useSourceAuthClient(): Exchange | null {
  const id = useCurrentBffSourceId();
  const browserUrl = useCurrentBrowserAuthUrl();
  const key = id ?? (browserUrl ? browserAuthKey(browserUrl) : undefined);
  const epoch = useAuthRequired((s) => (key ? (s.epoch[key] ?? 0) : 0));
  return useMemo(() => {
    if (id) return authRequiredExchange(id, epoch);
    return browserUrl ? browserAuthExchange(browserUrl, epoch) : null;
  }, [id, browserUrl, epoch]);
}
