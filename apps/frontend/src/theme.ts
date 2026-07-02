import { theme, type ThemeConfig } from 'antd';

export type ThemeMode = 'light' | 'dark';

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
