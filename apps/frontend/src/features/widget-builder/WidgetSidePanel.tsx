import type { ViewSpec } from '@fluid/shared';
import { useWidgetBuilder, type WidgetBuilderTarget } from './useWidgetBuilder';
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
 * options of the widget selected on the grid.
 */
export function WidgetSidePanel({ spec, editor }: WidgetSidePanelProps) {
  const builder = useWidgetBuilder(spec, editor);
  const { selected } = builder;

  return (
    <aside className={styles.panel} aria-label={selected ? 'Widget options' : 'Widget catalog'}>
      {selected ? (
        <WidgetInspector
          key={selected.id}
          widget={selected}
          suggestions={builder.suggestions}
          onChange={builder.update}
          onRemove={builder.remove}
          onClose={builder.close}
        />
      ) : (
        <WidgetCatalog onAdd={builder.add} />
      )}
    </aside>
  );
}
