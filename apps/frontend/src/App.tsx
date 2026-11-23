import { lazy, Suspense, useMemo } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Provider as UrqlProvider } from 'urql';
import { Skeleton } from 'antd';
import { AppLayout } from './app/layout/AppLayout';
import { RowPagingProvider } from './app/RowPagingProvider';
import { useLlmInsightAnalyzer } from './entities/llm';
import { useSourceWrites } from './entities/preferences/useSourceWrites';
import { analysisPath, engineFor, isAnalysisUrl, parseAnalysisUrl } from './entities/analysis';
import { createGraphQLClient } from './graphql/client';
import { useGraphqlEndpoint, useSourceAuthClient } from './entities/source';
import { InsightAnalyzerContext, WriteAccessContext } from './views/plugin-api';

// Each page is its own chunk: the first paint only loads the screen it shows.
const ConnectPage = lazy(() => import('./pages/connect/ConnectPage').then((m) => ({ default: m.ConnectPage })));
const SettingsPage = lazy(() => import('./pages/settings/SettingsPage').then((m) => ({ default: m.SettingsPage })));
const PluginPage = lazy(() => import('./pages/plugin/PluginPage').then((m) => ({ default: m.PluginPage })));
const AnalysePage = lazy(() => import('./pages/analyse/AnalysePage').then((m) => ({ default: m.AnalysePage })));
const MillerListPage = lazy(() => import('./pages/miller/MillerListPage').then((m) => ({ default: m.MillerListPage })));

const page = (element: React.ReactNode) => <Suspense fallback={<Skeleton active />}>{element}</Suspense>;

export function App() {
  // The BFF's proxy URL for a source routed through it, else the source's own URL.
  const endpoint = useGraphqlEndpoint();
  // The exchange is a new one when the user signed in again or out: the client is rebuilt, the queries run anew.
  const authExchange = useSourceAuthClient();
  const client = useMemo(
    () => (endpoint ? createGraphQLClient(endpoint, authExchange ? [authExchange] : []) : null),
    [endpoint, authExchange],
  );
  const { writable } = useSourceWrites();
  const analyzeView = useLlmInsightAnalyzer();

  // After a reload the in-page model is gone: rebuild it from the repository the URL names.
  const location = useLocation();
  const onAnalysePage = location.pathname.startsWith('/analyse/');
  const lost = !onAnalysePage && endpoint && isAnalysisUrl(endpoint) && !engineFor(endpoint) ? parseAnalysisUrl(endpoint) : null;
  // `from`: where the user was, so the analysis page brings them back there.
  if (lost) return <Navigate to={analysisPath(lost)} replace state={{ from: location.pathname + location.search }} />;

  return (
    <Routes>
      <Route path="/analyse/:owner/:name" element={page(<AnalysePage />)} />
      <Route path="/connect" element={page(<ConnectPage />)} />
      {client ? (
        <Route
          path="/"
          element={
            <UrqlProvider value={client}>
              <WriteAccessContext.Provider value={writable}>
                <InsightAnalyzerContext.Provider value={analyzeView}>
                  <RowPagingProvider>
                    <AppLayout />
                  </RowPagingProvider>
                </InsightAnalyzerContext.Provider>
              </WriteAccessContext.Provider>
            </UrqlProvider>
          }
        >
          {/* Every screen but the settings is a dashboard: `/` the Concepts one. */}
          <Route index element={page(<MillerListPage />)} />
          <Route path="settings" element={page(<SettingsPage />)} />
          <Route path="p/:pluginId/:sectionId/*" element={page(<PluginPage />)} />
          <Route path="d/*" element={page(<MillerListPage />)} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      ) : (
        <Route path="*" element={<Navigate to="/connect" replace />} />
      )}
    </Routes>
  );
}
