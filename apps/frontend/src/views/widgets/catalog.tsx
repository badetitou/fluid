import { lazy, type ComponentType } from 'react';
import type { CoreWidget, CoreWidgetType, Widget } from '@fluid/shared';
import { asObject, asRows } from '../data';
import type { WidgetCatalog, WidgetProps, WidgetRendererDefinition } from '../plugin-api/types';
import { NestedWidget } from './NestedWidget';
import { DescriptionsWidget } from './DescriptionsWidget';
import { StatisticWidget } from './StatisticWidget';
import { TableWidget } from './TableWidget';
import { TreeWidget } from './tree/TreeWidget';
import { LazyRichTextWidget } from './richtext/lazy';
import { ScatterWidget } from './scatter/ScatterWidget';
import { SankeyWidget } from './sankey/SankeyWidget';
import { HistoryWidget } from './history/HistoryWidget';
import { LazyCodeWidget } from './code/lazy';
import { AccordionWidget } from './accordion/AccordionWidget';
import { LazyNetworkWidget } from './network/lazy';
import { ClassDiagramWidget } from './classDiagram/ClassDiagramWidget';
import { BoxesWidget } from './boxes/BoxesWidget';
import { MatrixWidget } from './matrix/MatrixWidget';
import { BlueprintWidget } from './blueprint/BlueprintWidget';
import { ButterflyWidget } from './butterfly/ButterflyWidget';
import { FormWidget } from './form/FormWidget';
import { SpecPresenterWidget } from './specPresenter/SpecPresenterWidget';
import { PyramidWidget } from './pyramid/PyramidWidget';
import { InsightWidget } from './insight/InsightWidget';
import { LazyModel3dWidget, LazyScene3dWidget } from './model3d/lazy';

type Renderer<T extends CoreWidgetType> = ComponentType<WidgetProps<Extract<CoreWidget, { type: T }>>>;

// Charts pull in @ant-design/plots (G2), by far the heaviest dependency: load it
// only when a view actually shows a chart.
const charts = () => import('./charts');
const LineChart = lazy(() => charts().then((m) => ({ default: m.LineChartWidget })));
const BarChart = lazy(() => charts().then((m) => ({ default: m.BarChartWidget })));
const AreaChart = lazy(() => charts().then((m) => ({ default: m.AreaChartWidget })));
const PieChart = lazy(() => charts().then((m) => ({ default: m.PieChartWidget })));

/**
 * The built-in renderers: one per core widget type. Typed exhaustively, so a
 * widget type added to the shared schema does not compile until it can be rendered.
 */
export const WIDGET_RENDERERS: { [T in CoreWidgetType]: Renderer<T> } = {
  table: ({ widget, data, emit, invoke }) => (
    <TableWidget widget={widget} rows={asRows(data)} emit={emit} invoke={invoke} />
  ),
  statistic: ({ widget, data }) => <StatisticWidget widget={widget} data={data} />,
  descriptions: ({ widget, data }) => <DescriptionsWidget widget={widget} object={asObject(data)} />,
  line: ({ widget, data, fitHeight }) => <LineChart widget={widget} rows={asRows(data)} fitHeight={fitHeight} />,
  bar: ({ widget, data, fitHeight }) => <BarChart widget={widget} rows={asRows(data)} fitHeight={fitHeight} />,
  area: ({ widget, data, fitHeight }) => <AreaChart widget={widget} rows={asRows(data)} fitHeight={fitHeight} />,
  pie: ({ widget, data, fitHeight }) => <PieChart widget={widget} rows={asRows(data)} fitHeight={fitHeight} />,
  tree: ({ widget, data }) => <TreeWidget widget={widget} data={data} />,
  richtext: ({ widget, data }) => <LazyRichTextWidget widget={widget} data={data} />,
  scatter: ({ widget, data, fitHeight }) => <ScatterWidget widget={widget} rows={asRows(data)} fitHeight={fitHeight} />,
  sankey: (props) => <SankeyWidget {...props} />,
  history: ({ widget, data, fitHeight }) => <HistoryWidget widget={widget} rows={asRows(data)} fitHeight={fitHeight} />,
  code: ({ widget, data, resolve }) => <LazyCodeWidget widget={widget} data={data} resolve={resolve} />,
  form: ({ widget, data, invoke }) => <FormWidget widget={widget} data={data} invoke={invoke} />,
  accordion: ({ widget, data, resolve }) => (
    <AccordionWidget widget={widget} data={data} resolve={resolve} Nested={NestedWidget} />
  ),
  network: (props) => <LazyNetworkWidget {...props} />,
  classDiagram: ({ widget, data, resolve, emit, fitHeight }) => (
    <ClassDiagramWidget widget={widget} data={data} resolve={resolve} emit={emit} fitHeight={fitHeight} />
  ),
  boxes: ({ widget, data, emit, fitHeight }) => <BoxesWidget widget={widget} data={data} emit={emit} fitHeight={fitHeight} />,
  matrix: (props) => <MatrixWidget {...props} />,
  blueprint: ({ widget, data, resolve, emit, fitHeight }) => (
    <BlueprintWidget widget={widget} data={data} resolve={resolve} emit={emit} fitHeight={fitHeight} />
  ),
  butterfly: (props) => <ButterflyWidget {...props} />,
  model3d: ({ widget, data, fitHeight }) => <LazyModel3dWidget widget={widget} data={data} fitHeight={fitHeight} />,
  scene3d: ({ widget, data, resolve, emit, fitHeight }) => (
    <LazyScene3dWidget widget={widget} data={data} resolve={resolve} emit={emit} fitHeight={fitHeight} />
  ),
  specPresenter: ({ widget, data, emit, fitHeight }) => (
    <SpecPresenterWidget widget={widget} data={data} emit={emit} fitHeight={fitHeight} />
  ),
  pyramid: ({ widget, data, fitHeight }) => <PyramidWidget widget={widget} data={data} fitHeight={fitHeight} />,
  insight: ({ widget, resolve }) => <InsightWidget widget={widget} resolve={resolve} />,
};

/** Widget types drawn as charts (or canvases): they size themselves to their cell instead of scrolling. */
const CHART_TYPES: ReadonlySet<CoreWidgetType> = new Set(['line', 'bar', 'area', 'pie', 'scatter', 'sankey', 'network', 'classDiagram', 'boxes', 'matrix', 'blueprint', 'butterfly', 'model3d', 'scene3d']);

/** The rendering definition of a built-in widget type. */
export function builtinRenderer(type: CoreWidgetType): WidgetRendererDefinition {
  return {
    type,
    Render: WIDGET_RENDERERS[type] as ComponentType<WidgetProps<Widget>>,
    sizing: CHART_TYPES.has(type) ? 'chart' : 'flow',
  };
}

let builtin: WidgetCatalog | null = null;

/** Every built-in widget, for a view rendered without the plugin runtime (tests, previews). */
export function builtinWidgetCatalog(): WidgetCatalog {
  builtin ??= {
    renderers: new Map(
      (Object.keys(WIDGET_RENDERERS) as CoreWidgetType[]).map((type) => [type, builtinRenderer(type)]),
    ),
    explainMissing: (type) => `No installed plugin provides the “${type}” widget.`,
  };
  return builtin;
}
