import type { ButterflyWidget } from '@fluid/shared';
import { getPath } from '../../data';
import { idOf, rowsOf } from '../network/networkModel';
import { nodeLabel, type Row } from '../tree/treeModel';

// Pure logic of the butterfly map: the central element, its neighbours on each
// side (duplicates counted), their own neighbours at depth 2, and the cap per
// side (grouped by container, else the heaviest kept).

export type Side = 'in' | 'out';

/** Neighbours per side beyond which they are grouped by `groupField` (or the lightest hidden). */
export const MAX_PER_SIDE = 60;
export const CENTER_ID = 'center';

export interface ButterflyNode {
  /** Unique within the map: side, level and element id (an element may sit on both sides). */
  id: string;
  /** The element's id, as a string. */
  key: string;
  label: string;
  group?: string;
  /** The element's row; absent for a group box. */
  row?: Row;
  side: Side;
  level: 1 | 2;
  /** Occurrences of the links drawn to it. */
  weight: number;
  /** For a group box: how many elements it stands for. */
  members?: number;
}

export interface ButterflyEdge {
  key: string;
  /** Node ids; the arrow always flows to the right. */
  source: string;
  target: string;
  weight: number;
}

export interface ButterflySide {
  /** The distinct direct neighbours, before grouping. */
  count: number;
  /** The neighbours were too many and are shown as boxes per group. */
  grouped: boolean;
  /** Neighbours left out beyond the cap (no `groupField`). */
  hidden: number;
}

export interface Butterfly {
  center: { key: string; label: string; group?: string; row: Row };
  /** Every node but the center, column by column, top to bottom. */
  nodes: ButterflyNode[];
  edges: ButterflyEdge[];
  sides: Record<Side, ButterflySide>;
  /** The group values, in order of appearance. */
  groups: string[];
}

export type ButterflyOptions = Pick<
  ButterflyWidget,
  'incomingField' | 'outgoingField' | 'idField' | 'labelField' | 'groupField' | 'depth'
>;

interface Neighbour {
  key: string;
  label: string;
  group?: string;
  row: Row;
  weight: number;
}

const listOf = (value: unknown): unknown[] => (Array.isArray(value) ? value : value == null ? [] : [value]);

function groupOf(row: Row, groupField?: string): string | undefined {
  if (!groupField) return undefined;
  const value = getPath(row, groupField);
  return value == null || value === '' || typeof value === 'object' ? undefined : String(value);
}

/** The label of an element: its name, else its id. */
function labelOf(row: Row, key: string, labelField?: string): string {
  const label = nodeLabel(row, labelField);
  return label === '(unnamed)' ? key : label;
}

/** The elements `field` reaches from `row`, by id, their occurrences counted. */
export function neighboursOf(row: Row, field: string | undefined, opts: ButterflyOptions): Map<string, Neighbour> {
  const out = new Map<string, Neighbour>();
  if (!field) return out;
  for (const value of listOf(getPath(row, field))) {
    const [object] = rowsOf(value);
    const key = idOf(value, opts.idField ?? 'id') ?? (object ? `label:${nodeLabel(object, opts.labelField)}` : undefined);
    if (key === undefined) continue;
    const known = out.get(key);
    if (known) {
      known.weight += 1;
      // A neighbour first met as a bare id is completed by the first object describing it.
      if (Object.keys(known.row).length === 0 && object) Object.assign(known, describe(object, key, opts));
      continue;
    }
    out.set(key, { ...describe(object ?? {}, key, opts), weight: 1 });
  }
  return out;
}

const describe = (row: Row, key: string, opts: ButterflyOptions) => ({
  key,
  row,
  label: labelOf(row, key, opts.labelField),
  group: groupOf(row, opts.groupField),
});

const byGroupWeightLabel = (a: Neighbour, b: Neighbour) =>
  (a.group ?? '￿').localeCompare(b.group ?? '￿') || b.weight - a.weight || a.label.localeCompare(b.label);

const nodeId = (side: Side, level: 1 | 2, key: string) => `${side}${level}:${key}`;

/** One box per group, standing for its elements (those without group in "(no group)"). */
function groupBoxes(neighbours: Neighbour[]): Neighbour[] {
  const boxes = new Map<string, Neighbour & { members: number }>();
  for (const n of neighbours) {
    const group = n.group ?? '(no group)';
    const box = boxes.get(group) ?? { key: `group:${group}`, label: group, group: n.group, row: {}, weight: 0, members: 0 };
    box.weight += n.weight;
    box.members += 1;
    boxes.set(group, box);
  }
  return [...boxes.values()].map((box) => ({ ...box, label: `${box.label} (${box.members})` }));
}

/** The heaviest `MAX_PER_SIDE` neighbours, and how many were left out. */
function capped(neighbours: Neighbour[]): [Neighbour[], number] {
  if (neighbours.length <= MAX_PER_SIDE) return [neighbours, 0];
  const kept = [...neighbours].sort((a, b) => b.weight - a.weight).slice(0, MAX_PER_SIDE);
  return [kept, neighbours.length - kept.length];
}

