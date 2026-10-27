import { isCoreWidget, type ViewSpec } from '@fluid/shared';
import { PluginWidgetNote } from './PluginWidgetNote';
import { useWidgetBuilder, type WidgetBuilderTarget } from './useWidgetBuilder';
import { PasteWidgetEntry } from './PasteWidgetEntry';
import { useWidgetCopyPaste } from './useWidgetCopyPaste';
import { WidgetCatalog } from './WidgetCatalog';
import { WidgetInspector } from './WidgetInspector';
import styles from './WidgetBuilder.module.css';

interface WidgetSidePanelProps {
  /** The view as currently edited. */
  spec: ViewSpec;
  editor: WidgetBuilderTarget;
}

/**
 * Shown next to the grid while editing the layout: the widget catalog, or the
 * options of the widget selected on the grid. Widgets copy and paste across
 * views from here or with ⌘C / ⌘V.
 */
export function WidgetSidePanel({ spec, editor }: WidgetSidePanelProps) {
  const builder = useWidgetBuilder(spec, editor);
  const { selected } = builder;
  const clipboard = useWidgetCopyPaste(spec, editor);

  return (
    <aside className={styles.panel} aria-label={selected ? 'Widget options' : 'Widget catalog'}>
      {selected && !isCoreWidget(selected) ? (
        <PluginWidgetNote type={selected.type} onCopy={clipboard.copy} onClose={builder.close} />
      ) : selected ? (
        <WidgetInspector
          key={selected.id}
          widget={selected}
          suggestions={builder.suggestions}
          onChange={builder.update}
          onCopy={clipboard.copy}
          onRemove={builder.remove}
          onClose={builder.close}
        />
      ) : (
        <WidgetCatalog
          onAdd={builder.add}
          extra={clipboard.copied && <PasteWidgetEntry widget={clipboard.copied.widget} onPaste={clipboard.paste} />}
        />
      )}
    </aside>
  );
}
