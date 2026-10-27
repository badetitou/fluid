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
      ...(p.controlHeight !== undefined ? { controlHeight: p.controlHeight } : {}),
      ...(p.status ? { colorSuccess: p.status.success, colorWarning: p.status.warning, colorError: p.status.error } : {}),
      // Borders, not shadows, separate content.
      boxShadowTertiary: 'none',
    },
    components: {
      ...(p.shape ? {
        Button: { borderRadius: p.shape.buttonRadius, borderRadiusSM: p.shape.buttonRadius, borderRadiusLG: p.shape.buttonRadius },
        Input: { borderRadius: p.shape.controlRadius, borderRadiusSM: p.shape.controlRadius, borderRadiusLG: p.shape.controlRadius },
        InputNumber: { borderRadius: p.shape.controlRadius },
        Select: { borderRadius: p.shape.controlRadius, borderRadiusSM: p.shape.controlRadius, borderRadiusLG: p.shape.controlRadius },
        DatePicker: { borderRadius: p.shape.controlRadius },
        Card: { borderRadiusLG: p.shape.cardRadius },
        Modal: { borderRadiusLG: p.shape.cardRadius },
        Table: { headerBorderRadius: p.shape.cardRadius },
      } : {}),
      Layout: {
        headerBg: p.surface,
        siderBg: p.navigation?.background ?? p.surface,
        lightSiderBg: p.navigation?.background ?? p.surface,
        bodyBg: p.surface,
      },
      Menu: {
        itemBg: p.navigation?.background ?? p.surface,
        subMenuItemBg: p.navigation?.background ?? p.surface,
        itemColor: p.navigation?.ink ?? p.inkSecondary,
        itemHoverColor: p.navigation?.selectedInk ?? p.ink,
        itemHoverBg: p.navigation?.selected ?? p.selected,
        itemSelectedColor: p.navigation?.selectedInk ?? p.ink,
        subMenuItemSelectedColor: p.navigation?.selectedInk ?? p.ink,
        itemSelectedBg: p.navigation?.selected ?? p.selected,
        groupTitleColor: p.navigation?.ink ?? p.inkMuted,
        ...(p.navigation?.radius !== undefined ? { itemBorderRadius: p.navigation.radius, subMenuItemBorderRadius: p.navigation.radius } : {}),
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
  if (p.navigation) {
    vars['--fluid-navigation-background'] = p.navigation.background;
    vars['--fluid-navigation-ink'] = p.navigation.ink;
  }
  if (p.shape) {
    vars['--radius-xs'] = `${Math.round(p.shape.controlRadius / 2)}px`;
    vars['--radius-sm'] = `${p.shape.buttonRadius}px`;
    vars['--radius-md'] = `${p.shape.controlRadius}px`;
    vars['--radius-lg'] = `${p.shape.cardRadius}px`;
    vars['--radius-xl'] = `${p.shape.cardRadius}px`;
    vars['--fluid-pill-radius'] = `${p.shape.pillRadius}px`;
  }
  if (p.letterSpacing !== undefined) vars['--fluid-letter-spacing'] = `${p.letterSpacing}px`;
  if (p.surfaceInset) vars['--surface-inset'] = p.surfaceInset;
  if (p.surfaceButton) vars['--surface-button'] = p.surfaceButton;
  if (p.accentHover) vars['--accent-hover'] = p.accentHover;
  if (p.badgeBorder) vars['--badge-border'] = p.badgeBorder;
  series.forEach((c, i) => (vars[`--fluid-series-${i}`] = c));
  return vars;
}
