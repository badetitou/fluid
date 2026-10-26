import { describe, expect, it } from 'vitest';
import { SETTINGS_SECTIONS, sectionGroups, sectionOf } from './sections';

describe('settings sections', () => {
  it('opens the section of the URL, else the first one', () => {
    expect(sectionOf('themes').label).toBe('Themes');
    expect(sectionOf('nope').id).toBe('connection');
    expect(sectionOf(null).id).toBe('connection');
  });

  it('groups the sections in menu order, one plugin section per kind', () => {
    expect(sectionGroups().map((g) => g.group)).toEqual(['General', 'Plugins', 'Assistant']);
    const kinds = SETTINGS_SECTIONS.flatMap((s) => ('kind' in s ? [s.kind] : []));
    expect(kinds.sort()).toEqual(['sourceProvider', 'theme', 'viewBuilder', 'widget']);
  });
});
