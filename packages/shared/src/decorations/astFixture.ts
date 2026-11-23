import type { DecoratedEdge, DecoratedGraph, DecoratedNode } from './graph';

// A tiny builder for syntax trees as graphs (test helper): every syntax node is
// a graph node, and each parent has one `child` edge to each of its children.

export interface AstNode {
  node: DecoratedNode;
  children: AstNode[];
}

let counter = 0;

/** `ast('Block', { key: 'b' }, child1, child2)`; keys default to `Kind#n`. */
export function ast(
  kind: string,
  opts: { key?: string; name?: string } = {},
  ...children: AstNode[]
): AstNode {
  const key = opts.key ?? `${kind}#${++counter}`;
  return { node: { key, kind, ...(opts.name ? { name: opts.name } : {}) }, children };
}

/** Flattens trees into a graph. */
export function astGraph(...roots: AstNode[]): DecoratedGraph {
  const nodes: DecoratedNode[] = [];
  const edges: DecoratedEdge[] = [];
  const visit = (t: AstNode) => {
    nodes.push(t.node);
    for (const c of t.children) {
      edges.push({ from: t.node.key, to: c.node.key, kind: 'child' });
      visit(c);
    }
  };
  roots.forEach(visit);
  return { nodes, edges };
}

/** `if (cond) { body }`, with an optional else branch. */
export function ifStmt(key: string, body: AstNode[], otherwise?: AstNode[]): AstNode {
  return ast(
    'If',
    { key },
    ast('Expression'),
    ast('Block', { key: `${key}-then` }, ...body),
    ...(otherwise ? [ast('Else', { key: `${key}-else` }, ...otherwise)] : []),
  );
}
