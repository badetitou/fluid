import type { PlacedPoint } from './scatterModel';
import styles from './Scatter.module.css';

interface ScatterDotsProps {
  points: PlacedPoint[];
  /** Keys of the dots that open an item when clicked. */
  linked: ReadonlySet<string>;
  activeKey?: string;
  onActivate: (key: string | undefined) => void;
  onOpen: (key: string) => void;
}

/**
 * The dots. A dot is hovered or focused to show its card; a linked dot opens
 * its item on click or Enter. The active dot is drawn last, above the others.
 */
export function ScatterDots({ points, linked, activeKey, onActivate, onOpen }: ScatterDotsProps) {
  const active = points.find((p) => p.key === activeKey);
  const ordered = active ? [...points.filter((p) => p !== active), active] : points;
  return (
    <g>
      {ordered.map((p) => {
        const isLinked = linked.has(p.key);
        const className = [styles.dot, isLinked && styles.linked, p === active && styles.active].filter(Boolean).join(' ');
        return (
          <circle
            key={p.key}
            className={className}
            cx={p.cx}
            cy={p.cy}
            r={p.r}
            style={p.color ? { fill: p.color } : undefined}
            role={isLinked ? 'link' : 'img'}
            aria-label={p.label}
            tabIndex={isLinked ? 0 : undefined}
            onMouseEnter={() => onActivate(p.key)}
            onMouseLeave={() => onActivate(undefined)}
            onFocus={() => onActivate(p.key)}
            onBlur={() => onActivate(undefined)}
            onClick={() => isLinked && onOpen(p.key)}
            onKeyDown={(e) => {
              if (isLinked && e.key === 'Enter') onOpen(p.key);
            }}
          />
        );
      })}
    </g>
  );
}
