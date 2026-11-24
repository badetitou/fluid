import { useState } from 'react';
import { Button, Select, Space, Typography } from 'antd';
import { useLlmCapabilities } from '../../entities/llm';
import { detectPreset, findPreset, LLM_PRESETS, presetPatch, type LlmPresetId } from '../../llm/llmPresets';
import { Field } from './Field';
import { ProviderFields } from './ProviderFields';
import { useLlmSettingsDraft } from './useLlmSettingsDraft';
import styles from './LlmSettings.module.css';

const PROVIDER_OPTIONS = [
  { value: 'mock', label: 'Mock (offline, no key)' },
  { value: 'claude-code', label: 'Claude (local Claude Code login)' },
  { value: 'browser', label: 'Browser WebGPU (in this tab)' },
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
  const [presetId, setPresetId] = useState<LlmPresetId | null>(() =>
    detectPreset({ provider: draft.provider, model: draft.model, baseUrl: draft.baseUrl }),
  );

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
    setPresetId(null);
    setSaved(false);
  };
  const handlePresetChange = (id: LlmPresetId) => {
    const preset = findPreset(id);
    if (!preset) return;
    setPresetId(id);
    handleUpdate(
      presetPatch(preset, { provider: draft.provider, apiKey: draft.apiKey, presetId }),
    );
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
        per request — the API key is never stored server-side. The Browser WebGPU provider runs entirely
        in this tab and sends nothing.
      </Typography.Text>
      <Field label="Quick setup">
        <Select
          value={presetId ?? undefined}
          onChange={handlePresetChange}
          placeholder="Pick a provider or a free tier…"
          options={LLM_PRESETS.map((preset) => ({ value: preset.id, label: preset.label }))}
        />
      </Field>
      <Field label="Provider">
        <Select
          value={draft.provider}
          onChange={handleProviderChange}
          options={[...PROVIDER_OPTIONS]}
        />
      </Field>
      <ProviderFields draft={draft} onChange={handleUpdate} caps={caps} preset={findPreset(presetId) ?? null} />
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
