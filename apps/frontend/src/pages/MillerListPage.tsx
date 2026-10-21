import { useParams } from 'react-router-dom';
import { Alert, Flex } from 'antd';
import { MillerListView } from './MillerListView';

/**
 * MillerListPage renders a split-view columnar navigation.
 * Navigates through entities showing work lists and details side-by-side.
 * Each column owns its own perspectives (views) and AI editing, and introspects
 * its concept's type on demand.
 */
export function MillerListPage() {
  const params = useParams<{ '*': string }>();

  // Parse the path: /miller/:rootConcept or /miller/:rootConcept/:concept/:itemId/...
  const pathParts = (params['*'] || '').split('/').filter(Boolean);
  const rootConceptName = pathParts[0];
  const navigationStack = parseNavigationStack(pathParts);

  if (!rootConceptName) {
    return <Alert type="warning" showIcon message="No concept selected" />;
  }

  return (
    <Flex vertical gap={20}>
      <div style={{ height: 'calc(100vh - 200px)' }}>
        <MillerListView rootConceptName={rootConceptName} navigationStack={navigationStack} />
      </div>
    </Flex>
  );
}

interface NavigationNode {
  conceptName: string;
  itemId: string;
}

function parseNavigationStack(pathParts: string[]): NavigationNode[] {
  const stack: NavigationNode[] = [];
  // Skip the first element (root concept), start from index 1
  for (let i = 1; i < pathParts.length - 1; i += 2) {
    stack.push({
      conceptName: pathParts[i],
      itemId: pathParts[i + 1],
    });
  }
  return stack;
}
