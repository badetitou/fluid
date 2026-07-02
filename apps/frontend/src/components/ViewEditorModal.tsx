import { useEffect, useState } from 'react';
import { App as AntdApp, Alert, Checkbox, Input, Modal, Typography } from 'antd';
import { safeParseViewSpec, type ViewSpec } from '@fluid/shared';
import { bffClient, type SavedView } from '../bff/client';

export interface ViewEditorInitial {
  title: string;
  spec: ViewSpec;
  isDefault: boolean;
  /** Present when editing an existing saved view. */
  editingId?: string;
}

interface ViewEditorModalProps {
  open: boolean;
  mode: 'create' | 'edit';
  concept: string;
  initial: ViewEditorInitial;
  onClose: () => void;
  onSaved: (view: SavedView) => void;
}

function formatIssues(issues: { path: (string | number)[]; message: string }[]): string {
  return issues
    .slice(0, 6)
    .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
    .join('\n');
}

export function ViewEditorModal({
  open,
  mode,
  concept,
  initial,
  onClose,
  onSaved,
}: ViewEditorModalProps) {
  const { message } = AntdApp.useApp();
  const [title, setTitle] = useState(initial.title);
  const [specText, setSpecText] = useState('');
  const [isDefault, setIsDefault] = useState(initial.isDefault);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle(initial.title);
    setSpecText(JSON.stringify(initial.spec, null, 2));
    setIsDefault(initial.isDefault);
    setError(null);
    setSubmitting(false);
  }, [open, initial]);

  const handleOk = async () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError('A title is required.');
      return;
    }

    let raw: unknown;
    try {
      raw = JSON.parse(specText);
    } catch (err) {
      setError(`Invalid JSON: ${(err as Error).message}`);
      return;
    }

    const parsed = safeParseViewSpec(raw);
    if (!parsed.success) {
      setError(`Invalid view spec:\n${formatIssues(parsed.error.issues)}`);
      return;
    }

    const spec: ViewSpec = { ...parsed.data, title: trimmedTitle, concept };

    setSubmitting(true);
    setError(null);
    try {
      const saved =
        mode === 'edit' && initial.editingId
          ? await bffClient.updateView(initial.editingId, { spec, isDefault })
          : await bffClient.createView(spec, isDefault);
      message.success(mode === 'edit' ? 'View updated' : 'View saved');
      onSaved(saved);
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      title={mode === 'edit' ? 'Edit view' : 'New view'}
      open={open}
      onOk={handleOk}
      onCancel={onClose}
      okText={mode === 'edit' ? 'Save changes' : 'Create view'}
      confirmLoading={submitting}
      width={720}
      destroyOnHidden
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 }}>
        <Typography.Text type="secondary">
          A view is a declarative JSON spec (tables, stats, charts). Assistant-generated views
          arrive in a later phase — for now, edit the spec directly. It is validated before saving.
        </Typography.Text>

        <div>
          <Typography.Text strong>Title</Typography.Text>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={`e.g. ${concept} overview`}
          />
        </div>

        <div>
          <Typography.Text strong>Spec (JSON)</Typography.Text>
          <Input.TextArea
            value={specText}
            onChange={(e) => setSpecText(e.target.value)}
            autoSize={{ minRows: 12, maxRows: 22 }}
            spellCheck={false}
            style={{ fontFamily: 'monospace', fontSize: 12 }}
          />
        </div>

        <Checkbox checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)}>
          Set as the default view for {concept}
        </Checkbox>

        {error && (
          <Alert
            type="error"
            showIcon
            message="Could not save the view"
            description={<pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{error}</pre>}
          />
        )}
      </div>
    </Modal>
  );
}
