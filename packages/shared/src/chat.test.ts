import { describe, expect, it } from 'vitest';
import { chatAnswerSchema, chatResponseSchema, chatScopeSchema, chatViewContextSchema } from './chat';

describe('chat contract', () => {
  it('accepts the two scopes only', () => {
    expect(chatScopeSchema.safeParse('graph').success).toBe(true);
    expect(chatScopeSchema.safeParse('view').success).toBe(true);
    expect(chatScopeSchema.safeParse('list').success).toBe(false);
  });

  it('parses a view context', () => {
    const ok = chatViewContextSchema.safeParse({
      title: 'Characters',
      queries: ['query { characters { id } }'],
      widgets: [{ id: 'list', type: 'table' }],
    });
    expect(ok.success).toBe(true);
    expect(chatViewContextSchema.safeParse({ queries: 'x', widgets: [] }).success).toBe(false);
  });

  it('parses a response with and without a view', () => {
    const base = { message: 'Hi', provider: 'mock', model: 'mock' };
    expect(chatResponseSchema.safeParse(base).success).toBe(true);
    expect(
      chatResponseSchema.safeParse({
        ...base,
        suggestView: true,
        view: { version: 1, id: 'v', concept: 'Character', title: 'T', queries: {}, widgets: [] },
      }).success,
    ).toBe(true);
    expect(chatResponseSchema.safeParse({ ...base, view: { nope: 1 } }).success).toBe(false);
  });

  it('requires a non-empty message in the LLM answer', () => {
    expect(chatAnswerSchema.safeParse({ message: '' }).success).toBe(false);
    expect(chatAnswerSchema.safeParse({ message: 'ok', view: { any: 1 } }).success).toBe(true);
  });
});
