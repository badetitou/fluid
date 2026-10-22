import type { Column } from '@fluid/shared';
import { getPath } from '../../data';
import { humanize } from '../../fieldHeuristics';
import { formatValue } from '../../format';
import type { Point } from './layoutModel';
import type { NetworkNode } from './networkModel';
import styles from './Network.module.css';

interface NetworkTooltipProps {
  node: NetworkNode;
  /** Where the pointer is, in the canvas. */
  at: Point;
  columns: Column[];
  /** Color of the node, for the swatch next to its group. */
  color?: string;
  /** Width of the canvas, to keep the card inside it. */
  frameWidth: number;
}

const OFFSET = 14;

const titleOf = (col: Column) => col.title ?? humanize(col.key.split('.').pop() ?? col.key);

/** The card shown next to the hovered node: its label, its group, then the configured values. */
export function NetworkTooltip({ node, at, columns, color, frameWidth }: NetworkTooltipProps) {
  const position = at.x < frameWidth / 2 ? { left: at.x + OFFSET, top: at.y } : { right: frameWidth - at.x + OFFSET, top: at.y };
  const values = columns.filter((col) => {
    const value = getPath(node.row, col.key);
    return value != null && value !== '' && !(Array.isArray(value) && value.length === 0);
  });
  return (
    <div className={styles.tooltip} style={position} role="tooltip">
      <div className={styles.tooltipLabel}>{node.label}</div>
      {node.group !== undefined && (
        <div className={styles.tooltipRow}>
          <span>
            <span className={styles.swatch} style={{ background: color }} />
            {node.group}
          </span>
        </div>
      )}
      {values.map((col) => (
        <div key={col.key} className={styles.tooltipRow}>
          <span>{titleOf(col)}</span>
          <span>{formatValue(getPath(node.row, col.key), col.format, { currency: col.currency })}</span>
        </div>
      ))}
    </div>
  );
}
