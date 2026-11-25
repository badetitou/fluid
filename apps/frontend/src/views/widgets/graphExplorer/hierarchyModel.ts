import type { GraphExplorerWidget } from '@fluid/shared';
import { getPath } from '../../data';
import { focusNetwork, type FocusDirection } from '../network/focusModel';
import type { Network } from '../network/networkModel';
import { layoutHierarchy } from './hierarchyLayout';

// Pure HNode-style model: containment boxes, links aggregated to the closest
// visible ancestor, and a deterministic packed layout. No React, no renderer.

export type HierarchyKind = 'root' | 'container' | 'leaf';

export interface HierarchyNode {
  key: string;
  label: string;
  kind: HierarchyKind;
  row: Record<string, unknown>;
  group?: string;
  parent?: string;
  children: string[];
  count: number;
  depth: number;
  x: number;
  y: number;
  width: number;
  height: number;
  expandable: boolean;
}

export interface HierarchyEdge {
  key: string;
  source: string;
  target: string;
  weight: number;
}

export interface ContainerInfo {
  key: string;
  label: string;
  depth: number;
  count: number;
}

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface HierarchyGraph {
  nodes: HierarchyNode[];
  byKey: ReadonlyMap<string, HierarchyNode>;
  edges: HierarchyEdge[];
  containers: ContainerInfo[];
  bounds: Bounds;
  totalLeaves: number;
  visibleLeaves: number;
  hidden: number;
}

export interface HierarchyOptions {
  expanded?: readonly string[];
  collapsedGroups?: readonly string[];
  focus?: { key: string; depth: number; direction: FocusDirection };
}

export interface HierarchyDraft extends Omit<HierarchyNode, 'x' | 'y' | 'width' | 'height' | 'expandable'> {}

export const ROOT_KEY = 'h:root';

/** `hierarchyFields` wins; `groupByField` stays as the single-level shorthand. */
export function containmentFields(widget: GraphExplorerWidget): string[] {
  return widget.hierarchyFields?.length ? [...widget.hierarchyFields] : widget.groupByField ? [widget.groupByField] : [];
}

function pathValues(row: Record<string, unknown>, fields: readonly string[]): string[] {
  return fields
    .map((field) => getPath(row, field))
    .filter((value) => value !== undefined && value !== null && value !== '' && typeof value !== 'object')
    .map((value) => String(value));
}

const containerKey = (depth: number, parts: readonly string[]): string => `h:${depth}:${parts.join('/')}`;

function buildDrafts(network: Network, widget: GraphExplorerWidget): Map<string, HierarchyDraft> {
  const fields = containmentFields(widget);
  const drafts = new Map<string, HierarchyDraft>();
  const root: HierarchyDraft = {
    key: ROOT_KEY,
    label: widget.title ?? 'All',
    kind: 'root',
    row: { name: widget.title ?? 'All' },
    children: [],
    count: network.nodes.length,
    depth: 0,
  };
  drafts.set(root.key, root);
  for (const node of network.nodes) {
    const parts = pathValues(node.row, fields);
    let parent = ROOT_KEY;
    parts.forEach((value, depth) => {
      const key = containerKey(depth, parts.slice(0, depth + 1));
      let container = drafts.get(key);
      if (!container) {
        container = {
          key,
          label: value,
          kind: 'container',
          row: { name: value },
          parent,
          children: [],
          count: 0,
          depth: depth + 1,
        };
        drafts.set(key, container);
        drafts.get(parent)?.children.push(key);
      }
      container.count += 1;
      parent = key;
    });
    drafts.set(node.key, {
      key: node.key,
      label: node.label,
      kind: 'leaf',
      row: node.row,
      group: node.group,
      parent,
      children: [],
      count: 1,
      depth: parts.length,
    });
    drafts.get(parent)?.children.push(node.key);
  }
  return drafts;
}

function descendantLeaves(key: string, drafts: ReadonlyMap<string, HierarchyDraft>): string[] {
  const draft = drafts.get(key);
  if (!draft) return [];
  if (draft.kind === 'leaf') return [key];
  return draft.children.flatMap((child) => descendantLeaves(child, drafts));
}

