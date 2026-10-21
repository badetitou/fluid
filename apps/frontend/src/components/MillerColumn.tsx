import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import {
  Alert,
  App as AntdApp,
  Button,
  Dropdown,
  Empty,
  Flex,
  Input,
  Skeleton,
  Space,
  Tooltip,
  Typography,
  theme,
  type MenuProps,
} from 'antd';
import {
  AppstoreOutlined,
  CheckOutlined,
  CloseOutlined,
  DeleteOutlined,
  EditOutlined,
  FullscreenExitOutlined,
  FullscreenOutlined,
  MoreOutlined,
  PlusOutlined,
  PushpinOutlined,
  RobotOutlined,
  SettingOutlined,
  StarFilled,
  StarOutlined,
} from '@ant-design/icons';
import type { ViewSpec, Widget } from '@fluid/shared';
import {
  useConcept,
  useConceptsByName,
  usePinning,
  useRootConcepts,
  type Concept,
} from '../hooks/useConcepts';
import { useViews, type ViewEntry, type ViewSource } from '../hooks/useViews';
import { ViewRenderer } from '../views/ViewRenderer';
import { buildDetailView } from '../views/registry';
import { applyLayout, compact as compactLayout, resolveLayout } from '../views/gridLayout';
import { MillerColumnPathContext } from '../navigation/columnPath';
import { getViewScope, withScope, type ColumnKind } from '../views/viewScope';
import { ViewAssistantModal } from './ViewAssistantModal';
import { ViewEditorModal, type ViewEditorInitial } from './ViewEditorModal';
import { LlmSettingsModal } from './LlmSettingsModal';
import { buildConceptSchemaPayload } from '../llm/conceptSchema';
import { bffClient } from '../bff/client';
import { usePreferences } from '../store';
import { getChrome } from '../theme';

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
  conceptName: string;
  /** Present for drill-in (detail) columns; injects the id into the by-id query. */
  itemId?: string;
  /** Miller path of this column; links inside it open the next column after it. */
  path: string;
  title: string;
  subtitle: string;
  onClose?: () => void;
  /** When true, this column occupies the whole view (its widgets reflow to the extra width). */
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
}

/**
 * A single Miller navigation column bound to one concept. It introspects the
 * concept's type on demand, then hands over to the column body.
 */
export function MillerColumn({ conceptName, path, ...rest }: MillerColumnProps) {
  const { concept, fetching, error } = useConcept(conceptName);

  if (error || concept === null || (!fetching && !concept)) {
    return (
      <div style={{ padding: 12 }}>
        <Alert
          type={error ? 'error' : 'warning'}
          showIcon
          title={error ? `Could not introspect ${conceptName}` : 'Unknown concept'}
          description={error ? error.message : `No object type named "${conceptName}" exists.`}
        />
      </div>
    );
  }

  if (!concept) {
    return (
      <div style={{ padding: 12 }}>
        <Skeleton active paragraph={{ rows: 6 }} />
      </div>
    );
  }

  return (
    <MillerColumnPathContext.Provider value={path}>
      <MillerColumnBody concept={concept} {...rest} />
    </MillerColumnPathContext.Provider>
  );
}

type MillerColumnBodyProps = Omit<MillerColumnProps, 'conceptName' | 'path'> & { concept: Concept };

/**
 * The column body for a loaded concept. It resolves the
 * perspectives (saved / curated / auto views) for that concept, lets the user
 * switch between them, edit them with AI or JSON, and renders the active
 * perspective compactly so it fits a narrow column.
 */
