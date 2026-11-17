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
/** Characters kept of one message (a shown view's JSON included). */
export const MESSAGE_MAX = 3000;
const VIEW_MAX = 2000;

const INSTRUCTION =
  'Build a view (or dashboard) that gathers what this conversation explored: ' +
  'reuse the queries that worked and show the findings with fitting widgets.';

/** A view as the generator needs it: its queries (they already worked) and widgets, compact. */
export const describeView = (spec: ViewSpec): string =>
  shorten(JSON.stringify({ title: spec.title, queries: spec.queries, widgets: spec.widgets }), VIEW_MAX);

/** The turns of the talk as messages; an answer that showed a view carries its queries and widgets. */
export function conversationMessages(turns: ChatTurn[]): ChatMessage[] {
  const talk = turns.filter((t) => t.role !== 'notice');
  return talk.flatMap((t, i): ChatMessage[] => {
    if (t.role === 'user') return talk[i + 1]?.role === 'assistant' ? [{ role: 'user', content: t.text }] : [];
    if (t.role !== 'assistant') return [];
    return [{ role: 'assistant', content: t.view ? `${t.text}\n\n(View shown: ${describeView(t.view)})` : t.text }];
  });
}

const NOTE_ROOM = 60;
const shorten = (text: string, max: number) => (text.length <= max ? text : `${text.slice(0, max - 1)}…`);
const size = (m: ChatMessage) => m.content.length;

/**
 * Fits a conversation in `budget` characters: every message is shortened to
 * `MESSAGE_MAX`, then the first message and the latest ones are kept (always
 * the last exchange); the middle becomes a note saying how many were left out.
 */
export function capHistory(messages: ChatMessage[], budget = HISTORY_BUDGET): ChatMessage[] {
  const max = Math.min(MESSAGE_MAX, Math.floor(budget / 4));
  const msgs = messages.map((m) => (size(m) > max ? { ...m, content: shorten(m.content, max) } : m));
  if (msgs.reduce((n, m) => n + size(m), 0) <= budget || msgs.length <= 3) return msgs;
  const n = msgs.length;
  let start = n - 2;
  let left = budget - NOTE_ROOM - size(msgs[0]!) - size(msgs[n - 2]!) - size(msgs[n - 1]!);
  while (start > 1 && left - size(msgs[start - 1]!) >= 0) {
    left -= size(msgs[start - 1]!);
    start--;
  }
  // The tail starts on a user message, as the generator expects.
  while (start < n - 2 && msgs[start]!.role !== 'user') start++;
  const omitted = start - 1;
  if (omitted <= 0) return msgs;
  const note: ChatMessage = { role: 'assistant', content: `(${omitted} earlier message${omitted > 1 ? 's' : ''} omitted)` };
  return [msgs[0]!, note, ...msgs.slice(start)];
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
