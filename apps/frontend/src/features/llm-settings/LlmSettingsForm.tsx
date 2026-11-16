import { useState } from 'react';
import { Button, Select, Space, Typography } from 'antd';
import { useLlmCapabilities } from '../../entities/llm';
import { Field } from './Field';
import { ProviderFields } from './ProviderFields';
import { useLlmSettingsDraft } from './useLlmSettingsDraft';
import styles from './LlmSettings.module.css';

const PROVIDER_OPTIONS = [
  { value: 'mock', label: 'Mock (offline, no key)' },
  { value: 'claude-code', label: 'Claude (local Claude Code login)' },
  { value: 'openai', label: 'OpenAI (or compatible)' },
  { value: 'ollama', label: 'Ollama (local)' },
] as const;

interface LlmSettingsFormProps {
  onSaved?: () => void;
  onCancel?: () => void;
}

/** Shared editable LLM settings, used inline in Settings and in the Miller list modal. */
export function LlmSettingsForm({ onSaved, onCancel }: LlmSettingsFormProps) {
  const caps = useLlmCapabilities(true);
  const { draft, update, setProvider, save } = useLlmSettingsDraft(caps?.defaultProvider ?? null);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    save();
    setSaved(true);
    onSaved?.();
  };
  const handleUpdate = (patch: Parameters<typeof update>[0]) => {
    update(patch);
    setSaved(false);
  };
  const handleProviderChange = (provider: typeof draft.provider) => {
    setProvider(provider);
    setSaved(false);
  };

  return (
    <form
      className={styles.form}
      onSubmit={(event) => {
        event.preventDefault();
        handleSave();
      }}
    >
      <Typography.Text type="secondary">
        Used to generate views from a prompt. Settings stay in your browser and are sent to the BFF
        per request — the API key is never stored server-side.
      </Typography.Text>
      <Field label="Provider">
        <Select
          value={draft.provider}
          onChange={handleProviderChange}
          options={[...PROVIDER_OPTIONS]}
        />
      </Field>
      <ProviderFields draft={draft} onChange={handleUpdate} caps={caps} />
      <Space className={styles.actions}>
        {onCancel && (
          <Button htmlType="button" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button htmlType="submit" type="primary">
          {saved ? 'Saved' : 'Save settings'}
        </Button>
      </Space>
    </form>
  );
}
