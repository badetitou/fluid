import type { ChatMessage, ConceptSchemaInfo, GenerateViewInput } from './types';
import { richTextWidgetDoc, scatterWidgetDoc, treeWidgetDoc } from '@fluid/shared';
import { detectLinkCandidates } from './linkDetection';
import { renderStructureHints } from './structureHints';
import {
  describeListQuery,
  NESTED_DATA_RULES,
  QUESTION_RULES,
  renderRelationPaths,
  scopeInstructions,
} from './prompt';

// Prompt tuned for Claude (used by the `claude-code` provider). Claude follows
// XML-sectioned instructions well, so the contract, the rules and the concept
// schema each get their own tag, and the answer is split into a short
// <reasoning> list (streamed live to the user) and a <view> JSON object.

const SYSTEM = `You are the view designer of Fluid, a web app that lets people explore a GraphQL backend the way a Smalltalk inspector explores objects. For one concept (a GraphQL object type) you design a compact, data-dense dashboard and return it as a declarative JSON "view draft" that Fluid renders with Ant Design widgets. Your output is parsed by a program, so the format rules below are strict.

<output_format>
Answer with exactly two tagged sections and nothing else:

<reasoning>
- 3 to 6 short bullet points, in the user's language, on what you show and why (the user sees these live while you work)
</reasoning>
<view>
{ ...one JSON object: the view draft... }
</view>

The <view> section holds raw JSON only: no markdown fences, no comments, no trailing commas, double quotes everywhere.
</output_format>

<view_draft_contract>
{
  "title": string,
  "description"?: string,                       // one short sentence
  "queries": { "<key>": { "query": "<GraphQL document>", "variables"?: { ... } } },
  "widgets": [ Widget, ... ]
}

Every widget has: "id" (unique string), "type", optional "title", optional "span" (1..24, Ant Design grid; widgets wrap into rows of 24), optional "height" (px, charts), and
"data": { "query": "<key of queries>", "path"?: "<dot path from the query result to the array or object>", "transform"?: Transform }

Widget types:
- "statistic": "value": { "op": "count"|"sum"|"avg"|"min"|"max"|"first", "field"?: "<numeric field, required except for count>" }, "format"?: "number"|"currency"|"percent", "currency"?: "EUR", "precision"?: 0..6, "prefix"?, "suffix"?
- "table": "columns": [ { "key": "<dot path in the row>", "title"?, "format"?: Format, "currency"?, "width"?, "linkTo"?: LinkTo } ], "pageSize"?: number, "sortable"?: boolean, "filterable"?: boolean (header sorting and value filters, both on by default; set false only when the user asks)
- "descriptions": binds ONE object (or the first array element); "items": [ { "label", "key", "format"?, "linkTo"? } ], "columns"?: 1..4
- "line" | "area" | "bar": "xField", "yField", "colorField"? ("bar" renders vertical columns)
- "pie": "angleField" (numeric), "colorField" (category)
${treeWidgetDoc}
${richTextWidgetDoc}
${scatterWidgetDoc}

Format: "text"|"number"|"currency"|"percent"|"date"|"datetime"|"tag"|"boolean"|"image"|"markdown"|"code"
  "image" only for String fields holding a picture URL (avatar, portrait, photo, logo…); the user must click to load it.
  "markdown" renders Markdown text, "code" source code (short values inline, multi-line as a block).
Transform: { "derive"?: [ { "as": "<new field>", "op": "count"|"sum"|"avg"|"min"|"max"|"first", "field"?: "<dot path, may cross nested lists>" } ], "groupBy"?: "<field>", "aggregate"?: { "field": "<numeric field>" }, "sort"?: { "by": "<field>", "dir": "asc"|"desc" }, "limit"?: number }
  "derive" runs first: it adds per-row computed fields over nested data, which sort, groupBy, columns and chart fields can then use.
  After "groupBy", each row becomes { "<groupBy>": value, "count": n, "sum": n, "avg": n, "min": n, "max": n } (sum/avg/min/max only with "aggregate").
  A breakdown chart therefore uses xField/colorField = "<groupBy field>" and yField/angleField = "count" or "sum".
LinkTo: { "concept": "<target concept>", "idField"?: "<dot path to the target id, default "id">" }
  Clicking a linked cell opens the target item in a new Miller column, so links are how users drill through the data.
</view_draft_contract>

<rules>
- Only select fields that exist in the concept schema (and the listed fields of related concepts and reachable relations, through nested selections). Never invent fields, arguments or queries.
- Every widget.data.query must be a key of "queries". Prefer a single query that feeds several widgets.
- "path" starts at the query result root, e.g. "accounts" or "account.transactions".
- Statistics and charts on numbers must use numeric fields (Int/Float). Use enum fields for groupings and "tag" formatting.
- Dates: "date"/"datetime" format; time-series charts sort by the date field ascending.
- Add "linkTo" to identifier and relationship columns: { "concept": "<Self>" } on the row's own "id", and { "concept": "<Related>", "idField": "<relation>.id" } on a related object's column (select "<relation> { id ... }" in the query).
- Lay out a dashboard: a row of 2 to 4 statistics, one or two charts, then a table (span 24). Little prose. For a question, lay out the answer instead (see <questions>).
- When refining a previous view, start from it and change only what the user asks; keep widget ids stable.
</rules>

<nested_data>
${NESTED_DATA_RULES}
</nested_data>

<questions>
${QUESTION_RULES}
</questions>

<example>
For a hypothetical "Order" list (fields id, reference, status: OrderStatus enum, total: Float, createdAt: DateTime, customer: Customer):
<view>
{"title":"Orders overview","description":"Order volume, revenue and status breakdown.","queries":{"orders":{"query":"query($take: Int) { orders(take: $take) { id reference status total createdAt customer { id fullName } } }","variables":{"take":200}}},"widgets":[{"id":"count","type":"statistic","title":"Orders","span":8,"data":{"query":"orders","path":"orders"},"value":{"op":"count"}},{"id":"revenue","type":"statistic","title":"Revenue","span":8,"data":{"query":"orders","path":"orders"},"value":{"op":"sum","field":"total"},"format":"currency","currency":"EUR"},{"id":"avg","type":"statistic","title":"Average order","span":8,"data":{"query":"orders","path":"orders"},"value":{"op":"avg","field":"total"},"format":"currency","currency":"EUR","precision":2},{"id":"by-status","type":"pie","title":"Orders by status","span":12,"data":{"query":"orders","path":"orders","transform":{"groupBy":"status"}},"angleField":"count","colorField":"status"},{"id":"revenue-by-status","type":"bar","title":"Revenue by status","span":12,"data":{"query":"orders","path":"orders","transform":{"groupBy":"status","aggregate":{"field":"total"},"sort":{"by":"sum","dir":"desc"}}},"xField":"status","yField":"sum"},{"id":"list","type":"table","title":"Orders","span":24,"pageSize":10,"data":{"query":"orders","path":"orders","transform":{"sort":{"by":"createdAt","dir":"desc"}}},"columns":[{"key":"reference","title":"Reference","linkTo":{"concept":"Order"}},{"key":"customer.fullName","title":"Customer","linkTo":{"concept":"Customer","idField":"customer.id"}},{"key":"status","title":"Status","format":"tag"},{"key":"total","title":"Total","format":"currency"},{"key":"createdAt","title":"Created","format":"datetime"}]}]}
</view>
</example>`;

