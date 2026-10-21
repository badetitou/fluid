import { useCallback, useMemo } from 'react';
import { App as AntdApp } from 'antd';
import type { ViewSpec, Widget } from '@fluid/shared';
import { useConceptSchema, useRootConcepts, type Concept } from '../../entities/concept';
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
import { useLayoutEditor } from '../../features/layout-editor';
import type { PerspectiveActions } from '../../features/perspective-menu';
import { usePillRename } from '../../features/perspective-switcher';
import { WidgetAssistantAction } from '../../features/widget-assistant';
import { withScope } from '../../views/viewScope';
import { useColumnDialogs } from './useColumnDialogs';

interface Options {
  itemId?: string;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
}

/**
 * Everything a Miller column does, wired from the entity hooks and the
 * features: perspectives, their mutations, layout editing, inline rename,
 * pinning and the editors' dialogs. The column body only lays it out.
 */
export function useColumnController(concept: Concept, { itemId, isFullscreen, onToggleFullscreen }: Options) {
  const { modal } = AntdApp.useApp();
  const { relatedNames, conceptByName, schema } = useConceptSchema(concept);
  const { queriesByType } = useRootConcepts();
  const perspectives = useColumnPerspectives(concept, { itemId, conceptByName, queriesByType });
  const { selected, columnKind, pick, refetch } = perspectives;
  const mutations = useViewMutations(refetch);
  const dialogs = useColumnDialogs();
  const pinning = usePinnableConcepts(useMemo(() => [concept.name, ...relatedNames], [concept.name, relatedNames]));
  const rename = usePillRename((entry, title) => entry.saved && mutations.rename(entry.saved.id, title));

  // Editing a curated/auto perspective's layout saves the arrangement as a new saved perspective.
  const saveLayout = async (widgets: Widget[]) => {
    if (!selected) return false;
    if (selected.saved) {
      return Boolean(await mutations.updateSpec(selected.saved.id, { ...selected.spec, widgets }, 'Layout saved'));
    }
    const copy = withScope(
      { ...selected.spec, id: newViewId(concept.name), title: selected.title, widgets },
      columnKind,
    );
    const created = await mutations.create(copy, 'Layout saved as a new perspective');
    if (created) pick(created.id);
    return Boolean(created);
  };
  const layout = useLayoutEditor({ viewKey: selected?.key, isFullscreen, onToggleFullscreen, onSave: saveLayout });

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
          if ((await mutations.remove(id)) && entry.key === selected?.key) pick(undefined);
        },
      });
    },
    [modal, mutations, selected?.key, pick],
  );

  const onSaved = useCallback(
    (view: SavedView) => {
      refetch();
      pick(view.id);
    },
    [refetch, pick],
  );

  const actions: PerspectiveActions = {
    createWithAssistant: () => dialogs.openAssistant(),
    editWithAssistant: () => selected?.saved && dialogs.openAssistant(selected.saved),
    createJson: () => dialogs.openJson(newViewDraft(concept.name, selected?.spec, columnKind)),
    editJson: () => {
      const draft = selected && savedViewDraft(selected);
      if (draft) dialogs.openJson(draft);
    },
    rename: () => selected && rename.start(selected),
    setDefault: () => selected?.saved && mutations.setDefault(selected.saved.id),
    remove: () => selected && remove(selected),
    openSettings: dialogs.openSettings,
    pin: pinning.pin,
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

  return { perspectives, mutations, layout, rename, remove, dialogs, pinning, schema, actions, onSaved, renderWidgetActions };
}
