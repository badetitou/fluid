import type { LinkTo, TreeWidget } from '@fluid/shared';
import { getPath } from '../../data';

// Pure logic of the tree widget: turns the bound rows into a forest of nodes,
// whichever way the hierarchy is encoded (see the widget schema).

export type Row = Record<string, unknown>;

export interface TreeNode {
  /** Unique within the tree: the path of keys from the root. */
  key: string;
  label: string;
  row: Row;
  depth: number;
  children?: TreeNode[];
}

type TreeOptions = Pick<TreeWidget, 'childrenField' | 'parentField' | 'keyField' | 'labelField'>;

/** Guards against cyclic data (a node listed among its own descendants). */
const MAX_DEPTH = 32;
const LABEL_FIELDS = ['name', 'title', 'label', 'displayName', 'fullName', 'filename', 'path', 'code', 'id'];

const isRow = (value: unknown): value is Row => value != null && typeof value === 'object' && !Array.isArray(value);

function asRowList(value: unknown): Row[] {
  if (Array.isArray(value)) return value.filter(isRow);
  return isRow(value) ? [value] : [];
}

/** The text a node is labelled with: `labelField`, else the first label-ish field it has. */
export function nodeLabel(row: Row, labelField?: string): string {
  const fields = labelField ? [labelField, ...LABEL_FIELDS] : LABEL_FIELDS;
  for (const field of fields) {
    const value = getPath(row, field);
    if (value != null && value !== '' && typeof value !== 'object') return String(value);
  }
  return '(unnamed)';
}

function rowKey(row: Row, keyField = 'id'): string | undefined {
  const value = getPath(row, keyField);
  return value == null || typeof value === 'object' ? undefined : String(value);
}

/** The field holding a node's children at `depth`, if any. */
function childrenFieldAt(childrenField: TreeOptions['childrenField'], depth: number): string | undefined {
  if (Array.isArray(childrenField)) return childrenField[depth];
  return childrenField;
}

function nestedNode(row: Row, index: number, parentKey: string, depth: number, opts: TreeOptions): TreeNode {
  const key = `${parentKey}/${rowKey(row, opts.keyField) ?? `#${index}`}`;
  const node: TreeNode = { key, label: nodeLabel(row, opts.labelField), row, depth };
  const field = childrenFieldAt(opts.childrenField, depth);
  if (field && depth < MAX_DEPTH) {
    const kids = asRowList(getPath(row, field));
    if (kids.length) node.children = kids.map((kid, i) => nestedNode(kid, i, key, depth + 1, opts));
  }
  return node;
}

/** Keys of every row nested under a recursive `childrenField`, at any depth. */
function descendantKeys(rows: Row[], field: string, keyField?: string): Set<string> {
  const keys = new Set<string>();
  const visit = (row: Row, depth: number) => {
    if (depth > MAX_DEPTH) return;
    for (const kid of asRowList(getPath(row, field))) {
      const key = rowKey(kid, keyField);
      if (key !== undefined) keys.add(key);
      visit(kid, depth + 1);
    }
  };
  rows.forEach((row) => visit(row, 0));
  return keys;
}

function fromParents(rows: Row[], parentField: string, opts: TreeOptions): TreeNode[] {
  const known = new Set(rows.map((r) => rowKey(r, opts.keyField)).filter((k) => k !== undefined));
  const byParent = new Map<string | undefined, Row[]>();
  for (const row of rows) {
    const parent = rowKey(row, parentField);
    const slot = parent !== undefined && known.has(parent) && parent !== rowKey(row, opts.keyField) ? parent : undefined;
    byParent.set(slot, [...(byParent.get(slot) ?? []), row]);
  }
  const build = (row: Row, index: number, parentKey: string, depth: number): TreeNode => {
    const own = rowKey(row, opts.keyField);
    const key = `${parentKey}/${own ?? `#${index}`}`;
    const kids = own !== undefined && depth < MAX_DEPTH ? byParent.get(own) ?? [] : [];
    const node: TreeNode = { key, label: nodeLabel(row, opts.labelField), row, depth };
    if (kids.length) node.children = kids.map((kid, i) => build(kid, i, key, depth + 1));
    return node;
  };
  return (byParent.get(undefined) ?? []).map((row, i) => build(row, i, '', 0));
}

/** Build the forest a tree widget shows from its bound rows. */
export function buildTree(data: unknown, opts: TreeOptions): TreeNode[] {
  let rows = asRowList(data);
  if (opts.parentField) return fromParents(rows, opts.parentField, opts);
  // A list of every node with recursive children: keep only the roots.
  if (typeof opts.childrenField === 'string') {
    const nested = descendantKeys(rows, opts.childrenField, opts.keyField);
    if (nested.size) rows = rows.filter((row) => !nested.has(rowKey(row, opts.keyField) ?? ''));
  }
  return rows.map((row, i) => nestedNode(row, i, '', 0, opts));
}

/** Keys of the nodes above `depth`, i.e. those expanded when `depth` levels are open. */
export function expandedKeys(nodes: TreeNode[], depth: number): string[] {
  const out: string[] = [];
  const visit = (node: TreeNode) => {
    if (node.depth >= depth || !node.children) return;
    out.push(node.key);
    node.children.forEach(visit);
  };
  nodes.forEach(visit);
  return out;
}

/** Number of nodes in a forest. */
export function countNodes(nodes: TreeNode[]): number {
  return nodes.reduce((n, node) => n + 1 + countNodes(node.children ?? []), 0);
}

/** Where a click on a node at `depth` leads: the widget's link, or its link for that level. */
export function linkAt(linkTo: TreeWidget['linkTo'], depth: number): LinkTo | undefined {
  if (!linkTo) return undefined;
  if (Array.isArray(linkTo)) return linkTo[depth] ?? undefined;
  return linkTo;
}
