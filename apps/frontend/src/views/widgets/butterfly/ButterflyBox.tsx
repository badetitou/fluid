import type { KeyboardEvent } from 'react';
import { truncate, type PlacedBox } from './butterflyLayout';
import type { ButterflyState } from './useButterfly';
import styles from './Butterfly.module.css';

interface ButterflyBoxProps {
  box: PlacedBox;
  label: string;
  /** Full text, shown on hover. */
  tooltip: string;
  /** Its group's color. */
  accent?: string;
  maxChars: number;
  state: ButterflyState;
  /** `center`: the element itself; `node`: a neighbour that opens; `group`: a box standing for several. */
  kind: 'center' | 'node' | 'group';
}

const ACCENT_WIDTH = 4;

/** A box of the butterfly map: the center, a neighbour (clickable, keyboard included) or a group of them. */
export function ButterflyBox({ box, label, tooltip, accent, maxChars, state, kind }: ButterflyBoxProps) {
  const clickable = kind === 'node';
  const selected = state.selected === box.id;
  const className = [styles.box, styles[kind], selected ? styles.selected : '', state.hovered === box.id ? styles.hovered : '']
    .filter(Boolean)
    .join(' ');
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    state.open(box.id);
  };
  const shown = truncate(label, kind === 'center' ? maxChars - 2 : maxChars);
  return (
    <g
      className={className}
      transform={`translate(${box.x} ${box.y})`}
      data-node={box.id}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      aria-label={clickable ? tooltip : undefined}
      aria-pressed={clickable ? selected : undefined}
      onClick={clickable ? () => state.open(box.id) : undefined}
      onKeyDown={clickable ? onKeyDown : undefined}
      onMouseEnter={kind === 'center' ? undefined : () => state.hover(box.id)}
      onMouseLeave={kind === 'center' ? undefined : () => state.hover(undefined)}
    >
      <title>{tooltip}</title>
      <rect className={styles.frame} width={box.width} height={box.height} rx={4} stroke={kind === 'center' ? accent : undefined} />
      {kind !== 'center' && accent && <rect width={ACCENT_WIDTH} height={box.height} rx={2} fill={accent} />}
      <text className={styles.label} x={kind === 'center' ? box.width / 2 : ACCENT_WIDTH + 6} y={box.height / 2} dy="0.35em">
        {shown}
      </text>
    </g>
  );
}
