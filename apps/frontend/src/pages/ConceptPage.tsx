import { useParams } from 'react-router-dom';
import {
  Alert,
  Breadcrumb,
  Button,
  Card,
  Descriptions,
  Flex,
  Skeleton,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useConcepts } from '../hooks/useConcepts';
import type { ConceptField } from '../graphql/introspection';

export function ConceptPage() {
  const { name } = useParams<{ name: string }>();
  const { conceptByName, fetching, error } = useConcepts();

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

  const concept = name ? conceptByName.get(name) : undefined;

  if (!concept) {
    return (
      <Alert
        type="warning"
        showIcon
        message="Unknown concept"
        description={`No concept named "${name}" exists in this schema.`}
      />
    );
  }

  const columns = [
    {
      title: 'Field',
      dataIndex: 'name',
      key: 'name',
      render: (value: string) => <Typography.Text strong>{value}</Typography.Text>,
    },
    {
      title: 'Type',
      dataIndex: 'typeName',
      key: 'typeName',
      render: (value: string, record: ConceptField) => (
        <Space>
          <Typography.Text code>{value}</Typography.Text>
          {record.isList && <Tag>list</Tag>}
        </Space>
      ),
    },
    {
      title: 'Kind',
      dataIndex: 'typeKind',
      key: 'typeKind',
      render: (value: string, record: ConceptField) => (
        <Tag color={record.isScalar ? 'blue' : 'purple'}>{value}</Tag>
      ),
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      render: (value: string | null) => value ?? <Typography.Text type="secondary">—</Typography.Text>,
    },
  ];

  return (
    <Flex vertical gap={20}>
      <Breadcrumb items={[{ title: 'Concepts' }, { title: concept.name }]} />

      <Flex align="flex-start" justify="space-between" gap={16} wrap>
        <div>
          <Typography.Title level={3} style={{ marginBottom: 4 }}>
            {concept.name}
          </Typography.Title>
          <Typography.Text type="secondary">
            {concept.description ?? 'No description provided.'}
          </Typography.Text>
        </div>
        <Tooltip title="Creating views arrives in an upcoming phase">
          <Button type="primary" icon={<PlusOutlined />} disabled>
            New view
          </Button>
        </Tooltip>
      </Flex>

      <Alert
        type="info"
        showIcon
        message="No saved view yet for this concept"
        description="Dashboard views (tables, charts, stats) will render here. For now, this is the introspected shape of the concept."
      />

      <Card size="small">
        <Descriptions column={{ xs: 1, sm: 2, lg: 4 }} size="small">
          <Descriptions.Item label="Fields">{concept.scalarFields.length}</Descriptions.Item>
          <Descriptions.Item label="Relations">{concept.relationFields.length}</Descriptions.Item>
          <Descriptions.Item label="List query">
            {concept.queries.list ? (
              <Typography.Text code>{concept.queries.list.field}</Typography.Text>
            ) : (
              <Typography.Text type="secondary">—</Typography.Text>
            )}
          </Descriptions.Item>
          <Descriptions.Item label="By-id query">
            {concept.queries.byId ? (
              <Typography.Text code>{concept.queries.byId.field}</Typography.Text>
            ) : (
              <Typography.Text type="secondary">—</Typography.Text>
            )}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <Card title="Shape" size="small">
        <Table<ConceptField>
          rowKey="name"
          size="small"
          columns={columns}
          dataSource={concept.fields}
          pagination={false}
        />
      </Card>
    </Flex>
  );
}
