import type { FlowGraph, FlowLink } from './sankeyModel';

// Which column each node of a sankey stands in. Cycles are broken first (the
// links closing a cycle, found depth first, are left out of the placement),
// then each node goes right after its farthest source; sinks go to the last
// column. Nodes pinned by `columns` stay where they are pinned.

/** Node keys by priority: those of `nodeOrder` first, in that order, then by first appearance. */
export function nodePriority(graph: FlowGraph, nodeOrder: readonly string[] = []): Map<string, number> {
  const known = new Set(graph.nodes.map((n) => n.key));
  const ordered = [...new Set(nodeOrder.filter((k) => known.has(k)))];
  const rest = graph.nodes.filter((n) => !ordered.includes(n.key)).sort((a, b) => a.index - b.index);
  return new Map([...ordered, ...rest.map((n) => n.key)].map((key, i) => [key, i]));
}

/** The links closing a cycle, found by a depth-first walk in priority order. */
export function cycleLinks(graph: FlowGraph, priority: ReadonlyMap<string, number>): Set<FlowLink> {
  const rank = (key: string) => priority.get(key) ?? 0;
  const outgoing = new Map<string, FlowLink[]>();
  for (const l of graph.links) outgoing.set(l.source, [...(outgoing.get(l.source) ?? []), l]);
  for (const list of outgoing.values()) list.sort((a, b) => rank(a.target) - rank(b.target));

  const state = new Map<string, 'open' | 'done'>();
  const back = new Set<FlowLink>();
  const visit = (key: string) => {
    state.set(key, 'open');
    for (const link of outgoing.get(key) ?? []) {
      const s = state.get(link.target);
      if (s === 'open') back.add(link);
      else if (!s) visit(link.target);
    }
    state.set(key, 'done');
  };
  const roots = [...priority.keys()].sort((a, b) => rank(a) - rank(b));
  // Nodes nothing flows into first, so cycles are cut where the flow comes back.
  const hasInput = new Set(graph.links.map((l) => l.target));
  for (const key of [...roots.filter((k) => !hasInput.has(k)), ...roots]) if (!state.has(key)) visit(key);
  return back;
}

/** An exact name, or a `*` pattern matching node labels case-insensitively. */
function matches(pattern: string, key: string): boolean {
  if (!pattern.includes('*')) return pattern === key;
  const source = pattern
    .split('*')
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('.*');
  return new RegExp(`^${source}$`, 'i').test(key);
}

/** The pinned column of each listed node (first listing wins). */
function pinnedColumns(columns: readonly (readonly string[])[], nodes: readonly { key: string }[]): Map<string, number> {
  const pinned = new Map<string, number>();
  columns.forEach((patterns, col) =>
    patterns.forEach((pattern) =>
      nodes.forEach((node) => {
        if (!pinned.has(node.key) && matches(pattern, node.key)) pinned.set(node.key, col);
      }),
    ),
  );
  return pinned;
}

/** The column of each node, numbered from 0 without gaps. */
export function assignColumns(
  graph: FlowGraph,
  priority: ReadonlyMap<string, number>,
  columns?: readonly (readonly string[])[],
): Map<string, number> {
  const pinned = pinnedColumns(columns ?? [], graph.nodes);
  const back = cycleLinks(graph, priority);
  const forward = graph.links.filter((l) => !back.has(l));
  const inputs = new Map<string, string[]>();
  const outputs = new Map<string, number>();
  for (const l of forward) {
    inputs.set(l.target, [...(inputs.get(l.target) ?? []), l.source]);
    outputs.set(l.source, (outputs.get(l.source) ?? 0) + 1);
  }

  // Longest path from a source, memoised (the forward links have no cycle).
  const column = new Map<string, number>();
  const place = (key: string): number => {
    const known = column.get(key) ?? pinned.get(key);
    if (known !== undefined) return known;
    column.set(key, 0);
    const col = Math.max(0, ...(inputs.get(key) ?? []).map((s) => place(s) + 1));
    column.set(key, col);
    return col;
  };
  for (const key of priority.keys()) column.set(key, place(key));

  // Sinks fed by something go to the last column, so every flow ends on the right.
  const last = Math.max(0, ...column.values());
  for (const [key] of column) {
    if (!pinned.has(key) && !outputs.has(key) && inputs.has(key)) column.set(key, last);
  }

  const used = [...new Set(column.values())].sort((a, b) => a - b);
  const compact = new Map(used.map((c, i) => [c, i]));
  return new Map([...column].map(([key, col]) => [key, compact.get(col) ?? 0]));
}

/** The links going back to their source's column or an earlier one (closing a cycle), drawn under the figure. */
export function backLinks(
  graph: FlowGraph,
  columnOf: ReadonlyMap<string, number>,
): FlowLink[] {
  return graph.links.filter((l) => (columnOf.get(l.target) ?? 0) <= (columnOf.get(l.source) ?? 0));
}
