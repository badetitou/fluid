import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AnalyzeViewRequest, ChatInput } from '@fluid/shared';

const browserComplete = vi.hoisted(() => vi.fn<(...args: unknown[]) => Promise<string>>());
vi.mock('./browserEngine', () => ({ browserComplete }));

import { analyzeViewBrowser, chatBrowser, generateViewBrowser, generateWidgetBrowser } from './browserFlows';

const schema = {
  name: 'Character',
  listQuery: 'characters',
  fields: [
    { name: 'id', typeName: 'ID', typeKind: 'SCALAR', isScalar: true },
    { name: 'name', typeName: 'String', typeKind: 'SCALAR', isScalar: true },
  ],
};
const draft = {
  title: 'Characters',
  queries: { q: { query: '{ characters { id name } }' } },
  widgets: [
    { id: 'list', type: 'table', data: { query: 'q', path: 'characters' }, columns: [{ key: 'id' }] },
  ],
};
const widgetDraft = {
  type: 'table',
  data: { query: 'q', path: 'characters' },
  columns: [{ key: 'id' }],
};
const insight: AnalyzeViewRequest = {
  view: { title: 'Characters', concept: 'Character' },
  sources: [{ id: 'list', type: 'table', data: [{ id: '1' }, { id: '2' }] }],
};
const analysis = {
  verdict: 'insights',
  findings: [{ kind: 'gap', severity: 'notable', title: 't', detail: 'd' }],
};

beforeEach(() => browserComplete.mockReset());

describe('browser flows', () => {
  it('repairs an invalid view draft once and finalizes the view', async () => {
    browserComplete.mockResolvedValueOnce('not json').mockResolvedValueOnce(JSON.stringify(draft));
    const result = await generateViewBrowser(
      { concept: 'Character', schema, prompt: 'show characters' },
      {},
      'local-model',
    );
    expect(browserComplete).toHaveBeenCalledTimes(2);
    expect(result.spec.id).toMatch(/^gen-/);
    expect(result.provider).toBe('browser');
    expect(JSON.stringify(browserComplete.mock.calls[1]?.[1])).toContain('Your previous output was not a valid view draft');
  });

  it('validates and finalizes a single widget', async () => {
    browserComplete.mockResolvedValueOnce(JSON.stringify(widgetDraft));
    const result = await generateWidgetBrowser(
      { concept: 'Character', schema, prompt: 'add a table' },
      {},
      'local-model',
    );
    expect(result.widget.id).toMatch(/^widget-/);
    expect(result.widget.type).toBe('table');
  });

  it('keeps the chat message but drops a view that stays invalid', async () => {
    browserComplete
      .mockResolvedValueOnce(JSON.stringify({ message: 'Hello', view: { nope: true } }))
      .mockResolvedValueOnce(JSON.stringify({ message: 'Hello' }));
    const input: Omit<ChatInput, 'config' | 'widgets'> = {
      concept: 'Character',
      schema,
      scope: 'graph',
      prompt: 'hi',
    };
    const result = await chatBrowser(input, {}, 'local-model');
    expect(result.message).toContain('could not build a valid view');
    expect(result.view).toBeUndefined();
    expect(result.provider).toBe('browser');
  });

  it('parses a fenced insight answer locally', async () => {
    browserComplete.mockResolvedValueOnce('```json\n' + JSON.stringify(analysis) + '\n```');
    const result = await analyzeViewBrowser(insight, 'local-model');
    expect(result.verdict).toBe('insights');
    expect(result.findings).toHaveLength(1);
  });
});
