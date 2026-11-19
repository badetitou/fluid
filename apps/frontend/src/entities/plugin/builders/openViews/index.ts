import type { ViewBuilder } from '../../viewBuilder';
import type { ViewResponse } from '@fluid/shared';
import type { DataSource } from '../../../../views/plugin-api';
import { discoverProvider, fetchItems, fetchObjectViews, fetchView, runAction } from './api';
import { ENDPOINTS_SETTING, LEGACY_TAB_QUERY, isOpenViewsQuery, mergeByPriority, resolveQuery, parseEndpoints, queryVariables, viewPerspective } from './model';

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
      // Each endpoint on its own: a failing or silent one (requests time out) proposes nothing.
      const settled = await Promise.allSettled(
        bases.map(async (endpoint) => {
          const provider = await discoverProvider(endpoint, legacy);
          return { endpoint, views: (await fetchObjectViews(provider, itemId, signal)).views };
        }),
      );
      const lists = settled.flatMap((result) => (result.status === 'fulfilled' ? [result.value] : []));
      return mergeByPriority(lists).map(({ endpoint, view }) => viewPerspective(id, concept, itemId, endpoint, view));
    },
    dataSource: (settings) => ({
      id,
      run: async (query, variables, signal) => {
        const bases = endpoints(settings);
        const resolved = resolveQuery(query, variables, bases);
        const answer = await runQuery(bases, legacy, label, resolved.query, resolved.variables, signal);
        // A view saved before Open Views binds its widget to the tab's `root`.
        return query === LEGACY_TAB_QUERY && answer && typeof answer === 'object' ? { ...answer, root: (answer as ViewResponse).view } : answer;
      },
    }),
  };
}

/** Answers one query of an Open Views data source (`OPEN_VIEWS_QUERIES`), on one of `bases`. */
async function runQuery(
  bases: string[],
  legacy: boolean,
  label: string,
  query: string,
  variables: Record<string, unknown>,
  signal?: AbortSignal,
): ReturnType<DataSource['run']> {
  if (bases.length === 0) throw new Error(`Set the endpoint of ${label} in Settings → Plugins.`);
  if (!isOpenViewsQuery(query)) throw new Error(`Open Views answers views, view, items and action queries, not "${query}".`);
  const provider = await discoverProvider(queryVariables(query, variables, bases).endpoint, legacy);
  switch (query) {
    case 'views':
      return fetchObjectViews(provider, queryVariables(query, variables, bases).id, signal);
    case 'view': {
      const { id, view } = queryVariables(query, variables, bases);
      return fetchView(provider, id, view, signal);
    }
    case 'items': {
      const { id, view, ...page } = queryVariables(query, variables, bases);
      return fetchItems(provider, id, view, page, signal);
    }
    case 'action': {
      const { id, view, action } = queryVariables(query, variables, bases);
      return runAction(provider, id, view, action, signal);
    }
  }
}

/** The generic Open Views builder: any number of endpoints, one per line. */
export const openViewsBuilder: ViewBuilder = createOpenViewsBuilder({
  id: 'open-views',
  label: 'Open Views',
  endpoints: (settings) => parseEndpoints(settings[ENDPOINTS_SETTING]),
});
