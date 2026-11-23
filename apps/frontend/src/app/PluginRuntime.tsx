import { useEffect, useMemo, type ReactNode } from 'react';
import { ConfigProvider } from 'antd';
import {
  activeWidgetCatalog,
  PluginsContext,
  useActiveDataSources,
  useActiveGraphDecorators,
  usePluginRuntime,
  usePlugins,
  useThemeChoice,
} from '../entities/plugin';
import { buildAntdTheme, themeCssVariables, tokensFor } from '../shared/theme';
import { usePreferences } from '../store';
import {
  DataSourcesContext,
  DecorationsProvider,
  WidgetCatalogContext,
  WidgetThemeContext,
} from '../views/plugin-api';

/**
 * Loads the plugins and provides what they contribute: the widget catalog and
 * the view builders' data sources to the engine, the active theme to antd, to
 * the widgets and to the CSS variables, and the graph decorators to the widgets.
 */
export function PluginRuntime({ children }: { children: ReactNode }) {
  const plugins = usePluginRuntime();
  return (
    <PluginsContext.Provider value={plugins}>
      <ActivePlugins>{children}</ActivePlugins>
    </PluginsContext.Provider>
  );
}

function ActivePlugins({ children }: { children: ReactNode }) {
  const entries = usePlugins();
  const { active } = useThemeChoice();
  const dataSources = useActiveDataSources();
  const decorators = useActiveGraphDecorators();
  const preferredMode = usePreferences((s) => s.themeMode);

  const catalog = useMemo(() => {
    const disabled = entries.filter((e) => !e.enabled).map((e) => e.plugin.manifest.id);
    return activeWidgetCatalog(
      entries.map((e) => e.plugin),
      disabled,
    );
  }, [entries]);
  const theme = useMemo(() => tokensFor(active, preferredMode), [active, preferredMode]);
  const antdTheme = useMemo(() => buildAntdTheme(theme.tokens, theme.mode), [theme]);

  // Native controls, scrollbars and the styles antd does not own follow the theme.
  useEffect(() => {
    const root = document.documentElement;
    root.style.colorScheme = theme.mode;
    root.dataset.theme = theme.mode;
    const vars = themeCssVariables(theme.tokens);
    for (const [name, value] of Object.entries(vars)) root.style.setProperty(name, value);
    return () => Object.keys(vars).forEach((name) => root.style.removeProperty(name));
  }, [theme]);

  return (
    <WidgetCatalogContext.Provider value={catalog}>
      <DataSourcesContext.Provider value={dataSources}>
        <WidgetThemeContext.Provider value={theme}>
          <DecorationsProvider decorators={decorators}>
            <ConfigProvider theme={antdTheme}>{children}</ConfigProvider>
          </DecorationsProvider>
        </WidgetThemeContext.Provider>
      </DataSourcesContext.Provider>
    </WidgetCatalogContext.Provider>
  );
}
