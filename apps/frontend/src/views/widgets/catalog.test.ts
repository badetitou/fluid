import { describe, expect, it } from 'vitest';
import {
  ALL_EXAMPLE_VIEWS,
  butterflyExample,
  characterEpisodesNetworkExample,
  classDiagramExample,
  classDependencyMatrixExample,
  historyWidgetExample,
  safeParseViewSpec,
  safeParseWidgetDraft,
  specPresenterWidgetExample,
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

  it.each(['tree', 'richtext', 'scatter', 'sankey', 'code', 'accordion', 'model3d', 'scene3d', 'network', 'classDiagram', 'boxes', 'matrix', 'blueprint', 'butterfly', 'pyramid', 'insight'])('shows the %s widget in a curated example', (type) => {
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

  // Inspector tabs come from a Spec-Fluid backend, not a public GraphQL API: only a reference config.
  it('has a valid reference config for the spec presenter, which needs its data', () => {
    expect(widgetSchema.safeParse(specPresenterWidgetExample).success).toBe(true);
    const { id: _id, data: _data, ...unbound } = specPresenterWidgetExample;
    expect(safeParseWidgetDraft({ ...unbound, data: { query: 'tab', path: 'root' } }).success).toBe(true);
    expect(safeParseWidgetDraft(unbound).success).toBe(false);
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

  it('rejects a class diagram without its superclasses, generated or not', () => {
    const diagram = classDiagramExample.widgets[0] as Record<string, unknown>;
    const { superField: _super, ...flat } = diagram;
    const { id: _id, ...draft } = flat;
    expect(widgetSchema.safeParse(diagram).success).toBe(true);
    expect(widgetSchema.safeParse(flat).success).toBe(false);
    expect(safeParseWidgetDraft(draft).success).toBe(false);
    expect(safeParseWidgetDraft({ ...draft, superField: 'superclass' }).success).toBe(true);
  });

  it('rejects a butterfly without any side, generated or not', () => {
    const butterfly = butterflyExample.widgets[0] as Record<string, unknown>;
    const { incomingField: _in, outgoingField: _out, ...flat } = butterfly;
    const { id: _id, ...draft } = flat;
    expect(widgetSchema.safeParse(butterfly).success).toBe(true);
    expect(widgetSchema.safeParse(flat).success).toBe(false);
    expect(safeParseWidgetDraft(draft).success).toBe(false);
    expect(safeParseWidgetDraft({ ...draft, outgoingField: 'calls' }).success).toBe(true);
    expect(widgetSchema.safeParse({ ...butterfly, depth: 3 }).success).toBe(false);
  });

  it('rejects a matrix without the targets of its elements, generated or not', () => {
    const matrix = classDependencyMatrixExample.widgets[0] as Record<string, unknown>;
    const { targetsField: _targets, ...flat } = matrix;
    const { id: _id, ...draft } = flat;
    expect(widgetSchema.safeParse(matrix).success).toBe(true);
    expect(widgetSchema.safeParse(flat).success).toBe(false);
    expect(safeParseWidgetDraft(draft).success).toBe(false);
    expect(safeParseWidgetDraft({ ...draft, targetsField: 'dependencies' }).success).toBe(true);
    expect(widgetSchema.safeParse({ ...matrix, columns: 'both' }).success).toBe(false);
  });
});
