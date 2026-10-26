import type { ViewBuilder } from '../../viewBuilder';
import { fetchTab, fetchTabs } from './api';
import { SPEC_FLUID_SOURCE, TAB_QUERY, tabPerspective, tabVariables } from './model';

/** The setting holding the Spec-Fluid endpoint, e.g. `http://localhost:8081/spec-fluid`. */
export const ENDPOINT_SETTING = 'endpoint';

/**
 * The inspector tabs Pharo defines for an entity (Spec2 presenters, served
 * as JSON by the Spec-Fluid project of the image) as perspectives of its
 * detail column. Silent until an endpoint is set, and when it is unreachable.
 */
export const specFluidViewBuilder: ViewBuilder = {
  id: SPEC_FLUID_SOURCE,
  label: 'Pharo inspector tabs',
  fetchPerspectives: async ({ concept, itemId, columnKind, settings }, signal) => {
    const endpoint = settings[ENDPOINT_SETTING];
    if (!endpoint || columnKind !== 'detail' || !itemId) return [];
    try {
      const { tabs } = await fetchTabs(endpoint, itemId, signal);
      return tabs.map((tab) => tabPerspective(concept, itemId, tab));
    } catch {
      return [];
    }
  },
  dataSource: (settings) => ({
    id: SPEC_FLUID_SOURCE,
    run: async (query, variables, signal) => {
      const endpoint = settings[ENDPOINT_SETTING];
      if (!endpoint) throw new Error('Set the Spec-Fluid endpoint in Settings → Plugins.');
      if (query !== TAB_QUERY) throw new Error(`Spec-Fluid answers "${TAB_QUERY}" queries, not "${query}".`);
      const { id, tab } = tabVariables(variables);
      return fetchTab(endpoint, id, tab, signal);
    },
  }),
};
