import { Button, Card, Space, Switch, Typography } from 'antd';
import { DisconnectOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useSourceWrites } from '../../entities/preferences/useSourceWrites';
import { SavedSourcesList } from '../../features/source-switcher';
import { useConnection } from '../../store';
import styles from './SettingsPage.module.css';

/** The GraphQL source in use, whether fluid may write to it, and how to leave it. */
export function ConnectionCard() {
  const navigate = useNavigate();
  const graphqlUrl = useConnection((s) => s.graphqlUrl);
  const disconnect = useConnection((s) => s.disconnect);
  const { writable, setWritable } = useSourceWrites();

  const handleDisconnect = () => {
    disconnect();
    navigate('/connect', { replace: true });
  };

  return (
    <Card>
      <Space orientation="vertical" className={styles.full}>
        <div>
          <Typography.Text strong>GraphQL URL</Typography.Text>
          <div className={styles.url}>
            <Typography.Text ellipsis type="secondary" copyable className={styles.grow}>
              {graphqlUrl}
            </Typography.Text>
          </div>
        </div>
        <div>
          <Space>
            <Switch checked={writable} onChange={setWritable} aria-label="Allow changes" />
            <Typography.Text strong>Allow changes</Typography.Text>
          </Space>
          <Typography.Paragraph type="secondary" className={styles.control}>
            Let views send mutations to this source (edit, create, delete). Off by default; each change
            still needs a click, and deletions a confirmation.
          </Typography.Paragraph>
        </div>
        <div>
          <Typography.Text strong>Kept sources</Typography.Text>
          <Typography.Paragraph type="secondary" className={styles.control}>
            The sources offered in the top bar, besides those of the source plugins. Name them to tell them apart.
          </Typography.Paragraph>
          <SavedSourcesList />
        </div>
        <Button danger icon={<DisconnectOutlined />} onClick={handleDisconnect}>
          Disconnect
        </Button>
      </Space>
    </Card>
  );
}
