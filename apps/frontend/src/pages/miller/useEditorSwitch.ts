import type { ViewSpec } from '@fluid/shared';
import { editedViewDraft, newViewDraft, newViewId, type ViewEntry } from '../../entities/view';
import type { LayoutEditor } from '../../features/layout-editor';
import type { ColumnKind } from '../../views/viewScope';
import type { ColumnDialogs } from './useColumnDialogs';

interface Options {
  selected: ViewEntry | undefined;
  columnKind: ColumnKind;
  layout: LayoutEditor;
  dialogs: ColumnDialogs;
}

/**
 * Moves between the editors of a view: from the blank page of a new view to
 * the first one, and from the layout (no-code) editor to the assistant or the
 * JSON editor, carrying over the arranged widgets and the edited title.
 */
export function useEditorSwitch({ selected, columnKind, layout, dialogs }: Options) {
  const edited = (): ViewSpec | undefined =>
    selected && layout.widgets
      ? { ...selected.spec, title: layout.title.trim() || selected.title, widgets: layout.widgets }
      : undefined;

  const toJson = () => {
    const spec = edited();
    if (!selected || !spec) return;
    dialogs.openJson(editedViewDraft(selected, spec, columnKind));
    layout.exit();
  };

  const toAssistant = () => {
    const spec = edited();
    if (!selected || !spec) return;
    if (selected.saved) dialogs.openAssistant(selected.saved, spec);
    // A blank new view starts a fresh conversation; any other is refined as a new view.
    else dialogs.openAssistant(undefined, spec.widgets.length > 0 ? { ...spec, id: newViewId(spec.concept), scope: columnKind } : undefined);
    layout.exit();
  };

  // The blank page of a new view: pick the editor to build it with.
  const startWith = {
    assistant: () => dialogs.openAssistant(),
    manual: () => selected && layout.start(selected.spec.widgets, selected.title),
    json: () => selected && dialogs.openJson(newViewDraft(selected.spec.concept, selected.spec, columnKind)),
  };

  return { toJson, toAssistant, startWith };
}
