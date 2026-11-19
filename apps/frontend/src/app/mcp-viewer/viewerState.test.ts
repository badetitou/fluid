import { describe, expect, it } from 'vitest';
import type { ViewSpec } from '@fluid/shared';
import { viewerReducer, type ViewerState } from './viewerState';

const draft = { sourceId: 's', spec: { title: 'T' } as ViewSpec, data: {}, draft: { concept: 'C', request: 'r', issues: [] } };

describe('viewerReducer', () => {
  it('shows the preview until the result arrives, which replaces it', () => {
    let s: ViewerState = viewerReducer({}, { type: 'input', preview: { title: 'T', widgets: [] } });
    expect(s.preview?.title).toBe('T');
    s = viewerReducer(s, { type: 'result', parsed: { kind: 'view', payload: draft } });
    expect(s).toEqual({ view: draft });
  });

  it('keeps the last good view when a result fails', () => {
    const s = viewerReducer({ view: draft }, { type: 'result', parsed: { kind: 'error', message: 'boom' } });
    expect(s).toEqual({ view: draft, error: 'boom' });
  });

  it('turns the draft into a saved view', () => {
    const s = viewerReducer({ view: draft, error: 'x' }, { type: 'saved', viewId: 'v9', title: 'T' });
    expect(s.view).toMatchObject({ viewId: 'v9', draft: undefined });
    expect(s).toMatchObject({ savedTitle: 'T', error: undefined });
  });
});
