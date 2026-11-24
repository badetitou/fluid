import { createContext, useContext } from 'react';
import type { DataBinding, GraphExplorerWidget } from '@fluid/shared';
import type { GraphSessionPatch, GraphSessionState } from '../../graphSession';
import type { ExplorerFlowNode } from './graphExplorerFlow';

/** What every node and the toolbar need from the enclosing explorer (nodeTypes cannot close over props). */
export interface ExplorerNodeContextValue {
  widget: GraphExplorerWidget;
  resolve: (binding: DataBinding) => unknown;
  emit: (port: string, value: unknown) => void;
  session: GraphSessionState;
  setSession: (patch: GraphSessionPatch) => void;
  /** Keys of the groups that can be folded, prefixed with `group:`. */
  groups: string[];
  /** Node ids hidden by folding or focus, for the toolbar. */
  hidden: number;
  /** Total node ids before folding and focus, for the toolbar. */
  total: number;
  select: (node: ExplorerFlowNode) => void;
  toggleFocus: () => void;
  toggleExpanded: (key: string) => void;
  collapseAll: () => void;
  toggleGroup: (group: string) => void;
  canExpand: (row: Record<string, unknown>) => boolean;
}

export const ExplorerNodeContext = createContext<ExplorerNodeContextValue | null>(null);

export function useExplorerNode(): ExplorerNodeContextValue {
  const value = useContext(ExplorerNodeContext);
  if (!value) throw new Error('Graph explorer nodes must be rendered inside GraphExplorerCanvas.');
  return value;
}
