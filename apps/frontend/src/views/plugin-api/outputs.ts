import { outputQuery } from '@fluid/shared';

/** Outputs of the widgets of one view, keyed like query results: `@<widgetId>` → `{ <port>: value }`. */
export type OutputResults = Readonly<Record<string, Readonly<Record<string, unknown>>>>;

export interface OutputsStore {
  snapshot: () => OutputResults;
  emit: (widgetId: string, port: string, value: unknown) => void;
  subscribe: (listener: () => void) => () => void;
}

/** A tiny observable store of the values the widgets of a view emitted. */
export function createOutputsStore(): OutputsStore {
  let state: OutputResults = {};
  const listeners = new Set<() => void>();
  return {
    snapshot: () => state,
    emit: (widgetId, port, value) => {
      const key = outputQuery(widgetId);
      if (state[key]?.[port] === value) return;
      state = { ...state, [key]: { ...state[key], [port]: value } };
      listeners.forEach((l) => l());
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

/** Whether a widget (or one nested in it) reads another widget's outputs. */
export function readsOutputs(widget: unknown): boolean {
  return JSON.stringify(widget).includes('"query":"@');
}
