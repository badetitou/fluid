import { createContext, useContext, useMemo, type FC, type ReactNode } from 'react';
import type { GraphSessionState } from './model';

export interface GraphSessionStore {
  get(key: string): GraphSessionState | undefined;
  set(key: string, state: GraphSessionState): void;
  subscribe(key: string, listener: () => void): () => void;
}

/** Session-only, per-provider memory: no storage, no BFF, no ViewSpec writes. */
function createGraphSessionStore(): GraphSessionStore {
  const states = new Map<string, GraphSessionState>();
  const listeners = new Map<string, Set<() => void>>();
  return {
    get: (key) => states.get(key),
    set: (key, state) => {
      if (states.get(key) === state) return;
      states.set(key, state);
      for (const listener of [...(listeners.get(key) ?? [])]) listener();
    },
    subscribe: (key, listener) => {
      let keyListeners = listeners.get(key);
      if (!keyListeners) {
        keyListeners = new Set();
        listeners.set(key, keyListeners);
      }
      keyListeners.add(listener);
      return () => {
        keyListeners?.delete(listener);
        if (keyListeners?.size === 0) listeners.delete(key);
      };
    },
  };
}

/** Fallback so widgets still work when no provider was mounted above them. */
const fallbackStore = createGraphSessionStore();
const GraphSessionContext = createContext<GraphSessionStore>(fallbackStore);

/** Shares session-only explorer state between the widgets of a view. */
export const GraphSessionProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const store = useMemo(createGraphSessionStore, []);
  return <GraphSessionContext.Provider value={store}>{children}</GraphSessionContext.Provider>;
};

/** The store of the closest provider (or the fallback one outside any provider). */
export function useGraphSessionStore(): GraphSessionStore {
  return useContext(GraphSessionContext);
}
