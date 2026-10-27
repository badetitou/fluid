import { Card } from 'antd';
import { LlmSettingsForm } from '../../features/llm-settings';

/** Inline LLM provider settings. The same form is also shown in the Miller list modal. */
export function LlmCard() {
  return (
    <Card>
      <LlmSettingsForm />
    </Card>
  );
}
