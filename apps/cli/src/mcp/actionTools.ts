import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { FluidApi } from './fluidApi';
import { summarizeAction } from './model';
import { text, ui, type Guarded } from './results';

// View actions (mutations of a saved view): the viewer only, after the user confirmed. The model never sees this tool.

export function registerActionTools(server: McpServer, api: FluidApi, guarded: Guarded): void {
  server.registerTool(
    'invoke_action',
    {
      description: 'Run an action of a saved view on a source that allows changes (called by the viewer once the user confirmed).',
      inputSchema: {
        viewId: z.string().min(1),
        sourceId: z.string().min(1),
        action: z.string().min(1).max(200).describe('Key of the action in the view'),
        variables: z.record(z.string(), z.unknown()).optional().describe('The resolved variables of the mutation'),
      },
      _meta: ui(['app'], false),
    },
    ({ viewId, sourceId, action, variables }) =>
      guarded(sourceId, async () => {
        const out = await api.invokeAction(viewId, action, { sourceId, ...(variables ? { variables } : {}) });
        const result = { ...(out.data !== undefined ? { data: out.data } : {}), ...(out.errors ? { errors: out.errors } : {}) };
        return { ...text(summarizeAction(action, out)), structuredContent: result };
      }),
  );
}
