import { useEffect, useState } from 'react';
import {
  App as AntdApp,
  Alert,
  Button,
  Checkbox,
  Divider,
  Empty,
  Flex,
  Input,
  Modal,
  Space,
  Tag,
  Typography,
} from 'antd';
import { RobotOutlined, SettingOutlined, ThunderboltOutlined } from '@ant-design/icons';
import type { ViewSpec } from '@fluid/shared';
import { ViewRenderer } from '../views/ViewRenderer';
import { useLlmSettings } from '../store';
import {
  bffClient,
  type ChatMessage,
  type ConceptSchemaPayload,
  type SavedView,
} from '../bff/client';
import { toConfigOverrides } from '../llm/conceptSchema';

interface ViewAssistantModalProps {
  open: boolean;
  concept: string;
  schema: ConceptSchemaPayload;
  onClose: () => void;
  onSaved: (view: SavedView) => void;
  onOpenJson: (spec: ViewSpec) => void;
  onOpenSettings: () => void;
}

export function ViewAssistantModal({
  open,
  concept,
  schema,
  onClose,
  onSaved,
  onOpenJson,
  onOpenSettings,
}: ViewAssistantModalProps) {
  const { message } = AntdApp.useApp();
  const settings = useLlmSettings();
  const [prompt, setPrompt] = useState('');
  const [history, setHistory] = useState<ChatMessage[]>([]);
  const [spec, setSpec] = useState<ViewSpec | null>(null);
  const [meta, setMeta] = useState<{ provider: string; model: string } | null>(null);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isDefault, setIsDefault] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setPrompt('');
    setHistory([]);
    setSpec(null);
    setMeta(null);
    setGenerating(false);
    setSaving(false);
    setIsDefault(false);
    setError(null);
  }, [open]);

  const handleGenerate = async () => {
    const trimmed = prompt.trim();
    if (!trimmed) return;
    setGenerating(true);
    setError(null);
    try {
      const res = await bffClient.generateView({
        concept,
        schema,
        prompt: trimmed,
        history,
        config: toConfigOverrides(settings),
      });
      setSpec(res.spec);
      setMeta({ provider: res.provider, model: res.model });
      setHistory((h) => [
        ...h,
        { role: 'user', content: trimmed },
        { role: 'assistant', content: JSON.stringify(res.spec) },
      ]);
      setPrompt('');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!spec) return;
    setSaving(true);
    setError(null);
    try {
      const saved = await bffClient.createView(spec, isDefault);
      message.success('View saved');
      onSaved(saved);
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const userTurns = history.filter((m) => m.role === 'user');

  return (
    <Modal
      title={
        <Space>
          <RobotOutlined />
          <span>Create a view with the assistant — {concept}</span>
        </Space>
      }
      open={open}
      onCancel={onClose}
      width={900}
      destroyOnHidden
      footer={[
        <Button key="settings" icon={<SettingOutlined />} onClick={onOpenSettings}>
          Settings
        </Button>,
        <Button
          key="json"
          onClick={() => spec && onOpenJson(spec)}
          disabled={!spec}
        >
          Open in JSON editor
        </Button>,
        <Button key="save" type="primary" onClick={handleSave} loading={saving} disabled={!spec}>
          Save view
        </Button>,
      ]}
    >
      <Space direction="vertical" size={12} style={{ width: '100%', marginTop: 8 }}>
        <Flex align="center" justify="space-between" wrap gap={8}>
          <Typography.Text type="secondary">
            Describe the dashboard you want (tables, stats, charts). The assistant returns a view
            you can preview, refine, then save.
          </Typography.Text>
          <Tag icon={<ThunderboltOutlined />} color="blue">
            {settings.provider}
            {meta ? ` · ${meta.model}` : ''}
          </Tag>
        </Flex>

        {userTurns.length > 0 && (
          <Space direction="vertical" size={2} style={{ width: '100%' }}>
            {userTurns.map((t, i) => (
              <Typography.Text key={i} type="secondary" style={{ fontSize: 12 }}>
                <RobotOutlined /> “{t.content}”
              </Typography.Text>
            ))}
          </Space>
        )}

        <Space.Compact style={{ width: '100%' }}>
          <Input.TextArea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={
              spec
                ? 'Refine, e.g. "add a pie chart of balances by currency"'
                : 'e.g. "totals per account type, a chart of balances over time, and a table"'
            }
            autoSize={{ minRows: 2, maxRows: 5 }}
            onPressEnter={(e) => {
              if (!e.shiftKey) {
                e.preventDefault();
                if (!generating) handleGenerate();
              }
            }}
          />
        </Space.Compact>
        <Button
          type="primary"
          icon={<RobotOutlined />}
          onClick={handleGenerate}
          loading={generating}
          disabled={!prompt.trim()}
        >
          {spec ? 'Refine' : 'Generate'}
        </Button>

        {error && (
          <Alert
            type="error"
            showIcon
            message="Generation failed"
            description={<pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{error}</pre>}
          />
        )}

        <Divider style={{ margin: '4px 0' }}>Preview</Divider>

        {spec ? (
          <>
            <Checkbox checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)}>
              Set as the default view for {concept}
            </Checkbox>
            <div
              style={{
                border: '1px solid #f0f0f0',
                borderRadius: 8,
                padding: 12,
                maxHeight: 460,
                overflow: 'auto',
              }}
            >
              <ViewRenderer key={spec.id} spec={spec} />
            </div>
          </>
        ) : (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={generating ? 'Generating…' : 'No preview yet — generate a view above.'}
          />
        )}
      </Space>
    </Modal>
  );
}
