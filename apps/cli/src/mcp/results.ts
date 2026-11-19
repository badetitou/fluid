import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { VIEWER_URI } from './viewerHtml';

// Shapes shared by the tool handlers.

export const ui = (visibility: Array<'model' | 'app'>, withViewer: boolean) => ({
  ui: { ...(withViewer ? { resourceUri: VIEWER_URI } : {}), visibility },
});

/** `_meta` of a tool whose result the viewer shows. `ui/resourceUri` (flat) is deprecated in MCP Apps 2026-01-26; kept for older hosts. */
export const viewerMeta = (visibility: Array<'model' | 'app'>) => ({ ...ui(visibility, true), 'ui/resourceUri': VIEWER_URI });

export const text = (t: string): CallToolResult => ({ content: [{ type: 'text', text: t }] });

export const json = (value: unknown): CallToolResult => ({
  content: [{ type: 'text', text: JSON.stringify(value) }],
  structuredContent: Array.isArray(value) ? { items: value } : (value as Record<string, unknown>),
});

/** Runs a handler and turns fluid's failures into a tool error (see server.ts). */
export type Guarded = (sourceId: string | undefined, fn: () => Promise<CallToolResult>) => Promise<CallToolResult>;
