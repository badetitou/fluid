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
  /** Id of the next turn. */
  nextId: number;
  /** Bumped by a reset or a scope switch: an answer asked under another epoch is dropped. */
  epoch: number;
}

/** A column concept's chat: its conversation and the turn in flight. */
export interface ChatEntry {
  conversation: Conversation;
  pending: boolean;
  error: string | null;
}

export const emptyConversation = (scope: ChatScope = 'graph'): Conversation => ({ scope, turns: [], nextId: 1, epoch: 0 });
export const emptyEntry = (): ChatEntry => ({ conversation: emptyConversation(), pending: false, error: null });

type NewTurn = ChatTurn extends infer T ? (T extends ChatTurn ? Omit<T, 'id'> : never) : never;

const append = (c: Conversation, turn: NewTurn): Conversation => ({
  ...c,
  turns: [...c.turns, { ...turn, id: c.nextId } as ChatTurn],
  nextId: c.nextId + 1,
});

export const addUserTurn = (c: Conversation, text: string): Conversation => append(c, { role: 'user', text });

export function addAssistantTurn(
  c: Conversation,
  answer: { message: string; view?: ViewSpec; suggestView?: boolean },
): Conversation {
  const { message, view, suggestView } = answer;
  return append(c, { role: 'assistant', text: message, view, suggestView });
}

/** The scope to use: "view" needs a view in the column. */
export const effectiveScope = (scope: ChatScope, hasView: boolean): ChatScope => (scope === 'view' && !hasView ? 'graph' : scope);

/** Starts over, keeping the scope. */
export const resetConversation = (c: Conversation): Conversation => ({ ...emptyConversation(c.scope), epoch: c.epoch + 1 });

/** Moves the talk to another scope, with a notice where it changed; nothing when it is the scope already in effect. */
export function switchScope(c: Conversation, scope: ChatScope, hasView = true): Conversation {
  if (effectiveScope(c.scope, hasView) === scope) return c;
  const text = scope === 'view' ? 'Now talking about this view.' : 'Now talking about the whole graph.';
  return { ...append(c, { role: 'notice', text }), scope, epoch: c.epoch + 1 };
}

/** A prompt is sent: it joins the conversation (unless it is the retry of the last one) and a turn is in flight. */
export function beginTurn(e: ChatEntry, prompt?: string): ChatEntry {
  return { conversation: prompt === undefined ? e.conversation : addUserTurn(e.conversation, prompt), pending: true, error: null };
}

export type TurnOutcome = { answer: { message: string; view?: ViewSpec; suggestView?: boolean } } | { error: string };

/** The turn asked under `epoch` is over; if the conversation was reset or switched meanwhile, it is dropped. */
export function settleTurn(e: ChatEntry, epoch: number, outcome: TurnOutcome): ChatEntry {
  if (e.conversation.epoch !== epoch) return e;
  if ('error' in outcome) return { ...e, pending: false, error: outcome.error };
  return { conversation: addAssistantTurn(e.conversation, outcome.answer), pending: false, error: null };
}

/** The entry after a reset or a scope switch (both bump the epoch, which orphans a turn in flight). */
export const idleEntry = (conversation: Conversation): ChatEntry => ({ conversation, pending: false, error: null });

/**
 * What the model gets of the earlier turns: an answer is its text plus a mention
 * of the widgets it showed. A prompt that got no answer (a failed turn) is left out.
 */
export function buildHistory(turns: ChatTurn[]): ChatMessage[] {
  const talk = turns.filter((t) => t.role !== 'notice');
  return talk.flatMap((t, i): ChatMessage[] => {
    if (t.role === 'user') return talk[i + 1]?.role === 'assistant' ? [{ role: 'user', content: t.text }] : [];
    if (t.role !== 'assistant') return [];
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
