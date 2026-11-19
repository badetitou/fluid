import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { FluidApiError, type FluidApi } from './fluidApi';
import { errorText, summarizeRun, summarizeSources, summarizeViews } from './model';
import { VIEWER_HTML, VIEWER_MIME, VIEWER_URI } from './viewerHtml';

const ui = (visibility: Array<'model' | 'app'>, withViewer: boolean) => ({
  ui: { ...(withViewer ? { resourceUri: VIEWER_URI } : {}), visibility },
});

const text = (t: string): CallToolResult => ({ content: [{ type: 'text', text: t }] });
const json = (value: unknown): CallToolResult => ({
  content: [{ type: 'text', text: JSON.stringify(value, null, 2) }],
  structuredContent: Array.isArray(value) ? { items: value } : (value as Record<string, unknown>),
});

const runInput = {
  viewId: z.string().min(1).describe('Id of a saved view (see list_views)'),
  sourceId: z.string().min(1).describe('Id of a configured data source (see list_sources)'),
  take: z.number().int().min(1).max(10_000).optional().describe('Row limit passed to the view queries'),
};

export function createFluidMcpServer(api: FluidApi, baseUrl: string, version = '0.0.0'): McpServer {
  const server = new McpServer({ name: 'fluid', version });

  async function sourceName(sourceId: string): Promise<string | undefined> {
    try {
      return (await api.listSources()).find((s) => s.id === sourceId)?.name;
    } catch {
      return undefined;
    }
  }

  /** Runs a handler, turning API failures into tool errors (never a thrown protocol error). */
  async function guarded(sourceId: string | undefined, fn: () => Promise<CallToolResult>): Promise<CallToolResult> {
    try {
      return await fn();
    } catch (err) {
      if (!(err instanceof FluidApiError)) throw err;
      const name = err.kind === 'auth-required' && sourceId ? await sourceName(sourceId) : undefined;
      const detail = err.kind === 'not-found' ? err.message : err.kind === 'unreachable' ? undefined : err.message;
      return { isError: true, ...text(errorText(err.kind, { baseUrl, sourceName: name ?? sourceId, detail })) };
    }
  }

  server.registerTool(
    'list_sources',
    {
      description: 'List the data sources configured in fluid (id, name, url, authKind, signedIn for OAuth sources).',
      _meta: ui(['model'], false),
    },
    () => guarded(undefined, async () => json(summarizeSources(await api.listSources()))),
  );

  server.registerTool(
    'list_views',
    {
      description: 'List the saved fluid views (id, title, concept), optionally for one concept.',
      inputSchema: { concept: z.string().min(1).optional().describe('Only views of this concept') },
      _meta: ui(['model'], false),
    },
    ({ concept }) => guarded(undefined, async () => json(summarizeViews(await api.listViews(concept)))),
  );

  server.registerTool(
    'show_view',
    {
      description:
        'Run a saved view on a data source and show it. Returns a short summary; the data is shown in the viewer.',
      inputSchema: runInput,
      _meta: ui(['model', 'app'], true),
    },
    ({ viewId, sourceId, take }) =>
      guarded(sourceId, async () => {
        const { spec, rawSpec } = await api.getView(viewId);
        const run = await api.runView(viewId, { sourceId, ...(take ? { take } : {}) });
        return { ...text(summarizeRun(spec, run)), structuredContent: { spec: rawSpec, data: run.results } };
      }),
  );

  server.registerTool(
    'run_queries',
    {
      description: 'Run the stored queries of a saved view (used by the viewer to refresh data).',
      inputSchema: { ...runInput, variables: z.record(z.string(), z.unknown()).optional() },
      _meta: ui(['app'], false),
    },
    ({ viewId, sourceId, variables, take }) =>
      guarded(sourceId, async () => {
        const run = await api.runView(viewId, { sourceId, ...(variables ? { variables } : {}), ...(take ? { take } : {}) });
        return json(run);
      }),
  );

  server.registerResource(
    'viewer',
    VIEWER_URI,
    { title: 'fluid viewer', description: 'Renders a fluid view', mimeType: VIEWER_MIME },
    () => ({ contents: [{ uri: VIEWER_URI, mimeType: VIEWER_MIME, text: VIEWER_HTML }] }),
  );

  return server;
}
