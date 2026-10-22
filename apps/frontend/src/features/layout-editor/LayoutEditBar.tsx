import { LayoutHint } from './LayoutHint';
import { LayoutTitleInput } from './LayoutTitleInput';
import type { LayoutEditor } from './useLayoutEditor';
import styles from './LayoutEditor.module.css';

interface LayoutEditBarProps {
  editor: LayoutEditor;
  savesAsCopy: boolean;
  compact: boolean;
}

/** Shown in place of the perspective pills while editing: the view's title and how to arrange widgets. */
export function LayoutEditBar({ editor, savesAsCopy, compact }: LayoutEditBarProps) {
  return (
    <div className={`${styles.bar} ${compact ? styles.grow : ''}`}>
      <LayoutTitleInput editor={editor} />
      <LayoutHint savesAsCopy={savesAsCopy} compact={compact} />
    </div>
  );
}
