import { useEffect, useMemo, useRef, useState } from 'react';
import {
  App as AntdApp,
  Alert,
  BorderBeam,
  Button,
  Checkbox,
  Collapse,
  Empty,
  Flex,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Splitter,
  Tag,
  Timeline,
  Tooltip,
  Typography,
  theme,
} from 'antd';
import {
  ClearOutlined,
  EyeOutlined,
  LoadingOutlined,
  RobotOutlined,
  SendOutlined,
  SettingOutlined,
  StopOutlined,
  ThunderboltOutlined,
  UserOutlined,
} from '@ant-design/icons';
import type { ViewSpec, ViewScope } from '@fluid/shared';
import { ViewRenderer } from '../views/ViewRenderer';
import { useAssistantChats, useLlmSettings, type AssistantTurn } from '../store';
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

const EMPTY_TURNS: AssistantTurn[] = [];

/** Successful turns numbered as spec versions (v1, v2, …); v0 is the saved view. */
function versionTurns(turns: AssistantTurn[]): Map<string, number> {
  const versions = new Map<string, number>();
  let n = 0;
  for (const t of turns) if (t.spec) versions.set(t.id, ++n);
  return versions;
}

/**
 * Conversation replayed to the model: the saved view (when refining one), then
 * every successful exchange up to the version the new prompt builds on.
 */
function buildHistory(
  turns: AssistantTurn[],
  versions: Map<string, number>,
  base: number,
  initialSpec?: ViewSpec,
): ChatMessage[] {
  const history: ChatMessage[] = [];
  if (initialSpec) {
    history.push(
      { role: 'user', content: 'Here is the current saved view. Refine it with my next requests.' },
      { role: 'assistant', content: JSON.stringify(initialSpec) },
    );
  }
  for (const t of turns) {
    const v = versions.get(t.id);
    if (v === undefined) continue;
    if (v > base) break;
    history.push({ role: 'user', content: t.prompt }, { role: 'assistant', content: JSON.stringify(t.spec) });
  }
  return history;
}

