import type { CoreWidgetType } from '../view-spec';

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
    description: 'Line, bar, area, pie and scatter charts, and Sankey diagrams of flows.',
    types: ['line', 'bar', 'area', 'pie', 'scatter', 'sankey'],
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
    description: 'Networks of linked items (dependencies, call graphs), drawn with WebGL, UML class diagrams of inheritance hierarchies and butterfly maps of what an element depends on and what depends on it, and dependency matrices (DSM, co-usage).',
    types: ['network', 'classDiagram', 'butterfly', 'matrix'],
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
  {
    id: 'fluid-software-maps',
    name: 'Software maps',
    description: 'Software visualisations from Moose: polymetric boxes and treemaps, class blueprints and the overview pyramid.',
    types: ['blueprint', 'pyramid', 'boxes'],
  },
  {
    id: 'fluid-inspectors',
    name: 'Inspectors',
    description: 'Inspector tabs served by a backend such as Spec-Fluid (Pharo / Moose): tables, trees, Roassal views and text, as Pharo builds them.',
    types: ['specPresenter'],
  },
  {
    id: 'fluid-ai',
    name: 'AI',
    description: 'Widgets backed by the LLM: an analyst that reads what the other widgets show and tells what stands out.',
    types: ['insight'],
  },
];
