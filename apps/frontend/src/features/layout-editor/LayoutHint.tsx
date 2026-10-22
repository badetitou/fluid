import { Typography } from 'antd';
import styles from './LayoutEditor.module.css';

/** How to arrange widgets, shown in place of the perspective pills while editing. */
export function LayoutHint({ savesAsCopy, compact }: { savesAsCopy: boolean; compact: boolean }) {
  return (
    <Typography.Text type="secondary" ellipsis className={`${styles.hint} ${compact ? styles.grow : ''}`}>
      Drag to move · drag the corner to resize · click to edit options
      {savesAsCopy ? ' · saved as a new perspective' : ''}
    </Typography.Text>
  );
}
