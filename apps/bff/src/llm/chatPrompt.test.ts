import { describe, expect, it } from 'vitest';
import { buildChatMessages, buildChatRepairMessage } from './chatPrompt';
import type { ChatInput } from './chatTypes';

const input: ChatInput = {
  concept: 'Character',
  scope: 'view',
  prompt: 'Who is alive?',
  schema: {
    name: 'Character',
    listQuery: 'characters',
    fields: [{ name: 'id', typeName: 'ID', typeKind: 'SCALAR', isScalar: true }],
  },
  view: {
    title: 'Characters',
    queries: ['query { characters { id } }'],
    widgets: [{ id: 'list', type: 'table', title: 'All' }],
  },
  history: [
    { role: 'system', content: 'ignored' },
    { role: 'user', content: 'hi' },
    { role: 'assistant', content: 'hello' },
  ],
};

describe('buildChatMessages', () => {
  it('builds system + history (no system) + prompt', () => {
    const messages = buildChatMessages(input);
    expect(messages.map((m) => m.role)).toEqual(['system', 'user', 'assistant', 'user']);
    expect(messages.at(-1)?.content).toBe('Who is alive?');
  });

  it('documents widgets through the catalog and explains the scopes', () => {
    const system = buildChatMessages(input)[0].content;
    expect(system).toContain('"graph"');
    expect(system).toContain('CANNOT see query results');
    expect(system).toContain('"table"');
  });

  it('lists the current view in the view scope only', () => {
    expect(buildChatMessages(input)[0].content).toContain('characters { id }');
    const graph = buildChatMessages({ ...input, scope: 'graph' })[0].content;
    expect(graph).not.toContain('Current view');
  });

  it('uses entry points for a whole-graph schema', () => {
    const graph: ChatInput = {
      ...input,
      scope: 'graph',
      concept: '@graph',
      schema: { name: '@graph', fields: [], entryPoints: [{ concept: 'Episode', listQuery: 'episodes', fields: ['id: ID'] }] },
    };
    expect(buildChatMessages(graph)[0].content).toContain('Episode: list: episodes');
  });

  it('asks for tags with Claude and a repair message carries the errors', () => {
    expect(buildChatMessages(input, 'claude')[0].content).toContain('<chat>');
    expect(buildChatRepairMessage('boom').content).toContain('boom');
  });
});
