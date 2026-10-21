import { Button, Space, Tooltip } from 'antd';
import { AppstoreOutlined, CheckOutlined } from '@ant-design/icons';
import type { LayoutEditor } from './useLayoutEditor';
import styles from './LayoutEditor.module.css';

interface LayoutEditToolbarProps {
  editor: LayoutEditor;
  busy: boolean;
  /** Icon-only buttons where room is short. */
  compact: boolean;
}

/** Tidy up / Cancel / Done, shown in place of the column actions while arranging widgets. */
export function LayoutEditToolbar({ editor, busy, compact }: LayoutEditToolbarProps) {
  return (
    <Space size={4} className={styles.toolbar}>
      <Tooltip title="Close the gaps between widgets">
        <Button size="small" icon={<AppstoreOutlined />} onClick={editor.tidy}>
          {compact ? null : 'Tidy up'}
        </Button>
      </Tooltip>
      <Button size="small" onClick={editor.exit} disabled={busy}>
        Cancel
      </Button>
      <Button size="small" type="primary" icon={<CheckOutlined />} loading={busy} onClick={editor.save}>
        Done
      </Button>
    </Space>
  );
}
