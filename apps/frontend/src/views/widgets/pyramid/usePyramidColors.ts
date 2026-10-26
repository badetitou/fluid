import { useMemo, type CSSProperties } from 'react';
import { useWidgetTheme } from '../../plugin-api/widgetTheme';

const pick = (series: string[], i: number) => series[i % series.length];

/**
 * The colors of the pyramid as CSS variables for its root: the three levels of
 * the ratios and the tint of each part, all from the theme. A theme may set,
 * under `widgets.pyramid`: `low`, `average`, `high` (ratio colors), `onLevel`
 * (text on them), `size`, `coupling`, `inheritance` (part tints).
 */
export function usePyramidColors(): CSSProperties {
  const theme = useWidgetTheme('pyramid');
  return useMemo(() => {
    const { series, vars, mode } = theme;
    const tint = (color: string) => `color-mix(in srgb, ${color} ${mode === 'dark' ? 38 : 26}%, ${theme.surfaceCard})`;
    return {
      '--pyramid-low': vars.low ?? pick(series, 0),
      '--pyramid-average': vars.average ?? pick(series, 1),
      '--pyramid-high': vars.high ?? pick(series, 4),
      '--pyramid-on-level': vars.onLevel ?? (mode === 'dark' ? theme.surface : theme.surfaceCard),
      '--pyramid-size': tint(vars.size ?? pick(series, 3)),
      '--pyramid-coupling': tint(vars.coupling ?? pick(series, 5)),
      '--pyramid-inheritance': tint(vars.inheritance ?? pick(series, 2)),
      '--pyramid-ink': theme.ink,
      '--pyramid-border': theme.surfaceCard,
    } as CSSProperties;
  }, [theme]);
}
