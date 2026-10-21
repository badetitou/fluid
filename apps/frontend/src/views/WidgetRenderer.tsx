import type { Widget } from '@fluid/shared';
import { asObject, asRows, resolveBinding } from './data';
import type { ViewData } from './useViewData';
import { TableWidget } from './widgets/TableWidget';
import { StatisticWidget } from './widgets/StatisticWidget';
import { DescriptionsWidget } from './widgets/DescriptionsWidget';
import {
  AreaChartWidget,
  BarChartWidget,
  LineChartWidget,
  PieChartWidget,
} from './widgets/charts';

/**
 * Resolves a widget's data binding and renders the matching widget component.
 * `fitHeight` makes charts fill a fixed-size grid cell.
 */
export function WidgetBody({
  widget,
  view,
  fitHeight,
}: {
  widget: Widget;
  view: ViewData;
  fitHeight?: number;
}) {
  const resolved = resolveBinding(widget.data, view.results);

  switch (widget.type) {
    case 'table':
      return <TableWidget widget={widget} rows={asRows(resolved)} />;
    case 'statistic':
      return <StatisticWidget widget={widget} data={resolved} />;
    case 'descriptions':
      return <DescriptionsWidget widget={widget} object={asObject(resolved)} />;
    case 'line':
      return <LineChartWidget widget={widget} rows={asRows(resolved)} fitHeight={fitHeight} />;
    case 'bar':
      return <BarChartWidget widget={widget} rows={asRows(resolved)} fitHeight={fitHeight} />;
    case 'area':
      return <AreaChartWidget widget={widget} rows={asRows(resolved)} fitHeight={fitHeight} />;
    case 'pie':
      return <PieChartWidget widget={widget} rows={asRows(resolved)} fitHeight={fitHeight} />;
    default:
      return null;
  }
}
