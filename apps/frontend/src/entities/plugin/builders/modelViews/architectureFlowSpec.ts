import type { ViewSpec } from '@fluid/shared';
import { ENTITY_REF, operationName } from './selections';

// A Structure-like layer view, drawn with the sankey widget. Classes are the
// elements, packages their groups; the call graph between classes becomes the
// flow between packages. Column pins use name patterns, so the layers survive
// on models whose packages have a prefix (e.g. "org.example.business.order").

const ROWS = 300;
const EDGES = 100;

/** Common layer names, in dependency order; unmatched packages flow after their sources. */
const LAYERS = [
  ['*ui*', '*api*', '*entry*', '*web*', '*controller*'],
  ['*business*', '*service*', '*application*', '*usecase*'],
  ['*persistence*', '*repository*', '*dao*', '*mapper*'],
  ['*model*', '*domain*', '*core*', '*entity*'],
  ['*util*', '*common*', '*shared*', '*infra*'],
];

/** Calls between the packages of a model, with layers pinned by package name. */
export function architectureFlowSpec(concept: string): ViewSpec {
  return {
    version: 1,
    id: `model-views:architecture:${concept}`,
    concept,
    scope: 'list',
    title: 'Architecture flows',
    description:
      'The call graph folded into flows between packages. Columns are pinned by layer names when packages follow the usual entry, business, persistence, model or util conventions; other packages flow after their sources.',
    queries: {
      model: {
        query: /* GraphQL */ `
          query ${operationName(concept, 'Architecture')} {
            classes(first: ${ROWS}) {
              totalCount
              nodes {
                ${ENTITY_REF}
                parent { name }
                calls: outgoing(kind: "calls", first: ${EDGES}) {
                  nodes { to { ${ENTITY_REF} parent { name } } }
                }
              }
            }
          }
        `,
      },
    },
    widgets: [
      {
        id: 'flows',
        type: 'sankey',
        title: 'From package to package',
        span: 24,
        height: 520,
        data: { query: 'model', path: 'classes.nodes' },
        groupField: 'parent.name',
        targetsField: 'calls.nodes.to',
        targetGroupField: 'parent.name',
        columns: LAYERS,
      },
    ],
  };
}
