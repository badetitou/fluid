import { describe, expect, it } from 'vitest';
import { columnDialogsReducer, type ColumnDialogsState } from './useColumnDialogs';

const initial: ColumnDialogsState = { dialog: null, settingsOpen: false };
const draft = {
  title: 'T',
  isDefault: false,
  spec: { version: 1 as const, id: 'v', concept: 'A', title: 'T', queries: {}, widgets: [] },
};

describe('columnDialogsReducer', () => {
  it('keeps a single editor open at a time', () => {
    const assistant = columnDialogsReducer(initial, { type: 'open', dialog: { kind: 'assistant' } });
    const json = columnDialogsReducer(assistant, { type: 'open', dialog: { kind: 'json', draft } });
    expect(json.dialog).toEqual({ kind: 'json', draft });
    expect(columnDialogsReducer(json, { type: 'close' }).dialog).toBeNull();
  });

  it('stacks the LLM settings over the open editor', () => {
    const assistant = columnDialogsReducer(initial, { type: 'open', dialog: { kind: 'assistant' } });
    const both = columnDialogsReducer(assistant, { type: 'settings', open: true });
    expect(both).toEqual({ dialog: { kind: 'assistant' }, settingsOpen: true });
    expect(columnDialogsReducer(both, { type: 'settings', open: false }).dialog).toEqual({ kind: 'assistant' });
  });
});
