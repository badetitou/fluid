import { CompressOutlined, ZoomInOutlined, ZoomOutOutlined } from '@ant-design/icons';
import type { ZoomPan } from './useZoomPan';
import styles from './Zoom.module.css';

const STEP = 1.25;

/** Zoom in / out / fit buttons over a drawing, after an optional caption (how many elements it shows). */
export function ZoomToolbar({ zoom, caption }: { zoom: ZoomPan; caption?: string }) {
  return (
    <div className={styles.toolbar}>
      {caption && <span className={styles.caption}>{caption}</span>}
      <button type="button" aria-label="Zoom in" title="Zoom in" onClick={() => zoom.zoomBy(STEP)}>
        <ZoomInOutlined />
      </button>
      <button type="button" aria-label="Zoom out" title="Zoom out" onClick={() => zoom.zoomBy(1 / STEP)}>
        <ZoomOutOutlined />
      </button>
      <button type="button" aria-label="Fit to view" title="Fit to view" onClick={zoom.fit}>
        <CompressOutlined />
      </button>
    </div>
  );
}
