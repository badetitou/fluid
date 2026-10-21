import { describe, expect, it } from 'vitest';
import { ALL_EXAMPLE_VIEWS, safeParseViewSpec, WIDGET_TYPES } from '@fluid/shared';
import { WIDGET_RENDERERS } from './catalog';

describe('widget catalog', () => {
  it('has a renderer for every widget type of the shared schema', () => {
    expect(Object.keys(WIDGET_RENDERERS).sort()).toEqual([...WIDGET_TYPES].sort());
  });

  it('has valid curated examples', () => {
    for (const view of ALL_EXAMPLE_VIEWS) expect(safeParseViewSpec(view).success).toBe(true);
  });

  it.each(['tree', 'richtext'])('shows the %s widget in a curated example', (type) => {
    expect(ALL_EXAMPLE_VIEWS.some((v) => v.widgets.some((w) => w.type === type))).toBe(true);
  });
});
