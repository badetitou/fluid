import { describe, expect, it } from 'vitest';
import { BRAND, getTheme, PALETTES } from './theme';

describe('getTheme', () => {
  it('maps the badetitou palette of each mode to antd tokens', () => {
    for (const mode of ['light', 'dark'] as const) {
      const { token } = getTheme(mode);
      expect(token?.colorPrimary).toBe(BRAND.blue);
      expect(token?.colorBgLayout).toBe(PALETTES[mode].surface);
      expect(token?.colorBgContainer).toBe(PALETTES[mode].surfaceCard);
      expect(token?.colorText).toBe(PALETTES[mode].ink);
    }
  });

  it('keeps the sider on the page surface, not a coloured fill', () => {
    expect(getTheme('light').components?.Layout?.siderBg).toBe(PALETTES.light.surface);
    expect(getTheme('dark').components?.Layout?.siderBg).toBe(PALETTES.dark.surface);
  });
});
