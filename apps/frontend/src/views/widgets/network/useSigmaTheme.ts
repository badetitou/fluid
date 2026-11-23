import { useMemo } from 'react';
import { theme as antdTheme } from 'antd';
import {
  antdTokenLookup,
  resolveCssColor,
  type CssVariableLookup,
} from '../../plugin-api/resolveCssColor';
import { useWidgetTheme, type WidgetTheme } from '../../plugin-api/widgetTheme';

const resolveAll = <T extends Record<string, string>>(record: T, lookup: CssVariableLookup): T =>
  Object.fromEntries(
    Object.entries(record).map(([k, v]) => [k, resolveCssColor(v, undefined, lookup)]),
  ) as T;

/** The widget theme with its colors resolved (sigma's WebGL cannot read CSS variables); recomputed only when the theme changes. */
export function useSigmaTheme(type: string): WidgetTheme {
  const theme = useWidgetTheme(type);
  const { token } = antdTheme.useToken();
  return useMemo(() => {
    const lookup = antdTokenLookup(token);
    const resolve = (v: string) => resolveCssColor(v, undefined, lookup);
    const out: WidgetTheme = {
      ...theme,
      series: theme.series.map(resolve),
      status: resolveAll(theme.status, lookup),
      vars: resolveAll(theme.vars, lookup),
    };
    for (const [k, v] of Object.entries(theme)) {
      if (typeof v === 'string' && v.startsWith('var(')) Object.assign(out, { [k]: resolve(v) });
    }
    return out;
  }, [theme, token]);
}
