import { useMemo, type CSSProperties } from 'react';
import { useWidgetTheme } from '../../plugin-api/widgetTheme';

/**
 * The colors of the insight widget as CSS variables for its root, from the
 * theme. A theme may set, under `widgets.insight`: `accent` (the analyst's mark),
 * `critical`, `notable`, `info` (the severity of a finding).
 */
export function useInsightColors(): CSSProperties {
  const theme = useWidgetTheme('insight');
  return useMemo(() => {
    const { vars, primary } = theme;
    const accent = vars.accent ?? primary;
    return {
      '--insight-accent': accent,
      '--insight-critical': vars.critical ?? 'var(--ant-color-error)',
      '--insight-notable': vars.notable ?? 'var(--ant-color-warning)',
      '--insight-info': vars.info ?? accent,
      '--insight-ink': theme.ink,
      '--insight-ink-secondary': theme.inkSecondary,
      '--insight-surface': `color-mix(in srgb, ${accent} ${theme.mode === 'dark' ? 14 : 6}%, ${theme.surfaceCard})`,
      '--insight-border': theme.borderSubtle,
    } as CSSProperties;
  }, [theme]);
}
