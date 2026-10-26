import type { SankeyWidget } from '@fluid/shared';
import { asRows, getPath } from '../../data';

// Reads the flows of a sankey from its rows: link rows (source → target, a
// value) or element rows (group, targets, target group), summed group → group.

export type Row = Record<string, unknown>;

/** A node of the diagram: a group, with the rows that belong to it. */
export interface FlowNode {
  key: string;
  /** Order of first appearance: picks the node's color. */
  index: number;
  rows: Row[];
}

/** A flow between two nodes, with the rows behind it. */
export interface FlowLink {
  source: string;
  target: string;
  value: number;
  rows: Row[];
}

export interface FlowGraph {
  nodes: FlowNode[];
  links: FlowLink[];
  /** Number of bound rows. */
  rowCount: number;
  /** Links from a group to itself, left out of the diagram. */
  selfLinks: number;
}

/** Above this many nodes the diagram is unreadable: the widget asks to filter instead. */
export const MAX_NODES = 120;

const LABEL_KEYS = ['name', 'label', 'title', 'id'];

/** The node keys a value names: a label or id, an object holding one, or a list of them. */
export function keysOf(value: unknown): string[] {
  if (value == null || value === '') return [];
  if (Array.isArray(value)) return value.flatMap(keysOf);
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const key = LABEL_KEYS.find((k) => record[k] != null && record[k] !== '');
    return key ? keysOf(record[key]) : [];
  }
  return [String(value)];
}

function weightOf(holder: unknown, field: string | undefined): number {
  if (!field) return 1;
  const raw = getPath(holder, field);
  const n = typeof raw === 'number' ? raw : Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

class GraphBuilder {
  private readonly nodes = new Map<string, FlowNode>();
  private readonly owned = new Map<string, Set<Row>>();
  private readonly links = new Map<string, FlowLink>();
  selfLinks = 0;

  node(key: string): FlowNode {
    let node = this.nodes.get(key);
    if (!node) {
      node = { key, index: this.nodes.size, rows: [] };
      this.nodes.set(key, node);
    }
    return node;
  }

  /** `row` belongs to the group `key` (element rows), whether or not it links out. */
  own(key: string, row: Row) {
    const rows = this.owned.get(key) ?? new Set<Row>();
    rows.add(row);
    this.owned.set(key, rows);
  }

  link(source: string, target: string, value: number, row: Row) {
    if (value <= 0) return;
    if (source === target) {
      this.selfLinks += 1;
      return;
    }
    const id = JSON.stringify([source, target]);
    const link = this.links.get(id) ?? { source, target, value: 0, rows: [] };
    link.value += value;
    // Rows are read one at a time: a row already behind this link is its last one.
    if (link.rows[link.rows.length - 1] !== row) link.rows.push(row);
    this.links.set(id, link);
    this.node(source);
    this.node(target);
  }

  build(rowCount: number): FlowGraph {
    const links = [...this.links.values()];
    const nodes = [...this.nodes.values()].map((node) => {
      const owned = this.owned.get(node.key);
      if (owned) return { ...node, rows: [...owned] };
      const rows = new Set<Row>();
      for (const l of links) if (l.source === node.key || l.target === node.key) l.rows.forEach((r) => rows.add(r));
      return { ...node, rows: [...rows] };
    });
    return { nodes, links, rowCount, selfLinks: this.selfLinks };
  }
}

function linkRows(rows: Row[], widget: SankeyWidget, builder: GraphBuilder) {
  for (const row of rows) {
    const value = weightOf(row, widget.valueField);
    const targets = keysOf(getPath(row, widget.targetField));
    for (const source of keysOf(getPath(row, widget.sourceField))) {
      for (const target of targets) builder.link(source, target, value, row);
    }
  }
}

function elementRows(rows: Row[], widget: SankeyWidget, builder: GraphBuilder) {
  const targetGroupField = widget.targetGroupField ?? widget.groupField;
  for (const row of rows) {
    const groups = keysOf(getPath(row, widget.groupField));
    groups.forEach((g) => builder.own(g, row));
    const raw = getPath(row, widget.targetsField);
    const targets = Array.isArray(raw) ? raw : raw == null ? [] : [raw];
    for (const target of targets) {
      // A scalar target already names its group.
      const targetGroups = target !== null && typeof target === 'object' ? keysOf(getPath(target, targetGroupField)) : keysOf(target);
      const value = weightOf(target, widget.valueField);
      for (const source of groups) for (const tg of targetGroups) builder.link(source, tg, value, row);
    }
  }
}

/** Whether the widget reads element rows (group, targets) rather than link rows. */
export const readsElements = (widget: SankeyWidget) =>
  !(widget.sourceField && widget.targetField) && Boolean(widget.groupField && widget.targetsField);

/** The nodes and flows the bound data describes. */
export function buildFlows(data: unknown, widget: SankeyWidget): FlowGraph {
  const rows = asRows(data);
  const builder = new GraphBuilder();
  if (readsElements(widget)) elementRows(rows, widget, builder);
  else linkRows(rows, widget, builder);
  return builder.build(rows.length);
}

/** Why there is no diagram to draw, or undefined when there is one. */
export function emptyReason(graph: FlowGraph, widget: SankeyWidget): string | undefined {
  if (graph.rowCount === 0) return 'No data';
  if (graph.nodes.length > MAX_NODES) {
    return `Too many nodes (${graph.nodes.length}): filter or group the rows (at most ${MAX_NODES}).`;
  }
  if (graph.links.length > 0) return undefined;
  if (graph.selfLinks > 0) return 'Every flow stays inside its own group: nothing flows between groups.';
  if (readsElements(widget)) {
    return `No flow: "${widget.targetsField}" is empty, or its targets have no "${widget.targetGroupField ?? widget.groupField}" (select it in the query).`;
  }
  return `No flow: no row has both "${widget.sourceField}" and "${widget.targetField}" (select them in the query).`;
}

/** What a click on a node emits on `selected`. */
export const nodeSelection = (node: FlowNode) => ({ group: node.key, rows: node.rows });

/** What a click on a ribbon emits on `selected`. */
export const linkSelection = (link: FlowLink) => ({
  source: link.source,
  target: link.target,
  value: link.value,
  rows: link.rows,
});

/** A flow value, as written on the diagram. */
export const formatFlow = (value: number) => (Number.isInteger(value) ? String(value) : value.toFixed(2));
