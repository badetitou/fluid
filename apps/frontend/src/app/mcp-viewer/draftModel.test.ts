import { describe, expect, it } from 'vitest';
import type { ViewSpec } from '@fluid/shared';
import { draftOf, previewFromInput } from './draftModel';

describe('previewFromInput', () => {
  it('keeps the title and the widgets that have a type', () => {
    const preview = previewFromInput({
      arguments: { sourceId: 's', view: { title: 'Characters', widgets: [{ id: 'a', type: 'table', title: 'All' }, { id: 'b' }, { type: 'pie' }] } },
    });
    expect(preview).toEqual({ title: 'Characters', widgets: [{ key: 'a', type: 'table', title: 'All' }, { key: 'w2', type: 'pie' }] });
  });

  it('copes with arguments still streaming', () => {
    expect(previewFromInput({ arguments: { view: {} } })).toEqual({ widgets: [] });
    expect(previewFromInput({ arguments: { view: { title: 3, widgets: 'x' } } })).toEqual({ widgets: [] });
  });

  it('ignores the input of other tools', () => {
    expect(previewFromInput({ arguments: { viewId: 'v1', sourceId: 's1' } })).toBeNull();
    expect(previewFromInput('nope')).toBeNull();
  });
});

describe('draftOf', () => {
  it('drops the fields fluid sets', () => {
    const spec = { version: 1, id: 'd', concept: 'C', intent: 'r', title: 'T', queries: {}, widgets: [] } as unknown as ViewSpec;
    expect(draftOf(spec)).toEqual({ title: 'T', queries: {}, widgets: [] });
  });
});
