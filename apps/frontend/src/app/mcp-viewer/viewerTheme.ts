import { BADETITOU_THEME, tokensFor, type ThemeMode } from '../../shared/theme';

/** The built-in theme variant matching the host's light or dark context (light until the host says). */
export function viewerTheme(hostTheme: ThemeMode | undefined) {
  return tokensFor(BADETITOU_THEME, hostTheme ?? 'light');
}
