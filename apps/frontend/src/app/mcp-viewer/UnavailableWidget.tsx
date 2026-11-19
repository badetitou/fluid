import { Alert } from 'antd';

/**
 * Stands in for the widgets the viewer build leaves out (see vite.viewer.config.ts and
 * docs/architecture/MCP.md): they need web workers or weigh too much for a single HTML resource.
 */
export function UnavailableWidget({ widget }: { widget?: { type?: string } }) {
  return (
    <Alert
      type="info"
      showIcon
      title={`The ${widget?.type ?? 'widget'} widget is not available in this host`}
      description="Open this view in fluid to see it."
    />
  );
}
