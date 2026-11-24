import type { Perspective, ViewBuilder, ViewBuilderContext } from '../../viewBuilder';
import { architectureFlowSpec } from './architectureFlowSpec';
import { blueprintSpec } from './blueprintSpec';
import { callableSpec } from './callableSpec';
import { complexitySpec } from './complexitySpec';
import { classDependencySpec, namespaceDependencySpec } from './dependencySpec';
import { MODEL_CALLABLES, MODEL_CONTAINERS, MODEL_TYPES, looksLikeModel, modelLookup } from './detect';
import { codeTreeSpec, containerSpec } from './treeSpecs';
import { typeSpec } from './typeSpec';

export { looksLikeModel } from './detect';

/** The id of the Model views builder. */
export const MODEL_VIEWS_ID = 'model-views';

/** Concepts whose list column offers the whole code tree. */
const TREE_CONCEPTS: ReadonlySet<string> = new Set([...MODEL_CONTAINERS, 'Entity']);

const perspective = (spec: Perspective['spec'], defaultFor?: Perspective['defaultFor']): Perspective => ({
  key: spec.id,
  title: spec.title,
  origin: 'curated',
  spec,
  ...(defaultFor ? { defaultFor } : {}),
});

/** The detail perspective of one Model entity, by the kind of its concept. */
function detailPerspectives(concept: string, lookup: string): Perspective[] {
  if (MODEL_CALLABLES.has(concept)) return [perspective(callableSpec(concept, lookup), 'detail')];
  if (MODEL_TYPES.has(concept))
    return [
      perspective(typeSpec(concept, lookup), 'detail'),
      perspective(blueprintSpec(concept, lookup)),
      perspective(containerSpec(concept, lookup)),
    ];
  if (MODEL_CONTAINERS.has(concept)) return [perspective(containerSpec(concept, lookup), 'detail')];
  return [];
}

/** The Model perspectives of a column; none unless the source looks like Model's. */
export function modelPerspectives({ concept, columnKind, itemId, queriesByType }: ViewBuilderContext): Perspective[] {
  if (!looksLikeModel(queriesByType)) return [];
  if (columnKind === 'detail' && itemId) {
    const lookup = modelLookup(concept, queriesByType);
    return lookup ? detailPerspectives(concept.name, lookup) : [];
  }
  if (columnKind !== 'list') return [];
  const perspectives = TREE_CONCEPTS.has(concept.name) ? [perspective(codeTreeSpec(concept.name), 'list')] : [];
  if (concept.name === 'Class')
    perspectives.push(perspective(complexitySpec(concept.name)), perspective(classDependencySpec(concept.name)));
  if (concept.name === 'Namespace')
    perspectives.push(perspective(namespaceDependencySpec(concept.name)), perspective(architectureFlowSpec(concept.name)));
  return perspectives;
}

/**
 * Curated perspectives for sources serving badetitou/Model's code model
 * (detected from the schema, whatever the URL): the code tree, polymetric
 * maps, dependency matrices and layered flows of classes and packages, the
 * members, inheritance and blueprint of a type, and the callers and callees
 * of a method.
 */
export const modelViewsBuilder: ViewBuilder = {
  id: MODEL_VIEWS_ID,
  label: 'Model views',
  perspectives: modelPerspectives,
};
