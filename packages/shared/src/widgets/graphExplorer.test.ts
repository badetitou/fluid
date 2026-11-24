import { describe, expect, it } from 'vitest';
import {
  graphExplorerDraftSchema,
  graphExplorerIntentSchema,
  graphExplorerWidgetSchema,
  parseViewSpec,
  safeParseWidgetDraft,
  WIDGET_TYPES,
} from '../view-spec';
import { BUILTIN_WIDGET_CONTRACTS } from '../plugins/contracts';
import { BUILTIN_WIDGET_COLLECTIONS } from '../plugins/collections';
import {
  graphExplorerExample,
  graphExplorerPresetSchema,
  graphExplorerWidgetDoc,
  GRAPH_DETAIL_ID_VARIABLE,
  GRAPH_DETAIL_QUERY,
  GRAPH_EXPLORER_PRESETS,
  GRAPH_NODE_QUERY,
  normalizeGraphExplorerIntent,
} from './graphExplorer';

describe('graphExplorerPresetSchema', () => {
  it('accepts the four presets and nothing else', () => {
    expect(graphExplorerPresetSchema.options).toEqual([
      'code-dependencies',
      'inheritance',
      'calls',
      'generic',
    ]);
    expect(graphExplorerPresetSchema.safeParse('unknown').success).toBe(false);
  });

  it('gives every preset default fields and nested detail drafts', () => {
    for (const [name, preset] of Object.entries(GRAPH_EXPLORER_PRESETS)) {
      expect(preset.defaults.overview).toBeDefined();
      expect(preset.widgets.length).toBeGreaterThan(0);
      expect(name).toBe(graphExplorerPresetSchema.parse(name));
    }
  });
});

describe('graphExplorerIntentSchema', () => {
  it('accepts a small intent without any live expand state', () => {
    const intent = graphExplorerIntentSchema.parse({
      preset: 'code-dependencies',
      data: { query: 'classes', path: 'classes' },
      linksField: 'dependencies',
      groupByField: 'parentPackage.name',
      detailQuery: 'classDetail',
      overview: 'tree',
      initialExpanded: ['a'],
      collapseAbove: 12,
      id: 'explorer',
      title: 'Dependencies',
      span: 12,
    });
    expect(intent.id).toBe('explorer');
    expect(intent.preset).toBe('code-dependencies');
  });

  it('requires data and rejects an unknown preset', () => {
    expect(graphExplorerIntentSchema.safeParse({ preset: 'generic' }).success).toBe(false);
    expect(graphExplorerIntentSchema.safeParse({ data: { query: 'q' }, preset: 'nope' }).success).toBe(false);
  });
});

describe('normalizeGraphExplorerIntent', () => {
  const data = { query: 'classes', path: 'classes' };

  it('merges preset defaults under explicit fields and assigns stable nested ids', () => {
    const widget = normalizeGraphExplorerIntent(
      graphExplorerIntentSchema.parse({
        id: 'explorer',
        title: 'Dependencies',
        span: 12,
        preset: 'calls',
        data,
        overview: 'tree',
        collapseAbove: 7,
      }),
    );
    expect(widget).toMatchObject({
      id: 'explorer',
      title: 'Dependencies',
      span: 12,
      type: 'graphExplorer',
      data,
      preset: 'calls',
      overview: 'tree',
      collapseAbove: 7,
      graphLayout: 'layered',
      direction: 'LR',
    });
    expect(widget.widgets.map((w) => w.id)).toEqual(['detail-0', 'detail-1']);
    expect(graphExplorerWidgetSchema.safeParse(widget).success).toBe(true);
  });

  it('is deterministic and falls back to a stable id', () => {
    const intent = graphExplorerIntentSchema.parse({ preset: 'generic', data });
    expect(normalizeGraphExplorerIntent(intent)).toEqual(normalizeGraphExplorerIntent(intent));
    expect(normalizeGraphExplorerIntent(intent).id).toBe('graph-explorer');
  });

  it('uses explicit nested drafts over the preset widgets', () => {
    const widget = normalizeGraphExplorerIntent(
      graphExplorerIntentSchema.parse({
        preset: 'inheritance',
        data,
        widgets: [{ type: 'table', data: { query: '$detail', path: 'methods' } }],
      }),
    );
    expect(widget.widgets).toHaveLength(1);
    expect(widget.widgets[0]).toMatchObject({ id: 'detail-0', type: 'table' });
    expect('id' in graphExplorerDraftSchema.parse(widget)).toBe(false);
    const { id: _id, ...draft } = widget;
    expect(graphExplorerDraftSchema.safeParse(draft).success).toBe(true);
  });
});

describe('graphExplorer schema, docs and registration', () => {
  it('parses the curated example and its detail query is lazy', () => {
    const view = parseViewSpec(graphExplorerExample);
    expect(view.queries.classDetail?.lazy).toBe(true);
    expect(view.widgets[0].type).toBe('graphExplorer');
    expect(graphExplorerWidgetSchema.safeParse(view.widgets[0]).success).toBe(true);
  });

  it('accepts a compact intent as a widget draft', () => {
    expect(
      safeParseWidgetDraft({ type: 'graphExplorer', data: { query: 'classes' }, preset: 'generic' }).success,
    ).toBe(true);
  });

  it('documents the compact intent, the reserved queries and the presets', () => {
    expect(graphExplorerWidgetDoc).toContain('"preset"?:');
    expect(graphExplorerWidgetDoc).toContain('"lazy": true');
    expect(graphExplorerWidgetDoc).toContain(GRAPH_NODE_QUERY);
    expect(graphExplorerWidgetDoc).toContain(GRAPH_DETAIL_QUERY);
    expect(graphExplorerWidgetDoc).toContain(`$${GRAPH_DETAIL_ID_VARIABLE}: ID!`);
    for (const name of graphExplorerPresetSchema.options) expect(graphExplorerWidgetDoc).toContain(name);
  });

  it('is available in the widget types, the graphs collection and its contract', () => {
    expect(WIDGET_TYPES).toContain('graphExplorer');
    const graphs = BUILTIN_WIDGET_COLLECTIONS.find((c) => c.id === 'fluid-graphs');
    expect(graphs?.types).toContain('graphExplorer');
    const contract = BUILTIN_WIDGET_CONTRACTS.graphExplorer;
    expect(contract.inputs.map((p) => p.name)).toEqual(['data', 'edges']);
    expect(contract.outputs.map((p) => p.name)).toEqual(['selected']);
    expect(contract.actions).toEqual([]);
  });
});
