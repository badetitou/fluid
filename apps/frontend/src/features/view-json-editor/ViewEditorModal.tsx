import { useState } from 'react';
import { App as AntdApp, Alert, Checkbox, Input, Modal, Typography } from 'antd';
import { useSaveView, type SavedView, type ViewDraft } from '../../entities/view';
import { parseViewSpecText } from './model';
import styles from './ViewEditorModal.module.css';

interface ViewEditorModalProps {
  concept: string;
  /** Prefill; a draft with `editingId` updates that saved view. */
  draft: ViewDraft;
  onClose: () => void;
  onSaved: (view: SavedView) => void;
}

/** Edits a view as raw JSON, validated against the view spec schema before saving. Mounted only while open. */
export function ViewEditorModal({ concept, draft, onClose, onSaved }: ViewEditorModalProps) {
  const { message } = AntdApp.useApp();
  const [title, setTitle] = useState(draft.title);
  const [specText, setSpecText] = useState(() => JSON.stringify(draft.spec, null, 2));
  const [isDefault, setIsDefault] = useState(draft.isDefault);
  const { saving, error, setError, save } = useSaveView();
  const editing = Boolean(draft.editingId);

  const handleOk = async () => {
    const parsed = parseViewSpecText(specText, title, concept);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    const saved = await save(parsed.spec, { editingId: draft.editingId, isDefault });
    if (!saved) return;
    message.success(editing ? 'View updated' : 'View saved');
    onSaved(saved);
  };

  return (
    <Modal
      title={editing ? 'Edit view' : 'New view'}
      open
      onOk={handleOk}
      onCancel={onClose}
      okText={editing ? 'Save changes' : 'Create view'}
      confirmLoading={saving}
      width="min(720px, calc(100vw - 24px))"
    >
      <div className={styles.form}>
        <Typography.Text type="secondary">
          A view is a declarative JSON spec (tables, stats, charts). Edit the spec directly — it is
          validated before saving.
        </Typography.Text>

        <div>
          <Typography.Text strong>Title</Typography.Text>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={`e.g. ${concept} overview`} />
        </div>

        <div>
          <Typography.Text strong>Spec (JSON)</Typography.Text>
          <Input.TextArea
            value={specText}
            onChange={(e) => setSpecText(e.target.value)}
            autoSize={{ minRows: 12, maxRows: 22 }}
            spellCheck={false}
            className={styles.code}
          />
        </div>

        <Checkbox checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)}>
          Set as the default view for {concept}
        </Checkbox>

        {error && (
          <Alert
            type="error"
            showIcon
            title="Could not save the view"
            description={<pre className={styles.error}>{error}</pre>}
          />
        )}
      </div>
    </Modal>
  );
}
