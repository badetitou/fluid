import { useCallback, useEffect, useMemo } from 'react';
import { App as AntdApp } from 'antd';
import type { ViewSpec, Widget } from '@fluid/shared';
import { useConceptSchema, useRootConcepts, type Concept } from '../../entities/concept';
import { useColumnPreselect } from '../../entities/dashboard';
import {
  newViewDraft,
  newViewId,
  savedViewDraft,
  useColumnPerspectives,
  useViewMutations,
  type SavedView,
  type ViewEntry,
} from '../../entities/view';
import { usePinnableConcepts } from '../../features/concept-pinning';
import { useColumnDashboards } from '../../features/dashboard-promotion';
import { useLayoutEditor } from '../../features/layout-editor';
import type { PerspectiveActions } from '../../features/perspective-menu';
import { usePillRename } from '../../features/perspective-switcher';
import { WidgetAssistantAction } from '../../features/widget-assistant';
import { withScope } from '../../views/viewScope';
import { useColumnDialogs } from './useColumnDialogs';
import { useEditorSwitch } from './useEditorSwitch';
import { useNewView } from './useNewView';

interface Options {
  /** Miller path of the column, which dashboards open. */
  path: string;
  itemId?: string;
  /** Perspective shown first (a saved dashboard's). */
  perspective?: string;
  isFullscreen: boolean;
  /** Omitted when the column already fills the page. */
  onToggleFullscreen?: () => void;
}

/**
 * Everything a Miller column does, wired from the entity hooks and the
 * features: perspectives, their mutations, layout editing, inline rename,
 * pinning and the editors' dialogs. The column body only lays it out.
 */
export function useColumnController(concept: Concept, { path, itemId, perspective, isFullscreen, onToggleFullscreen }: Options) {
  const { modal } = AntdApp.useApp();
  const { relatedNames, conceptByName, schema } = useConceptSchema(concept);
  const { queriesByType } = useRootConcepts();
  const newView = useNewView(
    useColumnPerspectives(concept, { itemId, initialKey: perspective, conceptByName, queriesByType }),
    concept.name,
  );
  const { perspectives } = newView;
  const { selected, columnKind, pick, refetch } = perspectives;
  const mutations = useViewMutations(refetch);
  const dialogs = useColumnDialogs();
  const pinning = usePinnableConcepts(useMemo(() => [concept.name, ...relatedNames], [concept.name, relatedNames]));
  const rename = usePillRename((entry, title) => entry.saved && mutations.rename(entry.saved.id, title));
  const dashboards = useColumnDashboards({ path, concept: concept.name, itemId, selected, entries: perspectives.entries });

  // "New dashboard" opens this column with the assistant ready.
  const preselect = useColumnPreselect(path);
  const { openAssistant } = dialogs;
  useEffect(() => {
    if (preselect?.assistant) openAssistant();
  }, [preselect, openAssistant]);

  // Editing a curated/auto perspective's layout saves the arrangement as a new saved perspective.
  const saveLayout = async (widgets: Widget[], title: string) => {
    if (!selected) return false;
    if (selected.saved) {
      return Boolean(await mutations.updateSpec(selected.saved.id, { ...selected.spec, title, widgets }, 'Layout saved'));
    }
    const copy = withScope({ ...selected.spec, id: newViewId(concept.name), title, widgets }, columnKind);
    const isNew = selected.source === 'draft';
    const created = await mutations.create(copy, isNew ? 'View created' : 'Layout saved as a new perspective');
    if (created) pick(created.id);
    return Boolean(created);
  };
  const layout = useLayoutEditor({ viewKey: selected?.key, isFullscreen, onToggleFullscreen, onSave: saveLayout });
  const editorSwitch = useEditorSwitch({ selected, columnKind, layout, dialogs });

  const remove = useCallback(
    (entry: ViewEntry) => {
      const id = entry.saved?.id;
      if (!id) return;
      modal.confirm({
        title: 'Delete this perspective?',
        content: 'This removes the saved view for everyone.',
        okText: 'Delete',
        okButtonProps: { danger: true },
        onOk: async () => {
          if (!(await mutations.remove(id))) return;
          dashboards.viewDeleted(id);
          if (entry.key === selected?.key) pick(undefined);
        },
      });
    },
    [modal, mutations, dashboards, selected?.key, pick],
  );

  const onSaved = useCallback(
    (view: SavedView) => {
      dashboards.viewSaved(view);
      refetch();
      pick(view.id);
    },
    [dashboards, refetch, pick],
  );

  const actions: PerspectiveActions = {
    createView: newView.start,
    editWithAssistant: () => selected?.saved && dialogs.openAssistant(selected.saved),
    createJson: () => dialogs.openJson(newViewDraft(concept.name, selected?.spec, columnKind)),
    editJson: () => {
      const draft = selected && savedViewDraft(selected);
      if (draft) dialogs.openJson(draft);
    },
    setDefault: () => selected?.saved && mutations.setDefault(selected.saved.id),
    remove: () => selected && remove(selected),
    openSettings: dialogs.openSettings,
    pin: pinning.pin,
    promote: dashboards.promote,
  };

  // Stable while the saved view does not change: widget cards are memoised on it.
  const savedId = selected?.saved?.id;
  const savedSpec: ViewSpec | undefined = selected?.saved?.spec;
  const renderWidgetActions = useMemo(
    () =>
      savedId && savedSpec
        ? (widget: Widget) => (
            <WidgetAssistantAction
              widget={widget}
              view={{ concept: concept.name, schema, viewId: savedId, viewSpec: savedSpec }}
              onSaved={onSaved}
            />
          )
        : undefined,
    [savedId, savedSpec, concept.name, schema, onSaved],
  );

  return {
    perspectives, mutations, layout, editorSwitch, rename, remove,
    dialogs, pinning, schema, actions, onSaved, renderWidgetActions,
  };
}
