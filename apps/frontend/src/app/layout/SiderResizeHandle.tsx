import { useSiderResize } from './useSiderResize';
import styles from './AppLayout.module.css';

interface SiderResizeHandleProps {
  /** Current width of the sider, the start of each drag. */
  width: number;
  side: 'left' | 'right';
}

/** The grip on the sider's inner edge: drag to resize, double-click to reset. */
export function SiderResizeHandle({ width, side }: SiderResizeHandleProps) {
  const { dragging, onPointerDown, onDoubleClick } = useSiderResize(width);

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize navigation"
      aria-valuenow={width}
      title="Drag to resize, double-click to reset"
      className={`${styles.resizeHandle} ${side === 'right' ? styles.resizeHandleRight : ''} ${dragging ? styles.resizeHandleActive : ''}`}
      onPointerDown={onPointerDown}
      onDoubleClick={onDoubleClick}
    />
  );
}
