import { z } from 'zod';
import { severitySchema } from './schema';

// -----------------------------------------------------------------------------
// The graph a decorator reads, and what it gives back
// -----------------------------------------------------------------------------
// Nodes and edges are plain data so any source can provide them: model-graphql
// entities and relations, or the rows of any GraphQL API a widget shows.

export const decoratedNodeSchema = z.object({
  key: z.string().min(1),
  kind: z.string().optional(),
  fineKind: z.string().optional(),
  name: z.string().optional(),
  file: z.string().optional(),
  language: z.string().optional(),
  external: z.boolean().optional(),
  /** Tags the source already has (e.g. tags computed by Moose). */
  tags: z.array(z.string()).optional(),
  props: z.record(z.string(), z.unknown()).optional(),
});
export type DecoratedNode = z.infer<typeof decoratedNodeSchema>;

export const decoratedEdgeSchema = z.object({
  /** Defaults to `from->to:kind`. */
  key: z.string().optional(),
  from: z.string().min(1),
  to: z.string().min(1),
  kind: z.string().optional(),
});
export type DecoratedEdge = z.infer<typeof decoratedEdgeSchema>;

export const decoratedGraphSchema = z.object({
  nodes: z.array(decoratedNodeSchema),
  edges: z.array(decoratedEdgeSchema),
});
export type DecoratedGraph = z.infer<typeof decoratedGraphSchema>;

export const findingSchema = z.object({
  decoratorId: z.string(),
  ruleId: z.string(),
  severity: severitySchema,
  message: z.string(),
  /** Keys of the other nodes involved (the forbidden target, the cycle…). */
  related: z.array(z.string()).optional(),
});
export type Finding = z.infer<typeof findingSchema>;

export const decorationSchema = z.object({
  target: z.object({ type: z.enum(['node', 'edge']), key: z.string() }),
  tags: z.array(z.string()),
  findings: z.array(findingSchema),
});
export type Decoration = z.infer<typeof decorationSchema>;

export interface DecorationResult {
  decorations: Decoration[];
  /** Edges the decorators added; they are part of the graph rules ran on. */
  derivedEdges: DecoratedEdge[];
  /** Imported findings that matched no node, by `${decoratorId}/${importId}` (only when > 0). */
  unmatched?: Record<string, number>;
}

export function edgeKey(edge: DecoratedEdge): string {
  return edge.key ?? `${edge.from}->${edge.to}:${edge.kind ?? ''}`;
}
