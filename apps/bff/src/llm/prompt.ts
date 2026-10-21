import type { ChatMessage, ConceptSchemaInfo, GenerateViewInput, GenerateWidgetInput } from './types';
import { detectLinkCandidates, formatLinkCandidatesForPrompt } from './linkDetection';

// The system prompt pins the JSON contract (the ViewSpec *draft*) and biases the
// model toward dashboards: tables, statistics and charts, with little prose.
// CRITICAL: The prompt emphasizes creating INTERACTIVE tables with clickable links
// for Miller-list style navigation between related entities.

const CONTRACT = `You output a response with TWO SECTIONS:

1. REASONING (optional - help the user understand your thinking):
   Start with a "THINKING:" line, then list your reasoning steps. Each step starts with "- ".
   For example:
   THINKING:
   - The user wants X, so I need to query Y
   - I should include a chart showing Z
   - The timestamp field should be formatted as datetime

2. JSON OBJECT (required):
   Then, output ONE JSON object only — no markdown fences, no comments, no prose around it.

The JSON is a Fluid "view draft" with this exact shape:
{
  "title": string,
  "description"?: string,
  "queries": {                      // named GraphQL queries the widgets read from
    "<key>": { "query": "<GraphQL document string>", "variables"?: { ... } }
  },
  "widgets": [ Widget, ... ]
}

Each Widget is one of these discriminated shapes (field "type"):
- { "id": string, "type": "statistic", "title"?: string, "span"?: 1..24,
    "data": { "query": "<queries key>", "path"?: "<dot path to array/object>", "transform"?: Transform },
    "value": { "op": "count"|"sum"|"avg"|"min"|"max", "field"?: string }, "format"?: Format, "precision"?: number }
- { "id": string, "type": "table", "title"?: string, "span"?: 1..24,
    "data": { "query": ..., "path"?: ..., "transform"?: Transform },
    "columns": [ { "key": string, "title"?: string, "format"?: Format, "linkTo"?: LinkConfig, "width"?: number } ], "pageSize"?: number }
    ⭐ TABLE WIDGET IS THE PRIMARY WIDGET FOR INTERACTIVE NAVIGATION ⭐
    ⭐ EVERY TABLE COLUMN REPRESENTING AN ID OR RELATIONSHIP MUST HAVE linkTo ⭐
- { "id": string, "type": "descriptions", "title"?: string, "span"?: 1..24,
    "data": { "query": ..., "path"?: ... },
    "items": [ { "label": string, "key": string, "format"?: Format, "linkTo"?: LinkConfig } ] }
- { "id": string, "type": "line"|"area"|"bar", "title"?: string, "span"?: 1..24,
    "data": { "query": ..., "path"?: ..., "transform"?: Transform },
    "xField": string, "yField": string, "seriesField"?: string, "height"?: number }   // "bar" renders vertical columns
- { "id": string, "type": "pie", "title"?: string, "span"?: 1..24,
    "data": { "query": ..., "path"?: ..., "transform"?: Transform },
    "angleField": string, "colorField": string, "height"?: number }

LinkConfig (FEATURE: Infinite Navigation - enables Miller list-style drilling):
  "linkTo": { "concept": "<target concept name>", "idField"?: "<dot path to ID>" }
  - "concept": The target concept to navigate to (e.g., "Customer", "Order", "Product")
  - "idField": Optional dot path to extract the ID (defaults to "id"). Supports nested paths like "customer.id"
  - When a column or item has linkTo, clicking it opens a new Miller column showing that item's detail view
  - This enables INFINITE NAVIGATION: explore related objects by clicking links in tables or descriptions
  - Examples:
    * {"concept": "Account"} on an "id" column → opens the Account whose id is the row's "id"
    * {"concept": "Customer", "idField": "customer.id"} → opens the Customer whose id is the row's "customer.id"

Transform (optional) reshapes an array before rendering:
{ "groupBy"?: "<field>", "aggregate"?: { "field"?: "<numeric field>" },
  "sort"?: { "by": "<field>", "dir": "asc"|"desc" }, "limit"?: number }
When "groupBy" is set the rows become { "<groupBy>": value, "count": n, "sum": n, "avg": n, "min": n, "max": n }.
So a category breakdown = groupBy + a "bar"/"pie" widget with xField/colorField = "<groupBy>" and yField/angleField = "count" (or "sum").

Format is one of: "text","number","currency","percent","date","datetime","tag","boolean".

Rules:
- Every widget.data.query MUST reference a key defined in "queries".
- GraphQL selections may ONLY use fields listed in the concept schema below. Prefer the concept's list query.
- Pass a $take variable (e.g. 200) when the list query supports it.
- "path" is the dot path from the query result to the array/object (usually the list query field name).
- WIDGET TYPE SELECTION (CRITICAL - read user request carefully):
  * If request mentions "table", "list", "all items", "multiple", or "show all" → CREATE TABLE WIDGET with list query
  * If request mentions "detail", "single item", "this", "show relationships" → CREATE DESCRIPTIONS widget
  * If request asks for "links" or "clickable" → add linkTo to TABLE columns (not descriptions)
  * When in doubt, default to TABLE (lists with links are more useful for navigation)
- Build a DASHBOARD: a couple of statistics, one table, and one or two charts. Minimal descriptive text.
- **ALWAYS ADD NAVIGATION LINKS (linkTo) - THIS IS ESSENTIAL FOR MILLER LIST INTERACTION**:
  * For TABLE widgets: EVERY column that displays an ID or represents a relationship MUST have linkTo
  * Example: A "customers" table MUST have linkTo on the "id" column: { "concept": "Customer" }
  * For columns referencing related entities: use nested idField like "customer.id" to point to the ID
  * Use simple "linkTo": { "concept": "ConceptName" } for direct IDs
  * Use "linkTo": { "concept": "ConceptName", "idField": "field.path.to.id" } for nested relationships
  * THIS IS CRUCIAL: Adding linkTo makes columns clickable and enables users to navigate between related objects
  * Miller list navigation (split-view columns) is ONLY possible when you include linkTo in table columns
- Use double quotes everywhere. Output valid JSON and nothing else.`;

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

