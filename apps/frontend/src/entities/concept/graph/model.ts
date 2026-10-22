import type { Concept, ConceptField } from '../../../graphql/introspectionTypes';

// Walking the schema as a graph: from a root concept, each relation field leads
// to another concept, each scalar field is a property. A dot path such as
// "characters.results.origin.name" is a walk along relations, ending (or not)
// on a property.

export type ConceptLookup = (name: string) => Concept | undefined;

export interface SchemaWalk {
  /** Type of each concept on the walk, root first; the last one is the focus. */
  types: string[];
  /** Relation fields walked from the root (one fewer than `types`). */
  walked: string[];
  /** Property of the focus the path ends on, if any. */
  leaf?: string;
  /** Some concept on the walk is still being introspected. */
  loading: boolean;
  /** Segments of the path that match no field of the schema. */
  unresolved: string[];
}

export const splitPath = (path: string | undefined): string[] => (path ? path.split('.').filter(Boolean) : []);

export const joinPath = (segments: string[]): string => segments.join('.');

/**
 * Follows `segments` from `root` through relations. The walk stops at the first
 * concept not loaded yet (its type is already known from its parent's field),
 * or at the first segment that is not a relation: a property of the focus is
 * then the leaf, anything else is left unresolved.
 */
export function walkSchema(root: string, segments: string[], lookup: ConceptLookup): SchemaWalk {
  const types = [root];
  for (let i = 0; i < segments.length; i++) {
    const concept = lookup(types[i]);
    if (!concept) return { types, walked: segments.slice(0, i), loading: true, unresolved: [] };
    const field = concept.fields.find((f) => f.name === segments[i]);
    if (field && !field.isScalar) {
      types.push(field.typeName);
      continue;
    }
    const rest = segments.slice(i);
    const isLeaf = Boolean(field) && rest.length === 1;
    return {
      types,
      walked: segments.slice(0, i),
      leaf: isLeaf ? rest[0] : undefined,
      loading: false,
      unresolved: isLeaf ? [] : rest,
    };
  }
  return { types, walked: segments, loading: !lookup(types[types.length - 1]), unresolved: [] };
}

export type NodeKind = 'relation' | 'property';

export interface GraphNode {
  field: ConceptField;
  kind: NodeKind;
  x: number;
  y: number;
  /** Which side of the focus the node sits on: its label grows away from it. */
  side: 'left' | 'right';
}

export interface GraphLayout {
  width: number;
  height: number;
  center: { x: number; y: number };
  nodes: GraphNode[];
  /** Fields left out once a side is full. */
  hidden: number;
}

export interface LayoutOptions {
  width: number;
  /** Nodes shown on each side at most. */
  maxPerSide?: number;
  /** Vertical room per node. */
  rowHeight?: number;
}

const matchesFilter = (field: ConceptField, filter: string) => {
  const q = filter.trim().toLowerCase();
  return !q || field.name.toLowerCase().includes(q) || field.typeName.toLowerCase().includes(q);
};

const MAX_ANGLE = (70 * Math.PI) / 180;

/**
 * Points spread on an arc around the center, top to bottom, bulging towards
 * `side`, about `step` apart vertically: a few nodes stay level with the center.
 */
function arc(count: number, side: 'left' | 'right', cx: number, cy: number, rx: number, ry: number, step: number) {
  const sign = side === 'right' ? 1 : -1;
  const span = Math.min(MAX_ANGLE, Math.asin(Math.min(1, ((count - 1) * step) / 2 / ry)));
  return Array.from({ length: count }, (_, i) => {
    const t = count === 1 ? 0 : (i / (count - 1)) * 2 - 1;
    const angle = t * span;
    return { x: cx + sign * rx * Math.cos(angle), y: cy + ry * Math.sin(angle) };
  });
}

/**
 * Places a concept's fields around it: relations (where the walk can go on) on
 * the right, properties on the left. `filter` keeps the fields whose name or
 * type contains it.
 */
export function layoutGraph(concept: Concept, filter: string, options: LayoutOptions): GraphLayout {
  const { width, maxPerSide = 12, rowHeight = 30 } = options;
  const relations = concept.relationFields.filter((f) => matchesFilter(f, filter));
  const properties = concept.scalarFields.filter((f) => matchesFilter(f, filter));
  const shown = { relation: relations.slice(0, maxPerSide), property: properties.slice(0, maxPerSide) };
  const rows = Math.max(shown.relation.length, shown.property.length, 1);
  const height = Math.max(200, rows * rowHeight + 40);
  const center = { x: width / 2, y: height / 2 };
  const rx = width * 0.3;
  const ry = (height - 40) / 2 / Math.sin(MAX_ANGLE);

  const place = (fields: ConceptField[], kind: NodeKind, side: 'left' | 'right'): GraphNode[] =>
    arc(fields.length, side, center.x, center.y, rx, ry, rowHeight).map((p, i) => ({ field: fields[i], kind, side, ...p }));

  return {
    width,
    height,
    center,
    nodes: [...place(shown.relation, 'relation', 'right'), ...place(shown.property, 'property', 'left')],
    hidden: relations.length - shown.relation.length + properties.length - shown.property.length,
  };
}

/** How a field's type reads on its node: `[Episode]` for a list. */
export const typeLabel = (field: ConceptField): string => (field.isList ? `[${field.typeName}]` : field.typeName);

const CHAR_WIDTH = 6.6;
const MAX_CHARS = 26;

/** Text shortened to fit a node. */
export const clip = (text: string, max = MAX_CHARS): string => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

/** What a node reads: `episode: [Episode]`, shortened to fit. */
export const nodeLabel = (field: ConceptField): string => clip(`${field.name}: ${typeLabel(field)}`);

/** Width of a node, from its label. */
export const nodeWidth = (field: ConceptField): number => nodeLabel(field).length * CHAR_WIDTH + 18;

/** Where the edge from the center meets a node: the middle of its inner side. */
export const edgeEnd = (node: GraphNode): number => node.x + ((node.side === 'right' ? -1 : 1) * nodeWidth(node.field)) / 2;
