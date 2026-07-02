import { theme, type ThemeConfig } from 'antd';

export const fluidTheme: ThemeConfig = {
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