function renderSchema(schema: ConceptSchemaInfo): string {
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
  ]
    .filter(Boolean)
    .join('\n');
}

/**
 * Rules that depend on whether the view is generated for a list column (many
 * rows) or a detail column (one item). Detail columns only inject the selected
 * item's id into the query keyed by the concept's by-id field, so the model
 * must use exactly that key and a `$id: ID!` variable.
 */
export function scopeInstructions(input: Pick<GenerateViewInput, 'scope' | 'schema'>): string {
  const { schema } = input;
  if (input.scope === 'detail' && schema.byIdQuery) {
    return [
      `This view is a DETAIL view: it is shown for ONE selected ${schema.name}.`,
      `- Declare the query under the key "${schema.byIdQuery}" exactly, using the by-id query with a "$id: ID!" variable:`,
      `  "${schema.byIdQuery}": { "query": "query($id: ID!) { ${schema.byIdQuery}(id: $id) { ... } }" }`,
      '- Do NOT set "id" in "variables": the application injects the selected item\'s id at runtime.',
      `- Widgets read the item with "path": "${schema.byIdQuery}" (descriptions) or a nested list such as "${schema.byIdQuery}.<relation>" (tables, charts, statistics).`,
      '- Select related objects and lists through nested selections of that single query.',
    ].join('\n');
  }
  return [
    `This view is a LIST view: it shows many ${schema.name} rows.`,
    schema.listQuery
      ? schema.listLimitArg
        ? `- Read rows from the list query: ${describeListQuery(schema)} (pass "${schema.listLimitArg}": 200).`
        : `- Read rows from the list query: ${describeListQuery(schema)}.`
      : '- The concept has no list query; use the closest query available.',
  ].join('\n');
}

export function buildMessages(input: GenerateViewInput): ChatMessage[] {
  const system = [
    'You are Fluid\'s dashboard view generator. Given a GraphQL concept and a user request,',
    'you design a compact, useful dashboard as a JSON view draft.',
    'You can make the dashboard INTERACTIVE by adding "linkTo" to table columns and description items,',
    'enabling users to navigate infinitely between related objects (Miller list style).',
    '',
    CONTRACT,
    '',
    'Concept schema:',
    renderSchema(input.schema),
  ].join('\n');

  const messages: ChatMessage[] = [{ role: 'system', content: system }];
  if (input.history?.length) {
    for (const m of input.history) {
      if (m.role === 'user' || m.role === 'assistant') messages.push(m);
    }
  }
  
  // Detect and format link candidates from schema
  const linkCandidates = detectLinkCandidates(input.schema);
  const linkCandidatesText = formatLinkCandidatesForPrompt(linkCandidates);
  
  messages.push({
    role: 'user',
    content: [
      `Create a dashboard view for the "${input.concept}" concept.`,
      '',
      '🎯 PRIMARY GOAL: Create a TABLE widget with clickable links for navigation.',
      '',
      'TABLE WIDGET RULES:',
      '- If request mentions "table", "list", "all items", "multiple", "show all", or "work list" → CREATE TABLE WIDGET',
      '- The table MUST include relevant columns that allow users to click and navigate to related entities',
      '- ALWAYS add "linkTo" configuration to ID columns or relationship columns',
      '- Make columns clickable so users can drill down into details (Miller list navigation)',
      '',
      'LINK CONFIGURATION (Critical for navigation):',
      '- Every ID column should have: "linkTo": { "concept": "<related concept name>" }',
      '- For relationship fields, use: "linkTo": { "concept": "<target concept>", "idField": "<path.to.id>" }',
      '- Example table column:',
      '  { "key": "customerId", "title": "Customer", "linkTo": { "concept": "Customer", "idField": "customerId" } }',
      '',
      linkCandidatesText,
      '',
      scopeInstructions(input),
      '',
      `Request: ${input.prompt}`,
    ].join('\n'),
  });
  return messages;
}

