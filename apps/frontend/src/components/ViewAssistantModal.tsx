import { useEffect, useRef, useState } from 'react';
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
  Timeline,
  Typography,
  theme,
} from 'antd';
import { RobotOutlined, SettingOutlined, ThunderboltOutlined } from '@ant-design/icons';
import type { ViewSpec, ViewScope } from '@fluid/shared';
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
  editingViewId?: string;
  initialSpec?: ViewSpec;
  editingIsDefault?: boolean;
  /** Scope to associate a newly created view with (list vs detail column). */
  scope?: ViewScope;
}

export function ViewAssistantModal({
  open,
  concept,
  schema,
  onClose,
  onSaved,
  onOpenJson,
  onOpenSettings,
  editingViewId,
  initialSpec,
  editingIsDefault,
  scope,
}: ViewAssistantModalProps) {
  const { message } = AntdApp.useApp();
  const { token } = theme.useToken();
  const settings = useLlmSettings();
  const [prompt, setPrompt] = useState('');
  const [history, setHistory] = useState<ChatMessage[]>([]);
  const [spec, setSpec] = useState<ViewSpec | null>(initialSpec ?? null);
  const [meta, setMeta] = useState<{ provider: string; model: string } | null>(null);
  const [reasoning, setReasoning] = useState<string[] | null>(null);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isDefault, setIsDefault] = useState(editingIsDefault ?? false);
  const [error, setError] = useState<string | null>(null);
  // Live output streamed by the provider while generating (Claude Code only).
  const [live, setLive] = useState<{ thinking: string; text: string } | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const liveRef = useRef<HTMLPreElement | null>(null);

  const isEditing = !!editingViewId;

  // Stop an in-flight generation when the modal closes or unmounts.
  useEffect(() => {
    if (!open) abortRef.current?.abort();
    return () => abortRef.current?.abort();
  }, [open]);

  useEffect(() => {
    if (liveRef.current) liveRef.current.scrollTop = liveRef.current.scrollHeight;
  }, [live]);

  useEffect(() => {
    if (!open) return;
    setPrompt('');
    setHistory([]);
    setSpec(initialSpec ?? null);
    setMeta(null);
    setReasoning(null);
    setGenerating(false);
    setSaving(false);
    setIsDefault(editingIsDefault ?? false);
    setError(null);
    setLive(null);
  }, [open, initialSpec, editingIsDefault]);

  const handleGenerate = async () => {
    const trimmed = prompt.trim();
    if (!trimmed) return;
    setGenerating(true);
    setError(null);
    setReasoning(null);
    setLive(null);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const res = await bffClient.generateViewStream(
        {
          concept,
          schema,
          prompt: trimmed,
          scope: initialSpec?.scope ?? scope,
          history,
          config: toConfigOverrides(settings),
        },
        (delta) =>
          setLive((cur) => {
            const next = cur ?? { thinking: '', text: '' };
            return delta.kind === 'thinking'
              ? { ...next, thinking: next.thinking + delta.text }
              : { ...next, text: next.text + delta.text };
          }),
        controller.signal,
      );
      setSpec(res.spec);
      setMeta({ provider: res.provider, model: res.model });
      setReasoning(res.reasoning ?? null);
      setHistory((h) => [
        ...h,
        { role: 'user', content: trimmed },
        { role: 'assistant', content: JSON.stringify(res.spec) },
      ]);
      setPrompt('');
    } catch (err) {
      if (!controller.signal.aborted) setError((err as Error).message);
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      setGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!spec) return;
    setSaving(true);
    setError(null);
    // Associate the view with the column it was created from; keep an existing
    // association when refining an already-scoped view.
    const specToSave: ViewSpec = { ...spec, scope: spec.scope ?? scope };
    try {
      if (isEditing) {
        await bffClient.updateView(editingViewId, { spec: specToSave, isDefault });
        message.success('View updated');
        const saved = await bffClient.getView(editingViewId);
        onSaved(saved);
      } else {
        const saved = await bffClient.createView(specToSave, isDefault);
        message.success('View saved');
        onSaved(saved);
      }
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
          <span>{isEditing ? 'Edit' : 'Create'} a view with the assistant — {concept}</span>
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
          {isEditing ? 'Update view' : 'Save view'}
        </Button>,
      ]}
    >
      <Space direction="vertical" size={12} style={{ width: '100%', marginTop: 8 }}>
        <Alert
          type="info"
          showIcon
          message="💡 Tip: Ask for navigation links"
          description="Request clickable elements in your prompt like: 'Create a table with clickable IDs that navigate to details' or 'Add links to related customers'. This enables infinite navigation between objects!"
          style={{ marginBottom: 8 }}
        />
        <Flex align="center" justify="space-between" wrap gap={8}>
          <Typography.Text type="secondary">
            {isEditing
              ? 'Refine this view with prompts, then update it.'
              : 'Describe the dashboard you want (tables, stats, charts). The assistant returns a view you can preview, refine, then save.'}
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
                <RobotOutlined /> "{t.content}"
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
                : 'e.g. "Create a table with clickable IDs to navigate to details" or "Show accounts with links to related customers"'
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

        {generating && live && (
          <div>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              <ThunderboltOutlined /> Live output
            </Typography.Text>
            <pre
              ref={liveRef}
              style={{
                margin: '4px 0 0',
                padding: 12,
                maxHeight: 220,
                overflow: 'auto',
                whiteSpace: 'pre-wrap',
                fontSize: 12,
                borderRadius: 8,
                background: token.colorFillQuaternary,
                border: `1px solid ${token.colorBorderSecondary}`,
              }}
            >
              {live.thinking && (
                <span style={{ color: token.colorTextTertiary, fontStyle: 'italic' }}>
                  {live.thinking}
                  {'\n\n'}
                </span>
              )}
              {live.text}
            </pre>
          </div>
        )}

        {reasoning && reasoning.length > 0 && (
          <Alert
            type="info"
            showIcon
            message="LLM Reasoning"
            description={
              <Timeline
                items={reasoning.map((step) => ({
                  label: null,
                  children: <Typography.Text>{step}</Typography.Text>,
                }))}
                style={{ marginTop: 8 }}
              />
            }
          />
        )}

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
                border: `1px solid ${token.colorBorderSecondary}`,
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
