import type { MatrixHover } from './useMatrix';
import styles from './Matrix.module.css';

const OFFSET = 12;

/** « A → B : n » next to the pointer, for the hovered cell. */
export function MatrixTooltip({ hover }: { hover: MatrixHover }) {
  const { row, col, weight, cycle } = hover.cell;
  return (
    <div role="tooltip" className={styles.tooltip} style={{ left: hover.x + OFFSET, top: hover.y + OFFSET }}>
      <span className={styles.tooltipPair}>
        {row.label} → {col.label}
      </span>{' '}
      : {weight}
      {cycle && <span className={styles.tooltipCycle}> · cycle</span>}
    </div>
  );
}
