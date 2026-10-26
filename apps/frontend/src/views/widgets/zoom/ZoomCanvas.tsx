import { useCallback, useMemo, type MouseEvent, type ReactNode } from 'react';
import { useElementHeight, useElementWidth } from '../../../hooks/useElementWidth';
import { useZoomPan } from './useZoomPan';
import { ZoomToolbar } from './ZoomToolbar';
import styles from './Zoom.module.css';

interface ZoomCanvasProps {
  /** Size of the drawing, in its own units. */
  content: { width: number; height: number };
  /** Height of the frame showing it; without one, the frame fills its flex column. */
  height?: number;
  /** Accessible name of the drawing. */
  label: string;
  /** Shown before the zoom buttons. */
  caption?: string;
  /** Extra class of the frame (a themed background, say). */
  className?: string;
  /** The SVG elements of the drawing, zoomed and panned together. */
  children: ReactNode;
}

/**
 * An SVG drawing in a frame: wheel to zoom, drag to pan, zoom in / out / fit
 * buttons in the corner. A click ending a drag is not passed to the drawing,
 * so dragging over a box does not open it.
 */
export function ZoomCanvas({ content, height, label, caption, className, children }: ZoomCanvasProps) {
  const [widthRef, width] = useElementWidth<HTMLDivElement>();
  const [heightRef, measuredHeight] = useElementHeight<HTMLDivElement>();
  const ref = useCallback(
    (el: HTMLDivElement | null) => {
      widthRef(el);
      heightRef(height === undefined ? el : null);
    },
    [widthRef, heightRef, height],
  );
  const viewHeight = height ?? Math.floor(measuredHeight);
  const view = useMemo(() => ({ width: Math.floor(width), height: viewHeight }), [width, viewHeight]);
  const zoom = useZoomPan(content, view);
  const { x, y, k } = zoom.transform;
  const swallowDragClick = (e: MouseEvent) => {
    if (zoom.dragged()) e.stopPropagation();
  };
  const classes = [styles.viewport, height === undefined && styles.fill, className].filter(Boolean).join(' ');

  return (
    <div ref={ref} className={classes} style={height === undefined ? undefined : { height }}>
      <svg
        ref={zoom.wheelRef}
        className={styles.svg}
        role="group"
        aria-label={label}
        onClickCapture={swallowDragClick}
        {...zoom.handlers}
      >
        <g transform={`translate(${x},${y}) scale(${k})`}>{children}</g>
      </svg>
      <ZoomToolbar zoom={zoom} caption={caption} />
    </div>
  );
}
