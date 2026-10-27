import { Alert, Button, Space } from 'antd';
import { ArrowLeftOutlined, CopyOutlined } from '@ant-design/icons';
import styles from './WidgetBuilder.module.css';

interface PluginWidgetNoteProps {
  type: string;
  onCopy: () => void;
  onClose: () => void;
}

/** Shown instead of the options form for a plugin widget: its options are not generated yet. */
export function PluginWidgetNote({ type, onCopy, onClose }: PluginWidgetNoteProps) {
  return (
    <div className={styles.inspector}>
      <Space size={4}>
        <Button type="text" size="small" icon={<ArrowLeftOutlined />} onClick={onClose}>
          Back to the catalog
        </Button>
        <Button type="text" size="small" icon={<CopyOutlined />} onClick={onCopy}>
          Copy
        </Button>
      </Space>
      <Alert
        type="info"
        showIcon
        title={`“${type}” is a plugin widget`}
        description="Edit its options with the JSON editor or the widget assistant."
      />
    </div>
  );
}
