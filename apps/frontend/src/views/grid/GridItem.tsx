import type { CSSProperties, ReactNode } from 'react';
import { Dropdown, type MenuProps } from 'antd';
import { DeleteOutlined, MinusOutlined } from '@ant-design/icons';
import { SIZE_PRESETS } from '../gridLayout';
import type { DragMode } from './useGridDrag';
import styles from './WidgetGrid.module.css';

export interface GridItemEditing {
  /** How this item is being dragged, if it is. */
  dragMode?: DragMode;
  onPointerDown: (e: React.PointerEvent, mode: DragMode) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onRemove: () => void;
  onResize: (w: number, h: number) => void;
}

interface GridItemProps {
  label: string;
  rect: CSSProperties;
  /** Present in edit mode only. */
  editing?: GridItemEditing;
  children: ReactNode;
}

/** One widget placed on the grid; in edit mode it can be dragged, resized and removed. */
export function GridItem({ label, rect, editing, children }: GridItemProps) {
  if (!editing) {
    return (
      <div className={styles.item} style={rect}>
        <div className={styles.content}>{children}</div>
      </div>
    );
  }

  const { dragMode } = editing;
  const sizeMenu: MenuProps['items'] = [
    ...SIZE_PRESETS.map((p) => ({
      key: p.key,
      label: `${p.label} (${p.w}×${p.h})`,
      onClick: () => editing.onResize(p.w, p.h),
    })),
    { type: 'divider' as const },
    { key: 'remove', icon: <DeleteOutlined />, danger: true, label: 'Remove widget', onClick: editing.onRemove },
  ];
  const className = [
    styles.item,
    styles.editable,
    dragMode && styles.dragged,
    dragMode === 'move' && styles.lifted,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <Dropdown menu={{ items: sizeMenu }} trigger={['contextMenu']}>
      <div
        className={className}
        role="group"
        aria-label={`Widget ${label}`}
        tabIndex={0}
        onPointerDown={(e) => editing.onPointerDown(e, 'move')}
        onKeyDown={editing.onKeyDown}
        style={rect}
      >
        <div className={styles.content}>{children}</div>
        <span
          role="button"
          aria-label="Remove widget"
          className={styles.remove}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={editing.onRemove}
        >
          <MinusOutlined />
        </span>
        <span aria-label="Resize widget" className={styles.resize} onPointerDown={(e) => editing.onPointerDown(e, 'resize')}>
          <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden>
            <path d="M17 8 v3 a6 6 0 0 1 -6 6 h-3" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
        </span>
      </div>
    </Dropdown>
  );
}
