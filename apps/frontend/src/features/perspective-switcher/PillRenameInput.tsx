import { Input } from 'antd';
import type { PillRename } from './usePillRename';
import styles from './PerspectivePills.module.css';

/** The pill of the perspective being renamed, turned into a text field sized to its content. */
export function PillRenameInput({ rename }: { rename: PillRename }) {
  return (
    <Input
      size="small"
      autoFocus
      aria-label="Perspective name"
      value={rename.draft}
      onChange={(e) => rename.setDraft(e.target.value)}
      onFocus={(e) => e.target.select()}
      onPressEnter={(e) => e.currentTarget.blur()}
      onBlur={rename.commit}
      onKeyDown={(e) => {
        if (e.key !== 'Escape') return;
        rename.cancel();
        e.currentTarget.blur();
      }}
      className={`${styles.pill} ${styles.active} ${styles.renaming}`}
      style={{ width: Math.max(80, rename.draft.length * 7 + 24) }}
    />
  );
}
