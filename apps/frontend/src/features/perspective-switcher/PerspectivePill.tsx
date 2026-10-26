import { memo } from 'react';
import { Tooltip } from 'antd';
import { CloseOutlined, StarFilled } from '@ant-design/icons';
import type { ViewEntry } from '../../entities/view';
import styles from './PerspectivePills.module.css';

interface PerspectivePillProps {
  entry: ViewEntry;
  active: boolean;
  /** Saved perspectives can be renamed and deleted (needs the BFF). */
  editable: boolean;
  onPick: (key: string) => void;
  onRename: (entry: ViewEntry) => void;
  onDelete: (entry: ViewEntry) => void;
}

/** One perspective in the column's pill bar; double-click renames, × deletes the active saved one. */
export const PerspectivePill = memo(function PerspectivePill({
  entry,
  active,
  editable,
  onPick,
  onRename,
  onDelete,
}: PerspectivePillProps) {
  const canEdit = editable && entry.source === 'saved';
  return (
    <Tooltip
      title={`${entry.builder?.label ?? entry.source} perspective${canEdit ? ' — double-click to rename' : ''}`}
      mouseEnterDelay={0.6}
    >
      <span
        role="tab"
        aria-selected={active}
        tabIndex={0}
        onClick={() => onPick(entry.key)}
        onDoubleClick={() => canEdit && onRename(entry)}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onPick(entry.key)}
        className={`${styles.pill} ${active ? styles.active : ''}`}
      >
        <span
          className={`${styles.dot} ${styles[entry.source]}`}
          style={entry.builder && { background: entry.builder.color }}
        />
        {entry.title}
        {entry.saved?.isDefault && <StarFilled className={styles.star} />}
        {active && canEdit && (
          <CloseOutlined
            aria-label="Delete perspective"
            className={styles.close}
            onClick={(e) => {
              e.stopPropagation();
              onDelete(entry);
            }}
          />
        )}
      </span>
    </Tooltip>
  );
});