function summarizeSpec(spec: ViewSpec): string {
  const widgets = spec.widgets ?? [];
  const parts = widgets.map((w) => (w.title ? `${w.type} “${w.title}”` : w.type));
  return parts.length ? parts.join(' · ') : 'No widget';
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
  const sessionKey = `${concept}|${initialSpec?.scope ?? scope ?? ''}|${editingViewId ?? 'new'}`;
  const turns = useAssistantChats((s) => s.sessions[sessionKey]?.turns ?? EMPTY_TURNS);
  const addTurn = useAssistantChats((s) => s.addTurn);
  const clearSession = useAssistantChats((s) => s.clear);

  const [prompt, setPrompt] = useState('');
  // Version shown in the preview and refined by the next prompt; null = latest.
  const [selected, setSelected] = useState<number | null>(null);
  const [pending, setPending] = useState<{ prompt: string; basedOn: number | null } | null>(null);
  const [saving, setSaving] = useState(false);
  const [isDefault, setIsDefault] = useState(editingIsDefault ?? false);
  const [saveError, setSaveError] = useState<string | null>(null);
  // Live output streamed by the provider while generating (Claude Code only).
  const [live, setLive] = useState<{ thinking: string; text: string } | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const liveRef = useRef<HTMLPreElement | null>(null);

  const isEditing = !!editingViewId;
  const generating = pending !== null;

  const versions = useMemo(() => versionTurns(turns), [turns]);
  const specByVersion = useMemo(() => {
    const map = new Map<number, ViewSpec>();
    if (initialSpec) map.set(0, initialSpec);
    for (const t of turns) {
      const v = versions.get(t.id);
      if (v !== undefined && t.spec) map.set(v, t.spec);
    }
    return map;
  }, [turns, versions, initialSpec]);
  const latestVersion = specByVersion.size ? Math.max(...specByVersion.keys()) : null;
  const activeVersion = selected !== null && specByVersion.has(selected) ? selected : latestVersion;
  const spec = activeVersion !== null ? (specByVersion.get(activeVersion) ?? null) : null;

  // Stop an in-flight generation when the modal closes or unmounts.
  useEffect(() => {
    if (!open) abortRef.current?.abort();
    return () => abortRef.current?.abort();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setPrompt('');
    setSelected(null);
    setPending(null);
    setSaving(false);
    setIsDefault(editingIsDefault ?? false);
    setSaveError(null);
    setLive(null);
  }, [open, sessionKey, editingIsDefault]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ block: 'end' });
  }, [turns.length, pending, open]);

  useEffect(() => {
    if (liveRef.current) liveRef.current.scrollTop = liveRef.current.scrollHeight;
  }, [live]);

  const handleGenerate = async () => {
    const trimmed = prompt.trim();
    if (!trimmed || generating) return;
    const basedOn = activeVersion;
    setPending({ prompt: trimmed, basedOn });
    setPrompt('');
    setLive(null);
    setSaveError(null);
    const controller = new AbortController();
    abortRef.current = controller;
    const turn: AssistantTurn = { id: crypto.randomUUID(), prompt: trimmed, at: Date.now(), basedOn };
    try {
      const res = await bffClient.generateViewStream(
        {
          concept,
          schema,
          prompt: trimmed,
          scope: initialSpec?.scope ?? scope,
          history: buildHistory(turns, versions, basedOn ?? 0, initialSpec),
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
      addTurn(sessionKey, { ...turn, spec: res.spec, model: res.model, reasoning: res.reasoning });
      setSelected(null);
    } catch (err) {
      addTurn(sessionKey, { ...turn, error: controller.signal.aborted ? 'Stopped.' : (err as Error).message });
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      setPending(null);
      setLive(null);
    }
  };

  const handleSave = async () => {
    if (!spec) return;
    setSaving(true);
    setSaveError(null);
    // Associate the view with the column it was created from; keep an existing
    // association when refining an already-scoped view.
    const specToSave: ViewSpec = { ...spec, scope: spec.scope ?? scope };
    // Widgets the assistant kept stay where they were arranged on the grid.
    if (isEditing && initialSpec) {
      const layouts = new Map(initialSpec.widgets.map((w) => [w.id, w.layout]));
      specToSave.widgets = specToSave.widgets.map((w) =>
        w.layout || !layouts.get(w.id) ? w : { ...w, layout: layouts.get(w.id) },
      );
    }
    try {
      let saved: SavedView;
      if (isEditing) {
        await bffClient.updateView(editingViewId, { spec: specToSave, isDefault });
        message.success('View updated');
        saved = await bffClient.getView(editingViewId);
      } else {
        saved = await bffClient.createView(specToSave, isDefault);
        message.success('View saved');
      }
      // The conversation served its purpose once the view is persisted.
      clearSession(sessionKey);
      onSaved(saved);
      onClose();
    } catch (err) {
      setSaveError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const bubble = (role: 'user' | 'assistant', children: React.ReactNode, extra?: React.CSSProperties) => (
    <Flex gap={8} justify={role === 'user' ? 'flex-end' : 'flex-start'} align="flex-start">
      {role === 'assistant' && <RobotOutlined style={{ marginTop: 8, color: token.colorPrimary }} />}
      <div
        style={{
          maxWidth: '85%',
          padding: '8px 12px',
          borderRadius: 12,
          background: role === 'user' ? token.colorPrimaryBg : token.colorFillQuaternary,
          border: `1px solid ${role === 'user' ? token.colorPrimaryBorder : token.colorBorderSecondary}`,
          position: 'relative',
          ...extra,
        }}
      >
        {children}
      </div>
      {role === 'user' && <UserOutlined style={{ marginTop: 8, color: token.colorTextTertiary }} />}
    </Flex>
  );

  const versionLabel = (v: number) => (v === 0 ? 'saved view' : `v${v}`);

  const renderTurn = (t: AssistantTurn) => {
    const v = versions.get(t.id);
    const refinedFrom = t.basedOn !== null && t.basedOn !== (v ?? 0) - 1 ? t.basedOn : null;
    return (
      <Space key={t.id} orientation="vertical" size={6} style={{ width: '100%' }}>
        {bubble(
          'user',
          <>
            {refinedFrom !== null && (
              <Typography.Text type="secondary" style={{ fontSize: 11, display: 'block' }}>
                ↳ from {versionLabel(refinedFrom)}
              </Typography.Text>
            )}
            <Typography.Text style={{ whiteSpace: 'pre-wrap' }}>{t.prompt}</Typography.Text>
          </>,
        )}
        {t.error
          ? bubble(
              'assistant',
              <Typography.Text type="danger" style={{ whiteSpace: 'pre-wrap', fontSize: 12 }}>
                {t.error}
              </Typography.Text>,
              { borderColor: token.colorErrorBorder, background: token.colorErrorBg },
            )
          : t.spec &&
            v !== undefined &&
            bubble(
              'assistant',
              <Space orientation="vertical" size={4} style={{ width: '100%' }}>
                <Flex justify="space-between" align="center" gap={8}>
                  <Space size={4}>
                    <Tag color={v === activeVersion ? 'blue' : undefined} style={{ marginInlineEnd: 0 }}>
                      v{v}
                    </Tag>
                    <Typography.Text strong>{t.spec.title ?? 'Untitled view'}</Typography.Text>
                  </Space>
                  <Tooltip title={v === activeVersion ? 'Shown in the preview' : 'Show this version'}>
                    <Button
                      size="small"
                      type={v === activeVersion ? 'primary' : 'text'}
                      icon={<EyeOutlined />}
                      onClick={() => setSelected(v)}
                    />
                  </Tooltip>
                </Flex>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  {summarizeSpec(t.spec)}
                </Typography.Text>
                {t.reasoning && t.reasoning.length > 0 && (
                  <Collapse
                    size="small"
                    ghost
                    items={[
                      {
                        key: 'r',
                        label: <Typography.Text type="secondary" style={{ fontSize: 12 }}>Reasoning</Typography.Text>,
                        children: (
                          <Timeline
                            items={t.reasoning.map((step) => ({
                              content: <Typography.Text style={{ fontSize: 12 }}>{step}</Typography.Text>,
                            }))}
                          />
                        ),
                      },
                    ]}
                  />
                )}
                {t.model && (
                  <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                    {t.model} · {new Date(t.at).toLocaleTimeString()}
                  </Typography.Text>
                )}
              </Space>,
              v === activeVersion ? { borderColor: token.colorPrimaryBorder } : undefined,
            )}
      </Space>
    );
  };

  const chat = (
    <Flex vertical style={{ height: '100%', paddingRight: 12 }}>
      <Flex align="center" justify="space-between" gap={8} style={{ paddingBottom: 8 }}>
        <Tag icon={<ThunderboltOutlined />} color="blue" style={{ marginInlineEnd: 0 }}>
          {settings.provider}
          {settings.model ? ` · ${settings.model}` : ''}
        </Tag>
        <Popconfirm
          title="Start a new conversation?"
          description="The current exchanges and versions will be forgotten."
          onConfirm={() => {
            clearSession(sessionKey);
            setSelected(null);
          }}
          disabled={turns.length === 0 || generating}
        >
          <Button size="small" icon={<ClearOutlined />} disabled={turns.length === 0 || generating}>
            New conversation
          </Button>
        </Popconfirm>
      </Flex>

      <div style={{ flex: 1, overflow: 'auto', paddingBlock: 4 }}>
        <Space orientation="vertical" size={12} style={{ width: '100%' }}>
          {bubble(
            'assistant',
            <Typography.Text style={{ fontSize: 13 }}>
              {isEditing
                ? `I'm working from the saved view of ${concept}. Tell me what to change — each answer becomes a new version you can compare.`
                : `Describe the dashboard you want for ${concept} (tables, stats, charts, clickable links). Each answer becomes a version you can preview and refine.`}
            </Typography.Text>,
          )}
          {turns.map(renderTurn)}
          {pending && (
            <Space orientation="vertical" size={6} style={{ width: '100%' }}>
              {bubble(
                'user',
                <Typography.Text style={{ whiteSpace: 'pre-wrap' }}>{pending.prompt}</Typography.Text>,
              )}
              <Flex gap={8} align="flex-start">
                <RobotOutlined style={{ marginTop: 8, color: token.colorPrimary }} />
                <BorderBeam>
                  <div
                    style={{
                      flex: 1,
                      maxWidth: '85%',
                      padding: '8px 12px',
                      borderRadius: 12,
                      background: token.colorFillQuaternary,
                      border: `1px solid ${token.colorBorderSecondary}`,
                      position: 'relative',
                    }}
                  >
                    <Typography.Text type="secondary">
                      <LoadingOutlined /> Working on {pending.basedOn !== null ? versionLabel(pending.basedOn) : 'a first version'}…
                    </Typography.Text>
                    {live && (
                      <pre
                        ref={liveRef}
                        style={{
                          margin: '8px 0 0',
                          maxHeight: 180,
                          overflow: 'auto',
                          whiteSpace: 'pre-wrap',
                          fontSize: 11,
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
                    )}
                  </div>
                </BorderBeam>
              </Flex>
            </Space>
          )}
          <div ref={chatEndRef} />
        </Space>
      </div>

      <div style={{ paddingTop: 8 }}>
        {activeVersion !== null && activeVersion !== latestVersion && (
          <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
            Next prompt refines {versionLabel(activeVersion)}.{' '}
            <Typography.Link onClick={() => setSelected(null)}>Back to latest</Typography.Link>
          </Typography.Text>
        )}
        <Space.Compact style={{ width: '100%' }}>
          <Input.TextArea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={
              spec
                ? 'Refine, e.g. "add a pie chart of balances by currency"'
                : 'Describe a view or ask a question, e.g. "Which customers spent the most across all their accounts?"'
            }
            autoSize={{ minRows: 2, maxRows: 6 }}
            onPressEnter={(e) => {
              if (!e.shiftKey) {
                e.preventDefault();
                handleGenerate();
              }
            }}
          />
          {generating ? (
            <Button danger icon={<StopOutlined />} onClick={() => abortRef.current?.abort()} style={{ height: 'auto' }} />
          ) : (
            <Button
              type="primary"
              icon={<SendOutlined />}
              onClick={handleGenerate}
              disabled={!prompt.trim()}
              style={{ height: 'auto' }}
            />
          )}
        </Space.Compact>
      </div>
    </Flex>
  );

  const preview = (
    <Flex vertical gap={8} style={{ height: '100%', paddingLeft: 12 }}>
      <Flex align="center" justify="space-between" gap={8} wrap>
        <Space size={8}>
          <Typography.Text strong>Preview</Typography.Text>
          {specByVersion.size > 0 && activeVersion !== null && (
            <Select
              size="small"
              value={activeVersion}
              onChange={(v) => setSelected(v)}
              style={{ minWidth: 140 }}
              options={[...specByVersion.keys()]
                .sort((a, b) => b - a)
                .map((v) => ({
                  value: v,
                  label: `${versionLabel(v)}${v === latestVersion && v !== 0 ? ' (latest)' : ''}`,
                }))}
            />
          )}
          {generating && (
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              <LoadingOutlined /> generating a new version…
            </Typography.Text>
          )}
        </Space>
        {spec && (
          <Checkbox checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)}>
            Default view for {concept}
          </Checkbox>
        )}
      </Flex>
      {saveError && <Alert type="error" showIcon title="Save failed" description={saveError} />}
      <BorderBeam style={generating ? undefined : { display: 'none' }} lineWidth={2}>
        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflow: 'auto',
            padding: 12,
            borderRadius: 8,
            border: `1px solid ${token.colorBorderSecondary}`,
            position: 'relative',
            opacity: generating ? 0.6 : 1,
            transition: 'opacity 0.3s',
          }}
        >
          {spec ? (
            <ViewRenderer key={`${activeVersion}-${spec.id}`} spec={spec} />
          ) : (
            <Flex align="center" justify="center" style={{ height: '100%' }}>
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={generating ? 'The assistant is building your view…' : 'No preview yet — describe a view in the chat.'}
              />
            </Flex>
          )}
        </div>
      </BorderBeam>
    </Flex>
  );

  return (
    <Modal
      title={
        <Space>
          <RobotOutlined />
          <span>
            {isEditing ? 'Edit' : 'Create'} a view with the assistant — {concept}
          </span>
        </Space>
      }
      open={open}
      onCancel={onClose}
      width="min(1440px, 96vw)"
      centered
      destroyOnHidden
      footer={[
        <Button key="settings" icon={<SettingOutlined />} onClick={onOpenSettings}>
          Settings
        </Button>,
        <Button key="json" onClick={() => spec && onOpenJson(spec)} disabled={!spec}>
          Open in JSON editor
        </Button>,
        <Button
          key="save"
          type="primary"
          onClick={handleSave}
          loading={saving}
          disabled={!spec || generating || (isEditing && activeVersion === 0)}
        >
          {isEditing ? 'Update view' : 'Save view'}
          {activeVersion ? ` (v${activeVersion})` : ''}
        </Button>,
      ]}
    >
      <Splitter style={{ height: '72vh', marginTop: 8 }}>
        <Splitter.Panel defaultSize="38%" min={320}>
          {chat}
        </Splitter.Panel>
        <Splitter.Panel min={360}>{preview}</Splitter.Panel>
      </Splitter>
    </Modal>
  );
}
