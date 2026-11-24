import type { ViewSpec, Widget } from '@fluid/shared';
import { ENTITY_REF, entityLink, operationName } from './selections';

// Dependency structure matrices, as Moose draws them: classes against calls and
// references, namespaces against the calls between the classes they contain.
// Both axes are bounded to the widget's limit; edges are bounded to keep the
// answer small on large models.

const ROWS = 300;
const EDGES = 100;

const target = `${ENTITY_REF} parent { name }`;

const matrix = (id: string, title: string, path: string, targetsField: string, groupField?: string): Widget => ({
  id,
  type: 'matrix',
  title,
  span: 24,
  height: 560,
  data: { query: 'model', path },
  targetsField,
  targetIdField: 'key',
  targetLabelField: 'name',
  ...(groupField ? { groupField } : {}),
  columns: 'same',
  sort: groupField ? 'group' : 'name',
  linkTo: entityLink(),
});

/** A square DSM of the classes: calls between them, then references between them. */
export function classDependencySpec(concept: string): ViewSpec {
  return {
    version: 1,
    id: `model-views:dependency:${concept}`,
    concept,
    scope: 'list',
    title: 'Dependency matrix',
    description: 'Which classes call or reference which other classes; cycles appear in the cells.',
    queries: {
      model: {
        query: /* GraphQL */ `
          query ${operationName(concept, 'Dependency')} {
            classes(first: ${ROWS}) {
              totalCount
              nodes {
                ${ENTITY_REF}
                parent { name }
                calls: outgoing(kind: "calls", first: ${EDGES}) { nodes { to { ${target} } } }
                references: outgoing(kind: "references", first: ${EDGES}) { nodes { to { ${target} } } }
              }
            }
          }
        `,
      },
    },
    widgets: [
      matrix('calls', 'Calls', 'classes.nodes', 'calls.nodes.to', 'parent.name'),
      matrix('references', 'References', 'classes.nodes', 'references.nodes.to', 'parent.name'),
    ],
  };
}

/** A square DSM of the namespaces, from the calls between the classes they contain. */
export function namespaceDependencySpec(concept: string): ViewSpec {
  return {
    version: 1,
    id: `model-views:dependency:${concept}`,
    concept,
    scope: 'list',
    title: 'Package dependencies',
    description: 'Which packages depend on which, from the calls between their classes.',
    queries: {
      model: {
        query: /* GraphQL */ `
          query ${operationName(concept, 'PackageDependency')} {
            namespaces(first: ${ROWS}) {
              totalCount
              nodes {
                ${ENTITY_REF}
                classes: children(kind: CLASS, first: ${EDGES}) {
                  nodes {
                    calls: outgoing(kind: "calls", first: ${EDGES}) {
                      nodes { to { parent { ${ENTITY_REF} } } }
                    }
                  }
                }
              }
            }
          }
        `,
      },
    },
    widgets: [
      matrix('calls', 'Calls between packages', 'namespaces.nodes', 'classes.nodes.calls.nodes.to.parent'),
    ],
  };
}
