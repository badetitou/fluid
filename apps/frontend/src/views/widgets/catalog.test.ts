import { describe, expect, it } from 'vitest';
import {
  ALL_EXAMPLE_VIEWS,
  characterEpisodesNetworkExample,
  historyWidgetExample,
  safeParseViewSpec,
  safeParseWidgetDraft,
  WIDGET_TYPES,
  widgetSchema,
} from '@fluid/shared';
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

  it.each(['tree', 'richtext', 'scatter', 'code', 'accordion', 'network'])('shows the %s widget in a curated example', (type) => {
    expect(ALL_EXAMPLE_VIEWS.some((v) => v.widgets.some((w) => w.type === type))).toBe(true);
  });

  it('validates the widgets nested in an accordion, recursively', () => {
    const accordion = { id: 'a', type: 'accordion', data: { query: 'q' }, widgets: [] };
    const nested = { ...accordion, widgets: [{ ...accordion, id: 'b', widgets: [{ id: 'c', type: 'code' }] }] };
    expect(widgetSchema.safeParse({ ...accordion, widgets: [{ ...accordion, id: 'b' }] }).success).toBe(true);
    expect(widgetSchema.safeParse(nested).success).toBe(false);
    expect(safeParseWidgetDraft({ type: 'accordion', data: { query: 'q' }, widgets: [] }).success).toBe(true);
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

  it('rejects a network without links, or with links by group but no group', () => {
    const network = characterEpisodesNetworkExample.widgets[0] as Record<string, unknown>;
    const { linksField: _links, ...unlinked } = network;
    const { id: _id, ...draft } = unlinked;
    expect(widgetSchema.safeParse(network).success).toBe(true);
    expect(widgetSchema.safeParse(unlinked).error?.issues[0].path).toEqual(['linksField']);
    expect(safeParseWidgetDraft(draft).success).toBe(false);
    expect(safeParseWidgetDraft({ ...draft, edges: { query: 'calls' } }).success).toBe(true);
    const { groupField: _group, ...ungrouped } = network;
    expect(widgetSchema.safeParse(ungrouped).error?.issues[0].path).toEqual(['groupField']);
  });
});
