import type { KeyboardEvent } from 'react';
import { clip, nodeLabel, nodeWidth, typeLabel, type GraphNode } from './model';
import styles from './ConceptGraph.module.css';

interface ConceptGraphNodeProps {
  node: GraphNode;
  selected: boolean;
  /** Undefined when the node cannot be clicked (a property while picking a path). */
  onActivate?: () => void;
}

/** One field around the focused concept: a relation to walk into, or a property to pick. */
export function ConceptGraphNode({ node, selected, onActivate }: ConceptGraphNodeProps) {
  const { field, kind } = node;
  const label = nodeLabel(field);
  const width = nodeWidth(field);
  const classes = [styles.node, styles[kind], selected && styles.selected, onActivate && styles.active];

  const onKeyDown = (e: KeyboardEvent) => {
    if (onActivate && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      onActivate();
    }
  };

  return (
    <g
      className={classes.filter(Boolean).join(' ')}
      transform={`translate(${node.x - width / 2}, ${node.y - 11})`}
      role={onActivate ? 'button' : undefined}
      tabIndex={onActivate ? 0 : undefined}
      aria-label={kind === 'relation' ? `Go to ${field.name} (${field.typeName})` : `Pick ${field.name}`}
      aria-pressed={kind === 'property' && onActivate ? selected : undefined}
      onClick={onActivate}
      onKeyDown={onKeyDown}
    >
      <title>{field.description ?? `${field.name}: ${typeLabel(field)}`}</title>
      <rect width={width} height={22} rx={kind === 'relation' ? 6 : 11} />
      <text x={9} y={15}>
        <tspan className={styles.name}>{clip(field.name)}</tspan>
        <tspan className={styles.type}>{label.slice(field.name.length)}</tspan>
      </text>
    </g>
  );
}
