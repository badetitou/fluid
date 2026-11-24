import { renderActionsSection, renderPortDocs, renderWidgetDocs, resolveWidgetCatalog, VIEW_DRAFT_TYPES_DOC, type WidgetContract } from '..';

import type { ChatMessage, GenerateViewInput } from './types';

import { detectLinkCandidates, formatLinkCandidatesForPrompt } from './linkDetection';

import { NESTED_DATA_RULES, QUESTION_RULES, renderGenericSchema, scopeInstructions } from './promptRules';

import { isGraphSchema } from './graphScope';

const contract = (widgets: WidgetContract[]) => `You output a response with TWO SECTIONS:

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
  "actions"?: { "<key>": Action },   // mutations the widgets may run (see ACTIONS below)
  "widgets": [ Widget, ... ]
}

Each Widget is one of these discriminated shapes (field "type"); use ONLY these types:
${renderWidgetDocs(widgets)}
${renderPortDocs(widgets)}

${VIEW_DRAFT_TYPES_DOC}

Rules:
- Every widget.data.query MUST reference a key defined in "queries".
- GraphQL selections may ONLY use fields listed in the concept schema below (including the reachable relations, through nested selections). Prefer the concept's list query.
- Row limit: when the list query has one, pass it through a variable named exactly $take, never as a literal, whatever the argument is called (take, first, limit…): "query($take: Int) { orders(take: $take) { … } }" or "items(first: $take)", with "variables": { "take": 200 }. fluid sets $take from the source settings and loads more rows on demand. For a "top N", keep $take and use transform sort/limit.
- "path" is the dot path from the query result to the array/object (usually the list query field name).
- NESTED DATA (multi-level):
${NESTED_DATA_RULES.replace(/^/gm, '  ')}
- QUESTIONS:
${QUESTION_RULES.replace(/^/gm, '  ')}
- WIDGET TYPE SELECTION (CRITICAL - read user request carefully):
  * If request mentions "table", "list", "all items", "multiple", or "show all" → CREATE TABLE WIDGET with list query
  * If request mentions "detail", "single item", "this", "show relationships" → CREATE DESCRIPTIONS widget
  * If request asks for "links" or "clickable" → add linkTo to TABLE columns (not descriptions)
  * When in doubt, default to TABLE (lists with links are more useful for navigation)
- Build a DASHBOARD from the available widget types: a couple of statistics, one table, and one or two charts when charts are available. Minimal descriptive text (for a question, focus on the answer instead).
- **ALWAYS ADD NAVIGATION LINKS (linkTo) - THIS IS ESSENTIAL FOR MILLER LIST INTERACTION**:
  * For TABLE widgets: EVERY column that displays an ID or represents a relationship MUST have linkTo
  * Example: A "customers" table MUST have linkTo on the "id" column: { "concept": "Customer" }
  * For columns referencing related entities: use nested idField like "customer.id" to point to the ID
  * Use simple "linkTo": { "concept": "ConceptName" } for direct IDs
  * Use "linkTo": { "concept": "ConceptName", "idField": "field.path.to.id" } for nested relationships
  * THIS IS CRUCIAL: Adding linkTo makes columns clickable and enables users to navigate between related objects
  * Miller list navigation (split-view columns) is ONLY possible when you include linkTo in table columns
- Use double quotes everywhere. Output valid JSON and nothing else.`;

export function buildMessages(input: GenerateViewInput): ChatMessage[] {
  const system = [
    'You are Fluid\'s dashboard view generator. Given a GraphQL concept and a user request,',
    'you design a compact, useful dashboard as a JSON view draft.',
    'You can make the dashboard INTERACTIVE by adding "linkTo" to table columns and description items,',
    'enabling users to navigate infinitely between related objects (Miller list style).',
    '',
    contract(resolveWidgetCatalog(input.widgets)),
    '',
    'Concept schema:',
    renderGenericSchema(input.schema),
    '',
    'ACTIONS:',
    renderActionsSection(input.schema.mutations),
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
      isGraphSchema(input.schema)
        ? 'Create a dashboard view across the whole graph.'
        : `Create a dashboard view for the "${input.concept}" concept.`,
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
