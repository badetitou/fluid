import { useEffect, useMemo, useState } from 'react';
import {
  App as AntdApp,
  Button,
  Dropdown,
  Empty,
  Flex,
  Select,
  Space,
  Tag,
  Typography,
  theme,
  type MenuProps,
} from 'antd';
import {
  CloseOutlined,
  DeleteOutlined,
  EditOutlined,
  FullscreenExitOutlined,
  FullscreenOutlined,
  MoreOutlined,
  PlusOutlined,
  RobotOutlined,
  SettingOutlined,
  StarFilled,
  StarOutlined,
} from '@ant-design/icons';
import type { ViewSpec } from '@fluid/shared';
import type { Concept } from '../hooks/useConcepts';
import { useViews, type ViewEntry, type ViewSource } from '../hooks/useViews';
import { ViewRenderer } from '../views/ViewRenderer';
import { buildDetailView } from '../views/registry';
import { getViewScope, withScope, type ColumnKind } from '../views/viewScope';
import { ViewAssistantModal } from './ViewAssistantModal';
import { ViewEditorModal, type ViewEditorInitial } from './ViewEditorModal';
import { LlmSettingsModal } from './LlmSettingsModal';
import { buildConceptSchemaPayload } from '../llm/conceptSchema';
import { bffClient } from '../bff/client';

const SOURCE_META: Record<ViewSource, { label: string; color: string }> = {
  saved: { label: 'saved', color: 'green' },
  curated: { label: 'curated', color: 'blue' },
  auto: { label: 'auto', color: 'geekblue' },
};

/** Prefill for a brand-new perspective: clone the current spec with a fresh id + title. */
function newViewInitial(
  concept: string,
  from: ViewSpec | undefined,
  scope: ColumnKind,
): ViewEditorInitial {
  const base: ViewSpec = from
    ? { ...from, id: `${concept.toLowerCase()}-view-${Date.now().toString(36)}`, concept, scope }
    : {
        version: 1,
        id: `${concept.toLowerCase()}-view-${Date.now().toString(36)}`,
        concept,
        scope,
        title: `${concept} view`,
        queries: {},
        widgets: [],
      };
  return { title: `${concept} view`, spec: base, isDefault: false };
}

interface MillerColumnProps {
  concept: Concept;
  conceptByName: Map<string, Concept>;
  /** Present for drill-in (detail) columns; injects the id into the by-id query. */
  itemId?: string;
  title: string;
  subtitle: string;
  onClose?: () => void;
  /** When true, this column occupies the whole view and lays widgets on a grid. */
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
}

/**
 * A single Miller navigation column bound to one concept. It resolves the
 * perspectives (saved / curated / auto views) for that concept, lets the user
 * switch between them, edit them with AI or JSON, and renders the active
 * perspective compactly so it fits a narrow column.
 */
