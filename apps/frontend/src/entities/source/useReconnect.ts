import { useCallback } from 'react';
import { useAuthRequired } from './authRequired';
import type { AuthRequired, SignInStatus } from './oauth';
import { useCurrentBffSourceId } from './useSourceAuthClient';
import { useOAuthSignIn } from './useOAuthSignIn';

export interface Reconnect {
  /** Why the connected source needs a sign-in again; `null` when it does not. */
  required: AuthRequired | null;
  status: SignInStatus;
  /** Runs the sign-in (asking for the missing scope when that is the reason); queries run again once it is done. */
  reconnect: () => void;
}

/** The "Reconnect" prompt of the connected source, fed by the BFF's FLUID_AUTH_REQUIRED answers. */
export function useReconnect(): Reconnect {
  const id = useCurrentBffSourceId();
  const required = useAuthRequired((s) => (id ? (s.required[id] ?? null) : null));
  const reconnected = useAuthRequired((s) => s.reconnected);
  const { status, start } = useOAuthSignIn(id, () => id && reconnected(id));
  const reconnect = useCallback(
    () => start(required?.reason === 'insufficient_scope' ? required.scope : undefined),
    [start, required],
  );
  return { required, status, reconnect };
}
