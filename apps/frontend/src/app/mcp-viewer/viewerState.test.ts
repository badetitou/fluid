import { describe, expect, it } from 'vitest';
import type { ViewSpec } from '@fluid/shared';
import { viewerReducer, type ViewerState } from './viewerState';

const draft = { sourceId: 's', spec: { title: 'T' } as ViewSpec, data: {}, draft: { concept: 'C', request: 'r', issues: [] } };

describe('viewerReducer', () => {
  it('shows the preview until the result arrives, which replaces it', () => {
    let s: ViewerState = viewerReducer({}, { type: 'input', preview: { title: 'T', widgets: [] } });
    expect(s.preview?.title).toBe('T');
    s = viewerReducer(s, { type: 'result', parsed: { kind: 'view', payload: draft } });
    expect(s).toEqual({ view: draft, history: undefined });
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

  it('keeps the views shown before a link, and goes back to them', () => {
    const other = { ...draft, viewId: 'v2', draft: undefined };
    let s: ViewerState = viewerReducer({ view: draft }, { type: 'navigated', parsed: { kind: 'view', payload: other } });
    expect(s).toEqual({ view: other, history: [draft] });
    s = viewerReducer(s, { type: 'navigated', parsed: { kind: 'error', message: 'nope' } });
    expect(s).toMatchObject({ view: other, error: 'nope' });
    s = viewerReducer(s, { type: 'back' });
    expect(s).toEqual({ view: draft, history: [] });
    expect(viewerReducer(s, { type: 'back' })).toBe(s);
  });
});
