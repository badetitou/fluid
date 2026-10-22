import { describe, expect, it } from 'vitest';
import { buildAntdTheme, themeCssVariables } from './antdTheme';
import { BADETITOU_THEME, BRAND } from './badetitou';
import { themeDefinitionSchema, themeTokensSchema, tokensFor } from './tokens';

describe('buildAntdTheme', () => {
  it('maps the badetitou palette of each mode to antd tokens', () => {
    for (const mode of ['light', 'dark'] as const) {
      const p = BADETITOU_THEME[mode]!;
      const { token } = buildAntdTheme(p, mode);
      expect(token?.colorPrimary).toBe(BRAND.blue);
      expect(token?.colorBgLayout).toBe(p.surface);
      expect(token?.colorBgContainer).toBe(p.surfaceCard);
      expect(token?.colorText).toBe(p.ink);
    }
  });

  it('keeps the sider on the page surface, not a coloured fill', () => {
    const p = BADETITOU_THEME.dark!;
    expect(buildAntdTheme(p, 'dark').components?.Layout?.siderBg).toBe(p.surface);
  });
});

describe('themeCssVariables', () => {
  it('exposes the palette, the gradient and the chart series as CSS variables', () => {
    const vars = themeCssVariables({ ...BADETITOU_THEME.light!, series: ['#111111', '#222222'] });
    expect(vars['--surface']).toBe('#ffffff');
    expect(vars['--brand-blue']).toBe(BRAND.blue);
    expect(vars['--fluid-series-1']).toBe('#222222');
  });
});

describe('theme definitions', () => {
  it('falls back to the mode a single-mode theme has', () => {
    const lightOnly = { id: 'x', label: 'X', light: BADETITOU_THEME.light };
    expect(tokensFor(lightOnly, 'dark').mode).toBe('light');
  });

  it('rejects colors that would load or inject anything', () => {
    const base = BADETITOU_THEME.light!;
    expect(
      themeTokensSchema.safeParse({ ...base, surface: 'url(https://x.io/a.png)' }).success,
    ).toBe(false);
    expect(themeTokensSchema.safeParse({ ...base, ink: 'red; background: blue' }).success).toBe(
      false,
    );
    expect(
      themeTokensSchema.safeParse({ ...base, ink: 'oklch(21% 0.034 264.665 / 0.6)' }).success,
    ).toBe(true);
  });

  it('requires at least one mode', () => {
    expect(themeDefinitionSchema.safeParse({ id: 'x', label: 'X' }).success).toBe(false);
    expect(themeDefinitionSchema.safeParse(BADETITOU_THEME).success).toBe(true);
  });
});
