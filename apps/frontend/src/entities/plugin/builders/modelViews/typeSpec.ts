import type { ViewSpec, Widget } from '@fluid/shared';
import { ENTITY_REF, PAGE, entityLink, operationName, relationSelection } from './selections';

// The detail perspective of a Model type (class, interface, trait, enum,
// struct): what it is, its methods and fields, and its place in the hierarchy.

const members = (alias: string, kind: string, extra = '') =>
  `${alias}: children(kind: ${kind}, first: ${PAGE}) { totalCount nodes { ${ENTITY_REF} range { startLine endLine } ${extra} } }`;

/** How many relations a method has to others, for the methods table. */
const CALL_COUNTS = 'callers: incoming(kind: "calls") { totalCount } callees: outgoing(kind: "calls") { totalCount }';

const count = (id: string, title: string, path: string): Widget => ({
  id,
  type: 'statistic',
  title,
  span: 6,
  data: { query: 'type', path },
  value: { op: 'first', field: 'totalCount' },
  format: 'number',
});

const relatedTable = (id: string, title: string, path: string, end: 'from' | 'to'): Widget => ({
  id,
  type: 'table',
  title,
  span: 8,
  data: { query: 'type', path },
  columns: [
    { key: `${end}.name`, title: 'Type', linkTo: entityLink(end) },
    { key: `${end}.parent.name`, title: 'In' },
  ],
  pageSize: 10,
});

/** A type's identity, members and inheritance. */
export function typeSpec(concept: string, lookup: string): ViewSpec {
  const at = (path: string) => `${lookup}.${path}`;
  return {
    version: 1,
    id: `model-views:type:${concept}`,
    concept,
    scope: 'detail',
    title: `${concept} overview`,
    description: 'Its methods and fields, the types it extends or implements, and the types extending it.',
    queries: {
      type: {
        query: /* GraphQL */ `
          query ${operationName(concept, 'Overview')}($id: String!) {
            ${lookup}(key: $id) {
              ${ENTITY_REF} language file external range { startLine endLine } parent { ${ENTITY_REF} }
              ${members('methods', 'METHOD', CALL_COUNTS)}
              ${members('fields', 'FIELD')}
              ${relationSelection('supertypes', 'outgoing', 'inherits')}
              ${relationSelection('interfaces', 'outgoing', 'implements')}
              ${relationSelection('subtypes', 'incoming', 'inherits')}
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
        data: { query: 'type', path: lookup },
        columns: 1,
        items: [
          { label: 'Name', key: 'name' },
          { label: 'In', key: 'parent.name', linkTo: entityLink('parent') },
          { label: 'File', key: 'file' },
          { label: 'Language', key: 'language', format: 'tag' },
          { label: 'From line', key: 'range.startLine', format: 'number' },
          { label: 'To line', key: 'range.endLine', format: 'number' },
          { label: 'External', key: 'external', format: 'boolean' },
        ],
      },
      count('method-count', 'Methods', at('methods')),
      count('field-count', 'Fields', at('fields')),
      count('supertype-count', 'Supertypes', at('supertypes')),
      count('subtype-count', 'Subtypes', at('subtypes')),
      {
        id: 'methods',
        type: 'table',
        title: 'Methods',
        span: 16,
        data: { query: 'type', path: at('methods.nodes') },
        columns: [
          { key: 'name', title: 'Method', linkTo: entityLink() },
          { key: 'range.startLine', title: 'From line', format: 'number' },
          { key: 'range.endLine', title: 'To line', format: 'number' },
          { key: 'callers.totalCount', title: 'Callers', format: 'number' },
          { key: 'callees.totalCount', title: 'Callees', format: 'number' },
        ],
        pageSize: 10,
        sortable: true,
        filterable: true,
      },
      {
        id: 'fields',
        type: 'table',
        title: 'Fields',
        span: 8,
        data: { query: 'type', path: at('fields.nodes') },
        columns: [{ key: 'name', title: 'Field', linkTo: entityLink() }],
        pageSize: 10,
      },
      {
        id: 'hierarchy',
        type: 'butterfly',
        title: 'Inheritance',
        span: 24,
        height: 320,
        data: { query: 'type', path: lookup },
        incomingField: 'subtypes.nodes.from',
        outgoingField: 'supertypes.nodes.to',
        idField: 'key',
        groupField: 'parent.name',
        linkTo: entityLink(),
      },
      relatedTable('supertypes', 'Extends', at('supertypes.nodes'), 'to'),
      relatedTable('interfaces', 'Implements', at('interfaces.nodes'), 'to'),
      relatedTable('subtypes', 'Extended by', at('subtypes.nodes'), 'from'),
    ],
  };
}
