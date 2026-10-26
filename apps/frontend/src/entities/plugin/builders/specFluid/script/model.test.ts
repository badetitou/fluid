import { describe, expect, it } from 'vitest';
import { editorKeyAction, itemsTitle, openableScriptConcept } from './model';

describe('script runner model', () => {
  it('opens a result whose type the source can open', () => {
    expect(openableScriptConcept({ id: '1:2', type: 'Method' }, new Set(['Method']))).toBe('Method');
    expect(openableScriptConcept({ id: '1:2', type: 'Method' }, new Set(['Class']))).toBeUndefined();
    expect(openableScriptConcept({ id: '1:2', type: 'Method' }, null)).toBe('Method');
    expect(openableScriptConcept({ id: '1:2' }, null)).toBeUndefined();
    expect(openableScriptConcept(undefined, null)).toBeUndefined();
  });

  it('runs on Cmd/Ctrl+Enter and closes on Escape', () => {
    const key = (k: string, mods: Partial<{ metaKey: boolean; ctrlKey: boolean }> = {}) => ({
      key: k,
      metaKey: false,
      ctrlKey: false,
      ...mods,
    });
    expect(editorKeyAction(key('Enter', { metaKey: true }))).toBe('run');
    expect(editorKeyAction(key('Enter', { ctrlKey: true }))).toBe('run');
    expect(editorKeyAction(key('Enter'))).toBeUndefined();
    expect(editorKeyAction(key('Escape'))).toBe('close');
  });

  it('titles the items of a collection', () => {
    expect(itemsTitle(1, false)).toBe('1 item');
    expect(itemsTitle(3, undefined)).toBe('3 items');
    expect(itemsTitle(200, true)).toBe('First 200 items');
  });
});
