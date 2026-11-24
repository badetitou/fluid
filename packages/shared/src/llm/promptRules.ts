import type { ConceptSchemaInfo, GenerateViewInput } from './types';

import { renderStructureHints } from './structureHints';

import { graphScopeInstructions, isGraphSchema } from './graphScope';

// The system prompt pins the JSON contract (the ViewSpec *draft*) and biases the
// model toward dashboards: tables, statistics and charts, with little prose.
// CRITICAL: The prompt emphasizes creating INTERACTIVE tables with clickable links
// for Miller-list style navigation between related entities.

/** How dot paths cross nested lists at render time (shared by both prompts). */
export const NESTED_DATA_RULES = [
  'Views may show data several levels deep: select it with nested GraphQL selections (e.g. `customers { accounts { transactions { amount } } }`).',
  'Dot paths ("path", column/item "key", "field", "groupBy", "xField"…) cross nested lists: each segment is applied to every element and the results are flattened.',
  '  * "path": "customers.accounts.transactions" → one flat array of every transaction of every customer (tables, charts, statistics on it).',
  '  * column "key": "accounts.iban" on a customer row → the list of that customer\'s IBANs (rendered comma-separated).',
  '  * Per-row totals over nested data use transform "derive", e.g. { "as": "totalSpent", "op": "sum", "field": "accounts.transactions.amount" }, then sort by "totalSpent".',
  '  * To keep parent context in a flattened table, also select a back-reference when the schema has one (e.g. `transactions { amount account { iban } }` → key "account.iban").',
].join('\n');

/** A request phrased as a question must produce the view that answers it. */
export const QUESTION_RULES = [
  'The request may be a QUESTION (e.g. "which customers have the highest balance?", "how much was spent per category last month?").',
  'Then design the view that ANSWERS it:',
  '  * title = the question\'s topic, description = one sentence stating what the view answers;',
  '  * put the answer first: the statistic(s) or the focused chart/table that directly answers it (use transform sort/limit for "top"/"most"/"highest", groupBy for "per"/"by");',
  '  * then only the supporting widgets needed to justify the answer (e.g. the underlying rows, with links). No generic dashboard filler.',
  '  * Follow relations as deep as the question needs (see the reachable relations).',
].join('\n');

/**
 * Path from a list query's result to its rows: the list field itself, or its
 * rows field when it returns a pagination wrapper (e.g. "characters.results").
 */
export function listRowsPath(schema: ConceptSchemaInfo): string | undefined {
  if (!schema.listQuery) return undefined;
  return schema.listItemsPath ? `${schema.listQuery}.${schema.listItemsPath}` : schema.listQuery;
}

/** Human/LLM-readable shape of the list query, e.g. `characters { results { ... } }`. */
export function describeListQuery(schema: ConceptSchemaInfo): string {
  if (!schema.listQuery) return '(none)';
  const args = schema.listLimitArg ? `(${schema.listLimitArg}: Int)` : '';
  const shape = schema.listItemsPath
    ? `${schema.listQuery}${args} { ${schema.listItemsPath} { ...${schema.name} fields } }`
    : `${schema.listQuery}${args} { ...${schema.name} fields }`;
  const notes = [
    schema.listItemsPath
      ? `paginated wrapper: rows are under "${schema.listItemsPath}", read them with path "${listRowsPath(schema)}"`
      : null,
    schema.listLimitArg ? null : 'no row-limit argument: do not pass "take"',
  ].filter(Boolean);
  return notes.length ? `${shape} — ${notes.join('; ')}` : shape;
}

/**
 * Relations reachable through nested selections, several levels deep, e.g.
 * `accounts.transactions (Transaction[]): id: ID, amount: Float`. Lets the model
 * select and display data beyond the concept's direct fields.
 */
export function renderRelationPaths(schema: ConceptSchemaInfo): string {
  if (!schema.paths?.length) return '  (none)';
  return schema.paths
    .map(
      (p) =>
        `  - ${p.path} (${p.typeName}${p.isList ? '[]' : ''}${p.recursive ? `, recursive: ${p.typeName} → ${p.typeName}` : ''})${
          p.fields.length ? `: ${p.fields.join(', ')}` : ''
        }`,
    )
    .join('\n');
}

export function renderGenericSchema(schema: ConceptSchemaInfo): string {
  const fields = schema.fields
    .map(
      (f) =>
        `  - ${f.name}: ${f.typeName}${f.isList ? '[]' : ''} (${f.typeKind}${
          f.isScalar ? ', scalar' : ''
        })`,
    )
    .join('\n');
  const related =
    schema.related && schema.related.length
      ? schema.related
          .map((r) => `  - ${r.name}${r.fields?.length ? ` { ${r.fields.join(', ')} }` : ''}`)
          .join('\n')
      : '  (none)';
  return [
    `Concept: ${schema.name}`,
    schema.description ? `Description: ${schema.description}` : null,
    `List query (returns many): ${describeListQuery(schema)}`,
    schema.byIdQuery ? `By-id query: ${schema.byIdQuery}` : null,
    'Fields:',
    fields || '  (none)',
    'Related concepts:',
    related,
    'Reachable relations (nested selections, several levels deep; path (Type[] when it yields many rows): scalar fields):',
    renderRelationPaths(schema),
    renderStructureHints(schema),
  ]
    .filter(Boolean)
    .join('\n');
}

/**
 * Rules that depend on whether the view is generated for a list column (many
 * rows) or a detail column (one item). Detail columns only inject the selected
 * item's id into the query keyed by the concept's by-id field, so the model
 * must use exactly that key and an `$id` variable of the by-id argument's type.
 */
export function scopeInstructions(input: Pick<GenerateViewInput, 'scope' | 'schema'>): string {
  const { schema } = input;
  if (isGraphSchema(schema)) return graphScopeInstructions(schema);
  if (input.scope === 'detail' && schema.byIdQuery) {
    const idType = schema.byIdArgType ?? 'ID!';
    const idArg = schema.byIdArgName ?? 'id';
    return [
      `This view is a DETAIL view: it is shown for ONE selected ${schema.name}.`,
      `- Declare the query under the key "${schema.byIdQuery}" exactly, using the by-id query with a "$id: ${idType}" variable:`,
      `  "${schema.byIdQuery}": { "query": "query($id: ${idType}) { ${schema.byIdQuery}(${idArg}: $id) { ... } }" }`,
      '- Do NOT set "id" in "variables": the application injects the selected item\'s id at runtime.',
      `- Widgets read the item with "path": "${schema.byIdQuery}" (descriptions) or a nested list such as "${schema.byIdQuery}.<relation>" (tables, charts, statistics).`,
      '- Select related objects and lists through nested selections of that single query.',
    ].join('\n');
  }
  return [
    `This view is a LIST view: it shows many ${schema.name} rows.`,
    schema.listQuery
      ? schema.listLimitArg
        ? `- Read rows from the list query: ${describeListQuery(schema)} (declare $take: Int, pass ${schema.listLimitArg}: $take, "variables": { "take": 200 }).`
        : `- Read rows from the list query: ${describeListQuery(schema)}.`
      : '- The concept has no list query; use the closest query available.',
  ].join('\n');
}
