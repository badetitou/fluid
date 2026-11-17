import { describe, expect, it } from 'vitest';
import type { ViewSpec } from '@fluid/shared';
import type { ChatTurn } from './chatModel';
import { buildViewSeed, canBuildView, capHistory } from './viewSeed';

const view = {
  id: 'v',
  concept: 'Character',
  title: 'Alive',
  queries: { q: { query: '{ characters { results { name } } }' } },
  widgets: [{ id: 'w', type: 'table', title: 'Names', query: 'q' }],
} as unknown as ViewSpec;

const turns: ChatTurn[] = [
  { id: 1, role: 'user', text: 'who is alive?' },
  { id: 2, role: 'assistant', text: 'Some.', view },
  { id: 3, role: 'notice', text: 'Now talking about this view.' },
  { id: 4, role: 'user', text: 'and dead?' },
];

describe('buildViewSeed', () => {
  it('describes the views shown and leaves notices and unanswered prompts out', () => {
    const { history, prompt } = buildViewSeed(turns);
    expect(history).toHaveLength(2);
    expect(history[1]!.content).toContain('characters { results { name } }');
    expect(history[1]!.content).toContain('"Names"');
    expect(prompt).toMatch(/^Build a view/);
  });

  it('appends the extra instruction', () => {
    expect(buildViewSeed(turns, { extra: ' as a pie ' }).prompt).toMatch(/\n\nas a pie$/);
  });

  it('knows when there is an answer', () => {
    expect(canBuildView(turns)).toBe(true);
    expect(canBuildView(turns.slice(0, 1))).toBe(false);
  });
});

describe('capHistory', () => {
  const msg = (i: number) => [
    { role: 'user' as const, content: `q${i}`.padEnd(100, 'x') },
    { role: 'assistant' as const, content: `a${i}`.padEnd(100, 'x') },
  ];

  it('keeps a short conversation whole', () => {
    const all = [...msg(1), ...msg(2)];
    expect(capHistory(all, 1000)).toEqual(all);
  });

  it('keeps the first message and the latest turns, summarising the middle', () => {
    const all = [1, 2, 3, 4, 5, 6].flatMap(msg);
    const out = capHistory(all, 500);
    expect(out[0]).toEqual(all[0]);
    expect(out[1]!.content).toMatch(/^\(\d+ earlier messages? omitted\)$/);
    expect(out[2]!.role).toBe('user');
    expect(out[out.length - 1]).toEqual(all[all.length - 1]);
    expect(out.reduce((n, m) => n + m.content.length, 0)).toBeLessThanOrEqual(500 + 60);
  });
});
