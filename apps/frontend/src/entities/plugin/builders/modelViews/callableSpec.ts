import type { ViewSpec, Widget } from '@fluid/shared';
import { ENTITY_REF, entityLink, operationName, relationSelection } from './selections';

// The detail perspective of a Model callable (method, constructor, function):
// who calls it and what it calls, each call weighted by its number of sites.

const count = (id: string, title: string, path: string): Widget => ({
  id,
  type: 'statistic',
  title,
  span: 12,
  data: { query: 'callable', path },
  value: { op: 'first', field: 'totalCount' },
  format: 'number',
});

const callTable = (id: string, title: string, path: string, end: 'from' | 'to'): Widget => ({
  id,
  type: 'table',
  title,
  span: 12,
  data: { query: 'callable', path, transform: { sort: { by: 'siteCount', dir: 'desc' } } },
  columns: [
    { key: `${end}.name`, title: end === 'from' ? 'Caller' : 'Callee', linkTo: entityLink(end) },
    { key: `${end}.parent.name`, title: 'In' },
    { key: `${end}.kind`, title: 'Kind', format: 'tag' },
    { key: 'siteCount', title: 'Call sites', format: 'number' },
  ],
  pageSize: 10,
  sortable: true,
});

/** A callable's callers and callees, as a butterfly map and as tables with their site counts. */
export function callableSpec(concept: string, lookup: string): ViewSpec {
  const at = (path: string) => `${lookup}.${path}`;
  return {
    version: 1,
    id: `model-views:calls:${concept}`,
    concept,
    scope: 'detail',
    title: 'Callers and callees',
    description: 'Who calls it and what it calls, with the number of call sites of each.',
    queries: {
      callable: {
        query: /* GraphQL */ `
          query ${operationName(concept, 'Calls')}($id: String!) {
            ${lookup}(key: $id) {
              ${ENTITY_REF} language file range { startLine endLine } parent { ${ENTITY_REF} }
              ${relationSelection('callers', 'incoming', 'calls')}
              ${relationSelection('callees', 'outgoing', 'calls')}
            }
          }
        `,
      },
    },
    widgets: [
      {
        id: 'about',
        type: 'descriptions',
        title: concept,
        span: 24,
        data: { query: 'callable', path: lookup },
        columns: 1,
        items: [
          { label: 'Name', key: 'name' },
          { label: 'In', key: 'parent.name', linkTo: entityLink('parent') },
          { label: 'File', key: 'file' },
          { label: 'From line', key: 'range.startLine', format: 'number' },
          { label: 'To line', key: 'range.endLine', format: 'number' },
        ],
      },
      count('caller-count', 'Callers', at('callers')),
      count('callee-count', 'Callees', at('callees')),
      {
        id: 'calls',
        type: 'butterfly',
        title: 'Callers and callees',
        span: 24,
        height: 420,
        data: { query: 'callable', path: lookup },
        incomingField: 'callers.nodes.from',
        outgoingField: 'callees.nodes.to',
        idField: 'key',
        groupField: 'parent.name',
        linkTo: entityLink(),
      },
      callTable('callers', 'Callers', at('callers.nodes'), 'from'),
      callTable('callees', 'Callees', at('callees.nodes'), 'to'),
    ],
  };
}
