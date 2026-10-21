import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, Divider, Flex, Form, Input, Select, Tag, Typography, theme } from 'antd';
import { ApiOutlined, PlayCircleOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { useConnection } from '../store';
import { DEFAULT_GRAPHQL_URL } from '../runtime-config';

const DEFAULT_URL = DEFAULT_GRAPHQL_URL;

interface DemoSource {
  key: string;
  label: string;
  url: string;
  description: string;
  concepts: string[];
  /** Runs on the developer's machine rather than on the public internet. */
  local?: boolean;
}

// Public, CORS-enabled GraphQL APIs checked against Fluid's introspection,
// auto lists and detail views, to try it without running anything.
const DEMO_SOURCES: DemoSource[] = [
  {
    key: 'rick-and-morty',
    label: 'Rick and Morty',
    url: 'https://rickandmortyapi.com/graphql',
    description: 'Characters of the show, the places they live and the episodes they appear in.',
    concepts: ['Character', 'Location', 'Episode'],
  },
  {
    key: 'countries',
    label: 'Countries',
    url: 'https://countries.trevorblades.com/',
    description: 'Every country with its continent, languages, currency and capital.',
    concepts: ['Country', 'Continent', 'Language'],
  },
  {
    key: 'graphqlzero',
    label: 'GraphQLZero (blog & todos)',
    url: 'https://graphqlzero.almansi.me/api',
    description: 'Fake users with their posts, comments, albums, photos and todos.',
    concepts: ['User', 'Post', 'Comment', 'Album', 'Photo', 'Todo'],
  },
  {
    key: 'bank',
    label: 'Fluid bank (local)',
    url: 'http://localhost:4000/graphql',
    description: "The project's own demo bank API: customers, accounts, cards and transactions.",
    concepts: ['Customer', 'Account', 'Card', 'Transaction', 'Transfer', 'Beneficiary'],
    local: true,
  },
];

export function ConnectPage() {
  const navigate = useNavigate();
  const connect = useConnection((s) => s.connect);
  const [url, setUrl] = useState(DEFAULT_URL);
  const [demoKey, setDemoKey] = useState(DEMO_SOURCES[0].key);
  const demo = DEMO_SOURCES.find((d) => d.key === demoKey) ?? DEMO_SOURCES[0];
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

        <Divider plain style={{ margin: '20px 0 16px' }}>
          New to Fluid? Try a demo
        </Divider>

        <Flex vertical gap={12}>
          <ol style={{ margin: 0, paddingInlineStart: 20, color: token.colorTextSecondary }}>
            <li>Pick a demo API: Fluid reads its schema and lists its concepts.</li>
            <li>Open a concept to get a list generated automatically, then click a row to drill into it.</li>
            <li>
              Each column is a <em>perspective</em>: use its <code>⋯</code> menu to create one with the AI
              assistant, or pin a deeper concept to the sidebar.
            </li>
          </ol>
          <Select
            size="large"
            value={demoKey}
            onChange={setDemoKey}
            options={DEMO_SOURCES.map((d) => ({
              value: d.key,
              label: (
                <Flex justify="space-between" align="center" gap={8}>
                  <span>{d.label}</span>
                  {d.local && <Tag style={{ marginInlineEnd: 0 }}>needs local server</Tag>}
                </Flex>
              ),
            }))}
          />
          <Flex vertical gap={6}>
            <Typography.Text type="secondary">{demo.description}</Typography.Text>
            <Flex wrap gap={4}>
              {demo.concepts.map((c) => (
                <Tag key={c} color="blue" style={{ marginInlineEnd: 0 }}>
                  {c}
                </Tag>
              ))}
            </Flex>
          </Flex>
          <Button
            size="large"
            icon={<PlayCircleOutlined />}
            block
            onClick={() => connectTo(demo.url)}
          >
            Explore the {demo.label} demo
          </Button>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            Endpoint: <code>{demo.url}</code>
            {demo.local ? ' — start it with the project first.' : ''} You can switch sources later from
            the settings.
          </Typography.Text>
        </Flex>
      </Card>
    </Flex>
  );
}
