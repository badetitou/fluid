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

  it('passes asDashboard through and keeps an answer without view as is', () => {
    const seed = buildViewSeed(turns.slice(0, 1).concat({ id: 5, role: 'assistant', text: 'Plain.' }), { asDashboard: true });
    expect(seed.asDashboard).toBe(true);
    expect(seed.history[1]).toEqual({ role: 'assistant', content: 'Plain.' });
  });

  it('appends the extra instruction', () => {
    expect(buildViewSeed(turns, { extra: ' as a pie ' }).prompt).toMatch(/\n\nas a pie$/);
  });

  it('knows when there is an answer', () => {
    expect(canBuildView(turns)).toBe(true);
    expect(canBuildView(turns.slice(0, 1))).toBe(false);
  });
});

const total = (ms: { content: string }[]) => ms.reduce((n, m) => n + m.content.length, 0);

describe('capHistory', () => {
  const msg = (i: number) => [
    { role: 'user' as const, content: `q${i}`.padEnd(100, 'x') },
    { role: 'assistant' as const, content: `a${i}`.padEnd(100, 'x') },
  ];

  it('keeps a short conversation whole', () => {
    const all = [...msg(1), ...msg(2)];
    expect(capHistory(all, 1000)).toEqual(all);
  });

  it('keeps the first message and the latest turns, counting what the middle left out', () => {
    const all = [1, 2, 3, 4, 5, 6].flatMap(msg); // 12 messages of 100 characters
    const out = capHistory(all, 500);
    expect(out[0]).toEqual(all[0]);
    expect(out[1]).toEqual({ role: 'assistant', content: '(9 earlier messages omitted)' });
    expect(out.slice(2)).toEqual(all.slice(10));
    expect(out[2]!.role).toBe('user');
    expect(total(out)).toBeLessThanOrEqual(500);
  });

  it('says "1 earlier message omitted" in the singular', () => {
    const all = [1, 2, 3].flatMap(msg); // 6 messages
    const out = capHistory(all, 560); // room for the first, the note and the last 4
    expect(out[1]!.content).toBe('(1 earlier message omitted)');
  });

  it('shortens an oversized first message and still keeps the latest exchange', () => {
    const all = [{ role: 'user' as const, content: 'x'.repeat(50_000) }, ...msg(1), ...msg(2), ...msg(3)];
    const out = capHistory(all, 2000);
    expect(out[0]!.content.length).toBeLessThanOrEqual(500);
    expect(out.slice(-2)).toEqual(all.slice(-2));
    expect(total(out)).toBeLessThanOrEqual(2000);
  });

  it('shortens an oversized last answer, keeping its question', () => {
    const all = [...msg(1), ...msg(2), { role: 'user' as const, content: 'last?' }, { role: 'assistant' as const, content: 'y'.repeat(50_000) }];
    const out = capHistory(all, 2000);
    expect(out[out.length - 2]).toEqual({ role: 'user', content: 'last?' });
    expect(out[out.length - 1]!.role).toBe('assistant');
    expect(total(out)).toBeLessThanOrEqual(2000);
    expect(out.map((m) => m.role)).toEqual(out.map((_, i) => (i % 2 === 0 ? 'user' : 'assistant')));
  });

  it('shortens a single huge message', () => {
    const out = capHistory([{ role: 'user', content: 'z'.repeat(50_000) }]);
    expect(out).toHaveLength(1);
    expect(out[0]!.content.length).toBeLessThanOrEqual(3000);
  });
});
