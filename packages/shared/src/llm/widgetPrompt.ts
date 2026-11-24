import { renderPortDocs, renderWidgetDocs, resolveWidgetCatalog, type WidgetContract } from '..';

import type { ChatMessage, GenerateWidgetInput } from './types';

import { detectLinkCandidates, formatLinkCandidatesForPrompt } from './linkDetection';

import { renderViewActions } from './viewActionsPrompt';

import { renderGenericSchema } from './promptRules';

import { graphScopeInstructions, isGraphSchema } from './graphScope';

// Widget-specific contract and prompt building

const widgetContract = (widgets: WidgetContract[]) => `You output a response with TWO SECTIONS:

1. REASONING (optional - help the user understand your thinking):
   Start with a "THINKING:" line, then list your reasoning steps. Each step starts with "- ".

2. JSON OBJECT (required):
   Then, output ONE JSON widget object only — no markdown fences, no comments, no prose around it.

The JSON is a Fluid "widget draft" with one of these discriminated shapes (field "type"); use ONLY these types:
${renderWidgetDocs(widgets, { withId: false })}
${renderPortDocs(widgets)}

Transform: { "derive"?: [ { "as": string, "op": "count"|"sum"|"avg"|"min"|"max"|"first", "field"?: string } ], "groupBy"?: string, "aggregate"?: { "field"?: string }, "sort"?: { "by": string, "dir": "asc"|"desc" }, "limit"?: number }
  "derive" adds per-row computed fields over nested data (e.g. sum of "accounts.transactions.amount"), usable by sort, groupBy, columns and chart fields.
Format: "text"|"number"|"currency"|"percent"|"date"|"datetime"|"tag"|"boolean"|"image"|"markdown"|"code"
  "image" only for String fields holding a picture URL (avatar, portrait, photo, logo…); the user must click to load it.
LinkConfig: { "concept": string, "idField"?: string }

Important:
- Do NOT include an "id" field in the widget — it will be assigned by the system.
- WIDGET.data.query must reference an available query key.
- Dot paths cross nested lists (each segment applies to every element, results are flattened), so a widget can read data several levels deep, e.g. "path": "customer.accounts.transactions".
- Use double quotes everywhere. Output valid JSON and nothing else.`;

export function buildWidgetMessages(input: GenerateWidgetInput): ChatMessage[] {
  const system = [
    'You are Fluid\'s widget generator. Given a GraphQL concept and a user request, you generate a single dashboard widget as a JSON widget draft.',
    'You can make the widget INTERACTIVE by adding "linkTo" to table columns, enabling users to navigate between related objects (Miller list style).',
    '',
    widgetContract(resolveWidgetCatalog(input.widgets)),
    '',
    'Concept schema:',
    renderGenericSchema(input.schema),
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

  if (input.viewWidgets?.length) {
    contextParts.push('OTHER WIDGETS OF THE VIEW (their outputs can feed this widget, see WIRING):');
    for (const w of input.viewWidgets) {
      const outputs = w.outputs?.length ? ` — outputs: ${w.outputs.join(', ')}` : '';
      contextParts.push(`  "${w.id}": ${w.type}${w.title ? ` "${w.title}"` : ''}${outputs}`);
    }
    contextParts.push('');
  }

  if (input.viewQueries && Object.keys(input.viewQueries).length > 0) {
    contextParts.push('AVAILABLE QUERIES IN THE VIEW:');
    for (const [key, query] of Object.entries(input.viewQueries)) {
      contextParts.push(`  "${key}": ${query}`);
    }
    contextParts.push('');
  }

  contextParts.push(renderViewActions(input));
  contextParts.push('');
  contextParts.push(linkCandidatesText);
  contextParts.push('');
  if (isGraphSchema(input.schema)) {
    contextParts.push(graphScopeInstructions(input.schema));
    contextParts.push('');
  }
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
