import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  Breadcrumb,
  Button,
  Card,
  Flex,
  Skeleton,
  Space,
  Typography,
} from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { useConcepts } from '../hooks/useConcepts';
import { useViews, type ViewEntry } from '../hooks/useViews';
import { ViewRenderer } from '../views/ViewRenderer';

export function ItemPage() {
  const navigate = useNavigate();
  const { conceptName, itemId } = useParams<{ conceptName: string; itemId: string }>();
  const { conceptByName, fetching, error } = useConcepts();

  const concept = conceptName ? conceptByName.get(conceptName) : undefined;
  const { entries, defaultKey, loading: viewsLoading } = useViews(concept);

  const [picked, setPicked] = useState<string | undefined>(undefined);

  useEffect(() => {
    setPicked(undefined);
  }, [conceptName]);

  const activeKey = picked && entries.some((e) => e.key === picked) ? picked : defaultKey;
  const selected: ViewEntry | undefined = useMemo(
    () => entries.find((e) => e.key === activeKey) ?? entries[0],
    [entries, activeKey],
  );

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

  if (!concept) {
    return (
      <Alert
        type="warning"
        showIcon
        message="Unknown concept"
        description={`No concept named "${conceptName}" exists in this schema.`}
      />
    );
  }

  // Check if the concept has a byId query
  if (!concept.queries.byId) {
    return (
      <Alert
        type="warning"
        showIcon
        message="Cannot fetch item details"
        description={`The concept "${conceptName}" does not have a by-id query configured.`}
      />
    );
  }

  return (
    <Flex vertical gap={20}>
      <Breadcrumb
        items={[
          { title: 'Concepts', onClick: () => navigate('/') },
          { title: conceptName, onClick: () => navigate(`/concept/${conceptName}`) },
          { title: itemId },
        ]}
      />

      <Flex align="center" justify="space-between" gap={16}>
        <div>
          <Space align="center" size="middle">
            <Button
              type="text"
              icon={<ArrowLeftOutlined />}
              onClick={() => navigate(`/concept/${conceptName}`)}
              size="large"
            />
            <div>
              <Typography.Title level={3} style={{ marginBottom: 4 }}>
                {conceptName} - {itemId}
              </Typography.Title>
              <Typography.Text type="secondary">Item details</Typography.Text>
            </div>
          </Space>
        </div>
      </Flex>

      {viewsLoading && entries.length === 0 ? (
        <Card>
          <Skeleton active paragraph={{ rows: 4 }} />
        </Card>
      ) : selected ? (
        <ItemViewRenderer
          spec={selected.spec}
          concept={concept}
          itemId={itemId || ''}
        />
      ) : (
        <Alert
          type="info"
          showIcon
          message="No view available for this item"
          description={`This concept has no view to display the item details.`}
        />
      )}
    </Flex>
  );
}

/**
 * Wrapper component that provides item-specific context to the ViewRenderer.
 * It injects the item ID as a variable into the by-id query.
 */
function ItemViewRenderer({
  spec,
  concept,
  itemId,
}: {
  spec: any;
  concept: any;
  itemId: string;
}) {
  // Create a modified spec that adds the item ID to the by-id query variables
  const modifiedSpec = useMemo(() => {
    if (!concept.queries.byId) return spec;

    const byIdQueryKey = concept.queries.byId.field;
    // The most common argument names for ID parameters (try them in order)
    const idArgNames = ['id', 'ID', `${concept.name.toLowerCase()}Id`, `${concept.name}Id`];
    const idArgName = idArgNames[0]; // Default to 'id'

    // Find the query key in the spec that matches the byId query key
    const modifiedQueries = { ...spec.queries };

    if (modifiedQueries[byIdQueryKey]) {
      modifiedQueries[byIdQueryKey] = {
        ...modifiedQueries[byIdQueryKey],
        variables: {
          ...modifiedQueries[byIdQueryKey].variables,
          [idArgName]: itemId,
        },
      };
    } else {
      // Create a default by-id query if it doesn't exist in the view
      // This is a fallback: a basic query that fetches the object by ID
      const query = `query($${idArgName}: ID!) { ${byIdQueryKey}(${idArgName}: $${idArgName}) { id } }`;
      modifiedQueries[byIdQueryKey] = {
        query,
        variables: { [idArgName]: itemId },
      };
    }

    return {
      ...spec,
      queries: modifiedQueries,
    };
  }, [spec, concept, itemId]);

  return <ViewRenderer spec={modifiedSpec} />;
}
