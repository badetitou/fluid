import { useId } from 'react';
import type { PlacedEdge } from './butterflyLayout';
import styles from './Butterfly.module.css';

interface ButterflyEdgesProps {
  edges: PlacedEdge[];
  /** Keys of the edges drawn highlighted (those of the hovered or selected node). */
  lit: ReadonlySet<string>;
}

/** The arrows of the butterfly map, all flowing to the right, thicker for repeated links. */
export function ButterflyEdges({ edges, lit }: ButterflyEdgesProps) {
  const id = useId();
  const marker = (name: string, className: string) => (
    <marker id={`${id}${name}`} viewBox="0 0 10 10" refX="10" refY="5" markerWidth="8" markerHeight="8" markerUnits="userSpaceOnUse" orient="auto">
      <path d="M 0 0 L 10 5 L 0 10 Z" className={className} />
    </marker>
  );
  return (
    <g data-part="edges">
      <defs>
        {marker('arrow', styles.arrow)}
        {marker('lit', styles.arrowLit)}
      </defs>
      {edges.map((edge) => {
        const on = lit.has(edge.key);
        return (
          <path
            key={edge.key}
            d={edge.path}
            data-edge={edge.key}
            className={on ? `${styles.edge} ${styles.lit}` : styles.edge}
            strokeWidth={edge.strokeWidth}
            markerEnd={`url(#${id}${on ? 'lit' : 'arrow'})`}
          />
        );
      })}
    </g>
  );
}
