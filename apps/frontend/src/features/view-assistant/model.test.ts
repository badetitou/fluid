import { describe, expect, it } from 'vitest';
import type { ViewSpec } from '@fluid/shared';
import type { AssistantTurn } from '../../store';
import {
  appendDelta,
  buildHistory,
  refinedFrom,
  sessionKeyOf,
  specsByVersion,
  summarizeSpec,
  versionLabel,
  versionTurns,
} from './model';

const spec = (id: string, widgets: ViewSpec['widgets'] = []): ViewSpec => ({
  version: 1,
  id,
  concept: 'Account',
  title: id,
  queries: {},
  widgets,
});

const turn = (id: string, extra: Partial<AssistantTurn> = {}): AssistantTurn => ({
  id,
  prompt: `prompt ${id}`,
  at: 0,
  basedOn: null,
  ...extra,
});

const turns = [
  turn('a', { spec: spec('A') }),
  turn('err', { error: 'boom' }),
  turn('b', { spec: spec('B'), basedOn: 1 }),
  turn('c', { spec: spec('C'), basedOn: 1 }),
];

describe('sessionKeyOf', () => {
  it('keys new and edited views apart', () => {
    expect(sessionKeyOf('Account', 'list', undefined)).toBe('Account|list|new');
    expect(sessionKeyOf('Account', undefined, 'v1')).toBe('Account||v1');
    expect(sessionKeyOf('Account', 'list', undefined, true)).toBe('Account|list|new:chat');
  });
});

describe('versionTurns / specsByVersion', () => {
  it('numbers successful turns only', () => {
    expect([...versionTurns(turns)]).toEqual([
      ['a', 1],
      ['b', 2],
      ['c', 3],
    ]);
  });

  it('maps versions to specs with the saved view as v0', () => {
    const map = specsByVersion(turns, versionTurns(turns), spec('saved'));
    expect([...map.keys()]).toEqual([0, 1, 2, 3]);
    expect(map.get(2)?.id).toBe('B');
  });
});

describe('buildHistory', () => {
  it('replays exchanges up to the base version', () => {
    const history = buildHistory(turns, versionTurns(turns), 2);
    expect(history.map((m) => m.content)).toEqual([
      'prompt a',
      JSON.stringify(spec('A')),
      'prompt b',
      JSON.stringify(spec('B')),
    ]);
  });

  it('starts with the saved view when refining one', () => {
    const history = buildHistory([], new Map(), 0, spec('saved'));
    expect(history).toHaveLength(2);
    expect(history[1]).toEqual({ role: 'assistant', content: JSON.stringify(spec('saved')) });
  });
});

describe('labels', () => {
  it('summarizes widgets', () => {
    expect(summarizeSpec(spec('x'))).toBe('No widget');
    const widgets = [{ id: 'w', type: 'pie', title: 'Split' }, { id: 'v', type: 'table' }] as unknown as ViewSpec['widgets'];
    expect(summarizeSpec(spec('x', widgets))).toBe('pie “Split” · table');
  });

  it('names versions', () => {
    expect(versionLabel(0)).toBe('saved view');
    expect(versionLabel(3)).toBe('v3');
  });

  it('flags turns that did not refine the previous version', () => {
    expect(refinedFrom(turns[2], 2)).toBeNull();
    expect(refinedFrom(turns[3], 3)).toBe(1);
  });
});

describe('appendDelta', () => {
  it('accumulates thinking and text separately', () => {
    const live = appendDelta(appendDelta(null, { kind: 'thinking', text: 'hm' }), { kind: 'text', text: '{' });
    expect(live).toEqual({ thinking: 'hm', text: '{' });
  });
});