function MillerColumnBody({
  concept,
  itemId,
  title,
  subtitle,
  onClose,
  isFullscreen,
  onToggleFullscreen,
}: MillerColumnBodyProps) {
  const { token } = theme.useToken();
  const { message, modal } = AntdApp.useApp();
  const density = usePreferences((s) => s.density);
  const compact = density === 'compact';
  const chrome = getChrome(density);
  const { entries, defaultKey, loading, bffAvailable, refetch } = useViews(concept);

  const [picked, setPicked] = useState<string | undefined>(undefined);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [assistantEditingId, setAssistantEditingId] = useState<string | undefined>(undefined);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<'create' | 'edit'>('create');
  const [editorInitial, setEditorInitial] = useState<ViewEditorInitial | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  // Key of the saved perspective whose pill is being renamed inline.
  const [renamingKey, setRenamingKey] = useState<string | undefined>(undefined);
  const [renameDraft, setRenameDraft] = useState('');
  const renameCancelled = useRef(false);
  // Widgets being arranged with the mouse; null when not editing the layout.
  const [layoutDraft, setLayoutDraft] = useState<Widget[] | null>(null);
  // Whether entering layout edit switched the column to full screen (undone on exit).
  const enteredFullscreen = useRef(false);
  const editingLayout = layoutDraft !== null;

  // Reset the explicit pick when the concept changes so its default is honoured.
  useEffect(() => {
    setPicked(undefined);
    setLayoutDraft(null);
  }, [concept.name]);

  // Related types are introspected one level ahead so the LLM knows their fields.
  const relatedNames = useMemo(
    () => [...new Set(concept.relationFields.map((f) => f.typeName))],
    [concept],
  );
  const conceptByName = useConceptsByName(relatedNames);

  // Deeper concepts are not listed in the concept bar by default: offer to pin
  // this concept (when reached by navigation) and the concepts it relates to.
  const { queriesByType } = useRootConcepts();
  const { pinned, pin } = usePinning();
  const pinnable = [concept.name, ...relatedNames].filter(
    (name) => !queriesByType.has(name) && !pinned.includes(name),
  );

  const schema = useMemo(
    () => buildConceptSchemaPayload(concept, conceptByName),
    [concept, conceptByName],
  );

  // A column showing a single drilled-in item is a "detail" column; the root
  // work list is a "list" column. Views are associated with the matching scope.
  const columnKind: ColumnKind = itemId ? 'detail' : 'list';

  // For a drilled-in column, offer a compact detail perspective (bound to the
  // by-id query) as the default, ahead of the concept's list/curated/saved views.
  // It also lists the relations, linking to their own column when navigable.
  const detailEntry = useMemo<ViewEntry | null>(() => {
    if (!itemId) return null;
    const detailSpec = buildDetailView(concept, { conceptByName, queriesByType });
    return detailSpec
      ? { key: detailSpec.id, title: `${concept.name} detail`, source: 'auto', spec: detailSpec }
      : null;
  }, [itemId, concept, conceptByName, queriesByType]);

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

  const renderedSpec = useMemo(
    () => (spec && layoutDraft ? { ...spec, widgets: layoutDraft } : spec),
    [spec, layoutDraft],
  );

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

  // Layout edit: arrange the widgets on the grid like macOS widgets. Editing a
  // curated/auto perspective saves the arrangement as a new saved perspective.
  const startLayoutEdit = () => {
    if (!selected) return;
    setLayoutDraft(selected.spec.widgets);
    if (onToggleFullscreen && !isFullscreen) {
      enteredFullscreen.current = true;
      onToggleFullscreen();
    }
  };

  const exitLayoutEdit = () => {
    setLayoutDraft(null);
    if (enteredFullscreen.current) {
      enteredFullscreen.current = false;
      onToggleFullscreen?.();
    }
  };

  const saveLayout = async () => {
    if (!selected || !layoutDraft) return;
    const widgets = applyLayout(layoutDraft, resolveLayout(layoutDraft));
    setBusy(true);
    try {
      if (selected.saved) {
        await bffClient.updateView(selected.saved.id, { spec: { ...selected.spec, widgets } });
        message.success('Layout saved');
        refetch();
      } else {
        const copy: ViewSpec = withScope(
          {
            ...selected.spec,
            id: `${concept.name.toLowerCase()}-view-${Date.now().toString(36)}`,
            title: selected.title,
            widgets,
          },
          columnKind,
        );
        const created = await bffClient.createView(copy, false);
        message.success('Layout saved as a new perspective');
        refetch();
        setPicked(created.id);
      }
      exitLayoutEdit();
    } catch (err) {
      message.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const tidyLayout = () => {
    if (layoutDraft)
      setLayoutDraft(applyLayout(layoutDraft, compactLayout(resolveLayout(layoutDraft))));
  };

  const startRename = (entry: ViewEntry | undefined = selected) => {
    if (!entry?.saved || !bffAvailable) return;
    setPicked(entry.key);
    setRenameDraft(entry.title);
    setRenamingKey(entry.key);
  };

  const commitRename = async () => {
    const entry = allEntries.find((e) => e.key === renamingKey);
    setRenamingKey(undefined);
    if (renameCancelled.current) {
      renameCancelled.current = false;
      return;
    }
    const title = renameDraft.trim();
    if (!entry?.saved || !title || title === entry.title) return;
    setBusy(true);
    try {
      await bffClient.updateView(entry.saved.id, { title });
      message.success('Perspective renamed');
      refetch();
    } catch (err) {
      message.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = (entry: ViewEntry | undefined = selected) => {
    if (!entry?.saved) return;
    const id = entry.saved.id;
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
          if (entry.key === activeKey) setPicked(undefined);
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
      ? [
          {
            key: 'rename',
            icon: <EditOutlined />,
            label: 'Rename',
            disabled: !bffAvailable,
            onClick: () => startRename(),
          },
          { key: 'json-edit', icon: <EditOutlined />, label: 'Edit (JSON)', onClick: openJsonEdit },
        ]
      : []),
    ...(isSaved && !isDefaultView
      ? [{ key: 'default', icon: <StarOutlined />, label: 'Set as default', onClick: handleSetDefault }]
      : []),
    ...(isSaved
      ? [{ key: 'delete', icon: <DeleteOutlined />, danger: true, label: 'Delete', onClick: () => handleDelete() }]
      : []),
    ...(pinnable.length > 0
      ? [
          { type: 'divider' as const },
          {
            key: 'pin',
            icon: <PushpinOutlined />,
            label: 'Pin to concept bar',
            children: pinnable.map((name) => ({
              key: `pin:${name}`,
              label: name === concept.name ? `${name} (this concept)` : name,
              onClick: () => {
                pin(name);
                message.success(`${name} pinned to the concept bar`);
              },
            })),
          },
        ]
      : []),
    { type: 'divider' },
    { key: 'settings', icon: <SettingOutlined />, label: 'LLM settings', onClick: () => setSettingsOpen(true) },
  ];

  // Floating pills: one per perspective. The active saved one can be deleted
  // from its pill, and "+" creates a new one with the assistant.
  const pillBase: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    flexShrink: 0,
    height: chrome.pillHeight,
    padding: compact ? '0 7px' : '0 9px',
    borderRadius: 999,
    border: `1px solid ${token.colorBorderSecondary}`,
    background: token.colorBgContainer,
    color: token.colorTextSecondary,
    fontSize: compact ? 11 : 12,
    lineHeight: `${chrome.pillHeight - 2}px`,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    transition: `all ${token.motionDurationMid}`,
  };
  const activePill: CSSProperties = {
    borderColor: token.colorPrimaryBorder,
    background: token.colorPrimaryBg,
    color: token.colorPrimaryText,
    boxShadow: token.boxShadowTertiary,
  };

  const perspectivePills = allEntries.map((e) => {
    const active = e.key === selected?.key;
    if (e.key === renamingKey) {
      return (
        <Input
          key={e.key}
          size="small"
          autoFocus
          aria-label="Perspective name"
          value={renameDraft}
          onChange={(ev) => setRenameDraft(ev.target.value)}
          onFocus={(ev) => ev.target.select()}
          onPressEnter={(ev) => ev.currentTarget.blur()}
          onBlur={commitRename}
          onKeyDown={(ev) => {
            if (ev.key !== 'Escape') return;
            renameCancelled.current = true;
            ev.currentTarget.blur();
          }}
          style={{
            ...pillBase,
            ...activePill,
            cursor: 'text',
            width: Math.max(80, renameDraft.length * 7 + 24),
          }}
        />
      );
    }
    return (
      <Tooltip
        key={e.key}
        title={`${SOURCE_META[e.source].label} perspective${e.source === 'saved' && bffAvailable ? ' — double-click to rename' : ''}`}
        mouseEnterDelay={0.6}
      >
        <span
          role="tab"
          aria-selected={active}
          tabIndex={0}
          onClick={() => setPicked(e.key)}
          onDoubleClick={() => startRename(e)}
          onKeyDown={(ev) => (ev.key === 'Enter' || ev.key === ' ') && setPicked(e.key)}
          style={active ? { ...pillBase, ...activePill } : pillBase}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: token[`${SOURCE_META[e.source].color}6` as keyof typeof token] as string,
            }}
          />
          {e.title}
          {e.saved?.isDefault && <StarFilled style={{ color: token.colorWarning, fontSize: 10 }} />}
          {active && e.source === 'saved' && bffAvailable && (
            <CloseOutlined
              aria-label="Delete perspective"
              style={{ fontSize: 9, marginInlineStart: 2 }}
              onClick={(ev) => {
                ev.stopPropagation();
                handleDelete(e);
              }}
            />
          )}
        </span>
      </Tooltip>
    );
  });

  const actions = editingLayout ? (
    <Space size={4} style={{ flexShrink: 0 }}>
      <Tooltip title="Close the gaps between widgets">
        <Button size="small" icon={<AppstoreOutlined />} onClick={tidyLayout}>
          {compact ? null : 'Tidy up'}
        </Button>
      </Tooltip>
      <Button size="small" onClick={exitLayoutEdit} disabled={busy}>
        Cancel
      </Button>
      <Button
        size="small"
        type="primary"
        icon={<CheckOutlined />}
        loading={busy}
        onClick={saveLayout}
      >
        Done
      </Button>
    </Space>
  ) : (
    <Space size={2} style={{ flexShrink: 0 }}>
      {spec && bffAvailable && spec.widgets.length > 0 && (
        <Tooltip title="Edit layout — move and resize widgets">
          <Button
            type="text"
            size="small"
            aria-label="Edit layout"
            icon={<EditOutlined />}
            onClick={startLayoutEdit}
          />
        </Tooltip>
      )}
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
  );

  const layoutHint = (
    <Typography.Text
      type="secondary"
      ellipsis
      style={{ fontSize: 12, flex: compact ? '1 1 auto' : undefined, minWidth: 0 }}
    >
      Drag to move · drag the corner to resize · right-click for sizes
      {selected?.saved ? '' : ' · saved as a new perspective'}
    </Typography.Text>
  );

  const pillBar = editingLayout
    ? layoutHint
    : allEntries.length > 0 && (
        <div
          role="tablist"
          style={{
            display: 'flex',
            gap: compact ? 4 : 6,
            overflowX: 'auto',
            padding: compact ? 0 : '2px 0 4px',
            minWidth: 0,
            flex: compact ? '1 1 auto' : undefined,
          }}
        >
          {perspectivePills}
          {bffAvailable && (
            <Tooltip title="New perspective with assistant">
              <span
                role="button"
                aria-label="New perspective"
                tabIndex={0}
                onClick={openAssistantCreate}
                onKeyDown={(ev) => ev.key === 'Enter' && openAssistantCreate()}
                style={{
                  ...pillBase,
                  padding: 0,
                  width: chrome.pillHeight,
                  justifyContent: 'center',
                  borderStyle: 'dashed',
                }}
              >
                <PlusOutlined style={{ fontSize: 10 }} />
              </span>
            </Tooltip>
          )}
        </div>
      );

  // Compact density folds title, perspectives and actions into a single row;
  // the subtitle moves to a tooltip on the title.
  const header = compact ? (
    <Flex
      align="center"
      gap={8}
      style={{
        padding: chrome.columnHeaderPadding,
        borderBottom: `1px solid ${token.colorBorderSecondary}`,
        background: token.colorBgElevated,
      }}
    >
      <Tooltip title={subtitle} mouseEnterDelay={0.6}>
        <Typography.Text strong ellipsis style={{ fontSize: 13, flex: '0 1 auto', maxWidth: '40%' }}>
          {title}
        </Typography.Text>
      </Tooltip>
      {pillBar || <div style={{ flex: 1 }} />}
      {actions}
    </Flex>
  ) : (
    <div
      style={{
        padding: chrome.columnHeaderPadding,
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
        {actions}
      </Flex>
      {pillBar}
    </div>
  );

  return (
    <>
      {header}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {spec ? (
          <div style={{ padding: 12 }}>
            <ViewRenderer
              key={selected?.key}
              spec={renderedSpec!}
              editingLayout={editingLayout}
              onWidgetsChange={setLayoutDraft}
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
