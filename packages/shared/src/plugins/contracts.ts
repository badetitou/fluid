import { z } from 'zod';
import type { CoreWidgetType } from '../view-spec';
import { accordionWidgetDoc } from '../widgets/accordion';
import { codeWidgetDoc } from '../widgets/code';
import { formWidgetDoc } from '../widgets/form';
import {
  areaWidgetDoc,
  barWidgetDoc,
  descriptionsWidgetDoc,
  lineWidgetDoc,
  pieWidgetDoc,
  statisticWidgetDoc,
  tableWidgetDoc,
} from '../widgets/coreDocs';
import { historyWidgetDoc } from '../widgets/history';
import { networkWidgetDoc } from '../widgets/network';
import { model3dWidgetDoc, scene3dWidgetDoc } from '../widgets/model3d';
import { richTextWidgetDoc } from '../widgets/richtext';
import { scatterWidgetDoc } from '../widgets/scatter';
import { treeWidgetDoc } from '../widgets/tree';
import { actionSlotSchema, DATA_INPUT, portSpecSchema, SELECTED_OUTPUT, type ActionSlot, type PortSpec } from './ports';
import { PLUGIN_WIDGET_TYPE } from './widgetType';

// -----------------------------------------------------------------------------
// Widget contracts
// -----------------------------------------------------------------------------
// The serialisable half of a widget: what the BFF needs to prompt the LLM and
// validate its answer, and what Settings shows. The other half (the React
// renderer) lives in the frontend. Built-in widgets are validated by their zod
// schema in `view-spec.ts`; plugin widgets ship a JSON schema instead.

export const widgetContractSchema = z.object({
  type: z.string().min(1),
  label: z.string().min(1),
  description: z.string(),
  llmDoc: z.string().min(1),
  inputs: z.array(portSpecSchema).default([]),
  outputs: z.array(portSpecSchema).default([]),
  /** Config fields naming the view actions the widget runs (see docs/architecture/MUTATIONS.md). */
  actions: z.array(actionSlotSchema).default([]),
  /** JSON schema of the whole widget (plugins only; the built-ins have their zod schema). */
  jsonSchema: z.record(z.string(), z.unknown()).optional(),
  /** A valid configuration of the widget, for reference. */
  example: z.record(z.string(), z.unknown()).optional(),
});
export type WidgetContract = z.infer<typeof widgetContractSchema>;

/** A contract shipped by a plugin: namespaced type and JSON schema required. */
export const externalWidgetContractSchema = widgetContractSchema.extend({
  type: z.string().regex(PLUGIN_WIDGET_TYPE, 'Plugin widget types are "<pluginId>/<name>"'),
  jsonSchema: z.record(z.string(), z.unknown()),
});
export type ExternalWidgetContract = z.infer<typeof externalWidgetContractSchema>;

const contract = (
  type: CoreWidgetType,
  label: string,
  description: string,
  llmDoc: string,
  ports: { inputs?: PortSpec[]; outputs?: PortSpec[]; actions?: ActionSlot[] } = {},
): WidgetContract => ({
  type,
  label,
  description,
  llmDoc,
  inputs: ports.inputs ?? [DATA_INPUT],
  outputs: ports.outputs ?? [],
  actions: ports.actions ?? [],
});

const port = (name: string, description: string): PortSpec => ({
  name,
  shape: 'rows',
  description,
});

