import { GRAPH_DETAIL_ID_VARIABLE, type GraphExplorerWidget } from '@fluid/shared';
import { getPath } from '../../data';
import { focusNetwork, type FocusDirection } from '../network/focusModel';
import { buildNetwork, type Network, type NetworkEdge, type NetworkNode } from '../network/networkModel';

// Pure logic of the graph explorer: the network itself, its folded view and the
// values used for the on-demand detail query. No React, no state, no rendering.

export const groupKey = (value: string): string => `group:${value}`;

export interface FocusRequest {
  key: string;
  depth: number;
  direction: FocusDirection;
}

export interface ExplorerGraph {
  /** Every node and edge, before folding and focusing. */
  all: Network;
  /** What is actually drawn. */
  visible: Network;
  /** Nodes hidden by a folded group or by the focus. */
  hidden: number;
}

interface Grouped {
  nodes: NetworkNode[];
  counts: Map<string, number>;
}

function groupValue(node: NetworkNode, field?: string): string | undefined {
  if (!field) return undefined;
  const value = getPath(node.row, field);
  return value == null || value === '' || typeof value === 'object' ? undefined : String(value);
}

/** Groups by `field` and folds the groups whose key is in `collapsed`. */
function foldGroups(network: Network, field: string, collapsed: ReadonlySet<string>): Grouped {
  const counts = new Map<string, number>();
  for (const node of network.nodes) {
    const value = groupValue(node, field);
    if (value && collapsed.has(groupKey(value))) counts.set(groupKey(value), (counts.get(groupKey(value)) ?? 0) + 1);
  }
  const nodes: NetworkNode[] = [];
  const seen = new Set<string>();
  for (const node of network.nodes) {
    const value = groupValue(node, field);
    const key = value && collapsed.has(groupKey(value)) ? groupKey(value) : node.key;
    if (seen.has(key)) continue;
    seen.add(key);
    if (key === node.key) {
      nodes.push(node);
      continue;
    }
    nodes.push({
      key,
      label: `${value} (${counts.get(key) ?? 0})`,
      group: value,
      row: { name: value, count: counts.get(key) ?? 0 },
      external: false,
    });
  }
  return { nodes, counts };
}

/** Edges between the nodes that remain visible, with parallel links counted once. */
function visibleEdges(network: Network, keys: ReadonlySet<string>, field?: string, collapsed?: ReadonlySet<string>): NetworkEdge[] {
  const keyOf = (id: string): string | undefined => {
    const node = network.nodes.find((n) => n.key === id);
    if (!node) return undefined;
    const value = field ? groupValue(node, field) : undefined;
    return value && collapsed?.has(groupKey(value)) ? groupKey(value) : id;
  };
  const edges = new Map<string, NetworkEdge>();
  for (const edge of network.edges) {
    const source = keyOf(edge.source);
    const target = keyOf(edge.target);
    if (source === undefined || target === undefined || source === target) continue;
    if (!keys.has(source) || !keys.has(target)) continue;
    const key = `${source}→${target}`;
    if (!edges.has(key)) edges.set(key, { key, source, target });
  }
  return [...edges.values()];
}

/** Every node and edge, from the bound rows and the links. */
export function buildAll(data: unknown, edgesData: unknown, widget: GraphExplorerWidget): Network {
  return buildNetwork(data, edgesData, widget);
}

/** Folds the chosen groups, then focuses on a node if asked. */
export function visibleGraph(
  all: Network,
  widget: GraphExplorerWidget,
  options: { collapsedGroups?: readonly string[]; focus?: FocusRequest } = {},
): ExplorerGraph {
  const collapsed = new Set(options.collapsedGroups ?? []);
  const field = widget.groupByField;
  const grouped = field ? foldGroups(all, field, collapsed) : undefined;
  let visible: Network = grouped
    ? {
        nodes: grouped.nodes,
        edges: visibleEdges(all, new Set(grouped.nodes.map((n) => n.key)), field, collapsed),
        groups: [...new Set(grouped.nodes.map((n) => n.group).filter((g): g is string => !!g))],
      }
    : all;
  if (options.focus && widget.focusDepth) {
    const { key, depth, direction } = options.focus;
    visible = focusNetwork(visible, key, depth, direction);
  }
  return { all, visible, hidden: all.nodes.length - visible.nodes.length };
}

/** Builds the drawn graph from the raw data (also handy in tests). */
export function buildExplorerGraph(
  data: unknown,
  edgesData: unknown,
  widget: GraphExplorerWidget,
  options: { collapsedGroups?: readonly string[]; focus?: FocusRequest } = {},
): ExplorerGraph {
  return visibleGraph(buildAll(data, edgesData, widget), widget, options);
}

/** Groups folded on first render: every group in a tree overview, or the large ones. */
export function initialCollapsedGroups(network: Network, widget: GraphExplorerWidget): string[] {
  const field = widget.groupByField;
  if (!field) return [];
  const counts = new Map<string, number>();
  for (const node of network.nodes) {
    const value = groupValue(node, field);
    if (value) counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  const threshold = widget.overview === 'tree' ? 1 : (widget.collapseAbove ?? 40);
  return [...counts.entries()]
    .filter(([, count]) => count > threshold)
    .map(([value]) => groupKey(value));
}

/** At most `max` nodes are open at once: the oldest expansions close first. */
export function limitExpanded(keys: readonly string[], max: number): string[] {
  return [...new Set(keys)].slice(-Math.max(0, max));
}

/** Id passed to the lazy detail query as `$nodeId`, read from the expanded node's row. */
export function detailId(widget: GraphExplorerWidget, row: Record<string, unknown>): string | undefined {
  const value = getPath(row, widget.detailIdField ?? 'id');
  return value == null || value === '' ? undefined : String(value);
}

/** Variables of the lazy detail query: `$nodeId` comes from the expanded node. */
export function detailVariables(widget: GraphExplorerWidget, row: Record<string, unknown>): Record<string, unknown> {
  const id = detailId(widget, row);
  return id === undefined ? {} : { [GRAPH_DETAIL_ID_VARIABLE]: id };
}

/** Whether a node can be opened: it needs a detail query or nested widgets to show. */
export function canExpand(widget: GraphExplorerWidget, row: Record<string, unknown>): boolean {
  return (!!widget.detailQuery && !!detailId(widget, row)) || (widget.widgets?.length ?? 0) > 0;
}
