import { useMemo } from 'react';
import type { ButterflyWidget as ButterflyWidgetSpec } from '@fluid/shared';
import type { WidgetProps } from '../../plugin-api/types';
import { NetworkEmpty } from '../network/NetworkEmpty';
import { buildButterfly, emptyReason } from './butterflyModel';
import { ButterflyView } from './ButterflyView';

const DEFAULT_HEIGHT = 420;

/**
 * A butterfly map: the bound element in the middle, its dependents on the
 * left, its dependencies on the right, arrows flowing to the right. Clicking a
 * neighbour emits its row on `selected` and opens it in a new column.
 *
 * Colors come from the theme (series by group); a theme may set, under
 * `widgets.butterfly`: `lineColor`, `boxColor`, `centerColor`, `borderColor`,
 * `selectionColor`.
 */
export function ButterflyWidget({ widget, data, emit, fitHeight }: WidgetProps<ButterflyWidgetSpec>) {
  const height = fitHeight ?? widget.height ?? DEFAULT_HEIGHT;
  const butterfly = useMemo(() => buildButterfly(data, widget), [data, widget]);
  const reason = emptyReason(butterfly, widget);
  if (reason || !butterfly) return <NetworkEmpty height={height} reason={reason ?? ''} />;
  return <ButterflyView widget={widget} butterfly={butterfly} emit={emit} height={height} />;
}
