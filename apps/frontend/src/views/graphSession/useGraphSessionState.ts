import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import { useGraphSessionStore } from './GraphSessionProvider';
import { emptyGraphSessionState, type GraphSessionState } from './model';

export type GraphSessionPatch = Partial<GraphSessionState> | ((prev: GraphSessionState) => GraphSessionState);

/** Reads/writes one widget's session state; the store wins once it has an entry. */
export function useGraphSessionState(
  key: string,
  initial: GraphSessionState = emptyGraphSessionState,
): [GraphSessionState, (patch: GraphSessionPatch) => void] {
  const store = useGraphSessionStore();
  const subscribe = useCallback((listener: () => void) => store.subscribe(key, listener), [store, key]);
  const getSnapshot = useCallback(() => store.get(key), [store, key]);
  const stored = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const state = stored ?? initial;
  const latest = useRef(state);
  latest.current = state;

  // Defaults only apply on first mount: once the store holds an entry, it wins.
  useEffect(() => {
    if (store.get(key) === undefined) store.set(key, initial);
  }, [store, key, initial]);

  const set = useCallback(
    (patch: GraphSessionPatch) => {
      const prev = store.get(key) ?? latest.current;
      const next = typeof patch === 'function' ? patch(prev) : { ...prev, ...patch };
      store.set(key, next);
    },
    [store, key],
  );

  return [state, set];
}
