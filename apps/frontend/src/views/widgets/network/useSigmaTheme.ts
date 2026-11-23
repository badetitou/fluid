import { useMemo } from 'react';
import { resolveCssColor } from '../../plugin-api/resolveCssColor';
import { useWidgetTheme, type WidgetTheme } from '../../plugin-api/widgetTheme';

const resolveAll = <T extends Record<string, string>>(record: T): T =>
  Object.fromEntries(Object.entries(record).map(([k, v]) => [k, resolveCssColor(v)])) as T;

/** The widget theme with its colors resolved (sigma's WebGL cannot read CSS variables); recomputed only when the theme changes. */
export function useSigmaTheme(type: string): WidgetTheme {
  const theme = useWidgetTheme(type);
  return useMemo(() => {
    const out: WidgetTheme = {
      ...theme,
      series: theme.series.map((c) => resolveCssColor(c)),
      status: resolveAll(theme.status),
      vars: resolveAll(theme.vars),
    };
    for (const [k, v] of Object.entries(theme)) {
      if (typeof v === 'string' && v.startsWith('var(')) Object.assign(out, { [k]: resolveCssColor(v) });
    }
    return out;
  }, [theme]);
}
