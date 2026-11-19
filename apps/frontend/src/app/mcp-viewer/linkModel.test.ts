import { describe, expect, it } from 'vitest';
import { fluidLink, linkedItem, pickView } from './linkModel';

const rows = [
  { id: 'l', title: 'All', concept: 'Character' },
  { id: 'd', title: 'One', concept: 'Character', scope: 'detail' },
  { id: 'e', title: 'Eps', concept: 'Episode', scope: 'list' },
];

describe('linkModel', () => {
  it('reads the linked item from the memory path, ids with slashes included', () => {
    expect(linkedItem('/')).toBeNull();
    expect(linkedItem('/Character@1')).toEqual({ concept: 'Character', itemId: '1' });
    expect(linkedItem(`/Character@${encodeURIComponent('a/b')}`)).toEqual({ concept: 'Character', itemId: 'a/b' });
  });

  it('picks a detail view for an item and a list view for a concept', () => {
    expect(pickView(rows, { concept: 'Character', itemId: '1' })?.id).toBe('d');
    expect(pickView(rows, { concept: 'Character' })?.id).toBe('l');
    expect(pickView(rows, { concept: 'Episode', itemId: '2' })).toBeUndefined();
  });

  it('builds the fluid url of the item', () => {
    expect(fluidLink('http://localhost:4001/', { concept: 'Character', itemId: 'a/b' })).toBe('http://localhost:4001/d/Character@a%2Fb');
  });
});
