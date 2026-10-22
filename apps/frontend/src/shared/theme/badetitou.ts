import type { ThemeDefinition } from './tokens';

/**
 * The badetitou design system, as the hex values antd can derive palettes from
 * (the system itself writes the grays as Tailwind `oklch()`; `badetitou.css`
 * exposes the same tokens as CSS variables). fluid's default theme.
 */
export const BRAND = { green: '#86efac', blue: '#3b82f6', purple: '#9333ea' } as const;

const gradient: [string, string, string] = [BRAND.green, BRAND.blue, BRAND.purple];

export const BADETITOU_THEME: ThemeDefinition = {
  id: 'badetitou',
  label: 'badetitou',
  description: 'fluid default: grays, borders over shadows, green-blue-purple accents.',
  light: {
    primary: BRAND.blue,
    surface: '#ffffff',
    surfaceCard: '#f9fafb',
    surfaceElevated: '#ffffff',
    border: '#d1d5db',
    borderSubtle: '#e5e7eb',
    ink: '#111827',
    inkSecondary: '#374151',
    inkMuted: '#6b7280',
    link: '#1d4ed8',
    selected: '#f3f4f6',
    gradient,
  },
  dark: {
    primary: BRAND.blue,
    surface: '#111827',
    // gray-800 at 60% over gray-900, flattened so antd can derive from it.
    surfaceCard: '#19222f',
    surfaceElevated: '#1f2937',
    border: '#374151',
    borderSubtle: '#1f2937',
    ink: '#f3f4f6',
    inkSecondary: '#d1d5db',
    inkMuted: '#9ca3af',
    link: '#93c5fd',
    selected: '#1f2937',
    gradient,
  },
};
