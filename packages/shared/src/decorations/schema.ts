import { z } from 'zod';

// -----------------------------------------------------------------------------
// Graph decorators: the declarative language
// -----------------------------------------------------------------------------
// A decorator reads a graph (nodes + edges with a stable key) and adds to it:
// - derived edges (e.g. a front-end HTTP call joined to the back-end endpoint),
// - tags on nodes, from *concepts* (layers, services, domains…),
// - findings on nodes and edges, from *constraints* (rules with a severity).
// Every construct maps to a Cypher pattern (see `cypher.ts`), so a graph engine
// can run the same rules later.

export const severitySchema = z.enum(['error', 'warning', 'info']);
export type Severity = z.infer<typeof severitySchema>;

const scalarSchema = z.union([z.string(), z.number(), z.boolean()]);

/** A test on one property: a value to equal, or comparisons. */
export const propMatcherSchema = z.union([
  scalarSchema,
  z
    .object({
      eq: scalarSchema.optional(),
      ne: scalarSchema.optional(),
      gt: z.number().optional(),
      gte: z.number().optional(),
      lt: z.number().optional(),
      lte: z.number().optional(),
      regex: z.string().optional(),
      exists: z.boolean().optional(),
    })
    .strict(),
]);
export type PropMatcher = z.infer<typeof propMatcherSchema>;

const oneOrMany = z.union([z.string(), z.array(z.string())]);

/** Which nodes a rule is about. Every field given must hold (AND). */
/** A condition on the neighbours of a node: how many of them match. */
export interface Neighbours {
  /** Edge kinds followed; every kind when omitted. */
  via?: string[];
  match: Selector;
  /** At least this many neighbours match (default `min(1, max)`: 1, or 0 when `max` is 0). */
  min?: number;
  /** At most this many neighbours match (default no limit). */
  max?: number;
}

export interface Selector {
  key?: string | string[];
  kind?: string | string[];
  fineKind?: string | string[];
  /** Regular expression on the name. */
  name?: string;
  /** Glob on the file path: `*` within a segment, `**` across segments. */
  file?: string;
  language?: string | string[];
  external?: boolean;
  /** The node has at least one of these tags. */
  tag?: string | string[];
  /** Tests on `props`, by dotted path. */
  props?: Record<string, PropMatcher>;
  not?: Selector;
  all?: Selector[];
  any?: Selector[];
  /** The number of out-neighbours (over `via` edges) that match lies in [min, max]. */
  has?: Neighbours;
  /** The same, over in-neighbours. */
  in?: Neighbours;
  /** The source of the incoming `child` edge matches. */
  parent?: Selector;
  /** Some node up the `child` chain matches. */
  ancestor?: Selector;
}

const neighboursSchema: z.ZodType<Neighbours> = z.lazy(() =>
  z
    .object({
      via: z.array(z.string()).optional(),
      match: selectorSchema,
      min: z.number().int().min(0).optional(),
      max: z.number().int().min(0).optional(),
    })
    .strict(),
);

export const selectorSchema: z.ZodType<Selector> = z.lazy(() =>
  z
    .object({
      key: oneOrMany.optional(),
      kind: oneOrMany.optional(),
      fineKind: oneOrMany.optional(),
      name: z.string().optional(),
      file: z.string().optional(),
      language: oneOrMany.optional(),
      external: z.boolean().optional(),
      tag: oneOrMany.optional(),
      props: z.record(z.string(), propMatcherSchema).optional(),
      not: selectorSchema.optional(),
      all: z.array(selectorSchema).optional(),
      any: z.array(selectorSchema).optional(),
      has: neighboursSchema.optional(),
      in: neighboursSchema.optional(),
      parent: selectorSchema.optional(),
      ancestor: selectorSchema.optional(),
    })
    .strict(),
);

const idSchema = z.string().regex(/^[a-zA-Z0-9][\w.-]*$/, 'letters, digits, ".", "-" or "_"');
const tagSchema = z.string().regex(/^[\w:.-]+$/, 'letters, digits, ":", ".", "-" or "_"');

