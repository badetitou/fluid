import { describe, expect, it, vi } from 'vitest';
import type { ViewEntry } from '../../entities/view';
import { perspectiveMenuItems, type PerspectiveActions } from './perspectiveMenuItems';

const actions: PerspectiveActions = {
  createView: vi.fn(),
  editWithAssistant: vi.fn(),
  createJson: vi.fn(),
  editJson: vi.fn(),
  setDefault: vi.fn(),
  remove: vi.fn(),
  openSettings: vi.fn(),
  pin: vi.fn(),
  promote: vi.fn(),
};

const spec = { version: 1 as const, id: 'v', concept: 'Account', title: 'V', queries: {}, widgets: [] };
const curated: ViewEntry = { key: 'v', title: 'V', source: 'curated', spec };
const saved = (isDefault: boolean): ViewEntry => ({
  ...curated,
  source: 'saved',
  saved: { id: 'db', concept: 'Account', title: 'V', spec, isDefault, createdAt: '', updatedAt: '' },
});

const keys = (items: ReturnType<typeof perspectiveMenuItems>) =>
  items.map((i) => (i && 'key' in i ? i.key : i?.type));

describe('perspectiveMenuItems', () => {
  it('offers only creation for an unsaved perspective', () => {
    const items = perspectiveMenuItems({ selected: curated, bffAvailable: true, concept: 'Account', pinnable: [] }, actions);
    expect(keys(items)).toEqual(['new', 'json', 'divider', 'promote', 'divider', 'settings']);
  });

  it('offers editing for a saved perspective, without "set default" when it already is', () => {
    const state = { bffAvailable: true, concept: 'Account', pinnable: [] };
    expect(keys(perspectiveMenuItems({ ...state, selected: saved(false) }, actions))).toContain('default');
    expect(keys(perspectiveMenuItems({ ...state, selected: saved(true) }, actions))).toEqual([
      'new',
      'assistant-edit',
      'json',
      'json-edit',
      'delete',
      'divider',
      'promote',
      'divider',
      'settings',
    ]);
  });

  it('lists pinnable concepts and disables creation offline', () => {
    const items = perspectiveMenuItems(
      { selected: curated, bffAvailable: false, concept: 'Account', pinnable: ['Account', 'Bank'] },
      actions,
    );
    expect(items[0]).toMatchObject({ key: 'new', disabled: true });
    const pin = items.find((i) => i && 'key' in i && i.key === 'pin') as { children: { label: string }[] };
    expect(pin.children.map((c) => c.label)).toEqual(['Account (this concept)', 'Bank']);
  });
});
