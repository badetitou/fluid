import { describe, expect, it } from 'vitest';
import { BUILTIN_WIDGET_CONTRACTS, type ViewSpec, type WidgetContract } from '@fluid/shared';
import { checkProposal, otherWidgets } from './model';

const spec: ViewSpec = {
  version: 1,
  id: 'v',
  concept: 'Character',
  title: 'Characters',
  queries: { rows: { query: '{ characters { results { id name } } }' } },
  widgets: [
    { id: 'people', type: 'table', data: { query: 'rows', path: 'characters.results' } },
    { id: 'count', type: 'statistic', data: { query: 'rows' }, value: { op: 'count' } },
  ],
};

const tagcloud: WidgetContract = {
  type: 'tagcloud/cloud',
  label: 'Tag cloud',
  description: '',
  llmDoc: '- { "type": "tagcloud/cloud" }',
  inputs: [],
  outputs: [{ name: 'selected', shape: 'object', description: '' }],
  jsonSchema: {
    type: 'object',
    properties: { type: { const: 'tagcloud/cloud' }, field: { type: 'string' } },
    required: ['type', 'field'],
  },
};
const contracts = [...Object.values(BUILTIN_WIDGET_CONTRACTS), tagcloud];

describe('otherWidgets', () => {
  it('lists the other widgets of the view with their outputs', () => {
    expect(otherWidgets(spec, 'count', contracts)).toEqual([
      { id: 'people', type: 'table', title: undefined, outputs: ['selected'] },
    ]);
  });
});

describe('checkProposal', () => {
  it('accepts a widget wired to the output of another widget of the view', () => {
    const raw = {
      id: 'detail',
      type: 'descriptions',
      data: { query: '@people', path: 'selected' },
      items: [],
    };
    expect(checkProposal(raw, spec, contracts)).toEqual({ widget: raw });
  });

  it('rejects a binding to a widget the view does not have', () => {
    const raw = { id: 'detail', type: 'descriptions', data: { query: '@nobody' }, items: [] };
    expect(checkProposal(raw, spec, contracts)).toHaveProperty(
      'error',
      expect.stringContaining('"nobody"'),
    );
  });

  it('checks a plugin widget against its plugin schema, and only when the plugin is enabled', () => {
    const raw = { id: 'cloud', type: 'tagcloud/cloud', data: { query: 'rows' } };
    expect(checkProposal(raw, spec, contracts)).toHaveProperty(
      'error',
      expect.stringContaining('field'),
    );
    expect(checkProposal({ ...raw, field: 'name' }, spec, contracts)).toHaveProperty('widget');
    const withoutPlugin = Object.values(BUILTIN_WIDGET_CONTRACTS);
    expect(checkProposal({ ...raw, field: 'name' }, spec, withoutPlugin)).toHaveProperty(
      'error',
      expect.stringContaining('not an available widget type'),
    );
  });

  it('explains what is wrong with a built-in widget, not the plugin branch of the union', () => {
    const result = checkProposal(
      { id: 'x', type: 'statistic', data: { query: 'rows' } },
      spec,
      contracts,
    );
    expect(result).toHaveProperty('error', expect.stringContaining('value'));
  });
});
