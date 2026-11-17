import type { ViewSpec } from '@fluid/shared';
import type { ChatMessage } from '../../bff/client';
import type { ChatTurn } from './chatModel';

/** What the view assistant starts from when it is opened by the chat: its first prompt and the talk so far. */
export interface ViewSeed {
  prompt: string;
  history: ChatMessage[];
  /** Also list the saved view among the user's dashboards. */
  asDashboard?: boolean;
}

/** Characters kept of the conversation sent to the generator (about 3k tokens). */
export const HISTORY_BUDGET = 12_000;

const INSTRUCTION =
  'Build a view (or dashboard) that gathers what this conversation explored: ' +
  'reuse the queries that worked and show the findings with fitting widgets.';

/** A view as the generator needs it: its queries (they already worked) and widgets, compact. */
export const describeView = (spec: ViewSpec): string =>
  JSON.stringify({ title: spec.title, queries: spec.queries, widgets: spec.widgets });

/** The turns of the talk as messages; an answer that showed a view carries its queries and widgets. */
export function conversationMessages(turns: ChatTurn[]): ChatMessage[] {
  const talk = turns.filter((t) => t.role !== 'notice');
  return talk.flatMap((t, i): ChatMessage[] => {
    if (t.role === 'user') return talk[i + 1]?.role === 'assistant' ? [{ role: 'user', content: t.text }] : [];
    if (t.role !== 'assistant') return [];
    return [{ role: 'assistant', content: t.view ? `${t.text}\n\n(View shown: ${describeView(t.view)})` : t.text }];
  });
}

const size = (m: ChatMessage) => m.content.length;

/**
 * Keeps the first message and the most recent ones within `budget` characters;
 * the middle is replaced by a note saying how many were left out.
 */
export function capHistory(messages: ChatMessage[], budget = HISTORY_BUDGET): ChatMessage[] {
  if (messages.reduce((n, m) => n + size(m), 0) <= budget) return messages;
  const head = messages.slice(0, 1);
  let left = budget - size(head[0]!);
  let start = messages.length;
  while (start > head.length && left - size(messages[start - 1]!) >= 0) {
    left -= size(messages[start - 1]!);
    start--;
  }
  // The tail starts on a user message, as the generator expects.
  while (start < messages.length && messages[start]!.role !== 'user') start++;
  const omitted = start - head.length;
  if (omitted <= 0) return [...head, ...messages.slice(start)];
  const note: ChatMessage = { role: 'assistant', content: `(${omitted} earlier message${omitted > 1 ? 's' : ''} omitted)` };
  return [...head, note, ...messages.slice(start)];
}

/** The generation input for "Build a view from this conversation": instruction (plus the user's own) and capped history. */
export function buildViewSeed(turns: ChatTurn[], options: { extra?: string; asDashboard?: boolean } = {}): ViewSeed {
  const extra = options.extra?.trim();
  return {
    prompt: extra ? `${INSTRUCTION}\n\n${extra}` : INSTRUCTION,
    history: capHistory(conversationMessages(turns)),
    asDashboard: options.asDashboard,
  };
}

/** Whether the conversation has an answer to build a view from. */
export const canBuildView = (turns: ChatTurn[]): boolean => turns.some((t) => t.role === 'assistant');