function focusLeaves(network: Network, focus: NonNullable<HierarchyOptions['focus']>, drafts: Map<string, HierarchyDraft>): Set<string> {
  const isLeaf = network.nodes.some((node) => node.key === focus.key);
  const keys = isLeaf ? [focus.key] : descendantLeaves(focus.key, drafts);
  const focused = new Set<string>();
  for (const key of keys) {
    for (const node of focusNetwork(network, key, focus.depth, focus.direction).nodes) focused.add(node.key);
  }
  return focused;
}

function visibleKeys(drafts: Map<string, HierarchyDraft>, options: HierarchyOptions, network: Network): Set<string> {
  const collapsed = new Set(options.collapsedGroups ?? []);
  const focused = options.focus ? focusLeaves(network, options.focus, drafts) : undefined;
  const visible = new Set<string>();
  const visit = (key: string): boolean => {
    const draft = drafts.get(key);
    if (!draft) return false;
    if (draft.kind === 'container' && collapsed.has(key)) {
      const relevant = !focused || descendantLeaves(key, drafts).some((leaf) => focused.has(leaf));
      if (relevant) visible.add(key);
      return relevant;
    }
    if (draft.kind === 'leaf' && focused && !focused.has(key)) return false;
    const children = draft.children.filter(visit);
    if (draft.kind === 'root' || draft.kind === 'container') {
      if (children.length === 0) return false;
      visible.add(key);
      return true;
    }
    visible.add(key);
    return true;
  };
  visit(ROOT_KEY);
  return visible;
}

function aggregateEdges(network: Network, drafts: Map<string, HierarchyDraft>, visible: ReadonlySet<string>): HierarchyEdge[] {
  const ancestor = (id: string): string | undefined => {
    let key: string | undefined = id;
    while (key && !visible.has(key)) key = drafts.get(key)?.parent;
    return key && visible.has(key) ? key : undefined;
  };
  const edges = new Map<string, HierarchyEdge>();
  for (const edge of network.edges) {
    const source = ancestor(edge.source);
    const target = ancestor(edge.target);
    if (!source || !target || source === target) continue;
    const key = `${source}→${target}`;
    const found = edges.get(key);
    if (found) found.weight += 1;
    else edges.set(key, { key, source, target, weight: 1 });
  }
  return [...edges.values()];
}

/** Builds the visible hierarchy, its aggregated links and the packed layout. */
export function buildHierarchy(network: Network, widget: GraphExplorerWidget, options: HierarchyOptions = {}): HierarchyGraph {
  const drafts = buildDrafts(network, widget);
  const visible = visibleKeys(drafts, options, network);
  const { nodes, bounds } = layoutHierarchy(drafts, visible, new Set(options.expanded ?? []), widget);
  return {
    nodes,
    byKey: new Map(nodes.map((node) => [node.key, node])),
    edges: aggregateEdges(network, drafts, visible),
    containers: [...drafts.values()]
      .filter((draft) => draft.kind === 'container')
      .map(({ key, label, depth, count }) => ({ key, label, depth, count })),
    bounds,
    totalLeaves: network.nodes.length,
    visibleLeaves: nodes.filter((n) => n.kind === 'leaf').length,
    hidden: network.nodes.length - nodes.filter((n) => n.kind === 'leaf').length,
  };
}

/** Groups folded on first render: none in a network overview, large ones in a tree. */
export function initialHierarchyState(graph: HierarchyGraph, widget: GraphExplorerWidget): {
  expanded: string[];
  collapsedGroups: string[];
} {
  const threshold = widget.overview === 'tree' ? (widget.collapseAbove ?? 40) : 0;
  const collapsed = threshold === 0 ? [] : graph.containers.filter((c) => c.count > threshold).map((c) => c.key);
  return { expanded: [...(widget.initialExpanded ?? [])], collapsedGroups: collapsed };
}
