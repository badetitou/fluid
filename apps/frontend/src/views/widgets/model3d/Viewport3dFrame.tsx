import type { RefObject } from 'react';
import { Empty } from 'antd';
import type { Hover } from './usePicking';
import styles from './Model3d.module.css';

interface Viewport3dFrameProps {
  /** Where the viewport draws. */
  canvasRef: RefObject<HTMLDivElement | null>;
  height: number;
  /** Shown over the canvas instead of the scene (no data, no WebGL…). */
  message?: string;
  hover: Hover | null;
  /** The color of each category, as a legend under the canvas. */
  legend: { name: string; color: string }[];
}

const OFFSET = 12;

/** The canvas of a 3D widget, with its hover card and legend. */
export function Viewport3dFrame({ canvasRef, height, message, hover, legend }: Viewport3dFrameProps) {
  return (
    <div className={styles.frame} style={{ height }}>
      <div ref={canvasRef} className={styles.canvas}>
        {message && (
          <div className={styles.overlay}>
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={message} />
          </div>
        )}
        {hover && (
          <div className={styles.tooltip} style={{ left: hover.x + OFFSET, top: hover.y + OFFSET }} role="tooltip">
            <div className={styles.tooltipLabel}>{hover.element.label}</div>
            <div className={styles.tooltipCategory}>{hover.element.category}</div>
          </div>
        )}
      </div>
      {legend.length > 1 && (
        <div className={styles.legend}>
          {legend.map((c) => (
            <span key={c.name}>
              <span className={styles.swatch} style={{ background: c.color }} />
              {c.name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
