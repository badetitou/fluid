import { renderActionsSection, renderPortDocs, renderWidgetDocs, resolveWidgetCatalog } from '@fluid/shared';
import type { ChatMessage } from './types';
import type { ChatInput } from './chatTypes';
import { NESTED_DATA_RULES } from './prompt';
import { graphScopeInstructions, isGraphSchema } from './graphScope';
import { renderSchema } from './claudePrompt';

// Prompts of the chat. Same answer for every provider: one JSON object
// `{ message, view?, suggestView? }`; Claude Code wraps it in <chat> tags.

export type ChatFormat = 'json' | 'claude';

const outputFormat = (format: ChatFormat) =>
  [
    format === 'claude'
      ? 'Answer with a short <reasoning> list (3 bullets max, "- ..."), then ONE JSON object inside <chat>...</chat> tags, nothing else.'
      : 'Answer with ONE JSON object only: no markdown fences, no comments, no prose around it.',
    'The JSON object has this shape:',
    '{',
    '  "message": string,        // markdown, SHORT (a few sentences): the answer, or the lead-in to the view',
    '  "view"?: { "title": string, "description"?: string, "queries": { "<key>": { "query": "<GraphQL document>", "variables"?: {} } }, "widgets": [ Widget, ... ] },',
    '  "suggestView"?: boolean   // true when the conversation explores a topic worth a dedicated view/dashboard',
    '}',
  ].join('\n');

const behaviour = [
  'You are the chat assistant of Fluid, a web app that explores a GraphQL API like a Smalltalk inspector.',
  'There are two scopes:',
  '- "graph": the conversation is about the whole connected GraphQL API (its concepts, relations, entry points, data).',
  '- "view": the conversation is about the view currently shown in a column (its queries and widgets).',
  'IMPORTANT: you CANNOT see query results. To answer any question about data, write GraphQL queries and show them as widgets in "view": Fluid runs them and renders the result inline.',
  'So whenever data is involved, PREFER a widget answer (a statistic, a table, a chart) over prose; keep "message" short.',
  'Questions that need no data (how the schema is organised, what a field means) are answered in "message" alone, without "view".',
  'Set "suggestView": true when the conversation explores a topic that deserves a dedicated, richer view.',
  'The inline "view" must stay small: one to three widgets. Only select fields that exist in the schema below.',
].join('\n');

/** The column's current view (queries and widgets), for the "view" scope. */
export function renderViewContext(input: Pick<ChatInput, 'view' | 'item'>): string {
  const { view, item } = input;
  if (!view) return 'Current view: (not provided)';
  return [
    `Current view${view.title ? ` "${view.title}"` : ''}${item ? ` (showing item ${item.id})` : ''}:`,
    'Queries:',
    view.queries.length ? view.queries.map((q) => `  ${q.replace(/\s+/g, ' ').trim()}`).join('\n') : '  (none)',
    'Widgets:',
    view.widgets.length
      ? view.widgets.map((w) => `  - ${w.id}: ${w.type}${w.title ? ` "${w.title}"` : ''}`).join('\n')
      : '  (none)',
  ].join('\n');
}

function system(input: ChatInput, format: ChatFormat): string {
  const widgets = resolveWidgetCatalog(input.widgets);
  return [
    behaviour,
    '',
    outputFormat(format),
    '',
    'Widget types for "view" (use ONLY these types; every widget needs a unique "id" and "data": { "query": "<key of queries>", "path"?: "<dot path>" }):',
    renderWidgetDocs(widgets),
    renderPortDocs(widgets),
    '',
    NESTED_DATA_RULES,
    '',
    `Scope of this conversation: "${input.scope}".`,
    isGraphSchema(input.schema) ? graphScopeInstructions(input.schema) : `Schema:\n${renderSchema(input.schema)}`,
    ...(input.scope === 'view' ? ['', renderViewContext(input)] : []),
    '',
    'ACTIONS (do not create actions in chat answers):',
    renderActionsSection(input.schema.mutations),
  ].join('\n');
}

export function buildChatMessages(input: ChatInput, format: ChatFormat = 'json'): ChatMessage[] {
  const messages: ChatMessage[] = [{ role: 'system', content: system(input, format) }];
  for (const m of input.history ?? []) {
    if (m.role === 'user' || m.role === 'assistant') messages.push(m);
  }
  messages.push({ role: 'user', content: input.prompt });
  return messages;
}

export function buildChatRepairMessage(errorText: string, format: ChatFormat = 'json'): ChatMessage {
  return {
    role: 'user',
    content: [
      'Your previous answer did not validate against the chat contract. Validation errors:',
      errorText,
      '',
      format === 'claude'
        ? 'Answer again with the same <reasoning> and <chat> format.'
        : 'Return the corrected JSON object only.',
    ].join('\n'),
  };
}
