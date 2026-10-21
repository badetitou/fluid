import { EXAMPLE_VIEWS, type Column, type FormatKind, type ViewSpec } from '@fluid/shared';
import type { Concept, ConceptField } from '../graphql/introspection';

// Resolves the views available for a concept: curated examples that ship with
// Fluid, plus an auto-generated "overview" built from the introspected schema so
// every concept renders a dashboard even before anyone crafts a view for it.

function humanize(name: string): string {
  const spaced = name
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function guessFormat(field: ConceptField): FormatKind | undefined {
  if (field.typeKind === 'ENUM') return 'tag';
  switch (field.typeName) {
    case 'DateTime':
      return 'datetime';
    case 'Boolean':
      return 'boolean';
    case 'Float':
    case 'Int':
      return 'number';
    default:
      return undefined;
  }
}

/** Build a compact, navigable list for a concept from its introspected shape. */
export function buildDefaultView(concept: Concept): ViewSpec | null {
  const list = concept.queries.list;
  if (!list) return null;
  const listField = list.field;

  const scalars = concept.scalarFields;
  if (scalars.length === 0) return null;

  const hasId = scalars.some((f) => f.name === 'id');
  const idField = hasId ? 'id' : scalars[0].name;

  // Prefer a human-friendly primary column; fall back to the first non-id scalar.
  const LABELISH = ['name', 'title', 'label', 'fullName', 'displayName', 'email', 'reference', 'iban'];
  const primary =
    scalars.find((f) => LABELISH.includes(f.name)) ??
    scalars.find((f) => f.name !== 'id') ??
    scalars[0];

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
 * Build a compact detail view for a single entity, bound to the concept's by-id
 * query. Used as the default perspective when a Miller column is drilled into a
 * specific item (the caller injects the id into the query variables).
 */
export function buildDetailView(concept: Concept): ViewSpec | null {
  const byIdField = concept.queries.byId?.field;
  if (!byIdField) return null;

  const scalars = concept.scalarFields;
  if (scalars.length === 0) return null;

  const selection = scalars.map((f) => f.name).join('\n            ');
  const query = `query FluidAutoDetail_${concept.name}($id: ID!) {
          ${byIdField}(id: $id) {
            ${selection}
          }
        }`;

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
    widgets: [
      {
        id: 'detail',
        type: 'descriptions',
        title: humanize(concept.name),
        span: 24,
        data: { query: byIdField, path: byIdField },
        items: scalars.slice(0, 12).map((f) => ({
          label: humanize(f.name),
          key: f.name,
          format: guessFormat(f),
        })),
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
