import { Button, Popconfirm, Tag, Tooltip, Typography } from 'antd';
import { DeleteOutlined, SwapOutlined } from '@ant-design/icons';
import type { KeptSource } from '../../entities/source';
import styles from './SourceSwitcher.module.css';

interface SavedSourceRowProps {
  source: KeptSource;
  current: boolean;
  onSwitch: () => void;
  onRename: (name: string) => void;
  onForget: () => void;
}

/** One kept source: its editable name (a provider's, toned down, until given), its URL, switch to it or forget it. */
export function SavedSourceRow({ source, current, onSwitch, onRename, onForget }: SavedSourceRowProps) {
  return (
    <div className={styles.row}>
      <div className={styles.rowMain}>
        <Typography.Text
          strong
          className={styles.rowName}
          type={source.name ? undefined : 'secondary'}
          editable={{ text: source.name ?? '', onChange: onRename, tooltip: 'Rename' }}
        >
          {source.name ?? source.providerName ?? 'Unnamed'}
        </Typography.Text>
        <div>
          <Typography.Text type="secondary" ellipsis copyable>
            {source.url}
          </Typography.Text>
        </div>
      </div>
      {current ? (
        <Tag color="processing">connected</Tag>
      ) : (
        <Tooltip title="Switch to this source">
          <Button size="small" icon={<SwapOutlined />} aria-label="Switch to this source" onClick={onSwitch} />
        </Tooltip>
      )}
      <Popconfirm title="Forget this source?" okText="Forget" onConfirm={onForget}>
        <Button size="small" type="text" danger icon={<DeleteOutlined />} aria-label="Forget this source" />
      </Popconfirm>
    </div>
  );
}
