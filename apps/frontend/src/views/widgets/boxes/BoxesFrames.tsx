import type { Frame } from './boxesLayout';
import { HEADER } from './boxesGeometry';
import { fitText } from './BoxRect';
import styles from './Boxes.module.css';

/** The titled frames around the boxes of each group. */
export function BoxesFrames({ frames }: { frames: Frame[] }) {
  return (
    <g className={styles.frames}>
      {frames.map((f) => (
        <g key={f.key} data-frame={f.title}>
          <title>{f.title}</title>
          <rect className={styles.frameRect} x={f.x} y={f.y} width={f.w} height={f.h} />
          {f.h > HEADER && (
            <>
              <rect className={styles.frameHeader} x={f.x} y={f.y} width={f.w} height={HEADER} />
              <text className={styles.frameTitle} x={f.x + 4} y={f.y + HEADER - 5}>
                {fitText(f.title, f.w)}
              </text>
            </>
          )}
        </g>
      ))}
    </g>
  );
}
