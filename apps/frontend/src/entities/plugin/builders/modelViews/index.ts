import type { Perspective, ViewBuilder, ViewBuilderContext } from '../../viewBuilder';
import { callableSpec } from './callableSpec';
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
  if (MODEL_TYPES.has(concept)) return [perspective(typeSpec(concept, lookup), 'detail'), perspective(containerSpec(concept, lookup))];
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
  return columnKind === 'list' && TREE_CONCEPTS.has(concept.name) ? [perspective(codeTreeSpec(concept.name), 'list')] : [];
}

/**
 * Curated perspectives for sources serving badetitou/Model's code model
 * (detected from the schema, whatever the URL): the code tree, the members
 * and inheritance of a type, the callers and callees of a method.
 */
export const modelViewsBuilder: ViewBuilder = {
  id: MODEL_VIEWS_ID,
  label: 'Model views',
  perspectives: modelPerspectives,
};
