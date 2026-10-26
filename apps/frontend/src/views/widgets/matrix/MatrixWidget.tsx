import { useMemo } from 'react';
import type { MatrixWidget as MatrixWidgetSpec } from '@fluid/shared';
import type { WidgetProps } from '../../plugin-api/types';
import { NetworkEmpty } from '../network/NetworkEmpty';
import { buildMatrix, emptyReason } from './matrixModel';
import { MatrixView } from './MatrixView';

const DEFAULT_HEIGHT = 520;

/**
 * Who depends on whom, as a grid: a dependency structure matrix (DSM) or a
 * co-usage map. Cells are colored by weight, cycles in an alert color; a click
 * on a cell emits `{ source, target, weight }` on `selected`, a click on a label
 * emits its row and opens it in a new column.
 *
 * Colors come from the theme (primary for the weights, its error color for
 * cycles, series for the groups); a theme may set, under `widgets.matrix`:
 * `cellColor`, `cycleColor`, `diagonalColor`, `gridColor`, `backgroundColor`,
 * `selectionColor`.
 */
export function MatrixWidget({ widget, data, emit, fitHeight }: WidgetProps<MatrixWidgetSpec>) {
  const height = fitHeight ?? widget.height ?? DEFAULT_HEIGHT;
  const matrix = useMemo(() => buildMatrix(data, widget), [data, widget]);
  const reason = emptyReason(data, matrix, widget);
  if (reason) return <NetworkEmpty height={height} reason={reason} />;
  return <MatrixView widget={widget} matrix={matrix} emit={emit} height={height} />;
}
