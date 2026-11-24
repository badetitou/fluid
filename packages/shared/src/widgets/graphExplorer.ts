import { z } from 'zod';
import type { GraphExplorerIntent, GraphExplorerWidget, ViewSpec } from '../view-spec';
import { columnSchema, dataBindingSchema, linkToSchema, widgetBase } from './common';
import {
  GRAPH_DETAIL_ID_VARIABLE,
  GRAPH_DETAIL_QUERY,
  GRAPH_NODE_QUERY,
  GRAPH_EXPLORER_PRESETS,
  graphExplorerPresetSchema,
  type GraphExplorerPreset,
  type GraphExplorerPresetName,
} from './graphExplorerPresets';

export {
  GRAPH_DETAIL_ID_VARIABLE,
  GRAPH_DETAIL_QUERY,
  GRAPH_NODE_QUERY,
  GRAPH_EXPLORER_PRESETS,
  graphExplorerPresetSchema,
};
export type { GraphExplorerPreset, GraphExplorerPresetName };

/**
 * A hierarchical, expandable graph: `groupByField` folds nodes into composite
 * boxes; expanding a node reveals its nested `widgets` (a card, its source…).
 * Interaction state is session-only: the view keeps only its defaults
 * (`initialExpanded`, `collapseAbove`). Links and node fields keep the `network`
 * semantics; `groupField` only colors nodes. `detailQuery` names a lazy view
 * query declaring `$nodeId`, run for the expanded node as `$detail`.
 * The recursive `widgets` field is added in `view-spec.ts` to avoid a cycle.
 */
export const graphExplorerFields = {
  ...widgetBase,
  /** The nodes. */
  data: dataBindingSchema,
  /** Edge rows (one per link), when the nodes do not list their links. */
  edges: dataBindingSchema.optional(),
  /** Dot path of an edge's source id, or of an object holding it (default "source"). */
  sourceField: z.string().min(1).optional(),
  /** Dot path of an edge's target id, or of an object holding it (default "target"). */
  targetField: z.string().min(1).optional(),
  /** Dot path of a list in each node: the ids (or objects) it points to. */
  linksField: z.string().min(1).optional(),
  /** Links to items that are not nodes: added as nodes (default) or ignored. */
  missingNodes: z.enum(['add', 'ignore']).optional(),
  /** Dot path of a node's id, unique across every node (default "id"). */
  idField: z.string().min(1).optional(),
  /** Dot path of a node's label (default: name, title, label… whichever the row has). */
  labelField: z.string().min(1).optional(),
  /** Dot path of a node's kind: colors nodes and picks `linkToByGroup`. */
  groupField: z.string().min(1).optional(),
  /** Numeric field scaling the nodes (default: their number of links). */
  sizeField: z.string().min(1).optional(),
  /** Lines shown under the label on hover (default: the group). */
  tooltipFields: z.array(columnSchema).optional(),
  /** Dot path used to fold nodes into composite group boxes. */
  groupByField: z.string().min(1).optional(),
  /** First overview of the graph: a node-link map or a folded hierarchy. */
  overview: z.enum(['network', 'tree']).optional(),
  /** Node placement: `force` (default) or `layered`. */
  graphLayout: z.enum(['force', 'layered']).optional(),
  /** Direction of a layered layout: top to bottom (default) or left to right. */
  direction: z.enum(['TB', 'LR']).optional(),
  /** Lazy view query run for an expanded node; it must declare `$nodeId` and may use a `source`. */
  detailQuery: z.string().min(1).optional(),
  /** Dot path of the node id passed to `$nodeId` (default "id"). */
  detailIdField: z.string().min(1).optional(),
  /** Dot path into the detail result given to nested widgets bound to `$detail`. */
  detailPath: z.string().optional(),
  /** Preset the intent was written from; the normalizer fills its defaults and widgets. */
  preset: graphExplorerPresetSchema.optional(),
  /** Node ids expanded on first render; no live expand state is stored in the view. */
  initialExpanded: z.array(z.string()).optional(),
  /** Groups with more nodes than this start folded (default 40). */
  collapseAbove: z.number().int().positive().optional(),
  /** Levels of neighbours kept around the focused node (default 2). */
  focusDepth: z.number().int().min(1).max(10).optional(),
  /** Which links the focus follows: incoming, outgoing or both (default). */
  focusDirection: z.enum(['in', 'out', 'both']).optional(),
  /** Opens the clicked node in a new column. */
  linkTo: linkToSchema.optional(),
  /** Per value of `groupField`, how to open its nodes; takes precedence over `linkTo`. */
  linkToByGroup: z.record(z.string(), linkToSchema).optional(),
};

export type GraphExplorerFields = z.infer<z.ZodObject<typeof graphExplorerFields>>;

const DEFAULT_GRAPH_EXPLORER_ID = 'graph-explorer';

