import { describe, expect, it } from 'vitest';
import type { ViewSpec, Widget } from '@fluid/shared';
import { replaceWidget, viewUpdate } from './model';

const widget = { id: 'w2', type: 'markdown', title: 'New' } as unknown as Widget;

describe('viewUpdate', () => {
  it('takes concept and title from a new spec', () => {
    const spec = { concept: 'C', title: 'T' } as ViewSpec;
    expect(viewUpdate({ spec: {} }, { spec })).toEqual({ spec, concept: 'C', title: 'T' });
  });

  it('renames the stored spec on a bare rename, and leaves it alone otherwise', () => {
    expect(viewUpdate({ spec: { title: 'Old', widgets: [] } }, { title: 'New' })).toEqual({
      title: 'New',
      spec: { title: 'New', widgets: [] },
    });
    expect(viewUpdate({ spec: null }, { title: 'New' })).toEqual({ title: 'New' });
    expect(viewUpdate({ spec: {} }, { isDefault: false })).toEqual({ isDefault: false });
  });
});

describe('replaceWidget', () => {
  const stored = { title: 'V', widgets: [{ id: 'w1' }, { id: 'w2', layout: { x: 1 } }] };

  it('replaces the widget, keeping its id and layout', () => {
    expect(replaceWidget(stored, 'w2', { ...widget, id: 'other' } as Widget)).toEqual({
      title: 'V',
      widgets: [{ id: 'w1' }, { id: 'w2', type: 'markdown', title: 'New', layout: { x: 1 } }],
    });
    expect(stored.widgets[1]).toEqual({ id: 'w2', layout: { x: 1 } });
  });

  it('gives null for an unknown widget or a malformed spec', () => {
    expect(replaceWidget(stored, 'w9', widget)).toBeNull();
    expect(replaceWidget({ widgets: 'no' }, 'w1', widget)).toBeNull();
    expect(replaceWidget(null, 'w1', widget)).toBeNull();
  });
});
