import type { ReactNode } from 'react';
import { Button, Space, Tooltip } from 'antd';
import { CloseOutlined, EditOutlined, FullscreenExitOutlined, FullscreenOutlined } from '@ant-design/icons';
import styles from './MillerColumn.module.css';

interface ColumnActionsProps {
  /** Starts arranging the widgets; omitted when the view cannot be rearranged. */
  onEditLayout?: () => void;
  /** The perspective "…" menu. */
  menu: ReactNode;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  /** Omitted for the root column, which cannot be closed. */
  onClose?: () => void;
}

/** Buttons at the right of a column header. */
export function ColumnActions({ onEditLayout, menu, isFullscreen, onToggleFullscreen, onClose }: ColumnActionsProps) {
  return (
    <Space size={2} className={styles.actions}>
      {onEditLayout && (
        <Tooltip title="Edit layout — move and resize widgets">
          <Button type="text" size="small" aria-label="Edit layout" icon={<EditOutlined />} onClick={onEditLayout} />
        </Tooltip>
      )}
      {menu}
      <Button
        type="text"
        size="small"
        aria-label={isFullscreen ? 'Exit full screen' : 'Full screen'}
        icon={isFullscreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />}
        onClick={onToggleFullscreen}
      />
      {onClose && <Button type="text" size="small" aria-label="Close column" icon={<CloseOutlined />} onClick={onClose} />}
    </Space>
  );
}
