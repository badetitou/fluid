import { useMemo } from 'react';
import type { SankeyWidget as SankeyWidgetSpec } from '@fluid/shared';
import type { WidgetProps } from '../../plugin-api/types';
import { NetworkEmpty } from '../network/NetworkEmpty';
import { buildFlows, emptyReason } from './sankeyModel';
import { SankeyChart } from './SankeyChart';

const DEFAULT_HEIGHT = 360;

/**
 * Weighted flows between groups, as a Sankey diagram: nodes in columns, ribbons
 * as thick as the flow, links closing a cycle dashed under the figure. Clicking
 * a node emits `{ group, rows }` on `selected`, a ribbon `{ source, target, value, rows }`.
 *
 * Colors come from the theme (`series`, by node; a ribbon takes its source's);
 * a theme may set, under `widgets.sankey`: `labelColor` (default `ink`) and
 * `cycleColor` (ribbons going back; default their source's color).
 */
export function SankeyWidget({ widget, data, emit, fitHeight }: WidgetProps<SankeyWidgetSpec>) {
  const height = fitHeight ?? widget.height ?? DEFAULT_HEIGHT;
  const graph = useMemo(() => buildFlows(data, widget), [data, widget]);
  const reason = emptyReason(graph, widget);
  if (reason) return <NetworkEmpty height={height} reason={reason} />;
  return <SankeyChart widget={widget} graph={graph} emit={emit} height={height} />;
}
