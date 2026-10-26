import type { SpecFluidTab, ViewSpec } from '@fluid/shared';
import type { Concept } from '../../../../graphql/introspection';
import type { Perspective } from '../../viewBuilder';

/** Id of the Spec-Fluid data source, named by the `source` of its views' queries. */
export const SPEC_FLUID_SOURCE = 'spec-fluid';

/** The one request the data source answers: one inspector tab of one entity. */
export const TAB_QUERY = 'tab';

/** `<endpoint>/<segment>/…`, each segment URL-encoded (ids hold `:`, tab keys end with `:`). */
export function specFluidUrl(endpoint: string, ...segments: string[]): string {
  return [endpoint.replace(/\/+$/, ''), ...segments.map(encodeURIComponent)].join('/');
}

/** The variables of a tab query, read back from a view's query (they come from the BFF or the LLM: checked). */
export function tabVariables(variables: Record<string, unknown>): { id: string; tab: string } {
  const { id, tab } = variables;
  if (typeof id !== 'string' || typeof tab !== 'string' || !id || !tab) {
    throw new Error('A Spec-Fluid query needs the "id" of an entity and the "tab" to show.');
  }
  return { id, tab };
}

/** The perspective showing one Pharo inspector tab of an item. */
export function tabPerspective(concept: Concept, itemId: string, tab: SpecFluidTab): Perspective {
  const spec: ViewSpec = {
    version: 1,
    id: `spec-fluid-${concept.name}-${tab.key}`.replace(/[^A-Za-z0-9-]/g, '-'),
    concept: concept.name,
    scope: 'detail',
    title: tab.title,
    queries: { tab: { source: SPEC_FLUID_SOURCE, query: TAB_QUERY, variables: { id: itemId, tab: tab.key } } },
    widgets: [{ id: 'tab', type: 'specPresenter', span: 24, data: { query: 'tab', path: 'root' } }],
  };
  return { key: `${SPEC_FLUID_SOURCE}:${tab.key}`, title: tab.title, origin: 'remote', spec };
}
