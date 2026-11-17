import { lazy, Suspense, useMemo } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { Provider as UrqlProvider } from 'urql';
import { Skeleton } from 'antd';
import { AppLayout } from './app/layout/AppLayout';
import { useLlmInsightAnalyzer } from './entities/llm';
import { useSourceWrites } from './entities/preferences/useSourceWrites';
import { createGraphQLClient } from './graphql/client';
import { useConnection } from './store';
import { InsightAnalyzerContext, WriteAccessContext } from './views/plugin-api';

// Each page is its own chunk: the first paint only loads the screen it shows.
const ConnectPage = lazy(() => import('./pages/connect/ConnectPage').then((m) => ({ default: m.ConnectPage })));
const SettingsPage = lazy(() => import('./pages/settings/SettingsPage').then((m) => ({ default: m.SettingsPage })));
const MillerListPage = lazy(() => import('./pages/miller/MillerListPage').then((m) => ({ default: m.MillerListPage })));

const page = (element: React.ReactNode) => <Suspense fallback={<Skeleton active />}>{element}</Suspense>;

export function App() {
  const graphqlUrl = useConnection((s) => s.graphqlUrl);
  const client = useMemo(() => (graphqlUrl ? createGraphQLClient(graphqlUrl) : null), [graphqlUrl]);
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
                  <AppLayout />
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
