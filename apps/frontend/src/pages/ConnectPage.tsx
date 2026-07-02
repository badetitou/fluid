import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, Flex, Form, Input, Typography, theme } from 'antd';
import { ApiOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { useConnection } from '../store';
import { DEFAULT_GRAPHQL_URL } from '../runtime-config';

const DEFAULT_URL = DEFAULT_GRAPHQL_URL;

export function ConnectPage() {
  const navigate = useNavigate();
  const connect = useConnection((s) => s.connect);
  const [url, setUrl] = useState(DEFAULT_URL);
  const { token } = theme.useToken();

  const handleConnect = () => {
    if (!url.trim()) return;
    connect(url);
    navigate('/', { replace: true });
  };

  return (
    <Flex
      align="center"
      justify="center"
      style={{
        minHeight: '100vh',
        background: `linear-gradient(135deg, ${token.colorPrimary} 0%, #0b1021 100%)`,
        padding: 24,
      }}
    >
      <Card style={{ width: 460, maxWidth: '100%' }} variant="borderless">
        <Flex vertical gap={8} style={{ marginBottom: 24 }}>
          <Flex align="center" gap={12}>
            <ThunderboltOutlined style={{ fontSize: 28, color: token.colorPrimary }} />
            <Typography.Title level={2} style={{ margin: 0 }}>
              fluid
            </Typography.Title>
          </Flex>
          <Typography.Text type="secondary">
            Connect to a GraphQL source and explore its concepts — no pre-built screens, just your data.
          </Typography.Text>
        </Flex>

        <Form layout="vertical" onFinish={handleConnect}>
          <Form.Item label="GraphQL endpoint" required>
            <Input
              size="large"
              prefix={<ApiOutlined />}
              placeholder="http://localhost:4000/graphql"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              autoFocus
            />
          </Form.Item>
          <Button type="primary" size="large" htmlType="submit" block disabled={!url.trim()}>
            Connect
          </Button>
        </Form>

        <Typography.Paragraph type="secondary" style={{ marginTop: 16, marginBottom: 0, fontSize: 12 }}>
          Tip: the demo bank API runs at <code>http://localhost:4000/graphql</code>.
        </Typography.Paragraph>
      </Card>
    </Flex>
  );
}
