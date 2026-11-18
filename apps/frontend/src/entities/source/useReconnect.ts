import { useCallback } from 'react';
import { useAuthRequired } from './authRequired';
import type { AuthRequired, SignInStatus } from './oauth';
import { browserAuthKey } from './browserOAuth/model';
import { useBrowserSignIn } from './browserOAuth/useBrowserSignIn';
import { useCurrentBffSourceId, useCurrentBrowserAuthUrl } from './useSourceAuthClient';
import { useOAuthSignIn } from './useOAuthSignIn';

export interface Reconnect {
  /** Why the connected source needs a sign-in again; `null` when it does not. */
  required: AuthRequired | null;
  status: SignInStatus;
  /** Runs the sign-in (asking for the missing scope when that is the reason); queries run again once it is done. */
  reconnect: () => void;
}

/**
 * The "Reconnect" prompt of the connected source, fed by the BFF's FLUID_AUTH_REQUIRED answers, or
 * by the source's 401 when it is signed in to from the page (browser OAuth).
 */
export function useReconnect(): Reconnect {
  const id = useCurrentBffSourceId();
  const browserUrl = useCurrentBrowserAuthUrl();
  const key = id ?? (browserUrl ? browserAuthKey(browserUrl) : undefined);
  const required = useAuthRequired((s) => (key ? (s.required[key] ?? null) : null));
  const reconnected = useAuthRequired((s) => s.reconnected);
  const bff = useOAuthSignIn(id, reconnected);
  const browser = useBrowserSignIn(browserUrl);
  const { status, start } = id ? bff : browser;
  const reconnect = useCallback(
    () => start(required?.reason === 'insufficient_scope' ? required.scope : undefined),
    [start, required],
  );
  return { required, status, reconnect };
}
