import { useState } from 'react';
import { App as AntdApp, Button, Modal, Space, Splitter } from 'antd';
import { RobotOutlined, SettingOutlined } from '@ant-design/icons';
import { conceptLabel, type ViewSpec } from '@fluid/shared';
import type { ViewSeed } from '../../entities/llm';
import { preserveLayouts, useSaveView, type SavedView } from '../../entities/view';
import { AssistantChat } from './AssistantChat';
import { AssistantPreview } from './AssistantPreview';
import { useAssistantSession, type AssistantTarget } from './useAssistantSession';
import styles from './ViewAssistant.module.css';

export interface AssistantSource {
  /** The saved view being refined. */
  editing?: SavedView;
  /** Spec the conversation starts from (version 0) instead of the saved one, e.g. edits from the layout editor. */
  from?: ViewSpec;
  /** The chat's conversation: the first prompt is sent as the modal opens. */
  seed?: ViewSeed;
}

interface ViewAssistantModalProps {
  target: AssistantTarget;
  /** What the conversation starts from; a new view is created when empty. */
  source?: AssistantSource;
  onClose: () => void;
  onSaved: (view: SavedView) => void;
  onOpenJson: (spec: ViewSpec) => void;
  onOpenSettings: () => void;
}

/**
 * Creates or refines a view by chatting with the LLM. Each answer is a version
 * that can be previewed, refined again, then saved. Mounted only while open.
 */
export function ViewAssistantModal(props: ViewAssistantModalProps) {
  const { target, source = {}, onClose, onSaved, onOpenJson, onOpenSettings } = props;
  const { editing, from, seed } = source;
  const { message } = AntdApp.useApp();
  const base = from ?? editing?.spec;
  const session = useAssistantSession(target, editing?.id, base, seed);
  const { saving, error, setError, save } = useSaveView();
  const [isDefault, setIsDefault] = useState(editing?.isDefault ?? false);
  const { spec, activeVersion, clear } = session;
  const generating = session.pending !== null;

  const send = (prompt: string) => {
    setError(null);
    session.generate(prompt);
  };

  const handleSave = async () => {
    if (!spec) return;
    // Keep an existing scope association; widgets kept by the assistant stay where they were arranged.
    const toSave: ViewSpec = { ...spec, scope: spec.scope ?? target.scope };
    if (base) toSave.widgets = preserveLayouts(toSave.widgets, base.widgets);
    const saved = await save(toSave, { editingId: editing?.id, isDefault });
    if (!saved) return;
    message.success(editing ? 'View updated' : 'View saved');
    // The conversation served its purpose once the view is persisted.
    clear();
    onSaved(saved);
  };

  const label = conceptLabel(target.concept);
  const intro = seed
    ? `I'm building a view of ${label} from your chat. Each answer becomes a version you can preview and refine.`
    : base
    ? `I'm working from the ${editing ? 'saved ' : ''}view of ${label}. Tell me what to change — each answer becomes a new version you can compare.`
    : `Describe the dashboard you want for ${label} (tables, stats, charts, clickable links). Each answer becomes a version you can preview and refine.`;

  return (
    <Modal
      title={
        <Space>
          <RobotOutlined />
          <span>
            {editing ? 'Edit' : 'Create'} a view with the assistant — {label}
          </span>
        </Space>
      }
      open
      onCancel={onClose}
      width="min(1440px, 96vw)"
      centered
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
          disabled={!spec || generating || (Boolean(editing) && !from && activeVersion === 0)}
        >
          {editing ? 'Update view' : 'Save view'}
          {activeVersion ? ` (v${activeVersion})` : ''}
        </Button>,
      ]}
    >
      <Splitter className={styles.splitter}>
        <Splitter.Panel defaultSize="38%" min={320}>
          <AssistantChat session={session} intro={intro} onSend={send} />
        </Splitter.Panel>
        <Splitter.Panel min={360}>
          <AssistantPreview
            session={session}
            target={target}
            isDefault={isDefault}
            onDefaultChange={setIsDefault}
            saveError={error}
          />
        </Splitter.Panel>
      </Splitter>
    </Modal>
  );
}
