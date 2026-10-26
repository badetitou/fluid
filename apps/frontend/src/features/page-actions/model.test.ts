import { describe, expect, it } from 'vitest';
import { pageFocus } from './model';

describe('pageFocus', () => {
  it('is the rightmost column of a Miller path, with its path', () => {
    expect(pageFocus('/d/@home/Character/Character@1')).toEqual({
      concept: 'Character',
      itemId: '1',
      path: '/d/@home/Character/Character@1',
    });
    expect(pageFocus('/d/Class/Class@1%3A2')).toEqual({
      concept: 'Class',
      itemId: '1:2',
      path: '/d/Class/Class@1%3A2',
    });
  });

  it('is a concept root shown alone', () => {
    expect(pageFocus('/d/Character')).toEqual({ concept: 'Character', path: '/d/Character' });
  });

  it('is nothing on the Concepts page, a dashboard alone or outside the dashboards', () => {
    expect(pageFocus('/')).toBeUndefined();
    expect(pageFocus('/d/@home')).toBeUndefined();
    expect(pageFocus('/d/~sales')).toBeUndefined();
    expect(pageFocus('/settings')).toBeUndefined();
  });
});
