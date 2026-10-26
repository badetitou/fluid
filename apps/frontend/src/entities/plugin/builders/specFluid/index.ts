import type { ViewBuilder } from '../../viewBuilder';
import { fetchTab, fetchTabs } from './api';
import { ENDPOINT_SETTING, SPEC_FLUID_SOURCE, TAB_QUERY, tabPerspective, tabVariables } from './model';

export { ENDPOINT_SETTING } from './model';
export { pharoScriptAction } from './script/ScriptCommand';

/**
 * The inspector tabs Pharo defines for an entity (Spec2 presenters, served
 * as JSON by the Spec-Fluid project of the image) as perspectives of its
 * detail column. Silent until an endpoint is set, and when it is unreachable.
 * Its Smalltalk scripts are a page action (`pharoScriptAction`).
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
