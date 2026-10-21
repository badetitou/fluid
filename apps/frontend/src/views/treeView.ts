import type { LinkTo, TreeWidget, ViewSpec } from '@fluid/shared';
import { keyFieldOf, type Concept } from '../graphql/introspection';
import type { RelatedConcepts } from './detailView';
import { humanize, pickLabelField } from './fieldHeuristics';
import { findHierarchy, type Hierarchy } from './hierarchy';

// Auto tree widgets and views for concepts whose data forms a hierarchy (see
// hierarchy.ts). GraphQL has no recursive selection, so recursive children are
// selected a fixed number of levels deep.

/** Levels of recursive children selected by the auto views. */
export const TREE_DEPTH = 4;

/** Scalars selected for one node of a concept: its key (when it has one) and its label. */
function nodeFields(concept: Concept, related?: RelatedConcepts): { key?: string; label: string; selection: string } {
  const key = keyFieldOf(related?.queriesByType.get(concept.name) ?? concept.queries);
  const hasKey = concept.scalarFields.some((f) => f.name === key);
  const label = pickLabelField(concept.scalarFields).name;
  const names = new Set([...(hasKey ? [key] : []), label]);
  return { key: hasKey ? key : undefined, label, selection: [...names].join(' ') };
}

/** Link opening a node of `concept` in its own column, when it has a key and a by-id query. */
function nodeLink(concept: Concept, related?: RelatedConcepts): LinkTo | null {
  const queries = related?.queriesByType.get(concept.name) ?? concept.queries;
  const { key } = nodeFields(concept, related);
  return queries.byId && key !== undefined ? { concept: concept.name, idField: key } : null;
}

/** `fields child { fields child { … } }`, `depth` levels of children deep. */
export function recursiveSelection(fields: string, childField: string, depth = TREE_DEPTH): string {
  return depth <= 0 ? fields : `${fields} ${childField} { ${recursiveSelection(fields, childField, depth - 1)} }`;
}

/** Nested selection of a container chain: `a { fields b { fields } }`. */
function chainSelection(h: Extract<Hierarchy, { kind: 'levels' }>, related?: RelatedConcepts): string {
  return h.fields.reduceRight(
    (inner, field, i) => `${field.name} { ${nodeFields(h.concepts[i], related).selection}${inner ? ` ${inner}` : ''} }`,
    '',
  );
}

export interface TreePart {
  /** GraphQL selection to add under the concept's own fields. */
  selection: string;
  /** Tree widget settings, without its id / title / data binding. */
  widget: Pick<TreeWidget, 'childrenField' | 'parentField' | 'keyField' | 'labelField' | 'linkTo'>;
  title: string;
}

/** How a concept's hierarchy is selected and shown, from the concept's own level. */
export function treePart(concept: Concept, hierarchy: Hierarchy, related?: RelatedConcepts): TreePart {
  const own = nodeFields(concept, related);
  const linkTo = nodeLink(concept, related) ?? undefined;
  switch (hierarchy.kind) {
    case 'children':
      return {
        selection: `${hierarchy.field.name} { ${recursiveSelection(own.selection, hierarchy.field.name, TREE_DEPTH - 1)} }`,
        widget: { childrenField: hierarchy.field.name, keyField: own.key, labelField: own.label, linkTo },
        title: `${humanize(concept.name)} tree`,
      };
    case 'parent':
      return {
        selection: `${hierarchy.field.name} { ${own.key ?? own.label} }`,
        widget: { parentField: `${hierarchy.field.name}.${own.key ?? own.label}`, keyField: own.key, labelField: own.label, linkTo },
        title: `${humanize(concept.name)} tree`,
      };
    case 'levels':
      return {
        selection: chainSelection(hierarchy, related),
        widget: {
          childrenField: hierarchy.fields.map((f) => f.name),
          keyField: own.key,
          // One link per level: each level is a different concept.
          linkTo: [concept, ...hierarchy.concepts].map((c) => nodeLink(c, related)),
        },
        title: [concept.name, ...hierarchy.fields.map((f) => humanize(f.name))].join(' › '),
      };
  }
}

/** A list perspective showing every item of a concept as a tree, or null when its data is flat. */
export function buildTreeView(concept: Concept, related?: RelatedConcepts): ViewSpec | null {
  const list = concept.queries.list;
  if (!list || concept.scalarFields.length === 0) return null;
  const hierarchy = findHierarchy(concept, related?.conceptByName);
  if (!hierarchy) return null;

  const part = treePart(concept, hierarchy, related);
  const fields = `${nodeFields(concept, related).selection} ${part.selection}`;
  const varDecl = list.limitArg ? '($take: Int)' : '';
  const callArgs = list.limitArg ? `(${list.limitArg}: $take)` : '';
  const body = list.itemsPath ? `${list.itemsPath} { ${fields} }` : fields;
  return {
    version: 1,
    id: `auto-tree:${concept.name}`,
    concept: concept.name,
    scope: 'list',
    title: `${concept.name} tree`,
    description: `Auto-generated tree of ${concept.name}.`,
    queries: {
      rows: {
        query: `query FluidAutoTree_${concept.name}${varDecl} { ${list.field}${callArgs} { ${body} } }`,
        variables: list.limitArg ? { take: 200 } : {},
      },
    },
    widgets: [
      {
        id: 'tree',
        type: 'tree',
        title: part.title,
        span: 24,
        data: { query: 'rows', path: list.itemsPath ? `${list.field}.${list.itemsPath}` : list.field },
        ...part.widget,
      },
    ],
  };
}

/**
 * The tree widget of a detail view: the item's descendants (recursive children)
 * or its contents (container chain), with the GraphQL selection it needs; null
 * when the item has neither. `field` is the relation the tree replaces.
 */
export function buildDetailTree(
  concept: Concept,
  byIdField: string,
  related?: RelatedConcepts,
): { selection: string; field: string; widget: TreeWidget } | null {
  const hierarchy = findHierarchy(concept, related?.conceptByName);
  if (!hierarchy || hierarchy.kind === 'parent') return null;
  const part = treePart(concept, hierarchy, related);
  const [first, ...below] = hierarchy.kind === 'levels' ? hierarchy.fields.map((f) => f.name) : [hierarchy.field.name];
  const levels = hierarchy.kind === 'levels';
  return {
    selection: part.selection,
    field: first,
    widget: {
      id: 'tree',
      type: 'tree',
      title: [first, ...below].map(humanize).join(' › '),
      span: 24,
      data: { query: byIdField, path: `${byIdField}.${first}` },
      ...part.widget,
      // The tree starts one level down: drop the item's own level.
      ...(levels ? { childrenField: below, keyField: undefined, linkTo: (part.widget.linkTo as (LinkTo | null)[]).slice(1) } : {}),
    },
  };
}
