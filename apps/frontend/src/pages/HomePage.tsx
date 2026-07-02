import { Link } from 'react-router-dom';
import { Alert, Card, Col, Empty, Flex, Row, Skeleton, Space, Tag, Typography } from 'antd';
import { ArrowRightOutlined, TableOutlined } from '@ant-design/icons';
import { useConcepts } from '../hooks/useConcepts';

export function HomePage() {
  const { concepts, fetching, error } = useConcepts();

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

  return (
    <Flex vertical gap={20}>
      <div>
        <Typography.Title level={3} style={{ marginBottom: 4 }}>
          Concepts
        </Typography.Title>
        <Typography.Text type="secondary">
          These are the concepts exposed by your data source. Pick one to open its dashboard.
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
          {concepts.map((concept) => (
            <Col key={concept.name} xs={24} sm={12} lg={8} xxl={6}>
              <Link to={`/concept/${concept.name}`}>
                <Card
                  hoverable
                  title={
                    <Space>
                      <TableOutlined />
                      {concept.name}
                    </Space>
                  }
                  extra={<ArrowRightOutlined />}
                  style={{ height: '100%' }}
                >
                  <Typography.Paragraph
                    type="secondary"
                    ellipsis={{ rows: 2 }}
                    style={{ minHeight: 44 }}
                  >
                    {concept.description ?? 'No description provided.'}
                  </Typography.Paragraph>
                  <Space size={[4, 4]} wrap>
                    <Tag color="blue">{concept.scalarFields.length} fields</Tag>
                    {concept.relationFields.length > 0 && (
                      <Tag color="purple">{concept.relationFields.length} relations</Tag>
                    )}
                    {concept.queries.list && <Tag color="green">list</Tag>}
                    {concept.queries.byId && <Tag color="geekblue">by id</Tag>}
                  </Space>
                </Card>
              </Link>
            </Col>
          ))}
        </Row>
      )}
    </Flex>
  );
}
