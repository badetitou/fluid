import { useEffect, useState } from 'react';
import { Alert, Input, Modal, Select, Space, Tag, Typography } from 'antd';
import { useLlmSettings } from '../store';
import { bffClient, type LlmCapabilities, type LlmProvider } from '../bff/client';

interface LlmSettingsModalProps {
  open: boolean;
  onClose: () => void;
}

const PROVIDER_OPTIONS = [
  { value: 'mock', label: 'Mock (offline, no key)' },
  { value: 'openai', label: 'OpenAI (or compatible)' },
  { value: 'ollama', label: 'Ollama (local)' },
];

export function LlmSettingsModal({ open, onClose }: LlmSettingsModalProps) {
  const settings = useLlmSettings();
  const [provider, setProvider] = useState<LlmProvider>(settings.provider);
  const [model, setModel] = useState(settings.model);
  const [apiKey, setApiKey] = useState(settings.apiKey);
  const [baseUrl, setBaseUrl] = useState(settings.baseUrl);
  const [caps, setCaps] = useState<LlmCapabilities | null>(null);

  useEffect(() => {
    if (!open) return;
    setProvider(settings.provider);
    setModel(settings.model);
    setApiKey(settings.apiKey);
    setBaseUrl(settings.baseUrl);
    bffClient
      .getLlmConfig()
      .then(setCaps)
      .catch(() => setCaps(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleSave = () => {
    useLlmSettings.getState().update({ provider, model, apiKey, baseUrl });
    onClose();
  };

  const openaiModel = caps?.providers.openai.model ?? 'gpt-4o-mini';
  const openaiBase = caps?.providers.openai.baseUrl ?? 'https://api.openai.com/v1';
  const ollamaModel = caps?.providers.ollama.model ?? 'llama3.1';
  const ollamaBase = caps?.providers.ollama.baseUrl ?? 'http://localhost:11434/v1';

  return (
    <Modal
      title="Assistant (LLM) settings"
      open={open}
      onOk={handleSave}
      onCancel={onClose}
      okText="Save"
      destroyOnHidden
    >
      <Space direction="vertical" size={14} style={{ width: '100%', marginTop: 8 }}>
        <Typography.Text type="secondary">
          Used to generate views from a prompt. Settings stay in your browser and are sent to the
          BFF per request — the API key is never stored server-side.
        </Typography.Text>

        <div>
          <Typography.Text strong>Provider</Typography.Text>
          <Select
            style={{ width: '100%' }}
            value={provider}
            onChange={(v) => setProvider(v)}
            options={PROVIDER_OPTIONS}
          />
        </div>

        {provider === 'mock' && (
          <Alert
            type="info"
            showIcon
            message="The mock provider needs no configuration"
            description="It returns a deterministic dashboard built from the concept's schema — handy offline and for demos."
          />
        )}

        {provider === 'openai' && (
          <>
            {caps?.providers.openai.configured && (
              <Tag color="green">A server-side key is configured — leave the key blank to use it.</Tag>
            )}
            <div>
              <Typography.Text strong>Model</Typography.Text>
              <Input value={model} onChange={(e) => setModel(e.target.value)} placeholder={openaiModel} />
            </div>
            <div>
              <Typography.Text strong>API key</Typography.Text>
              <Input.Password
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-…"
                autoComplete="off"
              />
            </div>
            <div>
              <Typography.Text strong>Base URL</Typography.Text>
              <Input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder={openaiBase} />
            </div>
          </>
        )}

        {provider === 'ollama' && (
          <>
            <div>
              <Typography.Text strong>Model</Typography.Text>
              <Input value={model} onChange={(e) => setModel(e.target.value)} placeholder={ollamaModel} />
            </div>
            <div>
              <Typography.Text strong>Base URL</Typography.Text>
              <Input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder={ollamaBase} />
            </div>
          </>
        )}
      </Space>
    </Modal>
  );
}
