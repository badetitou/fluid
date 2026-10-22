import { Input } from 'antd';
import type { LayoutEditor } from './useLayoutEditor';
import styles from './LayoutEditor.module.css';

/** The view's title, editable while arranging its widgets; saved with the layout. */
export function LayoutTitleInput({ editor }: { editor: LayoutEditor }) {
  return (
    <Input
      size="small"
      aria-label="View title"
      placeholder="View title"
      value={editor.title}
      onChange={(e) => editor.rename(e.target.value)}
      onPressEnter={(e) => e.currentTarget.blur()}
      className={styles.titleInput}
    />
  );
}
