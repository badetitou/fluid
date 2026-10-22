import { Tooltip } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import type { ViewEntry } from '../../entities/view';
import { usePreferences } from '../../store';
import { PerspectivePill } from './PerspectivePill';
import { PillRenameInput } from './PillRenameInput';
import { ScrollArrow } from './ScrollArrow';
import { useScrollArrows } from './useScrollArrows';
import type { PillRename } from './usePillRename';
import styles from './PerspectivePills.module.css';

interface PerspectivePillsProps {
  entries: ViewEntry[];
  selectedKey: string | undefined;
  /** False when the BFF is unreachable: saved perspectives cannot change. */
  editable: boolean;
  rename: PillRename;
  onPick: (key: string) => void;
  /** Delete a saved perspective. */
  onDelete: (entry: ViewEntry) => void;
  /** "+" pill: create a perspective. */
  onCreate: () => void;
}

/** Floating pills switching between the perspectives of a column. */
export function PerspectivePills(props: PerspectivePillsProps) {
  const { entries, selectedKey, editable, rename, onPick, onDelete, onCreate } = props;
  const compact = usePreferences((s) => s.density === 'compact');
  const arrows = useScrollArrows();
  return (
    <div className={`${styles.wrap} ${compact ? styles.compact : ''}`}>
      {arrows.edges.left && <ScrollArrow direction={-1} onScroll={arrows.scroll} />}
      <div role="tablist" ref={arrows.ref} className={styles.bar}>
        {entries.map((e) =>
          e.key === rename.renamingKey ? (
            <PillRenameInput key={e.key} rename={rename} />
          ) : (
            <PerspectivePill
              key={e.key}
              entry={e}
              active={e.key === selectedKey}
              editable={editable}
              onPick={onPick}
              onRename={rename.start}
              onDelete={onDelete}
            />
          ),
        )}
        {editable && (
          <Tooltip title="New view">
            <span
              role="button"
              aria-label="New perspective"
              tabIndex={0}
              onClick={onCreate}
              onKeyDown={(e) => e.key === 'Enter' && onCreate()}
              className={`${styles.pill} ${styles.add}`}
            >
              <PlusOutlined className={styles.plus} />
            </span>
          </Tooltip>
        )}
      </div>
      {arrows.edges.right && <ScrollArrow direction={1} onScroll={arrows.scroll} />}
    </div>
  );
}
