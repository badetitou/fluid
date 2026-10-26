import type { ReactNode } from 'react';
import { Button, Space, Tooltip } from 'antd';
import {
  CloseOutlined,
  EditOutlined,
  FullscreenExitOutlined,
  FullscreenOutlined,
  FundProjectionScreenOutlined,
} from '@ant-design/icons';
import styles from './MillerColumn.module.css';

interface ColumnActionsProps {
  /** Starts arranging the widgets; omitted when the view cannot be rearranged. */
  onEditLayout?: () => void;
  /** The perspective "…" menu. */
  menu: ReactNode;
  isFullscreen: boolean;
  /** Omitted for a dashboard shown on its own, which already fills the page. */
  onToggleFullscreen?: () => void;
  /** Shows the perspective alone on the whole window; omitted when there is nothing to show. */
  onPresent?: () => void;
  /** Omitted for the root column, which cannot be closed. */
  onClose?: () => void;
}

/** Buttons at the right of a column header. */
export function ColumnActions({ onEditLayout, menu, isFullscreen, onToggleFullscreen, onPresent, onClose }: ColumnActionsProps) {
  return (
    <Space size={2} className={styles.actions}>
      {onEditLayout && (
        <Tooltip title="Edit — title, widgets (add, move, configure), or continue with AI / JSON">
          <Button type="text" size="small" aria-label="Edit layout" icon={<EditOutlined />} onClick={onEditLayout} />
        </Tooltip>
      )}
      {menu}
      {onPresent && (
        <Tooltip title="Present — the widgets alone on the whole screen, for a big display">
          <Button type="text" size="small" aria-label="Present" icon={<FundProjectionScreenOutlined />} onClick={onPresent} />
        </Tooltip>
      )}
      {onToggleFullscreen && (
        <Button
          type="text"
          size="small"
          aria-label={isFullscreen ? 'Exit full screen' : 'Full screen'}
          icon={isFullscreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />}
          onClick={onToggleFullscreen}
        />
      )}
      {onClose && <Button type="text" size="small" aria-label="Close column" icon={<CloseOutlined />} onClick={onClose} />}
    </Space>
  );
}