export function MillerColumn({
  concept,
  conceptByName,
  itemId,
  title,
  subtitle,
  onClose,
  isFullscreen,
  onToggleFullscreen,
}: MillerColumnProps) {
  const { token } = theme.useToken();
  const { message, modal } = AntdApp.useApp();
  const { entries, defaultKey, loading, bffAvailable, refetch } = useViews(concept);

  const [picked, setPicked] = useState<string | undefined>(undefined);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [assistantEditingId, setAssistantEditingId] = useState<string | undefined>(undefined);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<'create' | 'edit'>('create');
  const [editorInitial, setEditorInitial] = useState<ViewEditorInitial | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  // Reset the explicit pick when the concept changes so its default is honoured.
  useEffect(() => {
    setPicked(undefined);
  }, [concept.name]);

  const schema = useMemo(
    () => buildConceptSchemaPayload(concept, conceptByName),
    [concept, conceptByName],
  );

  // A column showing a single drilled-in item is a "detail" column; the root
  // work list is a "list" column. Views are associated with the matching scope.
  const columnKind: ColumnKind = itemId ? 'detail' : 'list';

  // For a drilled-in column, offer a compact detail perspective (bound to the
  // by-id query) as the default, ahead of the concept's list/curated/saved views.
  const detailEntry = useMemo<ViewEntry | null>(() => {
    if (!itemId) return null;
    const detailSpec = buildDetailView(concept);
    return detailSpec
      ? { key: detailSpec.id, title: `${concept.name} detail`, source: 'auto', spec: detailSpec }
      : null;
  }, [itemId, concept]);

  // A perspective belongs to this column when its scope matches the column kind.
  // Detail columns also get the auto detail perspective as the default.
  const allEntries = useMemo<ViewEntry[]>(() => {
    const byIdField = concept.queries.byId?.field;
    const matches = entries.filter((e) => getViewScope(e.spec, byIdField) === columnKind);
    if (itemId) {
      return detailEntry ? [detailEntry, ...matches] : matches;
    }
    return matches;
  }, [itemId, columnKind, entries, detailEntry, concept]);

  const effectiveDefaultKey = itemId
    ? detailEntry?.key ?? allEntries[0]?.key
    : allEntries.some((e) => e.key === defaultKey)
      ? defaultKey
      : allEntries[0]?.key;

  const activeKey = picked && allEntries.some((e) => e.key === picked) ? picked : effectiveDefaultKey;
  const selected = useMemo(
    () => allEntries.find((e) => e.key === activeKey) ?? allEntries[0],
    [allEntries, activeKey],
  );

  // Inject the itemId into the by-id query, but only when the active perspective
  // actually reads from it (avoids firing an unused query for list perspectives).
  const spec = useMemo<ViewSpec | null>(() => {
    if (!selected) return null;
    const byIdKey = concept.queries.byId?.field;
    if (!itemId || !byIdKey || !selected.spec.queries[byIdKey]) return selected.spec;

    const queries = { ...selected.spec.queries };
    queries[byIdKey] = {
      ...queries[byIdKey],
      variables: { ...queries[byIdKey].variables, id: itemId },
    };
    return { ...selected.spec, queries };
  }, [selected, itemId, concept]);

  const isSaved = selected?.source === 'saved';
  const isDefaultView = Boolean(selected?.saved?.isDefault);

  const openAssistantCreate = () => {
    setAssistantEditingId(undefined);
    setAssistantOpen(true);
  };
  const openAssistantEdit = () => {
    if (!selected?.saved) return;
    setAssistantEditingId(selected.saved.id);
    setAssistantOpen(true);
  };
  const openJsonCreate = () => {
    setEditorMode('create');
    setEditorInitial(newViewInitial(concept.name, selected?.spec, columnKind));
    setEditorOpen(true);
  };
  const openJsonEdit = () => {
    if (!selected?.saved) return;
    setEditorMode('edit');
    setEditorInitial({
      title: selected.saved.title,
      spec: selected.saved.spec,
      isDefault: selected.saved.isDefault,
      editingId: selected.saved.id,
    });
    setEditorOpen(true);
  };
  const openJsonWithSpec = (s: ViewSpec) => {
    setAssistantOpen(false);
    setEditorMode('create');
    setEditorInitial({ title: s.title, spec: withScope(s, s.scope ?? columnKind), isDefault: false });
    setEditorOpen(true);
  };

  const handleSetDefault = async () => {
    if (!selected?.saved) return;
    setBusy(true);
    try {
      await bffClient.updateView(selected.saved.id, { isDefault: true });
      message.success('Default perspective updated');
      refetch();
    } catch (err) {
      message.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = () => {
    if (!selected?.saved) return;
    const id = selected.saved.id;
    modal.confirm({
      title: 'Delete this perspective?',
      content: 'This removes the saved view for everyone.',
      okText: 'Delete',
      okButtonProps: { danger: true },
      onOk: async () => {
        setBusy(true);
        try {
          await bffClient.deleteView(id);
          message.success('Perspective deleted');
          setPicked(undefined);
          refetch();
        } catch (err) {
          message.error((err as Error).message);
        } finally {
          setBusy(false);
        }
      },
    });
  };

  const menuItems: MenuProps['items'] = [
    {
      key: 'assistant',
      icon: <RobotOutlined />,
      label: 'New with assistant',
      disabled: !bffAvailable,
      onClick: openAssistantCreate,
    },
    ...(isSaved
      ? [
          {
            key: 'assistant-edit',
            icon: <RobotOutlined />,
            label: 'Edit with assistant',
            disabled: !bffAvailable,
            onClick: openAssistantEdit,
          },
        ]
      : []),
    {
      key: 'json',
      icon: <PlusOutlined />,
      label: isSaved ? 'New perspective (JSON)' : 'Save a copy (JSON)',
      disabled: !bffAvailable,
      onClick: openJsonCreate,
    },
    ...(isSaved
      ? [{ key: 'json-edit', icon: <EditOutlined />, label: 'Edit (JSON)', onClick: openJsonEdit }]
      : []),
    ...(isSaved && !isDefaultView
      ? [{ key: 'default', icon: <StarOutlined />, label: 'Set as default', onClick: handleSetDefault }]
      : []),
    ...(isSaved
      ? [{ key: 'delete', icon: <DeleteOutlined />, danger: true, label: 'Delete', onClick: handleDelete }]
      : []),
    { type: 'divider' },
    { key: 'settings', icon: <SettingOutlined />, label: 'LLM settings', onClick: () => setSettingsOpen(true) },
  ];

  const perspectiveOptions = allEntries.map((e) => ({
    value: e.key,
    label: (
      <Space size={6}>
        <span>{e.title}</span>
        <Tag color={SOURCE_META[e.source].color} style={{ marginInlineEnd: 0 }}>
          {SOURCE_META[e.source].label}
        </Tag>
        {e.saved?.isDefault && <StarFilled style={{ color: token.colorWarning }} />}
      </Space>
    ),
  }));

  return (
    <>
      <div
        style={{
          padding: '10px 12px',
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
          background: token.colorBgElevated,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        <Flex align="flex-start" justify="space-between" gap={8}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 12, color: token.colorTextSecondary }}>{subtitle}</div>
            <Typography.Text strong ellipsis style={{ fontSize: 14 }}>
              {title}
            </Typography.Text>
          </div>
          <Space size={2}>
            <Dropdown menu={{ items: menuItems }} trigger={['click']}>
              <Button type="text" size="small" icon={<MoreOutlined />} loading={busy} />
            </Dropdown>
            {onToggleFullscreen && (
              <Button
                type="text"
                size="small"
                aria-label={isFullscreen ? 'Exit full screen' : 'Full screen'}
                icon={isFullscreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />}
                onClick={onToggleFullscreen}
              />
            )}
            {onClose && (
              <Button type="text" size="small" icon={<CloseOutlined />} onClick={onClose} />
            )}
          </Space>
        </Flex>
        {allEntries.length > 0 && (
          <Select
            size="small"
            style={{ width: '100%' }}
            value={selected?.key}
            options={perspectiveOptions}
            onChange={(v) => setPicked(v)}
            disabled={allEntries.length <= 1}
          />
        )}
      </div>

      <div style={{ flex: 1, overflow: 'auto' }}>
        {spec ? (
          <div style={{ padding: 12 }}>
            <ViewRenderer
              key={selected?.key}
              spec={spec}
              compact={!isFullscreen}
              maxColumns={isFullscreen ? 3 : undefined}
              concept={concept.name}
              schema={schema}
              viewId={selected?.saved?.id}
              onWidgetUpdated={(v) => {
                refetch();
                setPicked(v.id);
              }}
            />
          </div>
        ) : (
          <Flex vertical align="center" justify="center" gap={16} style={{ height: '100%', padding: 16 }}>
            <Empty description={loading ? 'Loading perspectives…' : 'No perspective for this concept'} />
            {bffAvailable && !loading && (
              <Button type="primary" icon={<RobotOutlined />} onClick={openAssistantCreate}>
                Create with assistant
              </Button>
            )}
          </Flex>
        )}
      </div>

      <ViewAssistantModal
        open={assistantOpen}
        concept={concept.name}
        schema={schema}
        scope={columnKind}
        onClose={() => {
          setAssistantOpen(false);
          setAssistantEditingId(undefined);
        }}
        onSaved={(v) => {
          refetch();
          setPicked(v.id);
          setAssistantOpen(false);
          setAssistantEditingId(undefined);
        }}
        onOpenJson={openJsonWithSpec}
        onOpenSettings={() => setSettingsOpen(true)}
        editingViewId={assistantEditingId}
        initialSpec={
          assistantEditingId
            ? entries.find((e) => e.saved?.id === assistantEditingId)?.spec
            : undefined
        }
        editingIsDefault={
          assistantEditingId
            ? entries.find((e) => e.saved?.id === assistantEditingId)?.saved?.isDefault
            : false
        }
      />

      {editorInitial && (
        <ViewEditorModal
          open={editorOpen}
          mode={editorMode}
          concept={concept.name}
          initial={editorInitial}
          onClose={() => setEditorOpen(false)}
          onSaved={(v) => {
            refetch();
            setPicked(v.id);
            setEditorOpen(false);
          }}
        />
      )}

      <LlmSettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  );
}
