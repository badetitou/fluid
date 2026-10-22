import { createContext, useCallback, useContext, useState, useSyncExternalStore } from 'react';
import { createOutputsStore, type OutputResults, type OutputsStore } from './outputs';

export const ViewOutputsContext = createContext<OutputsStore | null>(null);

/** One outputs store per rendered view, kept across renders. */
export function useOutputsStore(): OutputsStore {
  const [store] = useState(createOutputsStore);
  return store;
}

const NO_OUTPUTS: OutputResults = {};
const noSubscription = () => () => {};

/** The outputs of the view's widgets; re-renders on emissions only when `listen` (the widget reads some). */
export function useViewOutputs(listen: boolean): OutputResults {
  const store = useContext(ViewOutputsContext);
  const active = listen && store !== null;
  return useSyncExternalStore(
    active ? store.subscribe : noSubscription,
    active ? store.snapshot : () => NO_OUTPUTS,
  );
}

/** The `emit` of widget `widgetId`: a no-op outside a view. */
export function useWidgetEmit(widgetId: string): (port: string, value: unknown) => void {
  const store = useContext(ViewOutputsContext);
  return useCallback((port, value) => store?.emit(widgetId, port, value), [store, widgetId]);
}
