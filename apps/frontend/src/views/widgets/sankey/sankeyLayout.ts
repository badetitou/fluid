import { assignColumns, backLinks as backwardLinks, nodePriority } from './sankeyColumns';
import type { FlowGraph, FlowLink, FlowNode } from './sankeyModel';

// Geometry of a sankey: nodes stacked in columns, as tall as their flow;
// ribbons as thick as theirs. A link going back (to its own column or an
// earlier one, i.e. a cycle) runs in a lane under the figure.

export interface PlacedNode extends FlowNode {
  value: number;
  column: number;
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  /** Side of the node its label is written on. */
  labelSide: 'left' | 'right';
}

export interface PlacedLink extends FlowLink {
  key: string;
  /** Thickness of the ribbon. */
  width: number;
  /** SVG path of the ribbon's middle line, stroked `width` thick. */
  path: string;
  /** A link going back to an earlier column (a cycle), drawn under the figure. */
  back: boolean;
  /** Where the hover card points to. */
  mx: number;
  my: number;
}

export interface SankeyLayout {
  width: number;
  height: number;
  nodes: PlacedNode[];
  links: PlacedLink[];
}

export interface LayoutOptions {
  width: number;
  height: number;
  nodeOrder?: readonly string[];
  columns?: readonly (readonly string[])[];
}

const NODE_WIDTH = 12;
const MAX_PADDING = 14;
const LANE_GAP = 6;
const BACK_MARGIN = 22;
const SWEEPS = 3;

const center = (n: PlacedNode) => (n.y0 + n.y1) / 2;
const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);

/** Places the nodes and ribbons of `graph` in a `width` × `height` box. */
export function layoutSankey(graph: FlowGraph, options: LayoutOptions): SankeyLayout {
  const { width, height } = options;
  const priority = nodePriority(graph, options.nodeOrder);
  const columnOf = assignColumns(graph, priority, options.columns);
  const isBack = (l: FlowLink) => (columnOf.get(l.target) ?? 0) <= (columnOf.get(l.source) ?? 0);
  const backLinks = backwardLinks(graph, columnOf);
  const columnCount = Math.max(1, ...[...columnOf.values()].map((c) => c + 1));

  const nodes: PlacedNode[] = graph.nodes.map((n) => {
    const inflow = sum(graph.links.filter((l) => l.target === n.key).map((l) => l.value));
    const outflow = sum(graph.links.filter((l) => l.source === n.key).map((l) => l.value));
    const column = columnOf.get(n.key) ?? 0;
    const margin = backLinks.length > 0 ? BACK_MARGIN : 0;
    const x0 = margin + (columnCount > 1 ? (column * (width - 2 * margin - NODE_WIDTH)) / (columnCount - 1) : 0);
    const labelSide = columnCount > 1 && column === columnCount - 1 ? 'left' : 'right';
    return { ...n, value: Math.max(inflow, outflow), column, x0, x1: x0 + NODE_WIDTH, y0: 0, y1: 0, labelSide };
  });
  const byColumn = Array.from({ length: columnCount }, (_, c) => nodes.filter((n) => n.column === c));
  for (const col of byColumn) col.sort((a, b) => (priority.get(a.key) ?? 0) - (priority.get(b.key) ?? 0));

  // Scale: the fullest column, plus the lanes of the back links, fill the height.
  const tallest = Math.max(1, ...byColumn.map((c) => c.length));
  const padding = Math.min(MAX_PADDING, (height * 0.3) / tallest);
  const backValue = sum(backLinks.map((l) => l.value));
  const lanes = backLinks.length > 0 ? LANE_GAP * (backLinks.length + 1) : 0;
  const ky = Math.max(
    0.01,
    Math.min(...byColumn.map((c) => (height - lanes - padding * (c.length - 1)) / (sum(c.map((n) => n.value)) + backValue))),
  );
  const bandHeight = height - lanes - backValue * ky;

  const stack = (col: PlacedNode[]) => {
    const total = sum(col.map((n) => n.value * ky)) + padding * (col.length - 1);
    let y = Math.max(0, (bandHeight - total) / 2);
    for (const n of col) {
      n.y0 = y;
      n.y1 = y + Math.max(1, n.value * ky);
      y = n.y1 + padding;
    }
  };
  byColumn.forEach(stack);
  relax(byColumn, graph.links.filter((l) => !isBack(l)), priority, options.nodeOrder ?? [], stack);

  const byKey = new Map(nodes.map((n) => [n.key, n]));
  const links = placeLinks(graph.links, byKey, ky, isBack, bandHeight);
  return { width, height, nodes, links };
}