/** Follow-up message asking the model to fix an invalid draft. */
export function buildRepairMessage(errorText: string, previous: string): ChatMessage {
  return {
    role: 'user',
    content: [
      'Your previous output was not a valid view draft. Validation errors:',
      errorText,
      '',
      'Here is what you returned:',
      previous.slice(0, 4000),
      '',
      'Return a corrected JSON object that satisfies the contract. Output only the JSON.',
    ].join('\n'),
  };
}

// Widget-specific contract and prompt building

const WIDGET_CONTRACT = `You output a response with TWO SECTIONS:

1. REASONING (optional - help the user understand your thinking):
   Start with a "THINKING:" line, then list your reasoning steps. Each step starts with "- ".

2. JSON OBJECT (required):
   Then, output ONE JSON widget object only — no markdown fences, no comments, no prose around it.

The JSON is a Fluid "widget draft" with one of these discriminated shapes (field "type"):
- { "type": "statistic", "title"?: string, "span"?: 1..24,
    "data": { "query": "<query key>", "path"?: "<dot path>", "transform"?: Transform },
    "value": { "op": "count"|"sum"|"avg"|"min"|"max", "field"?: string }, "format"?: Format, "precision"?: number }
- { "type": "table", "title"?: string, "span"?: 1..24,
    "data": { "query": "<query key>", "path"?: "<dot path>", "transform"?: Transform },
    "columns": [ { "key": string, "title"?: string, "format"?: Format, "linkTo"?: LinkConfig, "width"?: number } ], "pageSize"?: number }
- { "type": "descriptions", "title"?: string, "span"?: 1..24,
    "data": { "query": "<query key>", "path"?: "<dot path>" },
    "items": [ { "label": string, "key": string, "format"?: Format, "linkTo"?: LinkConfig } ] }
- { "type": "line"|"area"|"bar", "title"?: string, "span"?: 1..24,
    "data": { "query": "<query key>", "path"?: "<dot path>", "transform"?: Transform },
    "xField": string, "yField": string, "colorField"?: string, "height"?: number }
- { "type": "pie", "title"?: string, "span"?: 1..24,
    "data": { "query": "<query key>", "path"?: "<dot path>", "transform"?: Transform },
    "angleField": string, "colorField": string, "height"?: number }

Transform: { "groupBy"?: string, "aggregate"?: { "field"?: string }, "sort"?: { "by": string, "dir": "asc"|"desc" }, "limit"?: number }
Format: "text"|"number"|"currency"|"percent"|"date"|"datetime"|"tag"|"boolean"
LinkConfig: { "concept": string, "idField"?: string }

Important:
- Do NOT include an "id" field in the widget — it will be assigned by the system.
- WIDGET.data.query must reference an available query key.
- Use double quotes everywhere. Output valid JSON and nothing else.`;

export function buildWidgetMessages(input: GenerateWidgetInput): ChatMessage[] {
  const system = [
    'You are Fluid\'s widget generator. Given a GraphQL concept and a user request, you generate a single dashboard widget as a JSON widget draft.',
    'You can make the widget INTERACTIVE by adding "linkTo" to table columns, enabling users to navigate between related objects (Miller list style).',
    '',
    WIDGET_CONTRACT,
    '',
    'Concept schema:',
    renderSchema(input.schema),
  ].join('\n');

  const messages: ChatMessage[] = [{ role: 'system', content: system }];
  if (input.history?.length) {
    for (const m of input.history) {
      if (m.role === 'user' || m.role === 'assistant') messages.push(m);
    }
  }

  // Detect and format link candidates from schema
  const linkCandidates = detectLinkCandidates(input.schema);
  const linkCandidatesText = formatLinkCandidatesForPrompt(linkCandidates);

  // Build user prompt with context
  const contextParts: string[] = [];

  if (input.existingWidget) {
    contextParts.push('EXISTING WIDGET (current state):');
    contextParts.push(JSON.stringify(input.existingWidget, null, 2));
    contextParts.push('');
  }

  if (input.viewQueries && Object.keys(input.viewQueries).length > 0) {
    contextParts.push('AVAILABLE QUERIES IN THE VIEW:');
    for (const [key, query] of Object.entries(input.viewQueries)) {
      contextParts.push(`  "${key}": ${query}`);
    }
    contextParts.push('');
  }

  contextParts.push(linkCandidatesText);
  contextParts.push('');
  contextParts.push(`Request: ${input.prompt}`);

  messages.push({
    role: 'user',
    content: contextParts.join('\n'),
  });
  return messages;
}

/** Follow-up message asking the model to fix an invalid widget draft. */
export function buildWidgetRepairMessage(errorText: string, previous: string): ChatMessage {
  return {
    role: 'user',
    content: [
      'Your previous output was not a valid widget draft. Validation errors:',
      errorText,
      '',
      'Here is what you returned:',
      previous.slice(0, 4000),
      '',
      'Return a corrected JSON widget object that satisfies the contract. Do NOT include an "id" field. Output only the JSON.',
    ].join('\n'),
  };
}
