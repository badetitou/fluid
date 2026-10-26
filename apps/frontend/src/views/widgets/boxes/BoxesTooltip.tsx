import type { BoxesWidget } from '@fluid/shared';
import type { BoxItem } from './boxesModel';
import type { PlacedBox } from './boxesLayout';
import { boxMetrics } from './boxesMetrics';
import type { Transform } from '../zoom/useZoomPan';
import styles from './Boxes.module.css';

interface BoxesTooltipProps {
  item: BoxItem;
  /** Where the box is drawn, before zooming. */
  at: PlacedBox;
  transform: Transform;
  widget: BoxesWidget;
  viewWidth: number;
}

const CARD_WIDTH = 220;

/** The card of the hovered box: its label, group and metrics with their names. */
export function BoxesTooltip({ item, at, transform, widget, viewWidth }: BoxesTooltipProps) {
  const { x, y, k } = transform;
  const right = (at.x + at.w) * k + x + 8;
  const left = right + CARD_WIDTH > viewWidth ? Math.max(0, (at.x * k + x) - CARD_WIDTH - 8) : right;
  const top = Math.max(0, at.y * k + y);
  return (
    <div className={styles.tooltip} role="tooltip" style={{ left, top, width: CARD_WIDTH }}>
      <div className={styles.tooltipTitle}>{item.label}</div>
      {item.group !== undefined && <div className={styles.tooltipGroup}>{item.group}</div>}
      <dl className={styles.metrics}>
        {boxMetrics(item, widget).map((m) => (
          <div key={m.role}>
            <dt>
              {m.name} <span className={styles.role}>({m.role})</span>
            </dt>
            <dd>{m.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
