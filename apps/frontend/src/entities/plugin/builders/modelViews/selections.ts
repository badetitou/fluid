import type { LinkTo } from '@fluid/shared';
import { MODEL_ENTITY } from './detect';

// GraphQL selections and links shared by the Model perspectives.

/** What a link to an entity needs: its concrete type (the column it opens), its key and name. */
export const ENTITY_REF = '__typename key name kind';

/** Opens any entity, in the column of its concrete type (`__typename`), by its key. */
export const entityLink = (holder?: string): LinkTo => ({
  concept: MODEL_ENTITY,
  idField: holder ? `${holder}.key` : 'key',
});

/** Most rows a connection is asked for, so a large model never answers with everything. */
export const PAGE = 500;

/**
 * `children` nested `levels` deep (a node, its children, theirs…), each node
 * selected with `ENTITY_REF` and the size of its range.
 */
export function childrenSelection(levels: number): string {
  if (levels <= 0) return '';
  return `children(first: ${PAGE}) { totalCount nodes { ${ENTITY_REF} ${childrenSelection(levels - 1)} } }`;
}

/** The relations of one kind on one side, with their weight and the entity at the other end. */
export function relationSelection(alias: string, side: 'incoming' | 'outgoing', kind: string): string {
  const end = side === 'incoming' ? 'from' : 'to';
  return `${alias}: ${side}(kind: "${kind}", first: ${PAGE}) { totalCount nodes { siteCount ${end} { ${ENTITY_REF} parent { key name } } } }`;
}

/** A GraphQL operation name from a concept name (`Class` → `FluidModelClass…`). */
export const operationName = (concept: string, suffix: string): string =>
  `FluidModel${concept.replace(/[^A-Za-z0-9_]/g, '')}${suffix}`;
