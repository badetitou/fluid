import { Modal } from 'antd';
import { LlmSettingsForm } from './LlmSettingsForm';

/** Chooses and configures the LLM provider of the assistants. Mounted only while open. */
export function LlmSettingsModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal
      title="Assistant (LLM) settings"
      open
      footer={null}
      onCancel={onClose}
    >
      <LlmSettingsForm onCancel={onClose} onSaved={onClose} />
    </Modal>
  );
}
