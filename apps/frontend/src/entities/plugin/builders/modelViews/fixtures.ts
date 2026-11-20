import type { ConceptQueries } from '../../../../graphql/introspection';

const byKey = (field: string): ConceptQueries => ({ byId: { field, idArg: 'key', idType: 'String!' } });

/** The root queries fluid reads from a Model source (`crates/model-graphql/schema.graphql`). */
export const MODEL_QUERIES = new Map<string, ConceptQueries>([
  ['Entity', { ...byKey('entityByKey'), list: { field: 'entities', itemsPath: 'nodes', limitArg: 'first' } }],
  ['Namespace', { ...byKey('namespaceByKey'), list: { field: 'namespaces', itemsPath: 'nodes', limitArg: 'first' } }],
  ['File', byKey('fileByKey')],
  ['Class', byKey('classByKey')],
  ['Interface', byKey('interfaceByKey')],
  ['Method', byKey('methodByKey')],
  ['Function', byKey('functionByKey')],
  ['Relation', { list: { field: 'relations', itemsPath: 'nodes', limitArg: 'first' } }],
]);
