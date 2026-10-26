import { useMemo } from 'react';
import { Empty } from 'antd';
import type { PyramidWidget as PyramidWidgetSpec } from '@fluid/shared';
import type { WidgetProps } from '../../plugin-api/types';
import { PyramidBrick } from './PyramidBrick';
import { PyramidLegend } from './PyramidLegend';
import { buildBricks } from './pyramidLayout';
import { emptyReason, readMetrics, thresholdsFor } from './pyramidModel';
import { usePyramidColors } from './usePyramidColors';
import styles from './Pyramid.module.css';

/**
 * The Overview Pyramid (Lanza & Marinescu): size & complexity on the left,
 * coupling on the right, inheritance on top, raw values and ratios colored
 * low / average / high against the thresholds of a language. Hovering a brick
 * names the metric and its thresholds. No navigation, no output.
 *
 * Colors come from the theme; a theme may set, under `widgets.pyramid`: `low`,
 * `average`, `high`, `onLevel`, `size`, `coupling`, `inheritance`.
 */
export function PyramidWidget({ widget, data, fitHeight }: Pick<WidgetProps<PyramidWidgetSpec>, 'widget' | 'data' | 'fitHeight'>) {
  const colors = usePyramidColors();
  const values = useMemo(() => readMetrics(data, widget), [data, widget]);
  const bricks = useMemo(() => buildBricks(values, thresholdsFor(widget)), [values, widget]);
  const reason = emptyReason(data, values);
  const height = fitHeight ?? widget.height;
  if (reason)
    return (
      <div className={styles.empty} style={{ height }}>
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={reason} />
      </div>
    );
  return (
    <div className={styles.root} style={{ ...colors, maxHeight: height }}>
      <div className={styles.grid} role="group" aria-label="Overview pyramid">
        {bricks.map((brick) => (
          <PyramidBrick key={brick.key} brick={brick} />
        ))}
      </div>
      <PyramidLegend preset={widget.thresholdPreset ?? 'java'} custom={widget.thresholds != null} />
    </div>
  );
}
