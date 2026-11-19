import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import type { ViewSpec } from '@fluid/shared';
import { createOutputsStore, type OutputsStore } from '../../views/plugin-api';
import type { HostBridge } from './bridge';
import { askMessage, modelContext, selectionsOf, type Selection } from './selectionModel';

/** Waits this long after the last selection change before telling the host. */
export const CONTEXT_DEBOUNCE_MS = 400;

export interface SelectionContext {
  /** The store the view's widgets emit to (a new one per view). */
  outputs: OutputsStore;
  selections: Selection[];
  /** Posts the selection as a user message (`ui/message`). */
  ask: () => Promise<void>;
}

/**
 * Watches the widgets' `selected` outputs and keeps the model context up to date
 * (`ui/update-model-context`), compacted and framed as untrusted data.
 */
export function useSelectionContext(bridge: HostBridge | undefined, spec: ViewSpec | undefined): SelectionContext {
  // A new view starts with nothing selected.
  const outputs = useMemo(() => createOutputsStore(), [spec]);
  const snapshot = useSyncExternalStore(outputs.subscribe, outputs.snapshot);
  const selections = useMemo(() => (spec ? selectionsOf(spec, snapshot) : []), [spec, snapshot]);
  const lastSent = useRef<string | null>(null);

  useEffect(() => {
    if (!bridge || !spec) return;
    // Nothing to say until something was selected once.
    if (selections.length === 0 && lastSent.current === null) return;
    const params = modelContext(spec, selections);
    const text = params.content[0].text;
    if (text === lastSent.current) return;
    const timer = setTimeout(() => {
      lastSent.current = text;
      bridge.updateModelContext(params).catch(() => undefined); // A host without it just does not know.
    }, CONTEXT_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [bridge, spec, selections]);

  const ask = useCallback(async () => {
    if (!bridge || !spec || selections.length === 0) return;
    await bridge.sendMessage(askMessage(spec, selections));
  }, [bridge, spec, selections]);

  return { outputs, selections, ask };
}
