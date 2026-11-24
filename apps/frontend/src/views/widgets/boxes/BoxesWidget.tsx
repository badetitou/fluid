import { useMemo } from 'react';
import type { BoxesWidget as BoxesWidgetSpec } from '@fluid/shared';
import type { WidgetProps } from '../../plugin-api/types';
import { NetworkEmpty } from '../network/NetworkEmpty';
import { BoxesToolbar } from './BoxesToolbar';
import { effectiveBoxesWidget } from './boxesConfig';
import { buildBoxes, emptyReason } from './boxesModel';
import { BoxesView } from './BoxesView';
import { useBoxesConfig } from './useBoxesConfig';

const DEFAULT_HEIGHT = 480;

/**
 * A polymetric view: one box per row, width, height and color from metrics,
 * as a hierarchy (`tree`), boxes in frames per group (`flow`) or a treemap.
 * Hovering a box shows its metrics, clicking it emits its row on `selected`
 * and opens it in a new column; the wheel zooms, dragging pans.
 *
 * The toolbar remaps the metrics locally: the spec's fields stay the defaults.
 * Colors come from the theme (sequential scale from `lowColor` to `highColor`,
 * categories from the series); a theme may set, under `widgets.boxes`:
 * `boxColor`, `lowColor`, `highColor`, `borderColor`, `lineColor`,
 * `frameColor`, `headerColor`, `selectionColor`.
 */
export function BoxesWidget({ widget, data, emit, fitHeight }: Pick<WidgetProps<BoxesWidgetSpec>, 'widget' | 'data' | 'emit' | 'fitHeight'>) {
  const config = useBoxesConfig(widget, data);
  const effective = useMemo(() => effectiveBoxesWidget(widget, config.overrides), [widget, config.overrides]);
  const height = fitHeight ?? widget.height ?? DEFAULT_HEIGHT;
  const model = useMemo(() => buildBoxes(data, effective), [data, effective]);
  const reason = emptyReason(model);
  if (reason) return <NetworkEmpty height={height} reason={reason} />;
  return (
    <>
      <BoxesToolbar widget={widget} config={config} />
      <BoxesView widget={effective} model={model} emit={emit} height={height} />
    </>
  );
}
