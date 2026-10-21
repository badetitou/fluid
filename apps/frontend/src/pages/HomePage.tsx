import { Link } from 'react-router-dom';
import { Alert, Card, Col, Empty, Flex, Row, Skeleton, Space, Tag, Typography } from 'antd';
import { ArrowRightOutlined, PushpinOutlined, TableOutlined } from '@ant-design/icons';
import { useConcept, useRootConcepts, type ConceptEntry } from '../hooks/useConcepts';

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
        <Typography.Title level={3} style={{ marginBottom: 4 }}>
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

/** A concept card introspects its own type, so the home page fills in progressively. */
function ConceptCard({ entry }: { entry: ConceptEntry }) {
  const { concept, fetching } = useConcept(entry.name);

  return (
    <Link to={`/miller/${entry.name}`}>
      <Card
        hoverable
        title={
          <Space>
            {entry.isRoot ? <TableOutlined /> : <PushpinOutlined />}
            {entry.name}
          </Space>
        }
        extra={<ArrowRightOutlined />}
        style={{ height: '100%' }}
      >
        {fetching && !concept ? (
          <Skeleton active title={false} paragraph={{ rows: 2 }} />
        ) : (
          <>
            <Typography.Paragraph type="secondary" ellipsis={{ rows: 2 }} style={{ minHeight: 44 }}>
              {concept?.description ?? 'No description provided.'}
            </Typography.Paragraph>
            <Space size={[4, 4]} wrap>
              {concept && <Tag color="blue">{concept.scalarFields.length} fields</Tag>}
              {concept && concept.relationFields.length > 0 && (
                <Tag color="purple">{concept.relationFields.length} relations</Tag>
              )}
              {entry.queries.list && <Tag color="green">list</Tag>}
              {entry.queries.byId && <Tag color="geekblue">by id</Tag>}
              {!entry.isRoot && <Tag>pinned</Tag>}
            </Space>
          </>
        )}
      </Card>
    </Link>
  );
}
