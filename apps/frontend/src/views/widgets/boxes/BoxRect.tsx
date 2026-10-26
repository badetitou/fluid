import type { KeyboardEvent } from 'react';
import type { BoxItem } from './boxesModel';
import type { PlacedBox } from './boxesLayout';
import { HEADER } from './boxesGeometry';
import styles from './Boxes.module.css';

export type BoxStatus = 'selected' | 'peer' | 'dimmed';

interface BoxRectProps {
  at: PlacedBox;
  item: BoxItem;
  fill?: string;
  status?: BoxStatus;
  onHover: (key: string | undefined) => void;
  onOpen: (key: string) => void;
}

const CHAR_WIDTH = 6.2;

/** The label cut to what fits in `width` pixels. */
export function fitText(text: string, width: number): string {
  const max = Math.floor((width - 8) / CHAR_WIDTH);
  if (max <= 1) return '';
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

/** One box: hover shows its card, click or Enter selects and opens it. */
export function BoxRect({ at, item, fill, status, onHover, onOpen }: BoxRectProps) {
  const className = [styles.box, status ? styles[status] : '', at.container ? styles.container : ''].join(' ').trim();
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    onOpen(item.key);
  };
  const text = at.labelled ? fitText(item.label, at.w) : '';
  return (
    <g
      className={className}
      role="button"
      tabIndex={0}
      aria-label={item.label}
      aria-pressed={status === 'selected'}
      data-box={item.key}
      onMouseEnter={() => onHover(item.key)}
      onMouseLeave={() => onHover(undefined)}
      onFocus={() => onHover(item.key)}
      onBlur={() => onHover(undefined)}
      onClick={() => onOpen(item.key)}
      onKeyDown={onKeyDown}
    >
      <rect x={at.x} y={at.y} width={Math.max(at.w, 1)} height={Math.max(at.h, 1)} style={{ fill }} />
      {text && (
        <text x={at.x + 4} y={at.y + Math.min(HEADER - 5, at.h / 2 + 4)} className={styles.label}>
          {text}
        </text>
      )}
    </g>
  );
}
