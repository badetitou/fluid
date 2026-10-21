import type { Column } from '@fluid/shared';
import { getPath } from '../../data';
import { humanize } from '../../fieldHeuristics';
import { formatValue } from '../../format';
import type { PlacedPoint } from './scatterModel';
import styles from './Scatter.module.css';

interface ScatterTooltipProps {
  point: PlacedPoint;
  columns: Column[];
  /** Width of the frame, to keep the card inside it. */
  frameWidth: number;
}

const OFFSET = 12;

const titleOf = (col: Column) => col.title ?? humanize(col.key.split('.').pop() ?? col.key);

/** The card shown next to the hovered dot: its label, then the configured values. */
export function ScatterTooltip({ point, columns, frameWidth }: ScatterTooltipProps) {
  const onRight = point.cx < frameWidth / 2;
  const position = onRight
    ? { left: point.cx + point.r + OFFSET, top: point.cy }
    : { right: frameWidth - point.cx + point.r + OFFSET, top: point.cy };
  return (
    <div className={styles.tooltip} style={{ ...position, transform: 'translateY(-50%)' }} role="tooltip">
      <div className={styles.tooltipLabel}>{point.label}</div>
      {columns.map((col) => (
        <div key={col.key} className={styles.tooltipRow}>
          <span>{titleOf(col)}</span>
          <span>{formatValue(getPath(point.row, col.key), col.format, { currency: col.currency })}</span>
        </div>
      ))}
    </div>
  );
}
