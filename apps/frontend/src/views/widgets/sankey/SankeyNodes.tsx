import type { PlacedNode } from './sankeyLayout';
import { formatFlow } from './sankeyModel';
import type { SankeySelection } from './useSankeySelection';
import styles from './Sankey.module.css';

interface SankeyNodesProps {
  nodes: PlacedNode[];
  selection: SankeySelection;
  colorOf: (node: PlacedNode) => string;
  labelColor: string;
}

const LABEL_GAP = 6;

/** The nodes, labelled beside them (on the left in the last column). Click or Enter selects one. */
export function SankeyNodes({ nodes, selection, colorOf, labelColor }: SankeyNodesProps) {
  return (
    <g>
      {nodes.map((n) => {
        const item = { kind: 'node', key: n.key } as const;
        const lit = selection.isLit(item);
        const right = n.labelSide === 'right';
        const className = [styles.node, lit && styles.lit, selection.focusing && !lit && styles.dim].filter(Boolean).join(' ');
        return (
          <g
            key={n.key}
            className={className}
            role="button"
            tabIndex={0}
            aria-label={`${n.key}: ${formatFlow(n.value)}`}
            aria-pressed={selection.selected?.kind === 'node' && selection.selected.key === n.key}
            onMouseEnter={() => selection.hover(item)}
            onMouseLeave={() => selection.hover(undefined)}
            onFocus={() => selection.hover(item)}
            onBlur={() => selection.hover(undefined)}
            onClick={() => selection.choose(item)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') selection.choose(item);
            }}
          >
            <rect x={n.x0} y={n.y0} width={n.x1 - n.x0} height={n.y1 - n.y0} fill={colorOf(n)} className={styles.nodeBar} />
            <text
              className={styles.label}
              x={right ? n.x1 + LABEL_GAP : n.x0 - LABEL_GAP}
              y={(n.y0 + n.y1) / 2}
              dy="0.35em"
              textAnchor={right ? 'start' : 'end'}
              fill={labelColor}
            >
              {n.key}
            </text>
          </g>
        );
      })}
    </g>
  );
}
