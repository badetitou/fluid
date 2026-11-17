import { describe, expect, it } from 'vitest';
import type { ViewSpec } from '@fluid/shared';
import {
  addAssistantTurn,
  addUserTurn,
  beginTurn,
  buildHistory,
  effectiveScope,
  emptyConversation,
  emptyEntry,
  idleEntry,
  lastUserPrompt,
  resetConversation,
  settleTurn,
  switchScope,
  viewContext,
} from './chatModel';

const view = {
  id: 'v',
  concept: 'Character',
  title: 'Characters',
  queries: { q: { query: '{ characters { id } }' } },
  widgets: [
    { id: 'w1', type: 'table', title: 'All' },
    { id: 'w2', type: 'stat' },
  ],
} as unknown as ViewSpec;

describe('chat conversation', () => {
  it('appends turns with growing ids', () => {
    const c = addAssistantTurn(addUserTurn(emptyConversation(), 'hi'), { message: 'hello' });
    expect(c.turns.map((t) => t.id)).toEqual([1, 2]);
  });

  it('summarizes an answer with the widgets it showed, and skips notices', () => {
    let c = addUserTurn(emptyConversation(), 'list them');
    c = addAssistantTurn(c, { message: 'Here', view });
    c = switchScope(c, 'view');
    c = addAssistantTurn(c, { message: 'Plain' });
    expect(buildHistory(c.turns)).toEqual([
      { role: 'user', content: 'list them' },
      { role: 'assistant', content: 'Here\n\n(Shown with: table "All", stat.)' },
      { role: 'assistant', content: 'Plain' },
    ]);
  });

  it('switches scope with a notice, once', () => {
    const c = switchScope(emptyConversation(), 'view');
    expect(c.scope).toBe('view');
    expect(c.turns).toHaveLength(1);
    expect(switchScope(c, 'view')).toBe(c);
  });

  it('resets but keeps the scope, and bumps the epoch', () => {
    const c = resetConversation(addUserTurn(emptyConversation('view'), 'x'));
    expect(c).toEqual({ scope: 'view', turns: [], nextId: 1, epoch: 1 });
  });

  it('finds a prompt awaiting its answer', () => {
    const c = addUserTurn(emptyConversation(), 'q');
    expect(lastUserPrompt(c.turns)).toBe('q');
    expect(lastUserPrompt(addAssistantTurn(c, { message: 'a' }).turns)).toBeUndefined();
  });

  it('falls back to the graph without a view', () => {
    expect(effectiveScope('view', false)).toBe('graph');
    expect(effectiveScope('view', true)).toBe('view');
  });

  it('describes the view structure', () => {
    expect(viewContext(view)).toEqual({
      title: 'Characters',
      queries: ['{ characters { id } }'],
      widgets: [
        { id: 'w1', type: 'table', title: 'All' },
        { id: 'w2', type: 'stat', title: undefined },
      ],
    });
  });

  it('compares a scope switch with the scope in effect', () => {
    const stored = emptyConversation('view');
    expect(switchScope(stored, 'graph', false)).toBe(stored);
    expect(switchScope(stored, 'graph', true).scope).toBe('graph');
  });

  it('leaves a prompt that got no answer out of the history', () => {
    let c = addUserTurn(emptyConversation(), 'failed');
    c = addUserTurn(c, 'again');
    c = addAssistantTurn(c, { message: 'ok' });
    expect(buildHistory(c.turns)).toEqual([
      { role: 'user', content: 'again' },
      { role: 'assistant', content: 'ok' },
    ]);
  });

  it('settles a turn, and drops one asked before a reset or a scope switch', () => {
    const asked = beginTurn(emptyEntry(), 'q');
    expect(asked.pending).toBe(true);
    const answer = { answer: { message: 'a' } };
    const done = settleTurn(asked, 0, answer);
    expect(done.pending).toBe(false);
    expect(done.conversation.turns.map((t) => t.role)).toEqual(['user', 'assistant']);

    const reset = idleEntry(resetConversation(asked.conversation));
    expect(settleTurn(reset, 0, answer)).toBe(reset);
    const switched = idleEntry(switchScope(asked.conversation, 'view'));
    expect(settleTurn(switched, 0, { error: 'x' })).toBe(switched);
  });

  it('keeps the error of a failed turn, then clears it on retry', () => {
    const failed = settleTurn(beginTurn(emptyEntry(), 'q'), 0, { error: 'boom' });
    expect(failed).toMatchObject({ pending: false, error: 'boom' });
    expect(failed.conversation.turns).toHaveLength(1);
    expect(beginTurn(failed)).toMatchObject({ pending: true, error: null });
  });
});
