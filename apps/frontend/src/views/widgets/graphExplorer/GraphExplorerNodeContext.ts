import { createContext, useContext } from 'react';
import type { DataBinding, GraphExplorerWidget } from '@fluid/shared';
import type { GraphSessionPatch, GraphSessionState } from '../../graphSession';
import type { HierarchyGraph } from './hierarchyModel';

/** What the toolbar and the few DOM cards need from the enclosing explorer. */
export interface ExplorerNodeContextValue {
  widget: GraphExplorerWidget;
  resolve: (binding: DataBinding) => unknown;
  emit: (port: string, value: unknown) => void;
  session: GraphSessionState;
  setSession: (patch: GraphSessionPatch) => void;
  hierarchy: HierarchyGraph;
  /** Keys of the containment boxes that can be folded. */
  groups: string[];
  /** Leaf nodes hidden by folding or focus, for the toolbar. */
  hidden: number;
  /** Leaf nodes before folding and focus, for the toolbar. */
  total: number;
  select: (key: string) => void;
  toggleFocus: () => void;
  toggleExpanded: (key: string) => void;
  collapseAll: () => void;
  canExpand: (row: Record<string, unknown>) => boolean;
}

export const ExplorerNodeContext = createContext<ExplorerNodeContextValue | null>(null);

export function useExplorerNode(): ExplorerNodeContextValue {
  const value = useContext(ExplorerNodeContext);
  if (!value) throw new Error('Graph explorer controls must be rendered inside GraphExplorerWidget.');
  return value;
}
