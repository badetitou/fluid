import type { ViewResponse } from '@fluid/shared';
import type { DataSource } from '../../../../views/plugin-api';
import type { ViewBuilder } from '../../viewBuilder';
import { discoverProvider, fetchItems, fetchObjectViews, fetchView, runAction, type ViewProvider } from './api';
import {
  ENDPOINTS_SETTING,
  LEGACY_TAB_QUERY,
  configuredEndpoint,
  isOpenViewsQuery,
  mergeByPriority,
  parseEndpoints,
  queryVariables,
  resolveQuery,
  viewPerspective,
} from './model';

export { ENDPOINTS_SETTING } from './model';
export { forgetProviders } from './api';

/** The id of the Open Views builder and of its data source. */
export const OPEN_VIEWS_SOURCE = 'open-views';

/** Data source ids of views saved before Open Views, answered by the Open Views data source. */
export const LEGACY_SOURCES = ['spec-fluid'];

/**
 * The provider a query goes to: the configured endpoint it names, else the
 * first configured one that serves the object.
 */
async function providerFor(named: string | undefined, id: string, bases: string[], signal?: AbortSignal): Promise<ViewProvider> {
  const endpoint = configuredEndpoint(named, bases);
  if (endpoint) return discoverProvider(endpoint);
  for (const base of bases) {
    try {
      const provider = await discoverProvider(base);
      await fetchObjectViews(provider, id, signal);
      return provider;
    } catch {
      // Not served there: try the next endpoint.
    }
  }
  throw new Error(`No Open Views endpoint serves the object ${id}.`);
}

/** Answers one query (`OPEN_VIEWS_QUERIES`, or the old `tab` query) on one of `bases`. */
async function runQuery(bases: string[], query: string, variables: Record<string, unknown>, signal?: AbortSignal): ReturnType<DataSource['run']> {
  if (bases.length === 0) throw new Error('Set the Open Views endpoints in Settings → Plugins.');
  const resolved = resolveQuery(query, variables);
  if (!isOpenViewsQuery(resolved.query)) throw new Error(`Open Views answers views, view, items and action queries, not "${query}".`);
  const { endpoint, id } = queryVariables(resolved.query, resolved.variables);
  const provider = await providerFor(endpoint, id, bases, signal);
  switch (resolved.query) {
    case 'views':
      return fetchObjectViews(provider, id, signal);
    case 'view': {
      const view: ViewResponse = await fetchView(provider, id, queryVariables('view', resolved.variables).view, signal);
      // A view saved before Open Views binds its widget to the tab's `root`.
      return query === LEGACY_TAB_QUERY ? { ...view, root: view.view } : view;
    }
    case 'items': {
      const { view, path, offset, limit } = queryVariables('items', resolved.variables);
      return fetchItems(provider, id, view, { path, offset, limit }, signal);
    }
    case 'action': {
      const { view, action } = queryVariables('action', resolved.variables);
      return runAction(provider, id, view, action, signal);
    }
  }
}

/**
 * A view builder reading fluid Open Views endpoints (`docs/architecture/OPEN-VIEWS.md`),
 * one per line in its settings: every view an endpoint declares for the item
 * of a detail column becomes a perspective, all endpoints merged by priority.
 * Silent until an endpoint is set; an unreachable endpoint proposes nothing.
 * Its data source also answers the views saved for the old Spec-Fluid builder.
 */
export const openViewsBuilder: ViewBuilder = {
  id: OPEN_VIEWS_SOURCE,
  label: 'Open Views',
  fetchPerspectives: async ({ concept, itemId, columnKind, settings }, signal) => {
    const bases = parseEndpoints(settings[ENDPOINTS_SETTING]);
    if (bases.length === 0 || columnKind !== 'detail' || !itemId) return [];
    // Each endpoint on its own: a failing or silent one (requests time out) proposes nothing.
    const settled = await Promise.allSettled(
      bases.map(async (endpoint) => {
        const provider = await discoverProvider(endpoint);
        return { endpoint, views: (await fetchObjectViews(provider, itemId, signal)).views };
      }),
    );
    const lists = settled.flatMap((result) => (result.status === 'fulfilled' ? [result.value] : []));
    return mergeByPriority(lists).map(({ endpoint, view }) => viewPerspective(OPEN_VIEWS_SOURCE, concept, itemId, endpoint, view));
  },
  dataSource: (settings) => ({
    id: OPEN_VIEWS_SOURCE,
    aliases: LEGACY_SOURCES,
    run: (query, variables, signal) => runQuery(parseEndpoints(settings[ENDPOINTS_SETTING]), query, variables, signal),
  }),
};
