import { describe, expect, it } from 'vitest';
import type { ViewSpec } from '@fluid/shared';
import {
  addAssistantTurn,
  addUserTurn,
  buildHistory,
  effectiveScope,
  emptyConversation,
  lastUserPrompt,
  resetConversation,
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

  it('resets but keeps the scope', () => {
    const c = resetConversation(addUserTurn(emptyConversation('view'), 'x'));
    expect(c).toEqual({ scope: 'view', turns: [] });
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
});
