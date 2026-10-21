import { theme, type ThemeConfig } from 'antd';

export type ThemeMode = 'light' | 'dark';

/**
 * `compact` shrinks the toolbars only (header, sider, column headers) to leave
 * room for content; the page content itself is never resized.
 */
export type Density = 'comfortable' | 'compact';

/** Layout metrics that are not antd tokens, shared by the app chrome. */
export interface Chrome {
  headerHeight: number;
  headerPadding: number;
  siderWidth: number;
  siderCollapsedWidth: number;
  menuItemHeight: number;
  columnHeaderPadding: string;
  pillHeight: number;
}

const CHROME: Record<Density, Chrome> = {
  comfortable: {
    headerHeight: 64,
    headerPadding: 20,
    siderWidth: 240,
    siderCollapsedWidth: 64,
    menuItemHeight: 40,
    columnHeaderPadding: '10px 12px',
    pillHeight: 22,
  },
  compact: {
    headerHeight: 40,
    headerPadding: 10,
    siderWidth: 200,
    siderCollapsedWidth: 48,
    menuItemHeight: 30,
    columnHeaderPadding: '4px 8px',
    pillHeight: 18,
  },
};

export const getChrome = (density: Density): Chrome => CHROME[density];

/**
 * The badetitou design system, as the hex values antd can derive palettes from
 * (the system itself writes the grays as Tailwind `oklch()`; `badetitou.css`
 * exposes the same tokens as CSS variables).
 */
export interface Palette {
  surface: string;
  surfaceCard: string;
  surfaceElevated: string;
  border: string;
  borderSubtle: string;
  ink: string;
  inkSecondary: string;
  inkMuted: string;
  link: string;
  selected: string;
}

export const BRAND = { green: '#86efac', blue: '#3b82f6', purple: '#9333ea' } as const;

export const PALETTES: Record<ThemeMode, Palette> = {
  light: {
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
  },
  dark: {
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
  },
};

const FONT_SANS = 'Inter, ui-sans-serif, system-ui, sans-serif';
const FONT_MONO = 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';

const buildTheme = (mode: ThemeMode): ThemeConfig => {
  const p = PALETTES[mode];
  return {
    algorithm: mode === 'dark' ? theme.darkAlgorithm : theme.defaultAlgorithm,
    token: {
      colorPrimary: BRAND.blue,
      colorInfo: BRAND.blue,
      colorLink: p.link,
      colorText: p.ink,
      colorTextSecondary: p.inkSecondary,
      colorTextTertiary: p.inkMuted,
      colorBorder: p.border,
      colorBorderSecondary: p.borderSubtle,
      colorBgLayout: p.surface,
      colorBgContainer: p.surfaceCard,
      colorBgElevated: p.surfaceElevated,
      fontFamily: FONT_SANS,
      fontFamilyCode: FONT_MONO,
      fontSize: 14,
      borderRadius: 8,
      borderRadiusLG: 8,
      borderRadiusSM: 4,
      borderRadiusXS: 2,
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
      Typography: {
        titleMarginBottom: '0.5em',
      },
    },
  };
};

const THEMES: Record<ThemeMode, ThemeConfig> = { light: buildTheme('light'), dark: buildTheme('dark') };

export const getTheme = (mode: ThemeMode): ThemeConfig => THEMES[mode];

export const fluidTheme = THEMES.light;
