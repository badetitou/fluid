// Sign-ins in flight: state -> verifier, nonce, source, redirect URI. Server side, in memory,
// short-lived and single use. This assumes ONE BFF process: with several, the callback could
// land on a process that never saw the start.

export const PENDING_TTL_MS = 10 * 60_000;
const MAX_PENDING = 1000;

export interface PendingSignIn {
  state: string;
  verifier: string;
  nonce: string;
  sourceId: string;
  /** The exact redirect_uri sent at start, reused for the code exchange. */
  redirectUri: string;
  /** The `openid` scope was requested: an ID token with this nonce is expected back. */
  oidc: boolean;
  createdAt: number;
}

export interface PendingStore {
  add(p: PendingSignIn): void;
  /** Returns and removes the entry; null when unknown, reused or expired. */
  take(state: string): PendingSignIn | null;
}

export function createPendingStore(ttlMs = PENDING_TTL_MS, now: () => number = Date.now): PendingStore {
  const items = new Map<string, PendingSignIn>();
  const prune = () => {
    for (const [state, p] of items) if (now() - p.createdAt >= ttlMs) items.delete(state);
  };
  return {
    add(p) {
      prune();
      // Bounded: drop the oldest when flooded.
      if (items.size >= MAX_PENDING) items.delete(items.keys().next().value as string);
      items.set(p.state, p);
    },
    take(state) {
      const p = items.get(state);
      if (!p) return null;
      items.delete(state);
      return now() - p.createdAt >= ttlMs ? null : p;
    },
  };
}
