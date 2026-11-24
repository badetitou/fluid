import { Alert, Progress } from 'antd';
import { useBrowserLlmStatus } from '../../entities/llm';
import { browserSupport } from '../../llm/browser/browserEngine';

/** Live model download / readiness for the browser provider. */
export function BrowserLlmStatus() {
  const status = useBrowserLlmStatus();
  const support = browserSupport();
  if (!support.supported) {
    return <Alert type="warning" showIcon title="WebGPU unavailable" description={support.reason} />;
  }
  if (status.state === 'loading') {
    return (
      <Alert
        type="info"
        showIcon
        title="Loading the local model"
        description={
          <>
            <Progress percent={Math.round(status.progress * 100)} size="small" />
            {status.text}
          </>
        }
      />
    );
  }
  if (status.state === 'error') {
    return <Alert type="error" showIcon title="The local model could not start" description={status.text} />;
  }
  if (status.state === 'ready') {
    return <Alert type="success" showIcon title="Local model ready" description={`Running ${status.model} in this tab.`} />;
  }
  return <Alert type="info" showIcon title="Model not loaded yet" description="The model downloads on the first request." />;
}
