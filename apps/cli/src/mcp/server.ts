import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { FluidApiError, type FluidApi, type RunOutput, type RunParams } from './fluidApi';
import {
  DEFAULT_TAKE,
  errorText,
  needsSignIn,
  oversizeKb,
  summarizeRun,
  summarizeRunShort,
  summarizeSources,
  summarizeViews,
} from './model';
import { VIEWER_HTML, VIEWER_MIME, VIEWER_URI } from './viewerHtml';

const ui = (visibility: Array<'model' | 'app'>, withViewer: boolean) => ({
  ui: { ...(withViewer ? { resourceUri: VIEWER_URI } : {}), visibility },
});

const text = (t: string): CallToolResult => ({ content: [{ type: 'text', text: t }] });
const json = (value: unknown): CallToolResult => ({
  content: [{ type: 'text', text: JSON.stringify(value) }],
  structuredContent: Array.isArray(value) ? { items: value } : (value as Record<string, unknown>),
});

const runInput = {
  viewId: z.string().min(1).describe('Id of a saved view (see list_views)'),
  sourceId: z.string().min(1).describe('Id of a configured data source (see list_sources)'),
  take: z
    .number()
    .int()
    .min(1)
    .max(10_000)
    .optional()
    .describe(`Row limit passed to the view queries (default ${DEFAULT_TAKE}; results over 256 KB are refused: lower it)`),
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

  /**
   * Runs the view with the default `take`. A 200 whose results hold a missing sign-in is an auth error
   * (some queries may have worked), and a result over the size cap is refused.
   */
  async function run(viewId: string, params: RunParams): Promise<RunOutput> {
    const out = await api.runView(viewId, { ...params, take: params.take ?? DEFAULT_TAKE });
    if (needsSignIn(out)) throw new FluidApiError('auth-required', 'sign-in required');
    const kb = oversizeKb(out);
    if (kb !== null) throw new FluidApiError('too-large', `The result is too large (${kb} KB, limit 256 KB): call again with a lower take.`);
    return out;
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
      // `ui/resourceUri` (flat) is deprecated in MCP Apps 2026-01-26; kept for hosts that predate `_meta.ui`.
      _meta: { ...ui(['model', 'app'], true), 'ui/resourceUri': VIEWER_URI },
    },
    ({ viewId, sourceId, take }) =>
      guarded(sourceId, async () => {
        const { spec, rawSpec } = await api.getView(viewId);
        const out = await run(viewId, { sourceId, take });
        return { ...text(summarizeRun(spec, out)), structuredContent: { spec: rawSpec, data: out.results } };
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
        const out = await run(viewId, { sourceId, ...(variables ? { variables } : {}), take });
        return { ...text(summarizeRunShort(out)), structuredContent: out };
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
