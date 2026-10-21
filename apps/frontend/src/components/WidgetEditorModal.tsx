import { useEffect, useState } from 'react';
import {
  App as AntdApp,
  Alert,
  Button,
  Empty,
  Input,
  Modal,
  Space,
  Timeline,
  Typography,
  theme,
} from 'antd';
import { RobotOutlined, ThunderboltOutlined } from '@ant-design/icons';
import type { ViewSpec, Widget } from '@fluid/shared';
import { useLlmSettings } from '../store';
import {
  bffClient,
  type ChatMessage,
  type ConceptSchemaPayload,
  type SavedView,
} from '../bff/client';
import { toConfigOverrides } from '../llm/conceptSchema';

interface WidgetEditorModalProps {
  open: boolean;
  concept: string;
  schema: ConceptSchemaPayload;
  widget: Widget;
  viewSpec: ViewSpec;
  viewId: string;
  onClose: () => void;
  onSaved: (updatedView: SavedView) => void;
}

export function WidgetEditorModal({
  open,
  concept,
  schema,
  widget,
  viewSpec,
  viewId,
  onClose,
  onSaved,
}: WidgetEditorModalProps) {
  const { message } = AntdApp.useApp();
  const { token } = theme.useToken();
  const settings = useLlmSettings();
  const [prompt, setPrompt] = useState('');
  const [history, setHistory] = useState<ChatMessage[]>([]);
  const [generating, setGenerating] = useState(false);
  const [reasoning, setReasoning] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newWidget, setNewWidget] = useState<Widget | null>(null);

  useEffect(() => {
    if (!open) return;
    setPrompt('');
    setHistory([]);
    setReasoning(null);
    setError(null);
    setNewWidget(null);
  }, [open]);

  const handleGenerate = async () => {
    const trimmed = prompt.trim();
    if (!trimmed) return;
    setGenerating(true);
    setError(null);
    setReasoning(null);
    try {
      // Build view queries map for context
      const viewQueries: Record<string, string> = {};
      for (const [key, query] of Object.entries(viewSpec.queries)) {
        viewQueries[key] = query.query;
      }

      const res = await bffClient.generateWidget({
        concept,
        schema,
        prompt: trimmed,
        existingWidget: widget,
        viewQueries,
        history,
        config: toConfigOverrides(settings),
      });
      setNewWidget(res.widget);
      setReasoning(res.reasoning ?? null);
      setHistory((h) => [
        ...h,
        { role: 'user', content: trimmed },
        { role: 'assistant', content: '(widget generated)' },
      ]);
      setPrompt('');
      message.success('Widget generated');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to generate widget';
      setError(msg);
      message.error(msg);
    } finally {
      setGenerating(false);
    }
  };

  const handleApply = async () => {
    if (!newWidget) return;
    try {
      const updated = await bffClient.updateViewWidget(viewId, widget.id, newWidget);
      message.success('Widget updated');
      onSaved(updated);
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to update widget';
      setError(msg);
      message.error(msg);
    }
  };

  return (
    <Modal
      title={`Modify widget: ${widget.title || widget.type}`}
      open={open}
      onCancel={onClose}
      width={900}
      footer={[
        <Button key="cancel" onClick={onClose}>
          Close
        </Button>,
        <Button
          key="apply"
          type="primary"
          onClick={handleApply}
          disabled={!newWidget}
          loading={generating}
        >
          Apply Changes
        </Button>,
      ]}
    >
      <Space orientation="vertical" style={{ width: '100%' }} size="large">
        {/* Prompt input */}
        <div>
          <Typography.Text strong>Describe how you'd like to modify this widget:</Typography.Text>
          <Input.TextArea
            placeholder={`E.g., "Change this to show top 10 instead of all", "Add a chart showing distribution", "Change colors to show risk levels"...`}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={3}
            disabled={generating}
            style={{ marginTop: 8 }}
          />
          <Button
            type="primary"
            onClick={handleGenerate}
            loading={generating}
            disabled={!prompt.trim()}
            style={{ marginTop: 8 }}
            icon={<RobotOutlined />}
          >
            {generating ? 'Generating...' : 'Generate Widget'}
          </Button>
        </div>

        {error && (
          <Alert type="error" title={error} showIcon closable={{ onClose: () => setError(null) }} />
        )}

        {/* Reasoning display */}
        {reasoning && reasoning.length > 0 && (
          <div>
            <Typography.Text strong>
              <ThunderboltOutlined /> Reasoning:
            </Typography.Text>
            <Timeline
              items={reasoning.map((step) => ({
                children: <Typography.Text type="secondary">{step}</Typography.Text>,
              }))}
              style={{ marginTop: 8 }}
            />
          </div>
        )}

        {/* New widget preview */}
        {newWidget && (
          <div style={{ backgroundColor: token.colorFillTertiary, padding: 12, borderRadius: 4 }}>
            <Typography.Text strong>Generated widget preview:</Typography.Text>
            <pre style={{ marginTop: 8, overflow: 'auto', maxHeight: 300 }}>
              {JSON.stringify(newWidget, null, 2)}
            </pre>
          </div>
        )}

        {!newWidget && !generating && (
          <Empty description="Generate a widget to preview changes" />
        )}
      </Space>
    </Modal>
  );
}
