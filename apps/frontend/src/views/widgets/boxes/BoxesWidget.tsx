import { useMemo } from 'react';
import type { BoxesWidget as BoxesWidgetSpec } from '@fluid/shared';
import type { WidgetProps } from '../../plugin-api/types';
import { NetworkEmpty } from '../network/NetworkEmpty';
import { buildBoxes, emptyReason } from './boxesModel';
import { BoxesView } from './BoxesView';

const DEFAULT_HEIGHT = 480;

/**
 * A polymetric view: one box per row, width, height and color from metrics,
 * as a hierarchy (`tree`), boxes in frames per group (`flow`) or a treemap.
 * Hovering a box shows its metrics, clicking it emits its row on `selected`
 * and opens it in a new column; the wheel zooms, dragging pans.
 *
 * Colors come from the theme (sequential scale from `lowColor` to `highColor`,
 * categories from the series); a theme may set, under `widgets.boxes`:
 * `boxColor`, `lowColor`, `highColor`, `borderColor`, `lineColor`,
 * `frameColor`, `headerColor`, `selectionColor`.
 */
export function BoxesWidget({ widget, data, emit, fitHeight }: Pick<WidgetProps<BoxesWidgetSpec>, 'widget' | 'data' | 'emit' | 'fitHeight'>) {
  const height = fitHeight ?? widget.height ?? DEFAULT_HEIGHT;
  const model = useMemo(() => buildBoxes(data, widget), [data, widget]);
  const reason = emptyReason(model);
  if (reason) return <NetworkEmpty height={height} reason={reason} />;
  return <BoxesView widget={widget} model={model} emit={emit} height={height} />;
}
