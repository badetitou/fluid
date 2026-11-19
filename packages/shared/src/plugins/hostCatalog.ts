import { WIDGET_TYPES } from '../view-spec';
import { resolveWidgetCatalog } from './catalog';
import type { WidgetContract } from './contracts';

/**
 * Built-in widgets the MCP viewer (`ui://fluid/viewer`) cannot draw: left out of its bundle
 * (network, 3D, see docs/architecture/MCP.md) or needing the app (insight calls the assistant).
 */
export const MCP_UNAVAILABLE_WIDGETS: readonly string[] = ['network', 'model3d', 'scene3d', 'insight'];

/** The widgets an assistant may use in a view drafted through MCP. */
export function mcpWidgetCatalog(): WidgetContract[] {
  return resolveWidgetCatalog({ types: WIDGET_TYPES.filter((t) => !MCP_UNAVAILABLE_WIDGETS.includes(t)) });
}
