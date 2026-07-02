import { useMemo } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { Provider as UrqlProvider } from 'urql';
import { createGraphQLClient } from './graphql/client';
import { useConnection } from './store';
import { AppLayout } from './components/AppLayout';
import { ConnectPage } from './pages/ConnectPage';
import { HomePage } from './pages/HomePage';
import { ConceptPage } from './pages/ConceptPage';
import { ItemPage } from './pages/ItemPage';
import { SettingsPage } from './pages/SettingsPage';
import { NavigationFeatureDemo } from './pages/NavigationFeatureDemo';

export function App() {
  const graphqlUrl = useConnection((s) => s.graphqlUrl);
  const client = useMemo(
    () => (graphqlUrl ? createGraphQLClient(graphqlUrl) : null),
    [graphqlUrl],
  );

  return (
    <Routes>
      <Route path="/connect" element={<ConnectPage />} />
      <Route path="/demo" element={<NavigationFeatureDemo />} />
      {client ? (
        <Route
          path="/"
          element={
            <UrqlProvider value={client}>
              <AppLayout />
            </UrqlProvider>
          }
        >
          <Route index element={<HomePage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="concept/:name" element={<ConceptPage />} />
          <Route path="concept/:conceptName/item/:itemId" element={<ItemPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      ) : (
        <Route path="*" element={<Navigate to="/connect" replace />} />
      )}
    </Routes>
  );
}
