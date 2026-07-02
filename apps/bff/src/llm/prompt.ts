import type { ChatMessage, ConceptSchemaInfo, GenerateViewInput } from './types';

// The system prompt pins the JSON contract (the ViewSpec *draft*) and biases the
// model toward dashboards: tables, statistics and charts, with little prose.

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
    "columns": [ { "key": string, "title"?: string, "format"?: Format, "linkTo"?: LinkConfig } ], "pageSize"?: number }
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
  - When a column or item has linkTo, users can click it to navigate to "/concept/{concept}/item/{id}"
  - This enables INFINITE NAVIGATION: explore related objects by clicking links in tables or descriptions
  - Examples:
    * {"concept": "Customer"} → uses "id" field, navigates to /concept/Customer/item/ACC-001
    * {"concept": "Customer", "idField": "customer.id"} → navigates to /concept/Customer/item/CUST-001

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
- Build a DASHBOARD: a couple of statistics, one table, and one or two charts. Minimal descriptive text.
- NAVIGATION: When showing lists or details, add "linkTo" on ID columns and related-object fields to enable exploration
  * On table columns that contain IDs, add linkTo pointing to that concept
  * On description items that show related objects, add linkTo pointing to the related concept
  * Use nested idField like "customer.id" to point to the ID field within nested objects
- Use double quotes everywhere. Output valid JSON and nothing else.`;

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
    `List query (returns many): ${schema.listQuery ?? '(none)'}`,
    schema.byIdQuery ? `By-id query: ${schema.byIdQuery}` : null,
    'Fields:',
    fields || '  (none)',
    'Related concepts:',
    related,
  ]
    .filter(Boolean)
    .join('\n');
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
  messages.push({
    role: 'user',
    content: `Create a dashboard view for the "${input.concept}" concept. Request: ${input.prompt}`,
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
