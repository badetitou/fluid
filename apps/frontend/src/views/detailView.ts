import type { ViewSpec, Widget } from '@fluid/shared';
import { keyFieldOf, type Concept, type ConceptField, type ConceptQueries } from '../graphql/introspection';
import { codeLanguageOf, guessFormat, humanize, pickLabelField, textKindOf } from './fieldHeuristics';
import { buildDetailTree } from './treeView';

/** What the detail view needs to know about the concepts a concept relates to. */
export interface RelatedConcepts {
  /** Introspected related types, by name. */
  conceptByName: Map<string, Concept>;
  /** Root queries per type: a related type is navigable when it has a by-id query. */
  queriesByType: Map<string, ConceptQueries>;
}

// Keep the detail column readable on entities with many relations.
const MAX_SCALAR_ITEMS = 12;
const MAX_LIST_RELATIONS = 4;

interface ResolvedRelation {
  field: ConceptField;
  target: Concept;
  label: ConceptField;
  /** Set when the target can be opened in its own column (it has a key and a by-id query). */
  navigable: boolean;
  /** The target's key field (`id`, or e.g. `code`). */
  key: string;
}

/** Relations whose target is introspected and can be shown inline (no required args). */
function resolveRelations(concept: Concept, related?: RelatedConcepts): ResolvedRelation[] {
  if (!related) return [];
  const resolved: ResolvedRelation[] = [];
  for (const field of concept.relationFields) {
    if (field.hasRequiredArgs) continue;
    const target = related.conceptByName.get(field.typeName);
    // Pagination wrappers / connections have no scalars of their own to show.
    if (!target || target.scalarFields.length === 0) continue;
    const targetQueries = related.queriesByType.get(target.name);
    const key = keyFieldOf(targetQueries);
    const hasKey = target.scalarFields.some((f) => f.name === key);
    resolved.push({
      field,
      target,
      label: pickLabelField(target.scalarFields),
      navigable: hasKey && Boolean(targetQueries?.byId),
      key,
    });
  }
  return resolved;
}

function relationSelection(r: ResolvedRelation, extra: ConceptField[] = []): string {
  const names = new Set([...(r.navigable ? [r.key] : []), r.label.name, ...extra.map((f) => f.name)]);
  return `${r.field.name} { ${[...names].join(' ')} }`;
}

/**
 * Build a compact detail view for a single entity, bound to the concept's by-id
 * query. Used as the default perspective when a Miller column is drilled into a
 * specific item (the caller injects the id into the query variables).
 *
 * When the related types are known, single relations (e.g. `origin`) are listed
 * with the scalars and link to their own column, and list relations (e.g.
 * `episode`) each get a small table whose rows link the same way.
 */
export function buildDetailView(concept: Concept, related?: RelatedConcepts): ViewSpec | null {
  const byIdField = concept.queries.byId?.field;
  if (!byIdField) return null;

  const scalars = concept.scalarFields;
  if (scalars.length === 0) return null;

  // Markdown / code properties get a widget of their own instead of a cramped row.
  const plain = scalars.filter((f) => !textKindOf(f));
  const rich = scalars.filter((f) => textKindOf(f));
  // A hierarchy below the item is shown as a tree instead of a flat table.
  const tree = buildDetailTree(concept, byIdField, related);

  const relations = resolveRelations(concept, related);
  const singles = relations.filter((r) => !r.field.isList);
  const lists = relations
    .filter((r) => r.field.isList && r.field.name !== tree?.field)
    .slice(0, MAX_LIST_RELATIONS);
  // One extra column for list relations, when the target has another scalar.
  const listExtra = (r: ResolvedRelation) =>
    r.target.scalarFields.filter((f) => f.name !== r.key && f.name !== r.label.name).slice(0, 1);

  const selection = [
    ...scalars.map((f) => f.name),
    ...singles.map((r) => relationSelection(r)),
    ...lists.map((r) => relationSelection(r, listExtra(r))),
    ...(tree ? [tree.selection] : []),
  ].join('\n            ');
  const idType = concept.queries.byId?.idType ?? 'ID!';
  const query = `query FluidAutoDetail_${concept.name}($id: ${idType}) {
          ${byIdField}(${keyFieldOf(concept.queries)}: $id) {
            ${selection}
          }
        }`;

  const widgets: Widget[] = [
    {
      id: 'detail',
      type: 'descriptions',
      title: humanize(concept.name),
      span: 24,
      data: { query: byIdField, path: byIdField },
      items: [
        ...plain.slice(0, MAX_SCALAR_ITEMS).map((f) => ({
          label: humanize(f.name),
          key: f.name,
          format: guessFormat(f),
        })),
        ...singles.map((r) => ({
          label: humanize(r.field.name),
          key: `${r.field.name}.${r.label.name}`,
          format: guessFormat(r.label),
          ...(r.navigable
            ? { linkTo: { concept: r.target.name, idField: `${r.field.name}.${r.key}` } }
            : {}),
        })),
      ],
    },
    ...rich.map(
      (f): Widget => ({
        id: `text-${f.name}`,
        type: 'richtext',
        title: humanize(f.name),
        span: 24,
        data: { query: byIdField, path: byIdField },
        field: f.name,
        format: textKindOf(f),
        language: textKindOf(f) === 'code' ? codeLanguageOf(f) : undefined,
      }),
    ),
    ...(tree ? [tree.widget] : []),
    ...lists.map(
      (r): Widget => ({
        id: `rel-${r.field.name}`,
        type: 'table',
        title: `${humanize(r.field.name)} (${r.target.name})`,
        span: 24,
        data: { query: byIdField, path: `${byIdField}.${r.field.name}` },
        columns: [r.label, ...listExtra(r)].map((f, index) => ({
          key: f.name,
          title: humanize(f.name),
          format: guessFormat(f),
          ...(index === 0 && r.navigable ? { linkTo: { concept: r.target.name, idField: r.key } } : {}),
        })),
        pageSize: 5,
      }),
    ),
  ];

  return {
    version: 1,
    id: `auto-detail:${concept.name}`,
    concept: concept.name,
    scope: 'detail',
    title: `${concept.name} detail`,
    description: `Auto-generated detail of a single ${concept.name}.`,
    queries: {
      [byIdField]: { query, variables: {} },
    },
    widgets,
  };
}
