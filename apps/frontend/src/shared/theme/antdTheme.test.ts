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

  it('lets a theme style navigation independently of content', () => {
    const navigation = { background: '#006f75', ink: '#ffffff', selected: '#00565b', selectedInk: '#ffffff', radius: 0 };
    const parsed = themeTokensSchema.parse({ ...BADETITOU_THEME.light!, navigation });
    const config = buildAntdTheme(parsed, 'light');
    expect(config.components?.Layout?.siderBg).toBe(navigation.background);
    expect(config.components?.Menu?.itemColor).toBe(navigation.ink);
    expect(config.components?.Menu?.itemSelectedBg).toBe(navigation.selected);
    expect(config.components?.Menu?.itemSelectedColor).toBe(navigation.selectedInk);
    expect(config.components?.Menu?.itemBorderRadius).toBe(0);
    expect(config.token?.colorBgContainer).toBe(BADETITOU_THEME.light!.surfaceCard);
  });
});

describe('themeCssVariables', () => {
  it('exposes the palette, the gradient and the chart series as CSS variables', () => {
    const vars = themeCssVariables({ ...BADETITOU_THEME.light!, series: ['#111111', '#222222'] });
    expect(vars['--surface']).toBe('#ffffff');
    expect(vars['--brand-blue']).toBe(BRAND.blue);
    expect(vars['--fluid-series-1']).toBe('#222222');
  });

  it('does not override legacy shape or navigation styles without explicit tokens', () => {
    const vars = themeCssVariables(BADETITOU_THEME.light!);
    expect(vars).not.toHaveProperty('--fluid-navigation-ink');
    expect(vars).not.toHaveProperty('--fluid-pill-radius');
    expect(vars).not.toHaveProperty('--radius-sm');
    expect(vars).not.toHaveProperty('--fluid-letter-spacing');
    expect(buildAntdTheme(BADETITOU_THEME.light!, 'light').components).not.toHaveProperty('Button');
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

  it('validates optional navigation colors and shape dimensions for installed themes', () => {
    const base = BADETITOU_THEME.light!;
    const navigation = { background: '#ffffff', ink: '#222222', selected: '#eeeeee', selectedInk: '#111111' };
    expect(themeTokensSchema.safeParse({ ...base, navigation: { ...navigation, background: 'url(https://x.io/a.png)' } }).success).toBe(false);
    expect(themeTokensSchema.safeParse({ ...base, navigation: { ...navigation, radius: -1 } }).success).toBe(false);
    expect(themeTokensSchema.safeParse({ ...base, shape: { buttonRadius: -1, controlRadius: 4, cardRadius: 4, pillRadius: 4 } }).success).toBe(false);
    expect(themeTokensSchema.safeParse({ ...base, controlHeight: 1000 }).success).toBe(false);
    expect(themeTokensSchema.safeParse({ ...base, status: { success: '#248836', warning: 'red; color: blue', error: '#ca1d34' } }).success).toBe(false);
  });
});
