import type { CodeRules, DecoratedEdge, DecoratedGraph, DecoratedNode } from '@fluid/shared';
import { getPath } from '../../data';
import type { DecorationIndex } from '../../plugin-api/decorationModel';
import { readPosition, type Annotation } from './annotationModel';

// Pure logic of the code widget's rules: the rows of a syntax tree become a graph the
// graph decorators run on, and their findings come back as annotations of the source.

const text = (value: unknown): string | undefined =>
  typeof value === 'string' || typeof value === 'number' ? String(value) : undefined;

/** The id a parent field holds: a plain id, or an object carrying it. */
function parentId(value: unknown, idField: string): string | undefined {
  return text(value) ?? text(getPath(value, idField));
}

/** One node per row (`props` is the row) and a `child` edge from each parent to its children. */
export function astRowsToGraph(rows: unknown[], fields: CodeRules): DecoratedGraph {
  const idField = fields.idField ?? 'id';
  const nodes: DecoratedNode[] = [];
  const edges: DecoratedEdge[] = [];
  const parents = new Map<string, string>();
  for (const row of rows) {
    const key = text(getPath(row, idField));
    // Rows without an id are skipped; the first of two rows sharing an id wins.
    if (key === undefined || key === '' || parents.has(key)) continue;
    const kind = text(getPath(row, fields.kindField ?? 'kind'));
    const name = text(getPath(row, fields.nameField ?? 'name'));
    nodes.push({
      key,
      ...(kind !== undefined ? { kind } : {}),
      ...(name !== undefined ? { name } : {}),
      props: typeof row === 'object' && row !== null ? (row as Record<string, unknown>) : {},
    });
    const parent = parentId(getPath(row, fields.parentField), idField);
    parents.set(key, parent ?? '');
  }
  for (const [key, parent] of parents) {
    // No edge to a parent that is not among the rows.
    if (parent !== '' && parents.has(parent)) edges.push({ from: parent, to: key, kind: 'child' });
  }
  return { nodes, edges };
}

/** One annotation per finding on a node, at the node's position; rows without a position are skipped. */
export function findingsToAnnotations(
  index: DecorationIndex,
  rows: unknown[],
  fields: CodeRules,
  source: string,
): Annotation[] {
  const idField = fields.idField ?? 'id';
  const seen = new Set<string>();
  return rows.flatMap((row) => {
    const key = text(getPath(row, idField)) ?? '';
    // Same rule as the graph: the first row of an id is the node.
    if (seen.has(key)) return [];
    seen.add(key);
    const findings = index.nodes.get(key)?.findings ?? [];
    if (findings.length === 0) return [];
    const range = readPosition(row, fields, source);
    if (!range) return [];
    return findings.map((f) => ({ ...range, message: f.message, severity: f.severity, rule: f.ruleId }));
  });
}
