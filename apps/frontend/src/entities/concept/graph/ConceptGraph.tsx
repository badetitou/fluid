import { useMemo } from 'react';
import { conceptLabel, isGraphConcept } from '@fluid/shared';
import type { Concept } from '../../../graphql/introspectionTypes';
import { ConceptGraphNode } from './ConceptGraphNode';
import { clip, edgeEnd, layoutGraph } from './model';
import styles from './ConceptGraph.module.css';

interface ConceptGraphProps {
  /** The concept in the middle of the graph. */
  concept: Concept;
  /** Keeps the fields whose name or type contains it. */
  filter: string;
  /** The property currently picked, highlighted. */
  picked?: string;
  onEnter: (relation: string) => void;
  /** Absent when properties cannot be picked. */
  onPick?: (property: string) => void;
}

const WIDTH = 600;

/**
 * A concept and its fields drawn as a star: relations on the right lead to
 * other concepts (clicking one walks there), properties on the left.
 */
export function ConceptGraph({ concept, filter, picked, onEnter, onPick }: ConceptGraphProps) {
  const layout = useMemo(() => layoutGraph(concept, filter, { width: WIDTH }), [concept, filter]);
  const { center } = layout;
  const title = isGraphConcept(concept.name) ? 'Query' : concept.name;

  return (
    <svg
      className={styles.svg}
      viewBox={`0 0 ${layout.width} ${layout.height}`}
      role="group"
      aria-label={`Fields of ${conceptLabel(concept.name)}`}
    >
      <defs>
        <marker id="concept-graph-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">
          <path d="M0,0 L10,5 L0,10 z" className={styles.arrow} />
        </marker>
      </defs>
      {layout.nodes.map((node) => (
        <line
          key={`edge-${node.field.name}`}
          x1={center.x}
          y1={center.y}
          x2={edgeEnd(node)}
          y2={node.y}
          className={node.kind === 'relation' ? styles.edgeRelation : styles.edgeProperty}
          markerEnd={node.kind === 'relation' ? 'url(#concept-graph-arrow)' : undefined}
        />
      ))}
      <g className={styles.center} transform={`translate(${center.x}, ${center.y})`}>
        <rect x={-64} y={-22} width={128} height={44} rx={22} />
        <text y={-2} textAnchor="middle" className={styles.centerTitle}>
          {clip(title, 16)}
        </text>
        <text y={14} textAnchor="middle" className={styles.centerSub}>
          {concept.relationFields.length} relations · {concept.scalarFields.length} props
        </text>
      </g>
      {layout.nodes.map((node) => (
        <ConceptGraphNode
          key={node.field.name}
          node={node}
          selected={node.kind === 'property' && node.field.name === picked}
          onActivate={
            node.kind === 'relation' ? () => onEnter(node.field.name) : onPick && (() => onPick(node.field.name))
          }
        />
      ))}
      {layout.hidden > 0 && (
        <text x={layout.width / 2} y={layout.height - 6} textAnchor="middle" className={styles.hidden}>
          {layout.hidden} more fields — filter to find them
        </text>
      )}
    </svg>
  );
}