/** Turn a compact intent into a full widget: preset defaults, then explicit fields, then ids. */
export function normalizeGraphExplorerIntent(intent: GraphExplorerIntent): GraphExplorerWidget {
  const preset = intent.preset === undefined ? undefined : GRAPH_EXPLORER_PRESETS[intent.preset];
  const drafts = intent.widgets ?? preset?.widgets ?? [];
  return {
    ...(preset?.defaults ?? {}),
    ...intent,
    id: intent.id ?? DEFAULT_GRAPH_EXPLORER_ID,
    type: 'graphExplorer',
    widgets: drafts.map((draft, index) => ({ ...draft, id: `detail-${index}` })),
  };
}

/** How the LLM is told to use the graph explorer widget. */
export const graphExplorerWidgetDoc = `- { "id": string, "type": "graphExplorer", "title"?: string, "span"?: 1..24,
    "height"?: number, "data": { "query": ..., "path"?: ... },
    "preset"?: "code-dependencies"|"inheritance"|"calls"|"generic",
    "linksField"?: string, "edges"?: DataBinding, "sourceField"?: string, "targetField"?: string,
    "groupByField"?: string, "overview"?: "network"|"tree", "detailQuery"?: string,
    "initialExpanded"?: [ "<node id>", ... ], "collapseAbove"?: number }
    WRITE A SMALL INTENT: pick a "preset" and a few field names, not a whole graph. Presets:
    "code-dependencies" (packages/classes and what they depend on, layered top-down), "inheritance"
    (superclasses, as a folded tree), "calls" (callers/callees, flowing left to right), "generic"
    (any linked items). The preset supplies the defaults and the nested widgets; explicit fields win.
    Prefer "graphExplorer" over "network" when the user wants to OPEN nodes to inspect their details
    without leaving the view; over "classDiagram" when the links are not only inheritance or when
    details matter more than UML boxes; over "tree" when the graph has cross-links and cycles; over
    "butterfly" which shows the neighbourhood of ONE element, not the whole graph; over "matrix"
    when the graph is sparse enough to read arrows and worth exploring node by node.
    The bound rows are the NODES; "linksField"/"edges" keep the network semantics. "groupByField"
    is a dot path folding nodes into composite group boxes (e.g. "parentPackage.name"); "groupField"
    only colors nodes. "overview" picks the first impression ("network" or "tree"),
    "collapseAbove" folds large groups, "initialExpanded" names nodes open at first render.
    "detailQuery" is the NAME of a query in "queries": set that query's "lazy": true so it is only run
    when a node is expanded. It must declare the GraphQL variable "$${
      GRAPH_DETAIL_ID_VARIABLE
    }: ID!" (e.g. \`class(id: $nodeId) { ... }\`), may have a "source", and receives the id of
    the expanded node (from "detailIdField", default "id"). In the nested "widgets", bind to the
    expanded node with "data": { "query": "${GRAPH_NODE_QUERY}" } and to its detail result with
    "data": { "query": "${GRAPH_DETAIL_QUERY}", "path"?: "<inside the detail result>" }; "detailPath"
    sets that path for every nested widget at once. Nested widgets read current interaction state, so
    they are never given live expand data in the saved view. Clicking a node emits its row on "selected".`;

/**
 * A curated view for code-analysis APIs exposing a `Class` concept with its
 * dependencies and a `classDetail($nodeId: ID!)` query: the graph can be opened
 * node by node to read a class's source and methods. No public API ships one:
 * it serves as a reference.
 */
export const graphExplorerExample: ViewSpec = {
  version: 1,
  id: 'builtin:class-graph-explorer',
  concept: 'Class',
  scope: 'list',
  title: 'Class dependency explorer',
  description: 'Classes grouped by package; open a class to read its source and methods.',
  queries: {
    classes: {
      query: /* GraphQL */ `
        query FluidGraphExplorerClasses($take: Int) {
          classes(take: $take) {
            id
            name
            parentPackage { name }
            dependencies { id name parentPackage { name } }
          }
        }
      `,
      variables: { take: 200 },
    },
    classDetail: {
      query: /* GraphQL */ `
        query FluidGraphExplorerDetail($nodeId: ID!) {
          class(id: $nodeId) {
            id
            name
            methods { id selector sourceCode }
          }
        }
      `,
      lazy: true,
    },
  },
  widgets: [
    {
      id: 'classes',
      type: 'graphExplorer',
      title: 'Dependencies',
      span: 24,
      height: 640,
      data: { query: 'classes', path: 'classes' },
      preset: 'code-dependencies',
      linksField: 'dependencies',
      groupByField: 'parentPackage.name',
      detailQuery: 'classDetail',
      detailPath: 'class',
      widgets: [
        {
          id: 'detail-card',
          type: 'descriptions',
          data: { query: GRAPH_NODE_QUERY },
          columns: 1,
          items: [
            { label: 'Name', key: 'name' },
            { label: 'Package', key: 'parentPackage.name', format: 'tag' },
          ],
        },
        {
          id: 'detail-methods',
          type: 'table',
          title: 'Methods',
          data: { query: GRAPH_DETAIL_QUERY, path: 'methods' },
          columns: [{ key: 'selector', title: 'Selector' }],
        },
      ],
    },
  ],
};
