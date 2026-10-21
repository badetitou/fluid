import { describe, expect, it } from 'vitest';
import { ALL_EXAMPLE_VIEWS, historyWidgetExample, safeParseViewSpec, WIDGET_TYPES, widgetSchema } from '@fluid/shared';
import { WIDGET_RENDERERS } from './catalog';
import { WIDGET_DEFAULTS } from './defaults';
import { WIDGET_INFO } from './widgetInfo';

describe('widget catalog', () => {
  it('has a renderer for every widget type of the shared schema', () => {
    expect(Object.keys(WIDGET_RENDERERS).sort()).toEqual([...WIDGET_TYPES].sort());
  });

  it('can add every widget type from the layout editor', () => {
    expect(Object.keys(WIDGET_INFO).sort()).toEqual([...WIDGET_TYPES].sort());
    expect(Object.keys(WIDGET_DEFAULTS).sort()).toEqual([...WIDGET_TYPES].sort());
  });

  it('has valid curated examples', () => {
    for (const view of ALL_EXAMPLE_VIEWS) expect(safeParseViewSpec(view).success).toBe(true);
  });

  it.each(['tree', 'richtext', 'scatter', 'code'])('shows the %s widget in a curated example', (type) => {
    expect(ALL_EXAMPLE_VIEWS.some((v) => v.widgets.some((w) => w.type === type))).toBe(true);
  });

  // Version histories are shaped differently in every API: no curated view, only a reference config.
  it('has a valid reference config for the history widget, without curated view', () => {
    expect(widgetSchema.safeParse(historyWidgetExample).success).toBe(true);
    expect(ALL_EXAMPLE_VIEWS.some((v) => v.widgets.some((w) => w.type === 'history'))).toBe(false);
  });
});
