import { Alert, Button } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import styles from './WidgetBuilder.module.css';

interface PluginWidgetNoteProps {
  type: string;
  onClose: () => void;
}

/** Shown instead of the options form for a plugin widget: its options are not generated yet. */
export function PluginWidgetNote({ type, onClose }: PluginWidgetNoteProps) {
  return (
    <div className={styles.inspector}>
      <Button type="text" size="small" icon={<ArrowLeftOutlined />} onClick={onClose}>
        Back to the catalog
      </Button>
      <Alert
        type="info"
        showIcon
        title={`“${type}” is a plugin widget`}
        description="Edit its options with the JSON editor or the widget assistant."
      />
    </div>
  );
}
