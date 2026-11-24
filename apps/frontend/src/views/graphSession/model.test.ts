import { describe, expect, it } from 'vitest';
import {
  collapseAll,
  emptyGraphSessionState,
  setCollapsedGroup,
  setExpanded,
  setFocus,
  setGroupBy,
  setOverride,
  toggleExpanded,
  type GraphSessionState,
} from './model';

const state = (patch: Partial<GraphSessionState> = {}): GraphSessionState => ({ ...emptyGraphSessionState, ...patch });

describe('graph session model', () => {
  it('starts empty', () => {
    expect(emptyGraphSessionState).toEqual({ expanded: [], collapsedGroups: [] });
  });

  it('toggles expanded keys without mutating the input', () => {
    const before = state({ expanded: ['a'] });
    const opened = toggleExpanded(before, 'b');
    expect(opened.expanded).toEqual(['a', 'b']);
    expect(before.expanded).toEqual(['a']);
    expect(toggleExpanded(opened, 'a').expanded).toEqual(['b']);
  });

  it('sets an expanded key once and stays stable when nothing changes', () => {
    const before = state({ expanded: ['a'] });
    expect(setExpanded(before, 'a', true)).toBe(before);
    expect(setExpanded(before, 'b', false)).toBe(before);
    expect(setExpanded(before, 'b', true).expanded).toEqual(['a', 'b']);
    expect(setExpanded(before, 'a', false).expanded).toEqual([]);
  });

  it('deduplicates keys on every list update', () => {
    const before = state({ expanded: ['a', 'a', 'b'], collapsedGroups: ['g', 'g'] });
    expect(setExpanded(before, 'c', true).expanded).toEqual(['a', 'b', 'c']);
    expect(setExpanded(before, 'a', true).expanded).toEqual(['a', 'b']);
    expect(setCollapsedGroup(before, 'g', true).collapsedGroups).toEqual(['g']);
    expect(setCollapsedGroup(state({ collapsedGroups: ['g'] }), 'g', true).collapsedGroups).toEqual(['g']);
    expect(setCollapsedGroup(before, 'h', true).collapsedGroups).toEqual(['g', 'h']);
    expect(setCollapsedGroup(before, 'g', false).collapsedGroups).toEqual([]);
  });

  it('collapses all given keys, keeping the other ones', () => {
    const before = state({ expanded: ['a', 'b', 'c'] });
    expect(collapseAll(before, ['a', 'c']).expanded).toEqual(['b']);
    expect(collapseAll(before, ['z'])).toBe(before);
    expect(collapseAll(before, [])).toBe(before);
    expect(before.expanded).toEqual(['a', 'b', 'c']);
  });

  it('sets groupBy and focus, clearing them with undefined', () => {
    const before = state();
    const grouped = setGroupBy(before, 'kind');
    expect(grouped.groupBy).toBe('kind');
    expect(setGroupBy(grouped, 'kind')).toBe(grouped);
    expect(setGroupBy(grouped, undefined).groupBy).toBeUndefined();

    const focused = setFocus(grouped, 'n1');
    expect(focused.focus).toBe('n1');
    expect(setFocus(focused, 'n1')).toBe(focused);
    expect(setFocus(focused, undefined).focus).toBeUndefined();
  });

  it('sets overrides immutably, stable for an identical value', () => {
    const before = state();
    const one = setOverride(before, 'layout', { zoom: 1 });
    expect(one.overrides).toEqual({ layout: { zoom: 1 } });
    expect(before.overrides).toBeUndefined();
    const value = { zoom: 2 };
    const two = setOverride(one, 'layout', value);
    expect(setOverride(two, 'layout', value)).toBe(two);
    expect(setOverride(two, 'color', 'red').overrides).toEqual({ layout: value, color: 'red' });
  });

  it('preserves the other fields on every update', () => {
    const before = state({ groupBy: 'kind', focus: 'n1', overrides: { color: 'red' } });
    expect(toggleExpanded(before, 'a')).toMatchObject({ groupBy: 'kind', focus: 'n1', overrides: { color: 'red' } });
  });
});
