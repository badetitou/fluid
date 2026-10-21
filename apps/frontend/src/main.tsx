import React, { useEffect, useMemo } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App as AntdApp, ConfigProvider } from 'antd';
import 'antd/dist/reset.css';
import { App } from './App';
import { getTheme } from './theme';
import { usePreferences } from './store';

function AppWithTheme() {
  const themeMode = usePreferences((s) => s.themeMode);
  const theme = useMemo(() => getTheme(themeMode), [themeMode]);

  // Native controls, scrollbars and the page behind the layout follow the theme.
  useEffect(() => {
    document.documentElement.style.colorScheme = themeMode;
    document.body.style.background = themeMode === 'dark' ? '#000' : '#f5f5f5';
  }, [themeMode]);

  return (
    <ConfigProvider theme={theme}>
      <AntdApp>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </AntdApp>
    </ConfigProvider>
  );
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <AppWithTheme />
  </React.StrictMode>,
);
