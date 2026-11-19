import { useEffect, useMemo } from 'react';
import { Alert, ConfigProvider, Empty } from 'antd';
import { MemoryRouter } from 'react-router-dom';
import { Provider as UrqlProvider } from 'urql';
import { buildAntdTheme, themeCssVariables } from '../../shared/theme';
import { ViewRenderer } from '../../views/ViewRenderer';
import { builtinWidgetCatalog } from '../../views/widgets/catalog';
import { WidgetCatalogContext, WidgetThemeContext } from '../../views/plugin-api';
import { createViewerClient } from './viewerClient';
import { useMcpHost } from './useMcpHost';
import { useReportSize } from './useReportSize';
import { viewerTheme } from './viewerTheme';

/**
 * The page the host shows for `ui://fluid/viewer`: the view of the last `show_view` result, drawn by
 * the same engine as the app, with the host's light or dark theme and no network of its own.
 */
export function McpViewer() {
  const host = useMcpHost();
  const sizeRef = useReportSize(host.reportSize);
  const theme = useMemo(() => viewerTheme(host.hostTheme), [host.hostTheme]);
  const antdTheme = useMemo(() => buildAntdTheme(theme.tokens, theme.mode), [theme]);
  const { view, error, runQueries } = host;
  const client = useMemo(
    () => (view ? createViewerClient(view, runQueries) : null),
    [view, runQueries],
  );

  useEffect(() => {
    const root = document.documentElement;
    root.style.colorScheme = theme.mode;
    root.dataset.theme = theme.mode;
    const vars = themeCssVariables(theme.tokens);
    for (const [name, value] of Object.entries(vars)) root.style.setProperty(name, value);
    document.body.style.background = theme.tokens.surface;
    return () => Object.keys(vars).forEach((name) => root.style.removeProperty(name));
  }, [theme]);

  return (
    <WidgetCatalogContext.Provider value={builtinWidgetCatalog()}>
      <WidgetThemeContext.Provider value={theme}>
        <ConfigProvider theme={antdTheme}>
          <div ref={sizeRef} style={{ padding: 8 }}>
            {error && <Alert type="error" showIcon title={error} style={{ marginBottom: 8 }} />}
            {!view && !error && <Empty description="Waiting for the view…" />}
            {client && view && (
              <UrqlProvider value={client}>
                {/* Widgets link to other items with router hooks; nothing navigates inside the host frame. */}
                <MemoryRouter>
                  <ViewRenderer spec={view.spec} maxColumns={2} />
                </MemoryRouter>
              </UrqlProvider>
            )}
          </div>
        </ConfigProvider>
      </WidgetThemeContext.Provider>
    </WidgetCatalogContext.Provider>
  );
}
