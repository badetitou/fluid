import { z } from 'zod';
import type { LinkTo, NetworkWidget } from '@fluid/shared';
import { getPath } from '../../data';
import { nodeLabel, type Row } from '../tree/treeModel';

export type { Row };

// Pure logic of the network widget: turns the bound rows (and the edge rows,
// if any) into nodes and directed edges, whichever way the links are encoded.

export interface NetworkNode {
  /** The node's id, as a string: unique within the network. */
  key: string;
  label: string;
  /** Value of `groupField`, when the node has one. */
  group?: string;
  row: Row;
  /** Not among the bound rows: added because a link points to it. */
  external: boolean;
}

export interface NetworkEdge {
  key: string;
  source: string;
  target: string;
}

export interface Network {
  nodes: NetworkNode[];
  edges: NetworkEdge[];
  /** The group values, in order of appearance. */
  groups: string[];
  /** Nodes linking to themselves: not drawn as edges, but decorators must see them. */
  selfLoops?: string[];
}

export type NetworkOptions = Pick<
  NetworkWidget,
  'idField' | 'labelField' | 'groupField' | 'linksField' | 'sourceField' | 'targetField' | 'missingNodes'
>;

const rowSchema = z.record(z.string(), z.unknown());
const idSchema = z.union([z.string().min(1), z.number().finite()]);

/** The rows of a bound value: a list (non-objects dropped) or a single object. */
export function rowsOf(value: unknown): Row[] {
  const items = Array.isArray(value) ? value : value == null ? [] : [value];
  return items.flatMap((item) => {
    const parsed = rowSchema.safeParse(item);
    return parsed.success && !Array.isArray(item) ? [parsed.data] : [];
  });
}

/** The id a value stands for: a scalar id, or the id field of an object holding it. */
export function idOf(value: unknown, idField: string): string | undefined {
  const direct = idSchema.safeParse(value);
  if (direct.success) return String(direct.data);
  const row = rowSchema.safeParse(value);
  if (!row.success || Array.isArray(value)) return undefined;
  const nested = idSchema.safeParse(getPath(row.data, idField));
  return nested.success ? String(nested.data) : undefined;
}

const listOf = (value: unknown): unknown[] => (Array.isArray(value) ? value : value == null ? [] : [value]);

function groupOf(row: Row, groupField?: string): string | undefined {
  if (!groupField) return undefined;
  const value = getPath(row, groupField);
  return value == null || value === '' || typeof value === 'object' ? undefined : String(value);
}

/** Builds the network: the bound rows as nodes, the links of `linksField` and of the edge rows as edges. */
export function buildNetwork(nodesData: unknown, edgesData: unknown, opts: NetworkOptions): Network {
  const idField = opts.idField ?? 'id';
  const nodes = new Map<string, NetworkNode>();
  const makeNode = (key: string, row: Row, external: boolean): NetworkNode => ({
    key,
    label: external && Object.keys(row).length === 0 ? key : nodeLabel(row, opts.labelField),
    group: groupOf(row, opts.groupField),
    row,
    external,
  });

  for (const row of rowsOf(nodesData)) {
    const key = idOf(getPath(row, idField), idField);
    if (key !== undefined && !nodes.has(key)) nodes.set(key, makeNode(key, row, false));
  }

  /** The node a link end stands for, added when missing (and allowed); undefined when dropped. */
  const endpoint = (value: unknown): string | undefined => {
    const key = idOf(value, idField);
    if (key === undefined) return undefined;
    const known = nodes.get(key);
    const row = rowSchema.safeParse(value);
    const linked = row.success && !Array.isArray(value) ? row.data : undefined;
    // A node first met as a bare id is completed by the first object that describes it.
    if (known && !(known.external && Object.keys(known.row).length === 0 && linked)) return key;
    if (!known && opts.missingNodes === 'ignore') return undefined;
    nodes.set(key, makeNode(key, linked ?? {}, true));
    return key;
  };

  const edges = new Map<string, NetworkEdge>();
  const selfLoops = new Set<string>();
  const addEdge = (source: string | undefined, target: string | undefined) => {
    if (source === undefined || target === undefined) return;
    if (source === target) {
      selfLoops.add(source);
      return;
    }
    const key = `${source}→${target}`;
    if (!edges.has(key)) edges.set(key, { key, source, target });
  };

  // Links are followed at any depth: a linked object listing its own links in
  // `linksField` (a nested selection, e.g. calls { calls { calls … } }) adds
  // those links too, and so on down, each object read once.
  if (opts.linksField) {
    const linksField = opts.linksField;
    const pending: [string, Row][] = [...nodes.values()].map((node) => [node.key, node.row]);
    const seen = new Set<Row>(pending.map(([, row]) => row));
    for (let i = 0; i < pending.length; i++) {
      const [source, row] = pending[i];
      for (const link of listOf(getPath(row, linksField))) {
        const target = endpoint(link);
        addEdge(source, target);
        const linked = rowSchema.safeParse(link);
        if (target === undefined || !linked.success || Array.isArray(link) || seen.has(link as Row)) continue;
        seen.add(link as Row);
        pending.push([target, link as Row]);
      }
    }
  }
  for (const row of rowsOf(edgesData)) {
    addEdge(endpoint(getPath(row, opts.sourceField ?? 'source')), endpoint(getPath(row, opts.targetField ?? 'target')));
  }

  const list = [...nodes.values()];
  const groups = [...new Set(list.flatMap((n) => (n.group === undefined ? [] : [n.group])))];
  return { nodes: list, edges: [...edges.values()], groups, ...(selfLoops.size > 0 ? { selfLoops: [...selfLoops] } : {}) };
}

/** Why there is nothing to draw, or null when there is a network. */
export function emptyReason(nodesData: unknown, network: Network, idField = 'id'): string | null {
  if (network.nodes.length > 0) return null;
  return rowsOf(nodesData).length === 0
    ? 'No nodes: the query returned no rows.'
    : `No node has an id: select "${idField}" in the query, or set "idField".`;
}

/** Why the network has no edge (nothing in the links field or the edge rows), or null when it has some. */
export function missingLinksReason(
  network: Network,
  opts: Pick<NetworkWidget, 'linksField' | 'sourceField' | 'targetField'>,
): string | null {
  if (network.edges.length > 0) return null;
  return opts.linksField
    ? `No links: no node lists other nodes in "${opts.linksField}".`
    : `No links: no edge row has both a "${opts.sourceField ?? 'source'}" and a "${opts.targetField ?? 'target'}".`;
}

/** How a node opens in a new column: the link of its group first, else the common one. */
export function linkFor(
  node: Pick<NetworkNode, 'group'>,
  widget: Pick<NetworkWidget, 'linkTo' | 'linkToByGroup'>,
): LinkTo | undefined {
  const byGroup = node.group === undefined ? undefined : widget.linkToByGroup?.[node.group];
  return byGroup ?? widget.linkTo;
}
