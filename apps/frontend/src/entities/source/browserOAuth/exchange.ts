import { makeOperation, mapExchange, type Exchange, type Operation } from 'urql';
import { useAuthRequired } from '../authRequired';
import { browserAuthKey, tokenUsable } from './model';
import { useBrowserOAuthSettings, useBrowserTokens } from './store';

/** The operation with the source's access token as a Bearer header, when it is sent to that source. */
function withToken(operation: Operation, sourceUrl: string): Operation {
  if (operation.context.url !== sourceUrl) return operation;
  const settings = useBrowserOAuthSettings.getState().byUrl[sourceUrl];
  const token = useBrowserTokens.getState().byUrl[sourceUrl];
  if (!settings || !token || !tokenUsable(token, settings, Date.now())) return operation;
  const base = operation.context.fetchOptions;
  const init = (typeof base === 'function' ? base() : base) ?? {};
  const headers = new Headers(init.headers);
  headers.set('authorization', `Bearer ${token.accessToken}`);
  return makeOperation(operation.kind, operation, {
    ...operation.context,
    fetchOptions: { ...init, headers: Object.fromEntries(headers) },
  });
}

/**
 * For a source signed in to from the page (no BFF): adds the in-memory access token to its
 * requests, and turns a 401 into the "sign in again" prompt. An answer reaching an exchange of an
 * older epoch (the user signed in since) is ignored.
 */
export const browserAuthExchange = (sourceUrl: string, epoch: number): Exchange => {
  const key = browserAuthKey(sourceUrl);
  return mapExchange({
    onOperation: (operation) => withToken(operation, sourceUrl),
    onResult(result) {
      const store = useAuthRequired.getState();
      if ((store.epoch[key] ?? 0) !== epoch) return result;
      const status = (result.error?.response as { status?: number } | undefined)?.status;
      if (status === 401) {
        const signedIn = Boolean(useBrowserTokens.getState().byUrl[sourceUrl]);
        store.report(key, { reason: signedIn ? 'expired' : 'signin' }, String(result.operation.key));
      } else if (result.data) {
        store.succeeded(key, String(result.operation.key));
      }
      return result;
    },
  });
};
