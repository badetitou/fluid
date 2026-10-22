import { ARROW, type DiagramLayout } from './classLayout';
import styles from './ClassDiagram.module.css';

const HALF_BASE = 6;

/** The inheritance lines and, under each unfolded superclass, the UML hollow triangle pointing at it. */
export function ClassConnectors({ layout }: { layout: DiagramLayout }) {
  const lines = layout.lines.map((s) => `M${s.x1} ${s.y1}L${s.x2} ${s.y2}`).join('');
  const arrows = layout.arrows
    .map((a) => `M${a.x} ${a.y}L${a.x - HALF_BASE} ${a.y + ARROW}L${a.x + HALF_BASE} ${a.y + ARROW}Z`)
    .join('');
  return (
    <svg className={styles.connectors} width={layout.width} height={layout.height} aria-hidden="true" data-part="connectors">
      <path className={styles.line} d={lines} />
      <path className={styles.arrow} d={arrows} />
    </svg>
  );
}
