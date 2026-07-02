import { useParams } from 'react-router-dom';
import { Alert, Card, Flex, Skeleton } from 'antd';
import { useConcepts } from '../hooks/useConcepts';
import { MillerListView } from './MillerListView';

/**
 * MillerListPage renders a split-view columnar navigation.
 * Navigates through entities showing work lists and details side-by-side.
 * Each column owns its own perspectives (views) and AI editing.
 */
export function MillerListPage() {
  const params = useParams<{ '*': string }>();

  const { conceptByName, fetching, error } = useConcepts();

  // Parse the path: /miller/:rootConcept or /miller/:rootConcept/:concept/:itemId/...
  const pathParts = (params['*'] || '').split('/').filter(Boolean);
  const rootConceptName = pathParts[0];
  const navigationStack = parseNavigationStack(pathParts);

  const rootConcept = rootConceptName ? conceptByName.get(rootConceptName) : undefined;

  if (error) {
    return (
      <Alert
        type="error"
        showIcon
        message="Could not introspect the GraphQL source"
        description={error.message}
      />
    );
  }

  if (fetching) {
    return (
      <Card>
        <Skeleton active paragraph={{ rows: 6 }} />
      </Card>
    );
  }

  if (!rootConcept) {
    return (
      <Alert
        type="warning"
        showIcon
        message="Unknown concept"
        description={`No concept named "${rootConceptName}" exists.`}
      />
    );
  }

  return (
    <Flex vertical gap={20}>
      <div style={{ height: 'calc(100vh - 200px)' }}>
        <MillerListView
          rootConcept={rootConcept}
          navigationStack={navigationStack}
          conceptByName={conceptByName}
        />
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
