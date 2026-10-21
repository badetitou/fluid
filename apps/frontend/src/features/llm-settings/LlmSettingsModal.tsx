import { Modal, Select, Space, Typography } from 'antd';
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

/** Chooses and configures the LLM provider of the assistants. Mounted only while open. */
export function LlmSettingsModal({ onClose }: { onClose: () => void }) {
  const caps = useLlmCapabilities(true);
  const { draft, update, setProvider, save } = useLlmSettingsDraft();

  return (
    <Modal
      title="Assistant (LLM) settings"
      open
      onOk={() => {
        save();
        onClose();
      }}
      onCancel={onClose}
      okText="Save"
    >
      <Space orientation="vertical" size={14} className={styles.form}>
        <Typography.Text type="secondary">
          Used to generate views from a prompt. Settings stay in your browser and are sent to the
          BFF per request — the API key is never stored server-side.
        </Typography.Text>
        <Field label="Provider">
          <Select value={draft.provider} onChange={setProvider} options={[...PROVIDER_OPTIONS]} />
        </Field>
        <ProviderFields draft={draft} onChange={update} caps={caps} />
      </Space>
    </Modal>
  );
}
