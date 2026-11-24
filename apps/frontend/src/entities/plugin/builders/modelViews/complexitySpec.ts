import type { ViewSpec } from '@fluid/shared';
import { ENTITY_REF, PAGE, entityLink, operationName } from './selections';

// The list perspective of Model classes: the polymetric view Moose calls
// "System complexity". Counts come from connections read with first: 0, which
// keeps the answer small whatever the size of the model. The widget's toolbar
// lets the reader remap these counters to width, height, color and layout.

/** Classes as boxes: fields and methods give the size, callers the color, inheritance the hierarchy. */
export function complexitySpec(concept: string): ViewSpec {
  return {
    version: 1,
    id: `model-views:complexity:${concept}`,
    concept,
    scope: 'list',
    title: 'System complexity',
    description:
      'Every class as a box: width is its fields, height its methods, color its callers, and inheritance draws the hierarchy. The toolbar remaps the metrics.',
    queries: {
      classes: {
        query: /* GraphQL */ `
          query ${operationName(concept, 'Complexity')} {
            classes(first: ${PAGE}) {
              totalCount
              nodes {
                ${ENTITY_REF}
                parent { name }
                methods: children(kind: METHOD, first: 0) { totalCount }
                fields: children(kind: FIELD, first: 0) { totalCount }
                callers: incoming(kind: "calls", first: 0) { totalCount }
                callees: outgoing(kind: "calls", first: 0) { totalCount }
                references: outgoing(kind: "references", first: 0) { totalCount }
                subclasses: incoming(kind: "inherits", first: 0) { totalCount }
                supertypes: outgoing(kind: "inherits", first: 1) { nodes { to { key } } }
              }
            }
          }
        `,
      },
    },
    widgets: [
      {
        id: 'complexity',
        type: 'boxes',
        title: 'System complexity',
        span: 24,
        height: 560,
        data: { query: 'classes', path: 'classes.nodes' },
        idField: 'key',
        labelField: 'name',
        widthField: 'fields.totalCount',
        heightField: 'methods.totalCount',
        sizeField: 'methods.totalCount',
        colorField: 'callers.totalCount',
        groupField: 'parent.name',
        parentField: 'supertypes.nodes.to.key',
        boxLayout: 'tree',
        linkTo: entityLink(),
      },
    ],
  };
}
