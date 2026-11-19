import type { ViewBuilder } from '../../viewBuilder';
import { discoverProvider, fetchItems, fetchObjectViews, fetchView } from './api';
import { ENDPOINTS_SETTING, ITEMS_QUERY, VIEW_QUERY, mergeByPriority, parseEndpoints, queryVariables, viewPerspective } from './model';

export { ENDPOINTS_SETTING } from './model';
export { evaluateOn, forgetProviders } from './api';

export interface OpenViewsBuilderOptions {
  /** The builder id, also the id of its data source. */
  id: string;
  label: string;
  /** The base URLs the builder reads, from the plugin's settings. */
  endpoints: (settings: Readonly<Record<string, string>>) => string[];
  /** Read an endpoint whose discovery answers 404 as an old Spec-Fluid server. */
  legacy?: boolean;
}

/**
 * A view builder reading fluid Open Views endpoints (`docs/architecture/OPEN-VIEWS.md`):
 * every view an endpoint declares for the item of a detail column becomes a
 * perspective, all endpoints merged by priority. Silent until an endpoint is
 * set; an unreachable endpoint proposes nothing.
 */
export function createOpenViewsBuilder({ id, label, endpoints, legacy = false }: OpenViewsBuilderOptions): ViewBuilder {
  return {
    id,
    label,
    fetchPerspectives: async ({ concept, itemId, columnKind, settings }, signal) => {
      const bases = endpoints(settings);
      if (bases.length === 0 || columnKind !== 'detail' || !itemId) return [];
      const lists = await Promise.all(
        bases.map(async (endpoint) => {
          try {
            const provider = await discoverProvider(endpoint, legacy);
            return { endpoint, views: (await fetchObjectViews(provider, itemId, signal)).views };
          } catch {
            return { endpoint, views: [] };
          }
        }),
      );
      return mergeByPriority(lists).map(({ endpoint, view }) => viewPerspective(id, concept, itemId, endpoint, view));
    },
    dataSource: (settings) => ({
      id,
      run: async (query, variables, signal) => {
        const bases = endpoints(settings);
        if (bases.length === 0) throw new Error(`Set the endpoint of ${label} in Settings → Plugins.`);
        if (query !== VIEW_QUERY && query !== ITEMS_QUERY) {
          throw new Error(`Open Views answers "${VIEW_QUERY}" and "${ITEMS_QUERY}" queries, not "${query}".`);
        }
        const vars = queryVariables(query, variables, bases);
        const provider = await discoverProvider(vars.endpoint, legacy);
        if ('path' in vars) return fetchItems(provider, vars.id, vars.view, vars, signal);
        return fetchView(provider, vars.id, vars.view, signal);
      },
    }),
  };
}

/** The generic Open Views builder: any number of endpoints, one per line. */
export const openViewsBuilder: ViewBuilder = createOpenViewsBuilder({
  id: 'open-views',
  label: 'Open Views',
  endpoints: (settings) => parseEndpoints(settings[ENDPOINTS_SETTING]),
});
