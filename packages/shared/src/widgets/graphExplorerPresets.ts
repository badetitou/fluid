import { z } from 'zod';
import type { WidgetDraft } from '../view-spec';
import type { GraphExplorerFields } from './graphExplorer';

// Reserved query keys a nested widget of a graph explorer can bind to. The
// renderer provides "$node" (the row of the expanded node) and, when the view
// declares a `detailQuery`, "$detail" (the result of that query for the node).
// Neither is a key of `ViewSpec.queries`: both are session-only.

/** Query key reading the row of the node currently expanded. */
export const GRAPH_NODE_QUERY = '$node';
/** Query key reading the result of the node's `detailQuery` (when there is one). */
export const GRAPH_DETAIL_QUERY = '$detail';
/** GraphQL variable of `detailQuery` receiving the expanded node's id. */
export const GRAPH_DETAIL_ID_VARIABLE = 'nodeId';

/** The small intents an LLM can pick instead of writing a whole graph config. */
export const graphExplorerPresetSchema = z.enum(['code-dependencies', 'inheritance', 'calls', 'generic']);
export type GraphExplorerPresetName = z.infer<typeof graphExplorerPresetSchema>;

/** The config fields a preset may default (never the bound data or the id). */
type PresetDefaults = Partial<Omit<GraphExplorerFields, 'id' | 'type' | 'data' | 'preset'>>;

/** A preset: defaults merged under an intent, and the widgets of an expanded node. */
export interface GraphExplorerPreset {
  /** Applied when the intent does not set the field; explicit intent fields win. */
  defaults: PresetDefaults;
  /** Draft widgets bound to `$node`/`$detail`; ids are assigned by the normalizer. */
  widgets: WidgetDraft[];
}

/**
 * Preset defaults and their nested widgets. Each nested widget is a draft: the
 * normalizer assigns `detail-0`, `detail-1`, … so ids stay stable and unique
 * inside one explorer. A preset without a `detailQuery` supplies a node card,
 * and a code widget only when the source is expected to return `sourceCode`.
 */
export const GRAPH_EXPLORER_PRESETS: Record<GraphExplorerPresetName, GraphExplorerPreset> = {
  'code-dependencies': {
    defaults: {
      overview: 'network',
      graphLayout: 'layered',
      direction: 'TB',
      groupByField: 'parentPackage.name',
      collapseAbove: 40,
      focusDepth: 2,
      focusDirection: 'both',
    },
    widgets: [
      {
        type: 'descriptions',
        title: 'Node',
        data: { query: GRAPH_NODE_QUERY },
        columns: 1,
        items: [
          { label: 'Name', key: 'name' },
          { label: 'Package', key: 'parentPackage.name', format: 'tag' },
        ],
      },
      {
        type: 'code',
        title: 'Source',
        data: { query: GRAPH_DETAIL_QUERY },
        field: 'sourceCode',
        language: 'smalltalk',
        search: false,
      },
    ],
  },
  inheritance: {
    defaults: {
      overview: 'tree',
      graphLayout: 'layered',
      direction: 'TB',
      linksField: 'superInheritances.superclass',
      groupByField: 'parentPackage.name',
      collapseAbove: 30,
    },
    widgets: [
      {
        type: 'descriptions',
        title: 'Class',
        data: { query: GRAPH_NODE_QUERY },
        columns: 1,
        items: [
          { label: 'Name', key: 'name' },
          { label: 'Package', key: 'parentPackage.name', format: 'tag' },
          { label: 'Abstract', key: 'isAbstract', format: 'boolean' },
        ],
      },
      {
        type: 'code',
        title: 'Source',
        data: { query: GRAPH_DETAIL_QUERY },
        field: 'sourceCode',
        language: 'smalltalk',
        search: false,
      },
    ],
  },
  calls: {
    defaults: {
      overview: 'network',
      graphLayout: 'layered',
      direction: 'LR',
      groupByField: 'parentType.name',
      collapseAbove: 60,
      focusDepth: 2,
      focusDirection: 'both',
    },
    widgets: [
      {
        type: 'descriptions',
        title: 'Node',
        data: { query: GRAPH_NODE_QUERY },
        columns: 1,
        items: [
          { label: 'Name', key: 'name' },
          { label: 'Owner', key: 'parentType.name', format: 'tag' },
        ],
      },
      {
        type: 'code',
        title: 'Source',
        data: { query: GRAPH_DETAIL_QUERY },
        field: 'sourceCode',
        language: 'smalltalk',
        search: false,
      },
    ],
  },
  generic: {
    defaults: { overview: 'network', graphLayout: 'force', collapseAbove: 40 },
    widgets: [
      {
        type: 'descriptions',
        title: 'Node',
        data: { query: GRAPH_NODE_QUERY },
        columns: 1,
        items: [{ label: 'Name', key: 'name' }],
      },
    ],
  },
};
