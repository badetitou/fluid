import { lazy, Suspense, useMemo } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { Provider as UrqlProvider } from 'urql';
import { Skeleton } from 'antd';
import { AppLayout } from './app/layout/AppLayout';
import { RowPagingProvider } from './app/RowPagingProvider';
import { useLlmInsightAnalyzer } from './entities/llm';
import { useSourceWrites } from './entities/preferences/useSourceWrites';
import { createGraphQLClient } from './graphql/client';
import { useGraphqlEndpoint, useSourceAuthClient } from './entities/source';
import { InsightAnalyzerContext, WriteAccessContext } from './views/plugin-api';

// Each page is its own chunk: the first paint only loads the screen it shows.
const ConnectPage = lazy(() => import('./pages/connect/ConnectPage').then((m) => ({ default: m.ConnectPage })));
const SettingsPage = lazy(() => import('./pages/settings/SettingsPage').then((m) => ({ default: m.SettingsPage })));
const MillerListPage = lazy(() => import('./pages/miller/MillerListPage').then((m) => ({ default: m.MillerListPage })));

const page = (element: React.ReactNode) => <Suspense fallback={<Skeleton active />}>{element}</Suspense>;

export function App() {
  // The BFF's proxy URL for a source routed through it, else the source's own URL.
  const endpoint = useGraphqlEndpoint();
  // A new `epoch` (the user signed in again) rebuilds the client, so the queries that failed run anew.
  const { exchange, epoch } = useSourceAuthClient();
  const client = useMemo(
    () => (endpoint ? createGraphQLClient(endpoint, exchange ? [exchange] : []) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [endpoint, exchange, epoch],
  );
  const { writable } = useSourceWrites();
  const analyzeView = useLlmInsightAnalyzer();

  return (
    <Routes>
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
          <Route path="d/*" element={page(<MillerListPage />)} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      ) : (
        <Route path="*" element={<Navigate to="/connect" replace />} />
      )}
    </Routes>
  );
}
