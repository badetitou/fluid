import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../app';
import { chat } from './chat';
import { chatCompletion } from './client';
import { LlmValidationError } from './errors';
import type { ChatInput } from './chatTypes';

vi.mock('./client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./client')>()),
  chatCompletion: vi.fn(),
}));
const completion = vi.mocked(chatCompletion);

const schema = {
  name: 'Character',
  listQuery: 'characters',
  listItemsPath: 'results',
  fields: [
    { name: 'id', typeName: 'ID', typeKind: 'SCALAR', isScalar: true },
    { name: 'name', typeName: 'String', typeKind: 'SCALAR', isScalar: true },
  ],
};
const body = { concept: 'Character', schema, scope: 'graph', prompt: 'list them', config: { provider: 'mock' } };
const openai = { ...body, config: { provider: 'openai', apiKey: 'k' } } as ChatInput;

const goodView = {
  title: 'T',
  queries: { q: { query: '{ characters { results { id } } }' } },
  widgets: [{ id: 'l', type: 'table', data: { query: 'q', path: 'characters.results' }, columns: [{ key: 'id' }] }],
};

describe('POST /api/llm/chat (mock)', () => {
  it('answers with a message and a table view', async () => {
    const app = buildApp({ logLevel: 'silent' });
    const res = await app.inject({ method: 'POST', url: '/api/llm/chat', payload: body });
    expect(res.statusCode).toBe(200);
    const json = res.json();
    expect(json.provider).toBe('mock');
    expect(json.message).toContain('list them');
    expect(json.view.concept).toBe('Character');
    expect(json.view.widgets.map((w: { type: string }) => w.type)).toEqual(['table']);
    expect(json.suggestView).toBe(true);
    await app.close();
  });

  it('rejects an unknown scope with 400', async () => {
    const app = buildApp({ logLevel: 'silent' });
    const res = await app.inject({ method: 'POST', url: '/api/llm/chat', payload: { ...body, scope: 'list' } });
    expect(res.statusCode).toBe(400);
    await app.close();
  });
});

describe('chat (real provider path)', () => {
  beforeEach(() => completion.mockReset());

  it('returns message and finalized view', async () => {
    completion.mockResolvedValueOnce(JSON.stringify({ message: 'Here', view: goodView }));
    const r = await chat(openai);
    expect(r.view?.widgets).toHaveLength(1);
    expect(r.view?.id).toMatch(/^chat-/);
  });

  it('repairs once when the JSON is invalid, then fails with LlmValidationError', async () => {
    completion.mockResolvedValue('nope');
    await expect(chat(openai)).rejects.toBeInstanceOf(LlmValidationError);
    expect(completion).toHaveBeenCalledTimes(2);
  });

  it('drops a view that stays invalid but keeps the message', async () => {
    const bad = JSON.stringify({ message: 'Text', view: { title: 'x', queries: {}, widgets: [{ id: 'a', type: 'zzz' }] } });
    completion.mockResolvedValue(bad);
    const r = await chat(openai);
    expect(r.view).toBeUndefined();
    expect(r.message).toContain('Text');
    expect(r.message).toContain('could not build a valid view');
    expect(completion).toHaveBeenCalledTimes(2);
  });

  it('accepts a repaired view', async () => {
    completion
      .mockResolvedValueOnce(JSON.stringify({ message: 'Text', view: { title: 'x', queries: {}, widgets: [{ id: 'a', type: 'zzz' }] } }))
      .mockResolvedValueOnce(JSON.stringify({ message: 'Fixed', view: goodView }));
    const r = await chat(openai);
    expect(r.message).toBe('Fixed');
    expect(r.view).toBeDefined();
  });
});
