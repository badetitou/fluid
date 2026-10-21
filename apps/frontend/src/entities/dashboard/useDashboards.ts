import { useCallback, useMemo } from 'react';
import { useConnection } from '../../store';
import { addDashboard, forgetPerspective, removeDashboard, renameDashboard, setDashboardIcon, type Dashboard } from './model';
import { useDashboardStore } from './store';

const EMPTY: Dashboard[] = [];

/** The dashboards of the current GraphQL source and the ways to change them. */
export function useDashboards() {
  const graphqlUrl = useConnection((s) => s.graphqlUrl);
  const dashboards = useDashboardStore((s) => (graphqlUrl ? s.byUrl[graphqlUrl] : undefined)) ?? EMPTY;
  const update = useDashboardStore((s) => s.update);

  const change = useCallback(
    (fn: (list: Dashboard[]) => Dashboard[]) => {
      if (graphqlUrl) update(graphqlUrl, fn);
    },
    [graphqlUrl, update],
  );

  return useMemo(
    () => ({
      dashboards,
      find: (id: string) => dashboards.find((d) => d.id === id),
      /** Adds the dashboard and returns it, or the existing one showing the same column. */
      add: (dashboard: Dashboard) => {
        let added = dashboard;
        change((list) => {
          const result = addDashboard(list, dashboard);
          added = result.dashboard;
          return result.list;
        });
        return added;
      },
      remove: (id: string) => change((list) => removeDashboard(list, id)),
      rename: (id: string, title: string) => change((list) => renameDashboard(list, id, title)),
      setIcon: (id: string, icon: string | null) => change((list) => setDashboardIcon(list, id, icon)),
      forgetPerspective: (key: string) => change((list) => forgetPerspective(list, key)),
    }),
    [dashboards, change],
  );
}
