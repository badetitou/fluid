import { Button, Space, Tooltip } from 'antd';
import { AppstoreOutlined, CheckOutlined, CodeOutlined, RobotOutlined } from '@ant-design/icons';
import type { LayoutEditor } from './useLayoutEditor';
import styles from './LayoutEditor.module.css';

interface LayoutEditToolbarProps {
  editor: LayoutEditor;
  busy: boolean;
  /** Icon-only buttons where room is short. */
  compact: boolean;
  /** Continue the edit with the assistant; omitted when it cannot be reached. */
  onOpenAssistant?: () => void;
  /** Continue the edit in the JSON editor. */
  onOpenJson: () => void;
}

/** AI / JSON / Tidy up / Cancel / Done, shown in place of the column actions while arranging widgets. */
export function LayoutEditToolbar({ editor, busy, compact, onOpenAssistant, onOpenJson }: LayoutEditToolbarProps) {
  return (
    <Space size={4} className={styles.toolbar}>
      {onOpenAssistant && (
        <Tooltip title="Continue with the assistant">
          <Button size="small" icon={<RobotOutlined />} onClick={onOpenAssistant} disabled={busy}>
            {compact ? null : 'AI'}
          </Button>
        </Tooltip>
      )}
      <Tooltip title="Continue in the JSON editor">
        <Button size="small" icon={<CodeOutlined />} onClick={onOpenJson} disabled={busy}>
          {compact ? null : 'JSON'}
        </Button>
      </Tooltip>
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