/** Tags the nodes it matches: a fixed tag, or one read from a field with a regex group. */
export const conceptSchema = z
  .object({
    id: idSchema,
    description: z.string().optional(),
    match: selectorSchema.default({}),
    tag: tagSchema.optional(),
    tagFrom: z
      .object({
        /** `name`, `file`, `kind`… or `props.<path>`. */
        field: z.string().min(1),
        /** The first capture group (or the whole match) becomes the tag. */
        pattern: z.string().min(1),
        prefix: z.string().optional(),
      })
      .strict()
      .optional(),
  })
  .strict()
  .refine(
    (c) => (c.tag === undefined) !== (c.tagFrom === undefined),
    'give either "tag" or "tagFrom"',
  );
export type Concept = z.infer<typeof conceptSchema>;

const ruleBase = {
  id: idSchema,
  severity: severitySchema.default('warning'),
  message: z.string().min(1),
  description: z.string().optional(),
  /** Edge kinds followed (calls, references…); every kind when omitted. */
  via: z.array(z.string()).optional(),
};

export const constraintSchema = z.discriminatedUnion('check', [
  /** Every matching node is a finding (e.g. "a class with more than 50 methods"). */
  z.object({ check: z.literal('node'), ...ruleBase, match: selectorSchema }).strict(),
  /** No edge (or path, when `reachable`) from a `from` node to a `to` node. */
  z
    .object({
      check: z.literal('forbidden'),
      ...ruleBase,
      from: selectorSchema,
      to: selectorSchema,
      reachable: z.boolean().optional(),
    })
    .strict(),
  /** Every `from` node has at least one edge to a `to` node. */
  z
    .object({ check: z.literal('required'), ...ruleBase, from: selectorSchema, to: selectorSchema })
    .strict(),
  /** Every matching node has no incoming edge (of the `via` kinds): unused, never called. */
  z.object({ check: z.literal('unreferenced'), ...ruleBase, match: selectorSchema }).strict(),
  /** No cycle among the matching nodes. */
  z
    .object({ check: z.literal('noCycle'), ...ruleBase, among: selectorSchema.default({}) })
    .strict(),
]);
export type Constraint = z.infer<typeof constraintSchema>;

const joinFieldSchema = z.union([z.string().min(1), z.array(z.string().min(1)).min(1)]);

/** Adds an edge between nodes whose two fields agree (e.g. a call URL and an endpoint path). */
export const derivedEdgeSchema = z
  .object({
    id: idSchema,
    kind: z.string().min(1),
    description: z.string().optional(),
    from: selectorSchema,
    to: selectorSchema,
    join: z
      .object({
        /** One field, or several that must all agree (a composite key). */
        from: joinFieldSchema,
        to: joinFieldSchema,
        /** `url`: ignore host, query, trailing slash and path parameters. */
        normalize: z.enum(['exact', 'url']).default('exact'),
      })
      .strict(),
  })
  .strict();
export type DerivedEdge = z.infer<typeof derivedEdgeSchema>;

/** Findings read from an analyser's log file (SARIF), placed on nodes by file and line. */
export const importSchema = z
  .object({
    id: idSchema,
    format: z.literal('sarif'),
    /** Absolute, or relative to the plugin manifest (page when not installed from a URL). */
    url: z.string().min(1),
    /** Prefix(es) cut from the log's file paths so they match the graph's `file`. */
    stripPrefix: z.union([z.string(), z.array(z.string())]).optional(),
    addPrefix: z.string().optional(),
    /** Only nodes of these kinds receive findings. */
    kinds: z.array(z.string()).optional(),
    description: z.string().optional(),
  })
  .strict();
export type DecoratorImport = z.infer<typeof importSchema>;

export const decoratorSpecSchema = z
  .object({
    id: idSchema,
    label: z.string().min(1),
    description: z.string().optional(),
    derived: z.array(derivedEdgeSchema).default([]),
    concepts: z.array(conceptSchema).default([]),
    constraints: z.array(constraintSchema).default([]),
    imports: z
      .array(importSchema)
      .default([])
      .refine((list) => new Set(list.map((i) => i.id)).size === list.length, 'import ids must be unique'),
  })
  .strict();
export type DecoratorSpec = z.infer<typeof decoratorSpecSchema>;
export type DecoratorSpecInput = z.input<typeof decoratorSpecSchema>;
