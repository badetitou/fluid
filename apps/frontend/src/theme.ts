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

const lightTheme: ThemeConfig = {
  algorithm: theme.defaultAlgorithm,
  token: {
    colorPrimary: '#2f54eb',
    borderRadius: 8,
    fontSize: 14,
  },
  components: {
    Layout: {
      headerBg: '#ffffff',
      siderBg: '#0b1021',
    },
    Menu: {
      darkItemBg: '#0b1021',
      darkSubMenuItemBg: '#0b1021',
    },
  },
};

const darkTheme: ThemeConfig = {
  algorithm: theme.darkAlgorithm,
  token: {
    colorPrimary: '#2f54eb',
    borderRadius: 8,
    fontSize: 14,
  },
  components: {
    Layout: {
      headerBg: '#141414',
      siderBg: '#0b1021',
    },
    Menu: {
      darkItemBg: '#0b1021',
      darkSubMenuItemBg: '#0b1021',
    },
  },
};

export const getTheme = (mode: ThemeMode): ThemeConfig => {
  return mode === 'dark' ? darkTheme : lightTheme;
};

export const fluidTheme = lightTheme;
