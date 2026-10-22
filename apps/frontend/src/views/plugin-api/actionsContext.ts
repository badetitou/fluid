import { createContext, useContext } from 'react';
import type { ActionContext, ActionResult } from '../actions/model';

/**
 * Whether the connected source may be written to. Provided by the app from the
 * connection settings; false without a provider, so a view is read-only by default.
 */
export const WriteAccessContext = createContext(false);

export const useWriteAccess = (): boolean => useContext(WriteAccessContext);

export type InvokeAction = (action: string, context?: ActionContext) => Promise<ActionResult>;

/** The actions of the rendered view; null when it has none or writes are off. */
export const ViewActionsContext = createContext<InvokeAction | null>(null);

/** The `invoke` handed to a widget: undefined when it cannot write. */
export function useWidgetInvoke(): InvokeAction | undefined {
  return useContext(ViewActionsContext) ?? undefined;
}
