import { useCallback, useEffect, useMemo, useRef } from 'react';
import { App as AntdApp } from 'antd';
import type { ViewSpec, Widget } from '@fluid/shared';
import { useConceptSchema, useRootConcepts, type Concept } from '../../entities/concept';
import { useColumnPreselect, type Preselect } from '../../entities/dashboard';
import { rootFieldsOf } from '../../entities/plugin';
import {
  newViewDraft,
  newViewId,
  savedViewDraft,
  useColumnPerspectives,
  useViewMutations,
  type SavedView,
  type ViewEntry,
} from '../../entities/view';
import { withAdditions, type SpecAdditions } from '../../entities/widget-clipboard';
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
  /** Position of the column, under which its last perspective is remembered. */
  slot: string;
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
export function useColumnController(concept: Concept, { path, slot, itemId, perspective, isFullscreen, onToggleFullscreen }: Options) {
  const { modal } = AntdApp.useApp();
  const { relatedNames, conceptByName, schema } = useConceptSchema(concept);
  const { queriesByType, rootType } = useRootConcepts();
  const rootFields = useMemo(() => rootFieldsOf(rootType), [rootType]);
  const newView = useNewView(
    useColumnPerspectives(concept, { itemId, slot, initialKey: perspective, conceptByName, queriesByType, rootFields }),
    { concept: concept.name, itemId, byIdField: concept.queries.byId?.field },
  );
  const { perspectives } = newView;
  const { selected, columnKind, pick, hide, refetch } = perspectives;
  const mutations = useViewMutations(refetch);
  const dialogs = useColumnDialogs();
  const pinning = usePinnableConcepts(useMemo(() => [concept.name, ...relatedNames], [concept.name, relatedNames]));
  const rename = usePillRename((entry, title) => entry.saved && mutations.rename(entry.saved.id, title));
  const dashboards = useColumnDashboards({ path, concept: concept.name, itemId, selected, entries: perspectives.entries });

  // "New dashboard" opens this column on the blank page offering AI / manual / JSON.
  const preselect = useColumnPreselect(path);
  const startedFor = useRef<Preselect | null>(null);
  useEffect(() => {
    if (!preselect?.newView || startedFor.current === preselect) return;
    startedFor.current = preselect;
    newView.start();
  }, [preselect, newView.start]);

  // Editing a curated/auto perspective's layout saves the arrangement as a new saved perspective.
  const saveLayout = async (widgets: Widget[], title: string, additions: SpecAdditions) => {
    if (!selected) return false;
    const spec = withAdditions({ ...selected.spec, title, widgets }, additions);
    if (selected.saved) return Boolean(await mutations.updateSpec(selected.saved.id, spec, 'Layout saved'));
    const copy = withScope({ ...spec, id: newViewId(concept.name) }, columnKind);
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
  const pillActions = useMemo(() => ({ onDelete: remove, onHide: (entry: ViewEntry) => hide(entry.key) }), [remove, hide]);

  const onSaved = useCallback(
    (view: SavedView, asDashboard = false) => {
      (asDashboard ? dashboards.saveAsDashboard : dashboards.viewSaved)(view);
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
    hide: () => selected && hide(selected.key),
    show: perspectives.show,
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
    perspectives, mutations, layout, editorSwitch, rename, pillActions,
    dialogs, pinning, schema, actions, onSaved, renderWidgetActions, openViewAssistant: dialogs.openViewAssistant,
  };
}
