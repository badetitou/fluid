import { Button, Card, Space, Typography } from 'antd';
import { DisconnectOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useConnection } from '../../store';
import styles from './SettingsPage.module.css';

/** The GraphQL source in use, and how to leave it. */
export function ConnectionCard() {
  const navigate = useNavigate();
  const graphqlUrl = useConnection((s) => s.graphqlUrl);
  const disconnect = useConnection((s) => s.disconnect);

  const handleDisconnect = () => {
    disconnect();
    navigate('/connect', { replace: true });
  };

  return (
    <Card title="Connection">
      <Space orientation="vertical" className={styles.full}>
        <div>
          <Typography.Text strong>GraphQL URL</Typography.Text>
          <div className={styles.url}>
            <Typography.Text ellipsis type="secondary" copyable className={styles.grow}>
              {graphqlUrl}
            </Typography.Text>
          </div>
        </div>
        <Button danger icon={<DisconnectOutlined />} onClick={handleDisconnect}>
          Disconnect
        </Button>
      </Space>
    </Card>
  );
}
