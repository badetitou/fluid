import type { FormatKind, ViewSpecDraft, WidgetDraft } from '@fluid/shared';
import type { ConceptFieldInfo, GenerateViewInput, GenerateWidgetInput } from './types';
import { listRowsPath } from './prompt';

function humanize(name: string): string {
  const spaced = name
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function guessFormat(field: ConceptFieldInfo): FormatKind | undefined {
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

/**
 * Deterministic, always-valid draft used by the offline `mock` provider (and as
 * a dependable fallback). It mirrors the real generator's intent: a count
 * statistic, a table of scalar fields, and a category breakdown chart when a
 * categorical (enum) field is available — so the whole pipeline is exercised
 * without a live LLM.
 */
/** List query honouring the row-limit argument and pagination wrapper, when present. */
function buildMockListQuery(
  concept: string,
  listField: string,
  selection: string,
  schema: GenerateViewInput['schema'],
): string {
  const varDecl = schema.listLimitArg ? '($take: Int)' : '';
  const args = schema.listLimitArg ? `(${schema.listLimitArg}: $take)` : '';
  const body = schema.listItemsPath
    ? `${schema.listItemsPath} {\n      ${selection}\n    }`
    : selection;
  return `query MockView_${concept}${varDecl} {\n  ${listField}${args} {\n      ${body}\n  }\n}`;
}

export function mockDraft(input: GenerateViewInput): ViewSpecDraft {
  const { schema, concept, prompt } = input;
  const listField = schema.listQuery ?? undefined;
  const rowsPath = listRowsPath(schema);
  const scalars = schema.fields.filter((f) => f.isScalar && !f.isList);

  const widgets: ViewSpecDraft['widgets'] = [];
  const queries: ViewSpecDraft['queries'] = {};

  // Detail columns inject the selected id into the query keyed by the by-id field.
  const byIdField = schema.byIdQuery ?? undefined;
  if (input.scope === 'detail' && byIdField && scalars.length) {
    const selection = scalars.map((f) => f.name).join('\n      ');
    queries[byIdField] = {
      query: `query MockDetail_${concept}($id: ${schema.byIdArgType ?? 'ID!'}) {\n  ${byIdField}(${schema.byIdArgName ?? 'id'}: $id) {\n      ${selection}\n  }\n}`,
    };
    widgets.push({
      id: 'detail',
      type: 'descriptions',
      title: humanize(concept),
      span: 24,
      data: { query: byIdField, path: byIdField },
      items: scalars.slice(0, 12).map((f) => ({
        label: humanize(f.name),
        key: f.name,
        format: guessFormat(f),
      })),
    });
  } else if (listField && scalars.length) {
    const selection = scalars.map((f) => f.name).join('\n      ');
    queries.rows = {
      query: buildMockListQuery(concept, listField, selection, schema),
      variables: schema.listLimitArg ? { take: 200 } : {},
    };

    widgets.push({
      id: 'count',
      type: 'statistic',
      title: `Total ${concept}`,
      span: 8,
      data: { query: 'rows', path: rowsPath },
      value: { op: 'count' },
    });

    const numeric = scalars.find((f) => f.typeName === 'Float' || f.typeName === 'Int');
    if (numeric) {
      widgets.push({
        id: 'sum',
        type: 'statistic',
        title: `Total ${humanize(numeric.name)}`,
        span: 8,
        data: { query: 'rows', path: rowsPath },
        value: { op: 'sum', field: numeric.name },
        format: 'number',
      });
    }

    const categorical = scalars.find((f) => f.typeKind === 'ENUM');
    if (categorical) {
      widgets.push({
        id: 'breakdown',
        type: 'bar',
        title: `${concept} by ${humanize(categorical.name)}`,
        span: numeric ? 8 : 16,
        data: {
          query: 'rows',
          path: rowsPath,
          transform: {
            groupBy: categorical.name,
            ...(numeric ? { aggregate: { field: numeric.name } } : {}),
            sort: { by: numeric ? 'sum' : 'count', dir: 'desc' },
          },
        },
        xField: categorical.name,
        yField: numeric ? 'sum' : 'count',
      });
    }

    widgets.push({
      id: 'list',
      type: 'table',
      title: humanize(concept),
      span: 24,
      data: { query: 'rows', path: rowsPath },
      columns: scalars.slice(0, 8).map((f) => ({
        key: f.name,
        title: humanize(f.name),
        format: guessFormat(f),
      })),
      pageSize: 10,
    });
  }

  return {
    title: `${concept} dashboard`,
    description: `Mock-generated dashboard for ${concept}. Prompt: ${prompt}`.slice(0, 200),
    queries,
    widgets,
  };
}

/**
 * Mock single widget draft for the offline `mock` provider. Returns a simple
 * statistic widget that demonstrates the widget generation capability.
 */
export function mockWidgetDraft(input: GenerateWidgetInput): WidgetDraft {
  const { schema, concept } = input;
  const listField = schema.listQuery ?? undefined;
  const rowsPath = listRowsPath(schema);

  // Return a simple count statistic widget
  if (listField) {
    return {
      type: 'statistic',
      title: `Total ${concept}`,
      span: 8,
      data: { query: 'rows', path: rowsPath },
      value: { op: 'count' },
    };
  }

  // Fallback: if no list query, return a basic statistic
  return {
    type: 'statistic',
    title: `${concept} count`,
    span: 8,
    data: { query: 'rows' },
    value: { op: 'count' },
  };
}
