import { Alert, Card, Col, Empty, Flex, Row, Skeleton, Typography } from 'antd';
import { useRootConcepts } from '../../entities/concept';
import { ConceptCard } from './ConceptCard';
import styles from './HomePage.module.css';

/** The concepts of the connected source, one card each. */
export function HomePage() {
  const { concepts, fetching, error } = useRootConcepts();

  if (error) {
    return (
      <Alert
        type="error"
        showIcon
        title="Could not introspect the GraphQL source"
        description={error.message}
      />
    );
  }

  return (
    <Flex vertical gap={20}>
      <div>
        <Typography.Title level={3} className={styles.title}>
          Concepts
        </Typography.Title>
        <Typography.Text type="secondary">
          These are the concepts exposed by the root of your data source, plus the ones you pinned.
          Pick one to open its dashboard.
        </Typography.Text>
      </div>

      {fetching ? (
        <Row gutter={[16, 16]}>
          {Array.from({ length: 6 }).map((_, i) => (
            <Col key={i} xs={24} sm={12} lg={8} xxl={6}>
              <Card>
                <Skeleton active paragraph={{ rows: 2 }} />
              </Card>
            </Col>
          ))}
        </Row>
      ) : concepts.length === 0 ? (
        <Empty description="No explorable concepts found in this schema" />
      ) : (
        <Row gutter={[16, 16]}>
          {concepts.map((entry) => (
            <Col key={entry.name} xs={24} sm={12} lg={8} xxl={6}>
              <ConceptCard entry={entry} />
            </Col>
          ))}
        </Row>
      )}
    </Flex>
  );
}
