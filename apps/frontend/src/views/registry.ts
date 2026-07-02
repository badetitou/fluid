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

/** Build a reasonable default dashboard for a concept from its introspected shape. */
export function buildDefaultView(concept: Concept): ViewSpec | null {
  const listField = concept.queries.list?.field;
  if (!listField) return null;

  const scalars = concept.scalarFields;
  if (scalars.length === 0) return null;

  const selection = scalars.map((f) => f.name).join('\n            ');
  const query = `query FluidAuto_${concept.name}($take: Int) {
          ${listField}(take: $take) {
            ${selection}
          }
        }`;

  const columns: Column[] = scalars.slice(0, 8).map((field) => ({
    key: field.name,
    title: humanize(field.name),
    format: guessFormat(field),
  }));

  return {
    version: 1,
    id: `auto:${concept.name}`,
    concept: concept.name,
    title: `${concept.name} overview`,
    description: `Auto-generated overview of ${concept.name}.`,
    queries: {
      rows: { query, variables: { take: 200 } },
    },
    widgets: [
      {
        id: 'count',
        type: 'statistic',
        title: `Total ${concept.name}`,
        span: 8,
        data: { query: 'rows', path: listField },
        value: { op: 'count' },
      },
      {
        id: 'list',
        type: 'table',
        title: humanize(concept.name),
        span: 24,
        data: { query: 'rows', path: listField },
        columns,
        pageSize: 10,
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
