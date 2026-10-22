import { theme, type ThemeConfig } from 'antd';
import { DEFAULT_SERIES, type ThemeMode, type ThemeTokens } from './tokens';

const FONT_SANS = 'Inter, ui-sans-serif, system-ui, sans-serif';
const FONT_MONO =
  'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';

/** The antd configuration of a theme's tokens. */
export function buildAntdTheme(p: ThemeTokens, mode: ThemeMode): ThemeConfig {
  const radius = p.radius ?? 8;
  return {
    algorithm: mode === 'dark' ? theme.darkAlgorithm : theme.defaultAlgorithm,
    token: {
      colorPrimary: p.primary,
      colorInfo: p.primary,
      colorLink: p.link,
      colorText: p.ink,
      colorTextSecondary: p.inkSecondary,
      colorTextTertiary: p.inkMuted,
      colorBorder: p.border,
      colorBorderSecondary: p.borderSubtle,
      colorBgLayout: p.surface,
      colorBgContainer: p.surfaceCard,
      colorBgElevated: p.surfaceElevated,
      fontFamily: p.fontFamily ?? FONT_SANS,
      fontFamilyCode: FONT_MONO,
      fontSize: 14,
      borderRadius: radius,
      borderRadiusLG: radius,
      borderRadiusSM: Math.round(radius / 2),
      borderRadiusXS: Math.round(radius / 4),
      // Borders, not shadows, separate content.
      boxShadowTertiary: 'none',
    },
    components: {
      Layout: {
        headerBg: p.surface,
        siderBg: p.surface,
        lightSiderBg: p.surface,
        bodyBg: p.surface,
      },
      Menu: {
        itemBg: p.surface,
        subMenuItemBg: p.surface,
        itemColor: p.inkSecondary,
        itemHoverColor: p.ink,
        itemHoverBg: p.selected,
        itemSelectedColor: p.ink,
        subMenuItemSelectedColor: p.ink,
        itemSelectedBg: p.selected,
        groupTitleColor: p.inkMuted,
      },
      Typography: { titleMarginBottom: '0.5em' },
    },
  };
}

/** The CSS variables of a theme (those of `badetitou.css`, plus `--fluid-*`), for the styles antd does not own. */
export function themeCssVariables(p: ThemeTokens): Record<string, string> {
  const series = p.series ?? DEFAULT_SERIES;
  const vars: Record<string, string> = {
    '--surface': p.surface,
    '--surface-card': p.surfaceCard,
    '--border': p.border,
    '--border-subtle': p.borderSubtle,
    '--ink': p.ink,
    '--ink-secondary': p.inkSecondary,
    '--ink-muted': p.inkMuted,
    '--link': p.link,
    '--fluid-primary': p.primary,
    '--fluid-selected': p.selected,
    '--fluid-radius': `${p.radius ?? 8}px`,
  };
  if (p.gradient)
    [vars['--brand-green'], vars['--brand-blue'], vars['--brand-purple']] = p.gradient;
  if (p.fontFamily) vars['--font-sans'] = p.fontFamily;
  series.forEach((c, i) => (vars[`--fluid-series-${i}`] = c));
  return vars;
}
