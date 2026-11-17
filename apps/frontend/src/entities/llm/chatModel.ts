import type { ChatScope, ChatViewContext, ViewSpec } from '@fluid/shared';
import type { ChatMessage } from '../../bff/client';

/** One entry of the conversation, as shown. A notice is local (a scope switch): never sent. */
export type ChatTurn =
  | { id: number; role: 'user'; text: string }
  | { id: number; role: 'assistant'; text: string; view?: ViewSpec; suggestView?: boolean }
  | { id: number; role: 'notice'; text: string };

export interface Conversation {
  scope: ChatScope;
  turns: ChatTurn[];
}

export const emptyConversation = (scope: ChatScope = 'graph'): Conversation => ({ scope, turns: [] });

const nextId = (turns: ChatTurn[]) => (turns.length === 0 ? 1 : Math.max(...turns.map((t) => t.id)) + 1);

export function addUserTurn(c: Conversation, text: string): Conversation {
  return { ...c, turns: [...c.turns, { id: nextId(c.turns), role: 'user', text }] };
}

export function addAssistantTurn(
  c: Conversation,
  answer: { message: string; view?: ViewSpec; suggestView?: boolean },
): Conversation {
  const { message, view, suggestView } = answer;
  return { ...c, turns: [...c.turns, { id: nextId(c.turns), role: 'assistant', text: message, view, suggestView }] };
}

/** Starts over, keeping the scope. */
export const resetConversation = (c: Conversation): Conversation => emptyConversation(c.scope);

/** Moves the talk to another scope; the conversation stays, with a notice where it changed. */
export function switchScope(c: Conversation, scope: ChatScope): Conversation {
  if (c.scope === scope) return c;
  const text = scope === 'view' ? 'Now talking about this view.' : 'Now talking about the whole graph.';
  return { scope, turns: [...c.turns, { id: nextId(c.turns), role: 'notice', text }] };
}

/** The scope to use: "view" needs a view in the column. */
export const effectiveScope = (scope: ChatScope, hasView: boolean): ChatScope => (scope === 'view' && !hasView ? 'graph' : scope);

/** What the model gets of the earlier turns: an answer is its text plus a mention of the widgets it showed. */
export function buildHistory(turns: ChatTurn[]): ChatMessage[] {
  return turns.flatMap((t): ChatMessage[] => {
    if (t.role === 'notice') return [];
    if (t.role === 'user') return [{ role: 'user', content: t.text }];
    const widgets = t.view?.widgets ?? [];
    if (widgets.length === 0) return [{ role: 'assistant', content: t.text }];
    const shown = widgets.map((w) => (w.title ? `${w.type} "${w.title}"` : w.type)).join(', ');
    return [{ role: 'assistant', content: `${t.text}\n\n(Shown with: ${shown}.)` }];
  });
}

/** The prompt still waiting for an answer (the conversation ends on it), if any. */
export function lastUserPrompt(turns: ChatTurn[]): string | undefined {
  const last = turns[turns.length - 1];
  return last?.role === 'user' ? last.text : undefined;
}

/** The structure of a column's view, as the chat sees it. */
export function viewContext(spec: ViewSpec): ChatViewContext {
  return {
    title: spec.title,
    queries: Object.values(spec.queries).map((q) => q.query),
    widgets: spec.widgets.map((w) => ({ id: w.id, type: w.type, title: w.title })),
  };
}
