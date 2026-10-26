import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Divider, Flex, Form, Input, Typography } from 'antd';
import { ApiOutlined } from '@ant-design/icons';
import { useSources } from '../../entities/source';
import { DEFAULT_GRAPHQL_URL } from '../../runtime-config';
import { FluidLogo, GradientButton } from '../../shared/ui';
import { DemoPicker } from './DemoPicker';
import styles from './ConnectPage.module.css';

/** Entry screen: connect to a GraphQL endpoint, or to one of the demo sources. */
export function ConnectPage() {
  const navigate = useNavigate();
  const { switchTo } = useSources();
  const [url, setUrl] = useState(DEFAULT_GRAPHQL_URL);

  const connectTo = (target: string) => {
    if (!target.trim()) return;
    switchTo(target.trim());
    navigate('/', { replace: true });
  };

  return (
    <Flex align="center" justify="center" className={styles.page}>
      <Card className={styles.card}>
        <Flex vertical gap={8} className={styles.intro}>
          <Flex align="center" gap={12}>
            <FluidLogo className={styles.logo} />
            <Typography.Title level={2} className={styles.title}>
              fluid
            </Typography.Title>
          </Flex>
          <Typography.Text type="secondary">
            Connect to a GraphQL source and explore its concepts — no pre-built screens, just your data.
          </Typography.Text>
        </Flex>

        <Form layout="vertical" onFinish={() => connectTo(url)}>
          <Form.Item label="GraphQL endpoint" required>
            <Input
              size="large"
              prefix={<ApiOutlined />}
              placeholder="https://example.com/graphql"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              autoFocus
            />
          </Form.Item>
          <GradientButton size="large" htmlType="submit" block disabled={!url.trim()}>
            Connect
          </GradientButton>
        </Form>

        <Divider plain className={styles.divider}>
          New to Fluid? Try a demo
        </Divider>

        <DemoPicker onConnect={connectTo} />
      </Card>
    </Flex>
  );
}
