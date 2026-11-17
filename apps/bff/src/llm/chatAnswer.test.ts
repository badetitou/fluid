import { describe, expect, it } from 'vitest';
import { resolveWidgetCatalog } from '@fluid/shared';
import { validateChatAnswer } from './chatAnswer';

const catalog = resolveWidgetCatalog(undefined);
const view = {
  title: 'Characters',
  queries: { q: { query: '{ characters { id name } }' } },
  widgets: [
    {
      id: 'list',
      type: 'table',
      data: { query: 'q', path: 'characters' },
      columns: [{ key: 'name', title: 'Name' }],
    },
  ],
};

describe('validateChatAnswer', () => {
  it('accepts a text-only answer', () => {
    const r = validateChatAnswer('{"message":"Hello","suggestView":true}', catalog);
    expect(r).toEqual({ ok: true, message: 'Hello', suggestView: true });
  });

  it('accepts an answer with a valid view', () => {
    const r = validateChatAnswer(JSON.stringify({ message: 'Here', view }), catalog);
    expect(r.ok && r.draft?.widgets).toHaveLength(1);
  });

  it('rejects invalid JSON without a message to keep', () => {
    const r = validateChatAnswer('not json', catalog);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.message).toBeUndefined();
  });

  it('rejects a missing message', () => {
    expect(validateChatAnswer('{"view":{}}', catalog).ok).toBe(false);
  });

  it('keeps the message when only the view is invalid', () => {
    const bad = { ...view, widgets: [{ id: 'x', type: 'nope', data: { query: 'q' } }] };
    const r = validateChatAnswer(JSON.stringify({ message: 'Text', view: bad }), catalog);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.message).toBe('Text');
    expect(!r.ok && r.errorText).toContain('"view"');
  });
});
