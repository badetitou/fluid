import { beforeEach, describe, expect, it } from 'vitest';
import { rememberPick, usePerspectiveMemory } from './perspectiveMemory';

describe('rememberPick', () => {
  it('remembers, replaces and forgets a slot without touching the others', () => {
    const one = rememberPick({}, '1:Character:item', 'detail');
    expect(one).toEqual({ '1:Character:item': 'detail' });
    const two = rememberPick(one, '2:Location:list', 'tree');
    expect(rememberPick(two, '1:Character:item', 'saved')).toEqual({ '1:Character:item': 'saved', '2:Location:list': 'tree' });
    expect(rememberPick(two, '2:Location:list', undefined)).toEqual(one);
  });

  it('keeps the same object when nothing changes', () => {
    const map = { a: 'x' };
    expect(rememberPick(map, 'a', 'x')).toBe(map);
    expect(rememberPick(map, 'b', undefined)).toBe(map);
  });
});

describe('usePerspectiveMemory', () => {
  beforeEach(() => usePerspectiveMemory.setState({ bySlot: {} }));

  it('stores the last pick per slot', () => {
    usePerspectiveMemory.getState().remember('1:Character:item', 'a');
    usePerspectiveMemory.getState().remember('1:Character:item', 'b');
    expect(usePerspectiveMemory.getState().bySlot).toEqual({ '1:Character:item': 'b' });
  });
});
