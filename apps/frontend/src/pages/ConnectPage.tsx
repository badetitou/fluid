import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, Divider, Flex, Form, Input, Typography, theme } from 'antd';
import { ApiOutlined, PlayCircleOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { useConnection } from '../store';
import { DEFAULT_GRAPHQL_URL } from '../runtime-config';

const DEFAULT_URL = DEFAULT_GRAPHQL_URL;

// Public, CORS-enabled GraphQL API used to try Fluid without running anything.
const DEMO_URL = 'https://rickandmortyapi.com/graphql';

export function ConnectPage() {
  const navigate = useNavigate();
  const connect = useConnection((s) => s.connect);
  const [url, setUrl] = useState(DEFAULT_URL);
  const { token } = theme.useToken();

  const connectTo = (target: string) => {
    if (!target.trim()) return;
    connect(target);
    navigate('/', { replace: true });
  };
  const handleConnect = () => connectTo(url);

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
      <Card style={{ width: 500, maxWidth: '100%' }} variant="borderless">
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

        <Divider plain style={{ margin: '20px 0 16px' }}>
          New to Fluid?
        </Divider>

        <Flex vertical gap={12}>
          <Typography.Text>
            Try it on the public <strong>Rick and Morty</strong> GraphQL API, with nothing to install:
          </Typography.Text>
          <ol style={{ margin: 0, paddingInlineStart: 20, color: token.colorTextSecondary }}>
            <li>Fluid reads the API's schema and lists its concepts: characters, locations, episodes.</li>
            <li>Open a concept to get a list generated automatically, then click a row to drill into it.</li>
            <li>
              Each column is a <em>perspective</em>: use its <code>⋯</code> menu to create one with the AI
              assistant, or pin a deeper concept to the sidebar.
            </li>
          </ol>
          <Button size="large" icon={<PlayCircleOutlined />} block onClick={() => connectTo(DEMO_URL)}>
            Explore the Rick and Morty demo
          </Button>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            Endpoint: <code>{DEMO_URL}</code> — you can switch sources later from the settings.
          </Typography.Text>
        </Flex>
      </Card>
    </Flex>
  );
}
