import { EXAMPLE_VIEWS, type Column, type ViewSpec } from '@fluid/shared';
import { keyFieldOf, type Concept } from '../graphql/introspection';
import { guessFormat, humanize, pickLabelField } from './fieldHeuristics';

export { buildDetailView, type RelatedConcepts } from './detailView';

// Resolves the views available for a concept: curated examples that ship with
// Fluid, plus an auto-generated "overview" built from the introspected schema so
// every concept renders a dashboard even before anyone crafts a view for it.

/** Build a compact, navigable list for a concept from its introspected shape. */
export function buildDefaultView(concept: Concept): ViewSpec | null {
  const list = concept.queries.list;
  if (!list) return null;
  const listField = list.field;

  const scalars = concept.scalarFields;
  if (scalars.length === 0) return null;

  // Rows are drilled into by the by-id query's key (`id`, or e.g. `code`).
  const key = keyFieldOf(concept.queries);
  const idField = scalars.some((f) => f.name === key) ? key : scalars[0].name;

  // Prefer a human-friendly primary column; fall back to the first non-id scalar.
  const primary = pickLabelField(scalars);

  // Keep the list compact: the primary column plus up to two more scalars.
  const extras = scalars.filter((f) => f.name !== primary.name).slice(0, 2);
  const chosen = [primary, ...extras];

  // Clicking the primary column drills into that item's detail column.
  const canDrill = Boolean(concept.queries.byId);

  const selection = Array.from(new Set([idField, ...chosen.map((f) => f.name)])).join('\n            ');
  // Only pass a row limit when the field supports one, and reach through the
  // pagination wrapper (e.g. `characters { results { ... } }`) when there is one.
  const varDecl = list.limitArg ? '($take: Int)' : '';
  const callArgs = list.limitArg ? `(${list.limitArg}: $take)` : '';
  const body = list.itemsPath ? `${list.itemsPath} {\n            ${selection}\n          }` : selection;
  const query = `query FluidAuto_${concept.name}${varDecl} {
          ${listField}${callArgs} {
            ${body}
          }
        }`;
  const rowsPath = list.itemsPath ? `${listField}.${list.itemsPath}` : listField;

  const columns: Column[] = chosen.map((field, index) => ({
    key: field.name,
    title: humanize(field.name),
    format: guessFormat(field),
    ...(index === 0 && canDrill ? { linkTo: { concept: concept.name, idField } } : {}),
  }));

  return {
    version: 1,
    id: `auto:${concept.name}`,
    concept: concept.name,
    scope: 'list',
    title: `${concept.name} list`,
    description: `Auto-generated list of ${concept.name}.`,
    queries: {
      rows: { query, variables: list.limitArg ? { take: 100 } : {} },
    },
    widgets: [
      {
        id: 'list',
        type: 'table',
        title: humanize(concept.name),
        span: 24,
        data: { query: 'rows', path: rowsPath },
        columns,
        pageSize: 8,
      },
    ],
  };
}

/**
 * All views for a concept: curated examples first, then the auto-generated
 * overview. The auto view is tagged so the UI can label it distinctly.
 */
export function getViewsForConcept(concept: Concept): ViewSpec[] {
  const curated = EXAMPLE_VIEWS[concept.name] ?? [];
  const auto = buildDefaultView(concept);
  return auto ? [...curated, auto] : [...curated];
}
