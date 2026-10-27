import { z } from 'zod';

export type ThemeMode = 'light' | 'dark';

// A theme is plain data (no code), so a theme plugin can be installed from any
// URL. Values end up in antd tokens and CSS variables: colors are restricted to
// CSS color syntax, without `url(` (no remote loads) nor `;` (no injection).
const color = z
  .string()
  .max(64)
  .regex(/^[#a-zA-Z0-9(),.%\s/-]+$/, 'Expected a CSS color')
  .refine((v) => !/url\s*\(/i.test(v), 'Expected a CSS color');

export const themeTokensSchema = z.object({
  primary: color,
  surface: color,
  surfaceCard: color,
  surfaceElevated: color,
  border: color,
  borderSubtle: color,
  ink: color,
  inkSecondary: color,
  inkMuted: color,
  link: color,
  selected: color,
  /** The three stops of the brand gradient bar. */
  gradient: z.tuple([color, color, color]).optional(),
  /** Categorical palette of charts (series, slices). */
  series: z.array(color).min(1).max(20).optional(),
  fontFamily: z
    .string()
    .max(200)
    .regex(/^[\w\s,'"-]+$/)
    .optional(),
  radius: z.number().int().min(0).max(24).optional(),
  controlHeight: z.number().int().min(24).max(56).optional(),
  letterSpacing: z.number().min(0).max(2).optional(),
  shape: z.object({
    buttonRadius: z.number().int().min(0).max(24),
    controlRadius: z.number().int().min(0).max(24),
    cardRadius: z.number().int().min(0).max(24),
    pillRadius: z.number().int().min(0).max(999),
  }).optional(),
  status: z.object({ success: color, warning: color, error: color }).optional(),
  surfaceInset: color.optional(),
  surfaceButton: color.optional(),
  accentHover: color.optional(),
  badgeBorder: color.optional(),
  navigation: z.object({
    background: color,
    ink: color,
    selected: color,
    selectedInk: color,
    radius: z.number().int().min(0).max(24).optional(),
  }).optional(),
  /** Per widget type, extra variables handed to that widget (`useWidgetTheme(type).vars`). */
  widgets: z.record(z.string(), z.record(z.string().regex(/^[a-zA-Z][\w-]*$/), color)).optional(),
});
export type ThemeTokens = z.infer<typeof themeTokensSchema>;

export const themeDefinitionSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
    label: z.string().min(1).max(60),
    description: z.string().max(300).optional(),
    light: themeTokensSchema.optional(),
    dark: themeTokensSchema.optional(),
  })
  .refine((t) => t.light || t.dark, 'A theme defines at least one of "light" and "dark"');
export type ThemeDefinition = z.infer<typeof themeDefinitionSchema>;

/** The tokens of `theme` for `mode`, falling back to the mode it has. */
export function tokensFor(
  theme: ThemeDefinition,
  mode: ThemeMode,
): { mode: ThemeMode; tokens: ThemeTokens } {
  const tokens = theme[mode];
  if (tokens) return { mode, tokens };
  const other: ThemeMode = mode === 'light' ? 'dark' : 'light';
  return { mode: other, tokens: theme[other] as ThemeTokens };
}

export const DEFAULT_SERIES = [
  '#3b82f6',
  '#22c55e',
  '#9333ea',
  '#f59e0b',
  '#ef4444',
  '#06b6d4',
  '#ec4899',
  '#84cc16',
];
