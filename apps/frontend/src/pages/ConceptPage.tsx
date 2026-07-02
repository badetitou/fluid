import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  App as AntdApp,
  Alert,
  Breadcrumb,
  Button,
  Card,
  Collapse,
  Descriptions,
  Flex,
  Popconfirm,
  Segmented,
  Skeleton,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import {
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  RobotOutlined,
  SettingOutlined,
  StarFilled,
  StarOutlined,
} from '@ant-design/icons';
import type { ViewSpec } from '@fluid/shared';
import { useConcepts } from '../hooks/useConcepts';
import { useViews, type ViewEntry, type ViewSource } from '../hooks/useViews';
import type { ConceptField } from '../graphql/introspection';
import { ViewRenderer } from '../views/ViewRenderer';
import { ViewEditorModal, type ViewEditorInitial } from '../components/ViewEditorModal';
import { ViewAssistantModal } from '../components/ViewAssistantModal';
import { LlmSettingsModal } from '../components/LlmSettingsModal';
import { buildConceptSchemaPayload } from '../llm/conceptSchema';
import { bffClient } from '../bff/client';

const SOURCE_META: Record<ViewSource, { label: string; color: string }> = {
  saved: { label: 'saved', color: 'green' },
  curated: { label: 'curated', color: 'blue' },
  auto: { label: 'auto', color: 'geekblue' },
};

/** Prefill for a brand-new view: clone the current spec with a fresh id + title. */
function newViewInitial(concept: string, from: ViewSpec | undefined): ViewEditorInitial {
  const base: ViewSpec = from
    ? { ...from, id: `${concept.toLowerCase()}-view-${Date.now().toString(36)}`, concept }
    : {
        version: 1,
        id: `${concept.toLowerCase()}-view-${Date.now().toString(36)}`,
        concept,
        title: `${concept} view`,
        queries: {},
        widgets: [],
      };
  return { title: `${concept} view`, spec: base, isDefault: false };
}

