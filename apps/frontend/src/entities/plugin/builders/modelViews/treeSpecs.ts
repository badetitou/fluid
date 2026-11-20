import type { ViewSpec, Widget } from '@fluid/shared';
import { ENTITY_REF, PAGE, childrenSelection, entityLink, operationName } from './selections';

// The containment perspectives of a Model source: the whole code tree
// (namespaces › files › types › members) and the tree under one entity.

const stat = (id: string, title: string, query: string, path: string, span = 6): Widget => ({
  id,
  type: 'statistic',
  title,
  span,
  data: { query, path },
  value: { op: 'first', field: 'totalCount' },
  format: 'number',
});

const tree = (id: string, title: string, query: string, path: string, childrenField: string): Widget => ({
  id,
  type: 'tree',
  title,
  span: 24,
  data: { query, path },
  keyField: 'key',
  childrenField,
  linkTo: entityLink(),
  expandDepth: 1,
});

/** The whole model as a tree, from its root entities, with its size. */
export function codeTreeSpec(concept: string): ViewSpec {
  return {
    version: 1,
    id: `model-views:code-tree:${concept}`,
    concept,
    scope: 'list',
    title: 'Code tree',
    description: 'Namespaces, their files, types and members, from the roots of the analysed code.',
    queries: {
      model: {
        query: /* GraphQL */ `
          query ${operationName(concept, 'CodeTree')} {
            stats { entities relations sites }
            roots: entities(roots: true, external: false, first: ${PAGE}) { totalCount nodes { ${ENTITY_REF} ${childrenSelection(4)} } }
            classes: classes(first: 1) { totalCount }
            methods: methods(first: 1) { totalCount }
          }
        `,
      },
    },
    widgets: [
      stat('classes', 'Classes', 'model', 'classes'),
      stat('methods', 'Methods', 'model', 'methods'),
      { id: 'entities', type: 'statistic', title: 'Entities', span: 6, data: { query: 'model', path: 'stats' }, value: { op: 'first', field: 'entities' } },
      { id: 'relations', type: 'statistic', title: 'Relations', span: 6, data: { query: 'model', path: 'stats' }, value: { op: 'first', field: 'relations' } },
      tree('tree', 'Code tree', 'model', 'roots.nodes', 'children.nodes'),
    ],
  };
}

/** The entities under one entity (a namespace, a file…), three levels deep. */
export function containerSpec(concept: string, lookup: string): ViewSpec {
  return {
    version: 1,
    id: `model-views:contents:${concept}`,
    concept,
    scope: 'detail',
    title: 'Contents',
    description: `What this ${concept.toLowerCase()} contains: its files, types and their members.`,
    queries: {
      entity: {
        query: /* GraphQL */ `
          query ${operationName(concept, 'Contents')}($id: String!) {
            ${lookup}(key: $id) { ${ENTITY_REF} language file external parent { ${ENTITY_REF} } ${childrenSelection(3)} }
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
        data: { query: 'entity', path: lookup },
        columns: 2,
        items: [
          { label: 'Name', key: 'name' },
          { label: 'Language', key: 'language', format: 'tag' },
          { label: 'File', key: 'file' },
          { label: 'In', key: 'parent.name', linkTo: entityLink('parent') },
        ],
      },
      stat('children', 'Direct children', 'entity', `${lookup}.children`, 24),
      tree('tree', 'Contents', 'entity', `${lookup}.children.nodes`, 'children.nodes'),
    ],
  };
}
