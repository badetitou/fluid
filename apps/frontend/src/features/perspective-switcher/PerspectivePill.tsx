import { memo } from 'react';
import { Tooltip } from 'antd';
import { CloseOutlined, EyeInvisibleOutlined, StarFilled } from '@ant-design/icons';
import type { ViewEntry } from '../../entities/view';
import styles from './PerspectivePills.module.css';

/** What can be done to a pill's perspective besides picking and renaming it. */
export interface PillActions {
  /** Deletes a saved perspective. */
  onDelete: (entry: ViewEntry) => void;
  /** Hides the perspective from the pills; the "…" menu shows it again. */
  onHide: (entry: ViewEntry) => void;
}

interface PerspectivePillProps {
  entry: ViewEntry;
  active: boolean;
  /** Saved perspectives can be renamed and deleted (needs the BFF). */
  editable: boolean;
  onPick: (key: string) => void;
  onRename: (entry: ViewEntry) => void;
  actions: PillActions;
}

/**
 * One perspective in the column's pill bar; double-click renames, the closed
 * eye hides it, × deletes the active saved one.
 */
export const PerspectivePill = memo(function PerspectivePill({
  entry,
  active,
  editable,
  onPick,
  onRename,
  actions,
}: PerspectivePillProps) {
  const canEdit = editable && entry.source === 'saved';
  return (
    <Tooltip
      title={`${entry.source} perspective${canEdit ? ' — double-click to rename' : ''}`}
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
        <span className={`${styles.dot} ${styles[entry.source]}`} />
        {entry.title}
        {entry.saved?.isDefault && <StarFilled className={styles.star} />}
        {entry.source !== 'draft' && (
          <EyeInvisibleOutlined
            role="button"
            aria-label="Hide view"
            title="Hide view"
            className={styles.hide}
            onClick={(e) => {
              e.stopPropagation();
              actions.onHide(entry);
            }}
          />
        )}
        {active && canEdit && (
          <CloseOutlined
            aria-label="Delete perspective"
            className={styles.close}
            onClick={(e) => {
              e.stopPropagation();
              actions.onDelete(entry);
            }}
          />
        )}
      </span>
    </Tooltip>
  );
});
