import type { ClassForest } from './classDiagramModel';
import type { BoxContent, DiagramLayout } from './classLayout';
import type { ClassDiagramState } from './useClassDiagram';
import { ClassBox } from './ClassBox';
import { ClassConnectors } from './ClassConnectors';
import { useDragPan } from './useDragPan';
import { useScrollToClass } from './useScrollToClass';
import styles from './ClassDiagram.module.css';

interface ClassDiagramCanvasProps {
  forest: ClassForest;
  layout: DiagramLayout;
  state: ClassDiagramState;
  content: BoxContent;
  /** The accent color of each class (its package). */
  accents: ReadonlyMap<string, string>;
  height: number;
  label: string;
}

/** The scrollable plane of the diagram, panned by dragging its background. */
export function ClassDiagramCanvas({ forest, layout, state, content, accents, height, label }: ClassDiagramCanvasProps) {
  const pan = useDragPan();
  const viewport = useScrollToClass(layout, state.target);
  return (
    <div
      ref={viewport}
      className={styles.viewport}
      style={{ height }}
      role="region"
      aria-label={label}
      tabIndex={0}
      {...pan}
    >
      <div className={styles.plane} style={{ width: layout.width, height: layout.height }}>
        <ClassConnectors layout={layout} />
        {layout.boxes.map((at) => {
          const cls = forest.classes.get(at.key);
          return (
            cls && (
              <ClassBox key={at.key} cls={cls} at={at} content={content} accent={accents.get(at.key)} state={state} />
            )
          );
        })}
      </div>
    </div>
  );
}
