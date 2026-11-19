import { describe, expect, it } from 'vitest';
import { BADETITOU_THEME } from '../../shared/theme';
import { sizeChanged } from './useReportSize';
import { viewerTheme } from './viewerTheme';

describe('viewerTheme', () => {
  it('picks the built-in variant of the host theme', () => {
    expect(viewerTheme('dark')).toEqual({ mode: 'dark', tokens: BADETITOU_THEME.dark });
    expect(viewerTheme('light')).toEqual({ mode: 'light', tokens: BADETITOU_THEME.light });
  });
  it('is light until the host says', () => {
    expect(viewerTheme(undefined).mode).toBe('light');
  });
});

describe('sizeChanged', () => {
  it('reports the first size and real changes only', () => {
    expect(sizeChanged(undefined, { width: 1, height: 1 })).toBe(true);
    expect(sizeChanged({ width: 1, height: 1 }, { width: 1, height: 1 })).toBe(false);
    expect(sizeChanged({ width: 1, height: 1 }, { width: 1, height: 2 })).toBe(true);
  });
});
