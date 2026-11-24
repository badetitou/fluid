import { useState } from 'react';
import { App as AntdApp, Alert, Button, Empty, Input, Modal, Space, Typography } from 'antd';
import { RobotOutlined } from '@ant-design/icons';
import type { SavedView } from '../../entities/view';
import { Reasoning } from '../../shared/ui';
import { useWidgetAssistant, type WidgetTarget } from './useWidgetAssistant';
import styles from './WidgetEditorModal.module.css';

interface WidgetEditorModalProps {
  target: WidgetTarget;
  onClose: () => void;
  onSaved: (updatedView: SavedView) => void;
}

/** Rewrites one widget of a saved view from a prompt. Mounted only while open. */
export function WidgetEditorModal({ target, onClose, onSaved }: WidgetEditorModalProps) {
  const { message } = AntdApp.useApp();
  const [prompt, setPrompt] = useState('');
  const { generating, error, clearError, proposal, generate, apply } = useWidgetAssistant(target);
  const { widget } = target;

  const handleGenerate = async () => {
    if (await generate(prompt)) {
      setPrompt('');
      message.success('Widget generated');
    }
  };

  const handleApply = async () => {
    const updated = await apply();
    if (!updated) return;
    message.success('Widget updated');
    onSaved(updated);
  };

  return (
    <Modal
      title={`Modify widget: ${widget.title || widget.type}`}
      open
      onCancel={onClose}
      width="min(900px, calc(100vw - 24px))"
      footer={[
        <Button key="cancel" onClick={onClose}>
          Close
        </Button>,
        <Button key="apply" type="primary" onClick={handleApply} disabled={!proposal} loading={generating}>
          Apply Changes
        </Button>,
      ]}
    >
      <Space orientation="vertical" className={styles.full} size="large">
        <div>
          <Typography.Text strong>Describe how you'd like to modify this widget:</Typography.Text>
          <Input.TextArea
            placeholder='E.g., "Change this to show top 10 instead of all", "Add a chart showing distribution"…'
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={3}
            disabled={generating}
            className={styles.spaced}
          />
          <Button
            type="primary"
            onClick={handleGenerate}
            loading={generating}
            disabled={!prompt.trim()}
            className={styles.spaced}
            icon={<RobotOutlined />}
          >
            {generating ? 'Generating...' : 'Generate Widget'}
          </Button>
        </div>

        {error && <Alert type="error" title={error} showIcon closable={{ onClose: clearError }} />}

        {proposal ? (
          <>
            <Reasoning steps={proposal.reasoning} />
            <div className={styles.proposal}>
              <Typography.Text strong>Generated widget preview:</Typography.Text>
              <pre className={styles.json}>{JSON.stringify(proposal.widget, null, 2)}</pre>
            </div>
          </>
        ) : (
          !generating && <Empty description="Generate a widget to preview changes" />
        )}
      </Space>
    </Modal>
  );
}
