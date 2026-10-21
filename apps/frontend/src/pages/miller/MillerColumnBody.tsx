import type { Concept } from '../../entities/concept';
import { LayoutEditToolbar, LayoutHint } from '../../features/layout-editor';
import { PerspectiveMenu } from '../../features/perspective-menu';
import { PerspectivePills } from '../../features/perspective-switcher';
import { usePreferences } from '../../store';
import { ViewRenderer } from '../../views/ViewRenderer';
import { ColumnActions } from './ColumnActions';
import { ColumnDialogs } from './ColumnDialogs';
import { ColumnEmpty } from './ColumnEmpty';
import { ColumnHeader } from './ColumnHeader';
import { columnSubtitle, columnTitle } from './model';
import { useColumnController } from './useColumnController';
import styles from './MillerColumn.module.css';

/** How a column sits in the Miller view. */
export interface ColumnFrame {
  /** Present for drill-in (detail) columns; injects the id into the by-id query. */
  itemId?: string;
  parentPath?: string;
  /** When true, this column occupies the whole view (its widgets reflow to the extra width). */
  isFullscreen: boolean;
  onToggleFullscreen: (path: string) => void;
  onClose: (parentPath: string) => void;
}

interface MillerColumnBodyProps extends ColumnFrame {
  concept: Concept;
  path: string;
}

/**
 * The column body for a loaded concept: its perspectives as pills, the active
 * one rendered compactly so it fits a narrow column, and the editors.
 */
export function MillerColumnBody({ concept, path, itemId, parentPath, isFullscreen, onToggleFullscreen, onClose }: MillerColumnBodyProps) {
  const compact = usePreferences((s) => s.density === 'compact');
  const toggleFullscreen = () => onToggleFullscreen(path);
  const c = useColumnController(concept, { itemId, isFullscreen, onToggleFullscreen: toggleFullscreen });
  const { entries, selected, spec, columnKind, loading, bffAvailable, pick } = c.perspectives;
  const { layout, mutations } = c;
  const createWithAssistant = bffAvailable ? c.actions.createWithAssistant : undefined;

  const bar = layout.editing ? (
    <LayoutHint savesAsCopy={!selected?.saved} compact={compact} />
  ) : (
    entries.length > 0 && (
      <PerspectivePills
        entries={entries}
        selectedKey={selected?.key}
        editable={bffAvailable}
        rename={c.rename}
        onPick={pick}
        onDelete={c.remove}
        onCreate={c.actions.createWithAssistant}
      />
    )
  );

  const actions = layout.editing ? (
    <LayoutEditToolbar editor={layout} busy={mutations.busy} compact={compact} />
  ) : (
    <ColumnActions
      onEditLayout={spec && bffAvailable && spec.widgets.length > 0 ? () => layout.start(spec.widgets) : undefined}
      menu={
        <PerspectiveMenu
          state={{ selected, bffAvailable, concept: concept.name, pinnable: c.pinning.pinnable }}
          actions={c.actions}
          busy={mutations.busy}
        />
      }
      isFullscreen={isFullscreen}
      onToggleFullscreen={toggleFullscreen}
      onClose={parentPath !== undefined ? () => onClose(parentPath) : undefined}
    />
  );

  return (
    <>
      <ColumnHeader
        title={columnTitle({ conceptName: concept.name, itemId })}
        subtitle={columnSubtitle(concept.name)}
        bar={bar}
        actions={actions}
      />
      <div className={styles.body}>
        {spec ? (
          <div className={styles.padded}>
            <ViewRenderer
              key={selected?.key}
              spec={layout.widgets ? { ...spec, widgets: layout.widgets } : spec}
              editingLayout={layout.editing}
              onWidgetsChange={layout.change}
              renderWidgetActions={c.renderWidgetActions}
            />
          </div>
        ) : (
          <ColumnEmpty loading={loading} onCreate={createWithAssistant} />
        )}
      </div>
      <ColumnDialogs
        dialogs={c.dialogs}
        target={{ concept: concept.name, schema: c.schema, scope: columnKind }}
        onSaved={c.onSaved}
      />
    </>
  );
}