/** Every built-in widget, typed exhaustively: a new core type does not compile without its contract. */
export const BUILTIN_WIDGET_CONTRACTS: { [T in CoreWidgetType]: WidgetContract } = {
  table: contract('table', 'Table', 'Rows with sorting, filters and links.', tableWidgetDoc, {
    outputs: [SELECTED_OUTPUT],
    actions: [{ name: 'rowActions', description: 'Buttons per row; each runs its action with the row as $target.' }],
  }),
  statistic: contract('statistic', 'Statistic', 'One aggregated number.', statisticWidgetDoc),
  descriptions: contract(
    'descriptions',
    'Descriptions',
    'The fields of one object.',
    descriptionsWidgetDoc,
  ),
  line: contract('line', 'Line chart', 'Trends over an axis.', lineWidgetDoc),
  bar: contract('bar', 'Bar chart', 'Categories compared as columns.', barWidgetDoc),
  area: contract('area', 'Area chart', 'Volumes over an axis.', areaWidgetDoc),
  pie: contract('pie', 'Pie chart', 'Shares of a whole.', pieWidgetDoc),
  scatter: contract('scatter', 'Scatter plot', 'Two measures per row, as dots.', scatterWidgetDoc),
  tree: contract('tree', 'Tree', 'A hierarchy, folded level by level.', treeWidgetDoc),
  richtext: contract('richtext', 'Rich text', 'Markdown or long text.', richTextWidgetDoc),
  code: contract('code', 'Code', 'Source code with annotations and diffs.', codeWidgetDoc, {
    inputs: [
      DATA_INPUT,
      port('annotations', 'Rows annotating lines (critiques, comments).'),
      port('compare', 'Another source to diff against.'),
    ],
  }),
  history: contract('history', 'History', 'A version graph (commits).', historyWidgetDoc),
  form: contract('form', 'Form', 'Edits or creates an item through a view action.', formWidgetDoc, {
    actions: [{ name: 'action', description: 'Run on submit with $target (the bound object) and $form (the values).' }],
  }),
  accordion: contract(
    'accordion',
    'Accordion',
    'Folding panels nesting other widgets.',
    accordionWidgetDoc,
  ),
  network: contract('network', 'Network', 'Items linked to each other, as nodes and arrows.', networkWidgetDoc, {
    inputs: [DATA_INPUT, port('edges', 'Edge rows (source → target), when the nodes do not list their links.')],
    outputs: [{ ...SELECTED_OUTPUT, description: 'The row of the node the user last clicked.' }],
  }),
  model3d: contract('model3d', '3D element', 'One building element (IFC) in 3D.', model3dWidgetDoc),
  scene3d: contract(
    'scene3d',
    '3D scene',
    'A whole building (IFC) in 3D, some elements highlighted.',
    scene3dWidgetDoc,
    {
      inputs: [DATA_INPUT, port('highlight', 'The element(s) to highlight, or their ids.')],
      outputs: [{ ...SELECTED_OUTPUT, description: 'The element the user last clicked.' }],
    },
  ),
};

/** A built-in widget collection: shipped with fluid, enabled by default. */
export interface BuiltinWidgetCollection {
  id: string;
  name: string;
  description: string;
  types: CoreWidgetType[];
  /** The app needs it (the prompts lean on tables): it cannot be disabled. */
  required?: boolean;
}

export const BUILTIN_WIDGET_COLLECTIONS: BuiltinWidgetCollection[] = [
  {
    id: 'fluid-essentials',
    name: 'Essentials',
    description: 'Tables, statistics and descriptions: the widgets every view starts from.',
    types: ['table', 'statistic', 'descriptions'],
    required: true,
  },
  {
    id: 'fluid-charts',
    name: 'Charts',
    description: 'Line, bar, area, pie and scatter charts.',
    types: ['line', 'bar', 'area', 'pie', 'scatter'],
  },
  {
    id: 'fluid-code',
    name: 'Code & text',
    description: 'Source code, version histories and rich text.',
    types: ['code', 'history', 'richtext'],
  },
  {
    id: 'fluid-structure',
    name: 'Structure',
    description: 'Trees and accordions, for nested collections.',
    types: ['tree', 'accordion'],
  },
  {
    id: 'fluid-graphs',
    name: 'Graphs',
    description: 'Networks of linked items (dependencies, call graphs), drawn with WebGL.',
    types: ['network'],
  },
  {
    id: 'fluid-editing',
    name: 'Editing',
    description: 'Forms and row buttons that change data through the view actions (needs “Allow changes”).',
    types: ['form'],
  },
  {
    id: 'fluid-3d',
    name: '3D',
    description: 'Building elements (IFC) in 3D, alone or highlighted in their model.',
    types: ['model3d', 'scene3d'],
  },
];
