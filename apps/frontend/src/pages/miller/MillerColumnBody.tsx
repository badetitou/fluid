import type { Concept } from '../../entities/concept';
import { LayoutEditBar, LayoutEditToolbar } from '../../features/layout-editor';
import { PerspectiveMenu } from '../../features/perspective-menu';
import { PerspectivePills } from '../../features/perspective-switcher';
import { NewViewChoices } from '../../features/view-creation';
import { WidgetSidePanel } from '../../features/widget-builder';
import { usePreferences } from '../../store';
import { ViewRenderer } from '../../views/ViewRenderer';
import { ColumnActions } from './ColumnActions';
import { ColumnDialogs } from './ColumnDialogs';
import { ColumnEmpty } from './ColumnEmpty';
import { ColumnHeader } from './ColumnHeader';
import { columnSubtitle, columnTitle, type ColumnConfig } from './model';
import { useColumnController } from './useColumnController';
import styles from './MillerColumn.module.css';

/**
 * How a column is shown: a dashboard alone as a `page`, one of several Miller
 * columns, or one of them expanded to `fullscreen`. A page and a full-screen
 * column lay their widgets out on the extra width.
 */
export type ColumnMode = 'page' | 'column' | 'fullscreen';

interface MillerColumnBodyProps {
  concept: Concept;
  column: ColumnConfig;
  mode: ColumnMode;
  onToggleFullscreen: (slot: string) => void;
  onClose: (parentPath: string) => void;
}

/**
 * The column body for a loaded concept: its perspectives as pills, the active
 * one rendered compactly so it fits a narrow column, and the editors.
 */
export function MillerColumnBody({ concept, column, mode, onToggleFullscreen, onClose }: MillerColumnBodyProps) {
  const { path, slot, itemId, parentPath, perspective } = column;
  const compact = usePreferences((s) => s.density === 'compact');
  const isFullscreen = mode !== 'column';
  const toggleFullscreen = mode === 'page' ? undefined : () => onToggleFullscreen(slot);
  const c = useColumnController(concept, { path, slot, itemId, perspective, isFullscreen, onToggleFullscreen: toggleFullscreen });
  const { entries, selected, spec, columnKind, loading, bffAvailable, pick } = c.perspectives;
  const { layout, mutations, editorSwitch } = c;
  const { startWith } = editorSwitch;
  const createView = bffAvailable ? c.actions.createView : undefined;

  const bar = layout.editing ? (
    <LayoutEditBar editor={layout} savesAsCopy={!selected?.saved} compact={compact} />
  ) : (
    entries.length > 0 && (
      <PerspectivePills
        entries={entries}
        selectedKey={selected?.key}
        editable={bffAvailable}
        rename={c.rename}
        onPick={pick}
        onDelete={c.remove}
        onCreate={c.actions.createView}
      />
    )
  );

  const actions = layout.editing ? (
    <LayoutEditToolbar
      editor={layout}
      busy={mutations.busy}
      compact={compact}
      onOpenAssistant={bffAvailable ? editorSwitch.toAssistant : undefined}
      onOpenJson={editorSwitch.toJson}
    />
  ) : (
    <ColumnActions
      onEditLayout={selected && spec && bffAvailable ? () => layout.start(spec.widgets, selected.title) : undefined}
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

  const shown = spec && layout.widgets ? { ...spec, widgets: layout.widgets } : spec;
  const body = (
    <div className={styles.body}>
      {selected?.source === 'draft' && !layout.editing ? (
        <NewViewChoices onAssistant={startWith.assistant} onManual={startWith.manual} onJson={startWith.json} />
      ) : shown ? (
        <div className={styles.padded}>
          <ViewRenderer
            key={selected?.key}
            spec={shown}
            editingLayout={layout.editing}
            onWidgetsChange={layout.change}
            selectedWidgetId={layout.selected?.id}
            onSelectWidget={layout.select}
            renderWidgetActions={c.renderWidgetActions}
          />
        </div>
      ) : (
        <ColumnEmpty loading={loading} onCreate={createView} />
      )}
    </div>
  );

  return (
    <>
      <ColumnHeader
        title={columnTitle(column)}
        subtitle={columnSubtitle(concept.name)}
        bar={bar}
        actions={actions}
        page={mode === 'page'}
      />
      {layout.editing && shown ? (
        <div className={styles.editing}>
          {body}
          <WidgetSidePanel spec={shown} editor={layout} />
        </div>
      ) : (
        body
      )}
      <ColumnDialogs
        dialogs={c.dialogs}
        target={{ concept: concept.name, schema: c.schema, scope: columnKind, itemId, byIdField: concept.queries.byId?.field }}
        onSaved={c.onSaved}
      />
    </>
  );
}
