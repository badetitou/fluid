import type { ChatMessage, GenerateWidgetInput } from './types';
import { renderPortDocs, renderWidgetDocs, resolveWidgetCatalog, type WidgetContract } from '@fluid/shared';
import { renderLinkHints, renderSchema } from './claudePrompt';
import { graphScopeInstructions, isGraphSchema } from './graphScope';

// Widget prompt tuned for Claude (used by the `claude-code` provider), built
// like the view prompt in `claudePrompt.ts`: XML sections, a <reasoning> list
// and a <widget> JSON object. The generic widget prompt (a "THINKING:" section,
// shouted emoji instructions, the current widget pasted unlabelled) made
// Claude's usage-policy safeguards reject about one edit in eight.

const system = (widgets: WidgetContract[]) => `You are the widget editor of Fluid, a web app that lets people explore a GraphQL backend the way a Smalltalk inspector explores objects. A dashboard ("view") shows one concept (a GraphQL object type) with Ant Design widgets. The user asks you to create or change ONE widget of their view; you return it as a declarative JSON "widget draft". Your output is parsed by a program, so the format rules below are strict.

<output_format>
Answer with exactly two tagged sections and nothing else:

<reasoning>
- 2 to 5 short bullet points, in the user's language, on what you change and why
</reasoning>
<widget>
{ ...one JSON object: the widget draft... }
</widget>

The <widget> section holds raw JSON only: no markdown fences, no comments, no trailing commas, double quotes everywhere.
</output_format>

<widget_draft_contract>
A widget has a "type", optional "title", optional "span" (1..24, Ant Design grid), optional "height" (px, charts), and
"data": { "query": "<key of the view's queries>", "path"?: "<dot path from the query result to the array or object>", "transform"?: Transform }

Widget types (use ONLY these):
${renderWidgetDocs(widgets, { withId: false })}
${renderPortDocs(widgets)}

Format: "text"|"number"|"currency"|"percent"|"date"|"datetime"|"tag"|"boolean"|"image"|"markdown"|"code"
  "image" only for String fields holding a picture URL; the user must click to load it.
Transform: { "derive"?: [ { "as": "<new field>", "op": "count"|"sum"|"avg"|"min"|"max"|"first", "field"?: "<dot path, may cross nested lists>" } ], "groupBy"?: "<field>", "aggregate"?: { "field": "<numeric field>" }, "sort"?: { "by": "<field>", "dir": "asc"|"desc" }, "limit"?: number }
  "derive" runs first: it adds per-row computed fields over nested data, which sort, groupBy, columns and chart fields can then use.
  After "groupBy", each row becomes { "<groupBy>": value, "count": n, "sum": n, "avg": n, "min": n, "max": n } (sum/avg/min/max only with "aggregate").
LinkTo: { "concept": "<target concept>", "idField"?: "<dot path to the target id, default "id">" }
  Clicking a linked cell opens the target item in a new Miller column.
</widget_draft_contract>

<rules>
- Do not include an "id" field: Fluid keeps the widget's id.
- "data.query" must be one of the view's queries (listed in <view_queries>) or "@<widgetId>" to read another widget's output. Only use fields those queries select.
- Dot paths cross nested lists (each segment applies to every element, results are flattened), e.g. "path": "customer.accounts.transactions".
- When <current_widget> is given, start from it and change only what the user asks; keep its type unless asked otherwise.
- Add "linkTo" to identifier and relationship columns when the query selects their id.
</rules>`;

function renderViewWidgets(input: GenerateWidgetInput): string {
  const lines = (input.viewWidgets ?? []).map((w) => {
    const outputs = w.outputs?.length ? ` (outputs: ${w.outputs.join(', ')})` : '';
    return `- "${w.id}": ${w.type}${w.title ? ` "${w.title}"` : ''}${outputs}`;
  });
  return lines.length ? lines.join('\n') : '(none)';
}

function renderViewQueries(input: GenerateWidgetInput): string {
  const entries = Object.entries(input.viewQueries ?? {});
  return entries.length ? entries.map(([key, query]) => `- "${key}": ${query}`).join('\n') : '(none)';
}

/** Messages for a Claude widget generation (system prompt + one user turn, plus history). */
export function buildClaudeWidgetMessages(input: GenerateWidgetInput): ChatMessage[] {
  const messages: ChatMessage[] = [{ role: 'system', content: system(resolveWidgetCatalog(input.widgets)) }];
  for (const m of input.history ?? []) {
    if (m.role === 'user' || m.role === 'assistant') messages.push(m);
  }
  const current = input.existingWidget
    ? ['<current_widget>', JSON.stringify(input.existingWidget), '</current_widget>', '']
    : [];
  const scope = isGraphSchema(input.schema) ? ['<scope>', graphScopeInstructions(input.schema), '</scope>', ''] : [];
  messages.push({
    role: 'user',
    content: [
      '<concept_schema>',
      renderSchema(input.schema),
      '</concept_schema>',
      '',
      '<view_queries>',
      renderViewQueries(input),
      '</view_queries>',
      '',
      '<view_widgets>',
      renderViewWidgets(input),
      '</view_widgets>',
      '',
      '<link_candidates>',
      renderLinkHints(input.schema),
      '</link_candidates>',
      '',
      ...scope,
      ...current,
      '<request>',
      input.prompt,
      '</request>',
    ].join('\n'),
  });
  return messages;
}

/** Follow-up asking Claude to fix a widget draft that failed validation. */
export function buildClaudeWidgetRepairMessage(errorText: string): ChatMessage {
  return {
    role: 'user',
    content: [
      'Your <widget> did not validate against the widget draft contract:',
      '<validation_errors>',
      errorText,
      '</validation_errors>',
      'Fix these errors and answer again with the same <reasoning> and <widget> format.',
    ].join('\n'),
  };
}
