import { Alert } from 'antd';
import { useWidgetCatalog } from './catalogContext';

/** Stands in for a widget no active plugin renders, saying which plugin to enable. */
export function MissingWidget({ type }: { type: string }) {
  const { explainMissing } = useWidgetCatalog();
  return (
    <Alert
      type="info"
      showIcon
      title={`Widget “${type}” unavailable`}
      description={explainMissing(type)}
    />
  );
}
