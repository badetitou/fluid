import { SnippetsOutlined } from '@ant-design/icons';
import { isCoreWidget, type Widget } from '@fluid/shared';
import { WIDGET_INFO } from '../../views/widgets/widgetInfo';
import styles from './WidgetBuilder.module.css';

interface PasteWidgetEntryProps {
  /** The copied widget. */
  widget: Widget;
  onPaste: () => void;
}

/** Pastes the widget copied last, from this view or another, below the others. */
export function PasteWidgetEntry({ widget, onPaste }: PasteWidgetEntryProps) {
  const kind = isCoreWidget(widget) ? WIDGET_INFO[widget.type].label : widget.type;
  return (
    <button type="button" className={`${styles.entry} ${styles.pasteEntry}`} onClick={onPaste}>
      <span className={styles.entryIcon}>
        <SnippetsOutlined />
      </span>
      <span className={styles.entryText}>
        <span className={styles.entryLabel}>Paste “{widget.title || widget.id}”</span>
        <span className={styles.entryDescription}>{kind} copied from a view, with the queries it uses · ⌘V</span>
      </span>
    </button>
  );
}
