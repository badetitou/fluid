import { describe, expect, it } from 'vitest';
import { WIDGET_TYPES } from '@fluid/shared';
import { WIDGET_RENDERERS } from './catalog';

describe('widget catalog', () => {
  it('has a renderer for every widget type of the shared schema', () => {
    expect(Object.keys(WIDGET_RENDERERS).sort()).toEqual([...WIDGET_TYPES].sort());
  });
});
