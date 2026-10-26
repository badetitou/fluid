import { CompressOutlined, ZoomInOutlined, ZoomOutOutlined } from '@ant-design/icons';
import type { ZoomPan } from './useZoomPan';
import styles from './Boxes.module.css';

const STEP = 1.25;

/** Zoom in / out / fit buttons over the drawing, with the number of boxes. */
export function BoxesToolbar({ zoom, count }: { zoom: ZoomPan; count: number }) {
  return (
    <div className={styles.toolbar}>
      <span className={styles.count}>{count === 1 ? '1 box' : `${count} boxes`}</span>
      <button type="button" aria-label="Zoom in" onClick={() => zoom.zoomBy(STEP)}>
        <ZoomInOutlined />
      </button>
      <button type="button" aria-label="Zoom out" onClick={() => zoom.zoomBy(1 / STEP)}>
        <ZoomOutOutlined />
      </button>
      <button type="button" aria-label="Fit to view" onClick={zoom.fit}>
        <CompressOutlined />
      </button>
    </div>
  );
}
