import { lazy, Suspense, type ComponentType } from 'react';
import { Skeleton } from 'antd';
import type { DataBinding, Widget, WidgetType } from '@fluid/shared';
import { asObject, asRows } from '../data';
import { DescriptionsWidget } from './DescriptionsWidget';
import { StatisticWidget } from './StatisticWidget';
import { TableWidget } from './TableWidget';
import { TreeWidget } from './tree/TreeWidget';
import { LazyRichTextWidget } from './richtext/lazy';
import { ScatterWidget } from './scatter/ScatterWidget';
import { HistoryWidget } from './history/HistoryWidget';
import { LazyCodeWidget } from './code/lazy';
import { AccordionWidget } from './accordion/AccordionWidget';

/** Props every widget renderer receives: its spec and its resolved data binding. */
export interface WidgetRendererProps<W extends Widget = Widget> {
  widget: W;
  data: unknown;
  /** Resolves another binding of the widget (e.g. a second source to compare). */
  resolve: (binding: DataBinding) => unknown;
  /** Height to fill exactly (grid layout); charts honour it. */
  fitHeight?: number;
}

type Renderer<T extends WidgetType> = ComponentType<WidgetRendererProps<Extract<Widget, { type: T }>>>;

// Charts pull in @ant-design/plots (G2), by far the heaviest dependency: load it
// only when a view actually shows a chart.
const charts = () => import('./charts');
const LineChart = lazy(() => charts().then((m) => ({ default: m.LineChartWidget })));
const BarChart = lazy(() => charts().then((m) => ({ default: m.BarChartWidget })));
const AreaChart = lazy(() => charts().then((m) => ({ default: m.AreaChartWidget })));
const PieChart = lazy(() => charts().then((m) => ({ default: m.PieChartWidget })));

/**
 * The widget catalog: one renderer per widget type. Typed exhaustively, so a
 * widget type added to the shared schema does not compile until it can be rendered.
 */
export const WIDGET_RENDERERS: { [T in WidgetType]: Renderer<T> } = {
  table: ({ widget, data }) => <TableWidget widget={widget} rows={asRows(data)} />,
  statistic: ({ widget, data }) => <StatisticWidget widget={widget} data={data} />,
  descriptions: ({ widget, data }) => <DescriptionsWidget widget={widget} object={asObject(data)} />,
  line: ({ widget, data, fitHeight }) => <LineChart widget={widget} rows={asRows(data)} fitHeight={fitHeight} />,
  bar: ({ widget, data, fitHeight }) => <BarChart widget={widget} rows={asRows(data)} fitHeight={fitHeight} />,
  area: ({ widget, data, fitHeight }) => <AreaChart widget={widget} rows={asRows(data)} fitHeight={fitHeight} />,
  pie: ({ widget, data, fitHeight }) => <PieChart widget={widget} rows={asRows(data)} fitHeight={fitHeight} />,
  tree: ({ widget, data }) => <TreeWidget widget={widget} data={data} />,
  richtext: ({ widget, data }) => <LazyRichTextWidget widget={widget} data={data} />,
  scatter: ({ widget, data, fitHeight }) => <ScatterWidget widget={widget} rows={asRows(data)} fitHeight={fitHeight} />,
  history: ({ widget, data, fitHeight }) => <HistoryWidget widget={widget} rows={asRows(data)} fitHeight={fitHeight} />,
  code: ({ widget, data, resolve }) => <LazyCodeWidget widget={widget} data={data} resolve={resolve} />,
  accordion: ({ widget, data, resolve }) => (
    <AccordionWidget widget={widget} data={data} resolve={resolve} Nested={NestedWidget} />
  ),
};

/** A widget nested in another one (accordion panels), rendered from its parent's resolver. */
function NestedWidget({ widget, resolve }: { widget: Widget; resolve: (binding: DataBinding) => unknown }) {
  const Render = WIDGET_RENDERERS[widget.type] as ComponentType<WidgetRendererProps>;
  return (
    <Suspense fallback={<Skeleton active />}>
      <Render widget={widget} data={resolve(widget.data)} resolve={resolve} />
    </Suspense>
  );
}

/** Widget types drawn as charts: they size themselves to their cell instead of scrolling. */
export const CHART_TYPES: ReadonlySet<WidgetType> = new Set(['line', 'bar', 'area', 'pie', 'scatter']);