export function ConceptPage() {
  const { name } = useParams<{ name: string }>();
  const { conceptByName, fetching, error } = useConcepts();
  const { message } = AntdApp.useApp();

  const concept = name ? conceptByName.get(name) : undefined;
  const { entries, defaultKey, loading: viewsLoading, bffAvailable, refetch } = useViews(concept);

  const [picked, setPicked] = useState<string | undefined>(undefined);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [modalInitial, setModalInitial] = useState<ViewEditorInitial | null>(null);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const schemaPayload = useMemo(
    () => (concept ? buildConceptSchemaPayload(concept, conceptByName) : null),
    [concept, conceptByName],
  );

  // Reset the explicit pick when switching concepts so the new concept's
  // default view is honoured.
  useEffect(() => {
    setPicked(undefined);
  }, [concept?.name]);

  // The active view follows the concept's default until the user explicitly
  // picks one; a stale pick (e.g. after a delete) also falls back to default.
  const activeKey =
    picked && entries.some((e) => e.key === picked) ? picked : defaultKey;

  const selected: ViewEntry | undefined = useMemo(
    () => entries.find((e) => e.key === activeKey) ?? entries[0],
    [entries, activeKey],
  );

  const openCreate = () => {
    setModalMode('create');
    setModalInitial(newViewInitial(concept!.name, selected?.spec));
    setModalOpen(true);
  };

  const openEdit = () => {
    if (!selected?.saved) return;
    setModalMode('edit');
    setModalInitial({
      title: selected.saved.title,
      spec: selected.saved.spec,
      isDefault: selected.saved.isDefault,
      editingId: selected.saved.id,
    });
    setModalOpen(true);
  };

  // Hand a generated spec off to the JSON editor for fine-tuning before saving.
  const openJsonWithSpec = (spec: ViewSpec) => {
    setAssistantOpen(false);
    setModalMode('create');
    setModalInitial({ title: spec.title, spec, isDefault: false });
    setModalOpen(true);
  };

  const handleSetDefault = async () => {
    if (!selected?.saved) return;
    setBusyId(selected.saved.id);
    try {
      await bffClient.updateView(selected.saved.id, { isDefault: true });
      message.success('Default view updated');
      refetch();
    } catch (err) {
      message.error((err as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async () => {
    if (!selected?.saved) return;
    const id = selected.saved.id;
    setBusyId(id);
    try {
      await bffClient.deleteView(id);
      message.success('View deleted');
      setPicked(undefined);
      refetch();
    } catch (err) {
      message.error((err as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  if (error) {
    return (
      <Alert
        type="error"
        showIcon
        message="Could not introspect the GraphQL source"
        description={error.message}
      />
    );
  }

  if (fetching) {
    return (
      <Card>
        <Skeleton active paragraph={{ rows: 6 }} />
      </Card>
    );
  }

  if (!concept) {
    return (
      <Alert
        type="warning"
        showIcon
        message="Unknown concept"
        description={`No concept named "${name}" exists in this schema.`}
      />
    );
  }

  const shapeColumns = [
    {
      title: 'Field',
      dataIndex: 'name',
      key: 'name',
      render: (value: string) => <Typography.Text strong>{value}</Typography.Text>,
    },
    {
      title: 'Type',
      dataIndex: 'typeName',
      key: 'typeName',
      render: (value: string, record: ConceptField) => (
        <Space>
          <Typography.Text code>{value}</Typography.Text>
          {record.isList && <Tag>list</Tag>}
        </Space>
      ),
    },
    {
      title: 'Kind',
      dataIndex: 'typeKind',
      key: 'typeKind',
      render: (value: string, record: ConceptField) => (
        <Tag color={record.isScalar ? 'blue' : 'purple'}>{value}</Tag>
      ),
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      render: (value: string | null) =>
        value ?? <Typography.Text type="secondary">—</Typography.Text>,
    },
  ];

  const isSaved = selected?.source === 'saved';
  const isDefaultView = Boolean(selected?.saved?.isDefault);

  const segmentedOptions = entries.map((entry) => ({
    value: entry.key,
    label: (
      <Space size={6}>
        <span>{entry.title}</span>
        <Tag color={SOURCE_META[entry.source].color} style={{ marginInlineEnd: 0 }}>
          {SOURCE_META[entry.source].label}
        </Tag>
        {entry.saved?.isDefault && <StarFilled style={{ color: '#faad14' }} />}
      </Space>
    ),
  }));

  return (
    <Flex vertical gap={20}>
      <Breadcrumb items={[{ title: 'Concepts' }, { title: concept.name }]} />

      <Flex align="flex-start" justify="space-between" gap={16} wrap>
        <div>
          <Space align="center" size="small">
            <Typography.Title level={3} style={{ marginBottom: 4 }}>
              {selected ? selected.title : concept.name}
            </Typography.Title>
            {selected && (
              <Tag color={SOURCE_META[selected.source].color}>
                {SOURCE_META[selected.source].label}
              </Tag>
            )}
            {isDefaultView && <Tag color="gold">default</Tag>}
          </Space>
          <div>
            <Typography.Text type="secondary">
              {selected?.spec.description ?? concept.description ?? 'No description provided.'}
            </Typography.Text>
          </div>
        </div>

        <Space wrap>
          {isSaved && (
            <>
              <Tooltip title={isDefaultView ? 'Already the default' : 'Make this the default view'}>
                <Button
                  icon={isDefaultView ? <StarFilled /> : <StarOutlined />}
                  onClick={handleSetDefault}
                  disabled={isDefaultView || busyId === selected?.saved?.id}
                >
                  Set default
                </Button>
              </Tooltip>
              <Button icon={<EditOutlined />} onClick={openEdit}>
                Edit
              </Button>
              <Popconfirm
                title="Delete this view?"
                description="This removes the saved view for everyone."
                okText="Delete"
                okButtonProps={{ danger: true }}
                onConfirm={handleDelete}
              >
                <Button danger icon={<DeleteOutlined />} loading={busyId === selected?.saved?.id}>
                  Delete
                </Button>
              </Popconfirm>
            </>
          )}
          <Tooltip
            title={
              bffAvailable
                ? 'Generate a view from a prompt (tables, charts, stats)'
                : 'Fluid BFF unavailable — start the BFF to use the assistant'
            }
          >
            <Button
              type="primary"
              icon={<RobotOutlined />}
              onClick={() => setAssistantOpen(true)}
              disabled={!bffAvailable}
            >
              Assistant
            </Button>
          </Tooltip>
          <Tooltip
            title={
              bffAvailable
                ? 'Create a view by editing its JSON (prefilled from the current one)'
                : 'Fluid BFF unavailable — start the BFF to save views'
            }
          >
            <Button icon={<PlusOutlined />} onClick={openCreate} disabled={!bffAvailable}>
              {isSaved ? 'New view (JSON)' : 'Save a copy'}
            </Button>
          </Tooltip>
          <Tooltip title="Assistant (LLM) settings">
            <Button icon={<SettingOutlined />} onClick={() => setSettingsOpen(true)} />
          </Tooltip>
        </Space>
      </Flex>

      {entries.length > 1 && (
        <Segmented
          options={segmentedOptions}
          value={selected?.key}
          onChange={(val) => setPicked(val as string)}
        />
      )}

      {!bffAvailable && (
        <Alert
          type="warning"
          showIcon
          message="Fluid BFF unavailable"
          description="Showing curated and auto-generated views only. Start the BFF to load and save persisted views."
        />
      )}

      {viewsLoading && entries.length === 0 ? (
        <Card>
          <Skeleton active paragraph={{ rows: 4 }} />
        </Card>
      ) : selected ? (
        <ViewRenderer key={selected.key} spec={selected.spec} />
      ) : (
        <Alert
          type="info"
          showIcon
          message="No view available for this concept"
          description="This concept has no root list query to build a default dashboard from. Use “Save a copy” once the BFF is running to craft one."
        />
      )}

      <Collapse
        items={[
          {
            key: 'shape',
            label: 'Concept shape (introspected)',
            children: (
              <Flex vertical gap={16}>
                <Descriptions column={{ xs: 1, sm: 2, lg: 4 }} size="small">
                  <Descriptions.Item label="Fields">
                    {concept.scalarFields.length}
                  </Descriptions.Item>
                  <Descriptions.Item label="Relations">
                    {concept.relationFields.length}
                  </Descriptions.Item>
                  <Descriptions.Item label="List query">
                    {concept.queries.list ? (
                      <Typography.Text code>{concept.queries.list.field}</Typography.Text>
                    ) : (
                      <Typography.Text type="secondary">—</Typography.Text>
                    )}
                  </Descriptions.Item>
                  <Descriptions.Item label="By-id query">
                    {concept.queries.byId ? (
                      <Typography.Text code>{concept.queries.byId.field}</Typography.Text>
                    ) : (
                      <Typography.Text type="secondary">—</Typography.Text>
                    )}
                  </Descriptions.Item>
                </Descriptions>
                <Table<ConceptField>
                  rowKey="name"
                  size="small"
                  columns={shapeColumns}
                  dataSource={concept.fields}
                  pagination={false}
                />
              </Flex>
            ),
          },
        ]}
      />

      {modalInitial && (
        <ViewEditorModal
          open={modalOpen}
          mode={modalMode}
          concept={concept.name}
          initial={modalInitial}
          onClose={() => setModalOpen(false)}
          onSaved={(view) => {
            refetch();
            setPicked(view.id);
          }}
        />
      )}

      {schemaPayload && (
        <ViewAssistantModal
          open={assistantOpen}
          concept={concept.name}
          schema={schemaPayload}
          onClose={() => setAssistantOpen(false)}
          onSaved={(view) => {
            refetch();
            setPicked(view.id);
          }}
          onOpenJson={openJsonWithSpec}
          onOpenSettings={() => setSettingsOpen(true)}
        />
      )}

      <LlmSettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </Flex>
  );
}
