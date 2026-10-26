import type { KeyboardEvent } from 'react';
import type { PlacedBox } from './blueprintLayout';
import type { BlueprintState } from './useBlueprint';
import styles from './Blueprint.module.css';

interface BlueprintBoxProps {
  box: PlacedBox;
  state: BlueprintState;
}

const STRIPE = 5;
const MAX_CHARS = 19;
const KIND_NAMES: Record<PlacedBox['kind'], string> = {
  constructor: 'constructor',
  abstract: 'abstract method',
  overriding: 'overriding method',
  accessor: 'accessor',
  plain: 'method',
  attribute: 'attribute',
};

const short = (label: string) =>
  label.length > MAX_CHARS ? `${label.slice(0, MAX_CHARS - 1)}…` : label;

/** A method or attribute: a box with its kind's stripe and its name, hover to highlight its links, click to open. */
export function BlueprintBox({ box, state }: BlueprintBoxProps) {
  const selected = state.selected === box.key;
  const dim = state.related !== undefined && !state.related.has(box.key);
  const className = [styles.box, selected && styles.selected, dim && styles.dim]
    .filter(Boolean)
    .join(' ');
  const description = `${box.label} (${KIND_NAMES[box.kind]}${box.size === undefined ? '' : `, ${box.size} lines`})`;
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    state.open(box.key);
  };
  return (
    <g
      className={className}
      data-kind={box.kind}
      data-key={box.key}
      role="button"
      tabIndex={0}
      aria-label={description}
      aria-pressed={selected}
      transform={`translate(${box.x},${box.y})`}
      onClick={() => state.open(box.key)}
      onKeyDown={onKeyDown}
      onMouseEnter={() => state.hover(box.key)}
      onMouseLeave={() => state.hover(undefined)}
      onFocus={() => state.hover(box.key)}
      onBlur={() => state.hover(undefined)}
    >
      <title>{description}</title>
      <rect className={styles.body} width={box.width} height={box.height} rx={3} />
      <rect className={styles.stripe} width={STRIPE} height={box.height} rx={2} />
      <text x={STRIPE + 5} y={Math.min(box.height / 2, 9)}>
        {short(box.label)}
      </text>
    </g>
  );
}
