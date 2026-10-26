import { useId } from 'react';
import type { BlueprintEdge } from './blueprintLayout';
import styles from './Blueprint.module.css';

interface BlueprintEdgesProps {
  edges: BlueprintEdge[];
  /** The hovered element: its edges stand out, the others fade. */
  hovered?: string;
}

/** The arrows of the internal calls (solid) and attribute accesses (dashed). */
export function BlueprintEdges({ edges, hovered }: BlueprintEdgesProps) {
  const arrow = `blueprint-arrow-${useId().replace(/[^\w-]/g, '')}`;
  const classOf = (edge: BlueprintEdge) => {
    if (hovered === undefined) return styles.edge;
    return `${styles.edge} ${edge.from === hovered || edge.to === hovered ? styles.hot : styles.dim}`;
  };
  return (
    <g data-part="edges" aria-hidden="true">
      <defs>
        <marker
          id={arrow}
          viewBox="0 0 6 6"
          refX={6}
          refY={3}
          markerWidth={6}
          markerHeight={6}
          orient="auto"
        >
          <path className={styles.arrowHead} d="M0,0 L6,3 L0,6 Z" />
        </marker>
      </defs>
      {edges.map((edge) => (
        <path
          key={`${edge.from}>${edge.to}`}
          className={classOf(edge)}
          data-kind={edge.kind}
          data-from={edge.from}
          data-to={edge.to}
          d={edge.d}
          markerEnd={`url(#${arrow})`}
        />
      ))}
    </g>
  );
}
