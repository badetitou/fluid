import { useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { App as AntdApp } from 'antd';
import { isGraphConcept } from '@fluid/shared';
import { dashboardFromColumn, dashboardHref, GRAPH_PATH, useDashboards } from '../../entities/dashboard';
import type { SavedView, ViewEntry } from '../../entities/view';

interface Column {
  path: string;
  concept: string;
  itemId?: string;
  /** Perspective shown in the column. */
  selected: ViewEntry | undefined;
  /** Perspectives listed in the column before a save, to tell new views apart. */
  entries: ViewEntry[];
}

/**
 * Keeps a column's dashboards in step with it: promote the column (on its
 * current perspective) to a dashboard of its own, turn every new whole-graph
 * view into a dashboard, and drop the dashboards of a deleted perspective.
 */
export function useColumnDashboards({ path, concept, itemId, selected, entries }: Column) {
  const { message } = AntdApp.useApp();
  const navigate = useNavigate();
  const { add, forgetPerspective } = useDashboards();

  const promote = useCallback(() => {
    const perspective = selected && { key: selected.key, title: selected.title };
    const dashboard = add(dashboardFromColumn({ concept, itemId, perspective }));
    message.success(`"${dashboard.title}" is in your dashboards`);
  }, [add, message, concept, itemId, selected]);

  const viewSaved = useCallback(
    (view: SavedView) => {
      if (!isGraphConcept(concept) || entries.some((e) => e.key === view.id)) return;
      const dashboard = add(dashboardFromColumn({ concept, perspective: { key: view.id, title: view.title } }));
      // Created from "New dashboard": continue on the dashboard itself.
      if (path === GRAPH_PATH) navigate(dashboardHref(dashboard));
    },
    [add, navigate, concept, entries, path],
  );

  /** A view saved on purpose as a dashboard (from the chat): listed whatever the concept. */
  const saveAsDashboard = useCallback(
    (view: SavedView) => {
      const dashboard = add(dashboardFromColumn({ concept, itemId, perspective: { key: view.id, title: view.title } }));
      message.success(`"${dashboard.title}" is in your dashboards`);
      if (path === GRAPH_PATH) navigate(dashboardHref(dashboard));
    },
    [add, message, navigate, concept, itemId, path],
  );

  return useMemo(
    () => ({ promote, viewSaved, saveAsDashboard, viewDeleted: forgetPerspective }),
    [promote, viewSaved, saveAsDashboard, forgetPerspective],
  );
}
