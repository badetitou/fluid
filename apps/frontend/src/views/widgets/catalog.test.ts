import { describe, expect, it } from 'vitest';
import {
  ALL_EXAMPLE_VIEWS,
  historyWidgetExample,
  safeParseViewSpec,
  safeParseWidgetDraft,
  WIDGET_TYPES,
  widgetSchema,
} from '@fluid/shared';
import { WIDGET_RENDERERS } from './catalog';

describe('widget catalog', () => {
  it('has a renderer for every widget type of the shared schema', () => {
    expect(Object.keys(WIDGET_RENDERERS).sort()).toEqual([...WIDGET_TYPES].sort());
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

  it('rejects a history without links between versions, generated or not', () => {
    const { parentsField: _parents, ...unlinked } = historyWidgetExample;
    const { id: _id, ...draft } = unlinked;
    expect(widgetSchema.safeParse(unlinked).error?.issues[0].path).toEqual(['parentsField']);
    expect(safeParseWidgetDraft(draft).success).toBe(false);
    expect(safeParseWidgetDraft({ ...draft, childrenField: 'children' }).success).toBe(true);
  });
});
