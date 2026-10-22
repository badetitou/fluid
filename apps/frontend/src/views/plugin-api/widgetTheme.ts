import { createContext, useContext, useMemo } from 'react';
import {
  BADETITOU_THEME,
  DEFAULT_SERIES,
  type ThemeMode,
  type ThemeTokens,
} from '../../shared/theme';

/** The active theme, as the engine hands it to widgets. */
export interface ActiveTheme {
  mode: ThemeMode;
  tokens: ThemeTokens;
}

export const WidgetThemeContext = createContext<ActiveTheme>({
  mode: 'light',
  tokens: BADETITOU_THEME.light!,
});

/** What a widget renderer reads from the theme: its tokens, the chart palette and its own overrides. */
export interface WidgetTheme extends ThemeTokens {
  mode: ThemeMode;
  series: string[];
  /** The variables the theme defines for this widget type (`tokens.widgets[type]`). */
  vars: Record<string, string>;
}

/** The theme as widget `type` sees it. Widgets use it to stay themable, built-in or plugin. */
export function useWidgetTheme(type: string): WidgetTheme {
  const { mode, tokens } = useContext(WidgetThemeContext);
  return useMemo(
    () => ({
      ...tokens,
      mode,
      series: tokens.series ?? DEFAULT_SERIES,
      vars: tokens.widgets?.[type] ?? {},
    }),
    [mode, tokens, type],
  );
}
