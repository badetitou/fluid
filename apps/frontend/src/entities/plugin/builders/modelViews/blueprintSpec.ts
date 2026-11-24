import type { ViewSpec } from '@fluid/shared';
import { ENTITY_REF, PAGE, entityLink, operationName } from './selections';

// The detail perspective of a Model type: the class blueprint, as Moose draws it.
// Model has no access relation: references to fields stand in for attribute accesses.
// It has no lines of code either, so the widget gives every method the same height.

const member = `${ENTITY_REF}
  calls: outgoing(kind: "calls", first: ${PAGE}) { nodes { to { key } } }
  callers: incoming(kind: "calls", first: ${PAGE}) { nodes { from { key } } }
  accesses: outgoing(kind: "references", first: ${PAGE}) { nodes { to { key } } }`;

/** The inner structure of one type: its methods and fields, their calls and references. */
export function blueprintSpec(concept: string, lookup: string): ViewSpec {
  return {
    version: 1,
    id: `model-views:blueprint:${concept}`,
    concept,
    scope: 'detail',
    title: 'Blueprint',
    description:
      'The methods by layer, their calls and the fields they reference, as in a Moose class blueprint. Box heights are uniform: Model does not serve lines of code.',
    queries: {
      entity: {
        query: /* GraphQL */ `
          query ${operationName(concept, 'Blueprint')}($id: String!) {
            ${lookup}(key: $id) {
              ${ENTITY_REF}
              methods(first: ${PAGE}) { ${member} }
              attributes: children(kind: FIELD, first: ${PAGE}) { nodes { ${ENTITY_REF} } }
            }
          }
        `,
      },
    },
    widgets: [
      {
        id: 'blueprint',
        type: 'blueprint',
        title: `${concept} blueprint`,
        span: 24,
        height: 560,
        data: { query: 'entity', path: lookup },
        methodsField: 'methods',
        attributesField: 'attributes.nodes',
        idField: 'key',
        labelField: 'name',
        callsField: 'calls.nodes.to.key',
        callersField: 'callers.nodes.from.key',
        accessesField: 'accesses.nodes.to.key',
        linkTo: entityLink(),
        attributeLinkTo: entityLink(),
      },
    ],
  };
}