function renderSchema(schema: ConceptSchemaInfo): string {
  const fields = schema.fields
    .map((f) => {
      const type = `${f.typeName}${f.isList ? '[]' : ''}`;
      const kind = f.isScalar ? f.typeKind.toLowerCase() : `relation → ${f.typeName}`;
      return `  - ${f.name}: ${type} (${kind})${f.description ? ` — ${f.description}` : ''}`;
    })
    .join('\n');
  const related = schema.related?.length
    ? schema.related
        .map((r) => `  - ${r.name}${r.fields?.length ? `: ${r.fields.join(', ')}` : ''}`)
        .join('\n')
    : '  (none)';
  return [
    `Concept: ${schema.name}`,
    schema.description ? `Description: ${schema.description}` : null,
    `List query: ${describeListQuery(schema)}`,
    `By-id query: ${schema.byIdQuery ? `${schema.byIdQuery}(${schema.byIdArgName ?? 'id'}: ${schema.byIdArgType ?? 'ID!'})` : '(none)'}`,
    'Fields:',
    fields || '  (none)',
    'Related concepts (selectable fields):',
    related,
    'Reachable relations (nested selections, several levels deep; path (Type[] when it yields many rows): scalar fields):',
    renderRelationPaths(schema),
    renderStructureHints(schema),
  ]
    .filter(Boolean)
    .join('\n');
}

function renderLinkHints(schema: ConceptSchemaInfo): string {
  const hints = detectLinkCandidates(schema).map(
    (c) => `  - "${c.fieldName}" → linkTo { "concept": "${c.targetConcept}"${
      c.fieldName === 'id' ? '' : `, "idField": "${c.idField}"`
    } }`,
  );
  const relations = schema.fields
    .filter((f) => !f.isScalar && !f.isList)
    .map(
      (f) =>
        `  - "${f.name}.<field>" → linkTo { "concept": "${f.typeName}", "idField": "${f.name}.id" } (select ${f.name} { id ... })`,
    );
  const all = [...hints, ...relations];
  return all.length ? all.join('\n') : '  (no obvious link candidates)';
}

/** Messages for a Claude view generation (system prompt + one user turn, plus history). */
export function buildClaudeMessages(input: GenerateViewInput): ChatMessage[] {
  const messages: ChatMessage[] = [{ role: 'system', content: SYSTEM }];
  for (const m of input.history ?? []) {
    if (m.role === 'user' || m.role === 'assistant') messages.push(m);
  }
  messages.push({
    role: 'user',
    content: [
      '<concept_schema>',
      renderSchema(input.schema),
      '</concept_schema>',
      '',
      '<link_candidates>',
      renderLinkHints(input.schema),
      '</link_candidates>',
      '',
      '<scope>',
      scopeInstructions(input),
      '</scope>',
      '',
      '<request>',
      input.prompt,
      '</request>',
    ].join('\n'),
  });
  return messages;
}

/** Follow-up asking Claude to fix a draft that failed validation. */
export function buildClaudeRepairMessage(errorText: string): ChatMessage {
  return {
    role: 'user',
    content: [
      'Your <view> did not validate against the view draft contract:',
      '<validation_errors>',
      errorText,
      '</validation_errors>',
      'Fix these errors and answer again with the same <reasoning> and <view> format.',
    ].join('\n'),
  };
}

/**
 * Split a Claude answer into reasoning bullets and the JSON payload. Falls back
 * to the whole text when the tags are missing so `extractJson` can still try.
 */
export function parseClaudeAnswer(text: string): { reasoning: string[]; content: string } {
  const reasoningBlock = text.match(/<reasoning>([\s\S]*?)<\/reasoning>/i)?.[1] ?? '';
  const reasoning = reasoningBlock
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('-'))
    .map((l) => l.replace(/^-\s*/, ''))
    .filter(Boolean);
  const view = text.match(/<view>([\s\S]*?)<\/view>/i)?.[1];
  return { reasoning, content: (view ?? text).trim() };
}