interface SideResult {
  nodes: ButterflyNode[];
  edges: ButterflyEdge[];
  side: ButterflySide;
}

/** The nodes and edges of one side, the arrows oriented to the right. */
function buildSide(center: Row, centerKey: string, side: Side, opts: ButterflyOptions): SideResult {
  const field = side === 'in' ? opts.incomingField : opts.outgoingField;
  const direct = [...neighboursOf(center, field, opts).values()].filter((n) => n.key !== centerKey);
  const grouped = direct.length > MAX_PER_SIDE && opts.groupField !== undefined;
  const [level1, hidden1] = grouped ? [groupBoxes(direct), 0] : capped(direct);
  level1.sort(byGroupWeightLabel);
  const edge = (from: string, to: string, weight: number): ButterflyEdge => {
    const [source, target] = side === 'in' ? [from, to] : [to, from];
    return { key: `${source}→${target}`, source, target, weight };
  };
  const nodes: ButterflyNode[] = level1.map((n) => ({ ...n, id: nodeId(side, 1, n.key), side, level: 1, row: grouped ? undefined : n.row }));
  const edges = nodes.map((n) => edge(n.id, CENTER_ID, n.weight));
  let hidden2 = 0;
  if (opts.depth === 2 && !grouped) {
    const outer = outerNeighbours(level1, field, centerKey, opts);
    const [level2, hidden] = capped([...outer.values()].map((o) => o.neighbour));
    hidden2 = hidden;
    const index = new Map(level1.map((n, i) => [n.key, i]));
    const barycenter = (key: string) => {
      const links = outer.get(key)!.links;
      return [...links.keys()].reduce((sum, k) => sum + index.get(k)!, 0) / links.size;
    };
    level2.sort((a, b) => barycenter(a.key) - barycenter(b.key) || a.label.localeCompare(b.label));
    for (const n of level2) {
      const id = nodeId(side, 2, n.key);
      nodes.push({ ...n, id, side, level: 2 });
      for (const [inner, weight] of outer.get(n.key)!.links) edges.push(edge(id, nodeId(side, 1, inner), weight));
    }
  }
  return { nodes, edges, side: { count: direct.length, grouped, hidden: hidden1 + hidden2 } };
}

/** The neighbours of the direct neighbours (not the center, not a direct neighbour), with their links. */
function outerNeighbours(level1: Neighbour[], field: string | undefined, centerKey: string, opts: ButterflyOptions) {
  const direct = new Set(level1.map((n) => n.key));
  const outer = new Map<string, { neighbour: Neighbour; links: Map<string, number> }>();
  for (const inner of level1) {
    for (const n of neighboursOf(inner.row, field, opts).values()) {
      if (n.key === centerKey || direct.has(n.key)) continue;
      const entry = outer.get(n.key) ?? { neighbour: { ...n, weight: 0 }, links: new Map<string, number>() };
      entry.neighbour.weight += n.weight;
      entry.links.set(inner.key, (entry.links.get(inner.key) ?? 0) + n.weight);
      outer.set(n.key, entry);
    }
  }
  return outer;
}

/** The butterfly map of the bound element, or null when there is no element. */
export function buildButterfly(data: unknown, opts: ButterflyOptions): Butterfly | null {
  const [row] = rowsOf(data);
  if (!row) return null;
  const key = idOf(getPath(row, opts.idField ?? 'id'), opts.idField ?? 'id') ?? CENTER_ID;
  const incoming = buildSide(row, key, 'in', opts);
  const outgoing = buildSide(row, key, 'out', opts);
  const nodes = [...incoming.nodes, ...outgoing.nodes];
  const centerGroup = groupOf(row, opts.groupField);
  const groups = [...new Set([centerGroup, ...nodes.map((n) => n.group)].filter((g): g is string => g !== undefined))];
  return {
    center: { key, label: labelOf(row, key, opts.labelField), group: centerGroup, row },
    nodes,
    edges: [...incoming.edges, ...outgoing.edges],
    sides: { in: incoming.side, out: outgoing.side },
    groups,
  };
}

/** Why there is nothing to draw, or null when the element has neighbours. */
export function emptyReason(butterfly: Butterfly | null, opts: ButterflyOptions): string | null {
  if (!butterfly) return 'No element: the query returned nothing to show.';
  if (butterfly.nodes.length > 0) return null;
  const fields = [opts.incomingField, opts.outgoingField].filter(Boolean).map((f) => `"${f}"`);
  return `No dependencies: ${butterfly.center.label} has nothing in ${fields.join(' or ')}.`;
}

/** The edges touching a node, for highlighting. */
export function edgesOf(butterfly: Butterfly, id: string): Set<string> {
  return new Set(butterfly.edges.filter((e) => e.source === id || e.target === id).map((e) => e.key));
}

/** The full text of a node, shown on hover: label, group, repeated links or grouped elements. */
export function tooltipOf(node: ButterflyNode): string {
  if (node.members !== undefined) return `${node.label}: ${node.members} elements, ${node.weight} links`;
  const group = node.group === undefined ? '' : ` (${node.group})`;
  return `${node.label}${group}${node.weight > 1 ? ` ×${node.weight}` : ''}`;
}
