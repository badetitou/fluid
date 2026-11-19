import { useState } from 'react';
import { Alert, Button, Space } from 'antd';
import type { DraftInfo } from './toolResult';

interface Props {
  draft?: DraftInfo;
  /** Title of the view once saved. */
  savedTitle?: string;
  onSave: () => Promise<void>;
}

/** Above a drafted view: its issues and the "Save in fluid" button; then that it was saved. */
export function DraftBar({ draft, savedTitle, onSave }: Props) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  if (!draft) return savedTitle ? <Alert type="success" showIcon title={`Saved in fluid as "${savedTitle}".`} /> : null;

  const save = () => {
    setSaving(true);
    setError(undefined);
    onSave()
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setSaving(false));
  };
  return (
    <Space orientation="vertical">
      {draft.issues.length > 0 && (
        <Alert type="warning" showIcon title="The assistant still has issues to fix" description={<ul>{draft.issues.map((i) => <li key={i}>{i}</li>)}</ul>} />
      )}
      {error && <Alert type="error" showIcon title={error} />}
      <Button type="primary" loading={saving} onClick={save}>
        Save in fluid
      </Button>
    </Space>
  );
}