/** Reorders each column by the mean height of its neighbours, a few sweeps each way, to uncross ribbons. */
function relax(
  byColumn: PlacedNode[][],
  links: FlowLink[],
  priority: ReadonlyMap<string, number>,
  nodeOrder: readonly string[],
  stack: (col: PlacedNode[]) => void,
) {
  const all = new Map(byColumn.flat().map((n) => [n.key, n]));
  const pinned = (n: PlacedNode) => nodeOrder.indexOf(n.key);
  const barycenter = (n: PlacedNode, side: 'source' | 'target') => {
    const other = side === 'source' ? 'target' : 'source';
    const around = links.filter((l) => l[other] === n.key);
    const weight = sum(around.map((l) => l.value));
    if (weight === 0) return center(n);
    return sum(around.map((l) => center(all.get(l[side]) as PlacedNode) * l.value)) / weight;
  };
  const reorder = (col: PlacedNode[], side: 'source' | 'target') => {
    const keys = new Map(col.map((n) => [n, barycenter(n, side)]));
    col.sort((a, b) => {
      const pa = pinned(a);
      const pb = pinned(b);
      if (pa >= 0 || pb >= 0) return (pa < 0 ? Infinity : pa) - (pb < 0 ? Infinity : pb);
      return (keys.get(a) ?? 0) - (keys.get(b) ?? 0) || (priority.get(a.key) ?? 0) - (priority.get(b.key) ?? 0);
    });
    stack(col);
  };
  for (let i = 0; i < SWEEPS; i += 1) {
    for (let c = 1; c < byColumn.length; c += 1) reorder(byColumn[c], 'source');
    for (let c = byColumn.length - 2; c >= 0; c -= 1) reorder(byColumn[c], 'target');
  }
}

/** Stacks the ribbons along each node (by the height of the other end) and draws them. */
function placeLinks(
  graph: FlowLink[],
  byKey: ReadonlyMap<string, PlacedNode>,
  ky: number,
  isBack: (l: FlowLink) => boolean,
  bandHeight: number,
): PlacedLink[] {
  const node = (key: string) => byKey.get(key) as PlacedNode;
  // Back links leave from the bottom of their source and enter at the bottom of their target.
  const order = (l: FlowLink, end: 'source' | 'target') => (isBack(l) ? Infinity : center(node(l[end])));
  const sourceY = new Map<FlowLink, number>();
  const targetY = new Map<FlowLink, number>();
  for (const n of byKey.values()) {
    let y = n.y0;
    for (const l of graph.filter((k) => k.source === n.key).sort((a, b) => order(a, 'target') - order(b, 'target'))) {
      sourceY.set(l, y + (l.value * ky) / 2);
      y += l.value * ky;
    }
    y = n.y0;
    for (const l of graph.filter((k) => k.target === n.key).sort((a, b) => order(a, 'source') - order(b, 'source'))) {
      targetY.set(l, y + (l.value * ky) / 2);
      y += l.value * ky;
    }
  }

  let lane = bandHeight + LANE_GAP;
  return graph.map((l) => {
    const w = Math.max(1, l.value * ky);
    const sx = node(l.source).x1;
    const tx = node(l.target).x0;
    const sy = sourceY.get(l) ?? 0;
    const ty = targetY.get(l) ?? 0;
    const key = JSON.stringify([l.source, l.target]);
    if (!isBack(l)) {
      const xm = (sx + tx) / 2;
      const path = `M${sx},${sy}C${xm},${sy} ${xm},${ty} ${tx},${ty}`;
      return { ...l, key, width: w, path, back: false, mx: xm, my: (sy + ty) / 2 };
    }
    const ly = lane + w / 2;
    lane += w + LANE_GAP;
    const r = BACK_MARGIN - 4;
    const path = `M${sx},${sy}C${sx + r},${sy} ${sx + r},${ly} ${sx},${ly}L${tx},${ly}C${tx - r},${ly} ${tx - r},${ty} ${tx},${ty}`;
    return { ...l, key, width: w, path, back: true, mx: (sx + tx) / 2, my: ly };
  });
}
