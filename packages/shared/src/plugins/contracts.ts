import { z } from 'zod';
import type { CoreWidgetType } from '../view-spec';
import { accordionWidgetDoc } from '../widgets/accordion';
import { blueprintWidgetDoc } from '../widgets/blueprint';
import { boxesWidgetDoc } from '../widgets/boxes';
import { classDiagramWidgetDoc } from '../widgets/classDiagram';
import { butterflyWidgetDoc } from '../widgets/butterfly';
import { codeWidgetDoc } from '../widgets/code';
import { formWidgetDoc } from '../widgets/form';
import { matrixWidgetDoc } from '../widgets/matrix';
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
import { insightWidgetDoc } from '../widgets/insight';
import { networkWidgetDoc } from '../widgets/network';
import { model3dWidgetDoc, scene3dWidgetDoc } from '../widgets/model3d';
import { richTextWidgetDoc } from '../widgets/richtext';
import { sankeyWidgetDoc } from '../widgets/sankey';
import { scatterWidgetDoc } from '../widgets/scatter';
import { pyramidWidgetDoc } from '../widgets/pyramid';
import { specPresenterWidgetDoc } from '../widgets/specPresenter';
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
  sankey: contract('sankey', 'Sankey', 'Weighted flows between a few groups, as ribbons.', sankeyWidgetDoc, {
    outputs: [{ ...SELECTED_OUTPUT, description: 'The clicked node `{ group, rows }` or ribbon `{ source, target, value, rows }`.' }],
  }),
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
  classDiagram: contract(
    'classDiagram',
    'Class diagram',
    'An inheritance hierarchy as a UML class diagram, branches folding.',
    classDiagramWidgetDoc,
    { outputs: [{ ...SELECTED_OUTPUT, description: 'The row of the class the user last clicked.' }] },
  ),
  boxes: contract(
    'boxes',
    'Polymetric boxes',
    'Items as boxes sized and colored by metrics, as a hierarchy, grouped in frames, or a treemap.',
    boxesWidgetDoc,
    { outputs: [{ ...SELECTED_OUTPUT, description: 'The row of the box the user last clicked.' }] },
  ),
  matrix: contract('matrix', 'Dependency matrix', 'Who depends on whom, as a grid (DSM, co-usage map).', matrixWidgetDoc, {
    outputs: [
      {
        ...SELECTED_OUTPUT,
        description:
          'The last click: on a cell `{ source, target, weight }` (the element row, the target row or object, the summed weight); on a label, that row.',
      },
    ],
  }),
  blueprint: contract('blueprint', 'Class blueprint', 'One class: methods by layer, internal calls, attribute accesses.', blueprintWidgetDoc, {
    inputs: [{ ...DATA_INPUT, description: 'The class: an object holding its methods and attributes.' }],
    outputs: [{ ...SELECTED_OUTPUT, description: 'The row of the method or attribute the user last clicked.' }],
  }),
  butterfly: contract(
    'butterfly',
    'Butterfly',
    'One element in the middle, what depends on it on the left, what it depends on on the right.',
    butterflyWidgetDoc,
    {
      inputs: [{ ...DATA_INPUT, description: 'The central element: one object (or the first row of a list).' }],
      outputs: [{ ...SELECTED_OUTPUT, description: 'The row of the neighbour (dependent or dependency) the user last clicked.' }],
    },
  ),
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
  pyramid: contract(
    'pyramid',
    'Overview pyramid',
    'A system or package in one figure: size, complexity, coupling and inheritance metrics, ratios colored against thresholds.',
    pyramidWidgetDoc,
  ),
  insight: contract(
    'insight',
    'AI analysis',
    'An AI analyst reading what the other widgets show: anomalies, correlations, questions to dig into.',
    insightWidgetDoc,
    {
      inputs: [
        { name: 'sources', shape: 'any', description: 'The data the other widgets of the view show (all of them by default).' },
        { ...DATA_INPUT, description: 'Optional extra data to analyse, that no widget shows.' },
      ],
    },
  ),
  specPresenter: contract(
    'specPresenter',
    'Open view',
    'A view served by a tool in the fluid Open Views format (Pharo inspector tabs included): lists, tables, trees, SVG, text, tabs, actions.',
    specPresenterWidgetDoc,
    {
      inputs: [{ ...DATA_INPUT, description: 'The Open Views response to draw (or a view node, or an old Spec-Fluid node).' }],
      outputs: [{ ...SELECTED_OUTPUT, description: 'The entity the user last clicked: `{ id, type? }`.' }],
    },
  ),
};
