import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { registerActionTools } from './actionTools';
import { registerDraftTools } from './draftTools';
import { FluidApiError, type FluidApi, type RunOutput, type RunParams } from './fluidApi';
import {
  DEFAULT_TAKE,
  deliveryError,
  errorText,
  summarizeRun,
  summarizeRunShort,
  summarizeSources,
  summarizeViews,
} from './model';
import { json, text, ui, viewerMeta } from './results';
import { PLACEHOLDER_HTML, VIEWER_MIME, VIEWER_URI } from './viewerHtml';

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

const variables = z.record(z.string(), z.unknown()).optional().describe('Variables of the view queries, e.g. { "id": "1" }');

export function createFluidMcpServer(api: FluidApi, baseUrl: string, version = '0.0.0', viewerHtml = PLACEHOLDER_HTML): McpServer {
  const server = new McpServer({ name: 'fluid', version });

  async function sourceInfo(sourceId: string) {
    try {
      return (await api.listSources()).find((s) => s.id === sourceId);
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
    const blocked = deliveryError(out);
    if (blocked) throw blocked;
    return out;
  }

  /** Runs a handler, turning API failures into tool errors (never a thrown protocol error). */
  async function guarded(sourceId: string | undefined, fn: () => Promise<CallToolResult>): Promise<CallToolResult> {
    try {
      return await fn();
    } catch (err) {
      if (!(err instanceof FluidApiError)) throw err;
      const name = err.kind === 'auth-required' && sourceId ? (await sourceInfo(sourceId))?.name : undefined;
      const detail = err.kind === 'not-found' ? err.message : err.kind === 'unreachable' ? undefined : err.message;
      return { isError: true, ...text(errorText(err.kind, { baseUrl, sourceName: name ?? sourceId, detail, issues: err.issues })) };
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
      description: 'List the saved fluid views (id, title, concept, scope list or detail), optionally for one concept.',
      inputSchema: { concept: z.string().min(1).optional().describe('Only views of this concept') },
      // The viewer looks up the view of a linked item with it.
      _meta: ui(['model', 'app'], false),
    },
    ({ concept }) => guarded(undefined, async () => json(summarizeViews(await api.listViews(concept)))),
  );

  server.registerTool(
    'show_view',
    {
      description:
        'Run a saved view on a data source and show it. Returns a short summary; the data is shown in the viewer. For a detail view, pass the item id as variables.id.',
      inputSchema: { ...runInput, variables },
      _meta: viewerMeta(['model', 'app']),
    },
    ({ viewId, sourceId, take, variables: vars }) =>
      guarded(sourceId, async () => {
        const { spec, rawSpec } = await api.getView(viewId);
        const out = await run(viewId, { sourceId, take, ...(vars ? { variables: vars } : {}) });
        // Whether the viewer may offer the view's actions: the source allows changes ("Allow changes" in fluid).
        const writable = (await sourceInfo(sourceId))?.allowWrites === true;
        const shown = { viewId, sourceId, take: take ?? DEFAULT_TAKE, ...(vars ? { variables: vars } : {}), fluidUrl: baseUrl, writable };
        return { ...text(summarizeRun(spec, out)), structuredContent: { ...shown, spec: rawSpec, data: out.results } };
      }),
  );

  server.registerTool(
    'run_queries',
    {
      description: 'Run the stored queries of a saved view (used by the viewer to refresh data).',
      inputSchema: { ...runInput, variables },
      _meta: ui(['app'], false),
    },
    ({ viewId, sourceId, variables, take }) =>
      guarded(sourceId, async () => {
        const out = await run(viewId, { sourceId, ...(variables ? { variables } : {}), take });
        return { ...text(summarizeRunShort(out)), structuredContent: out };
      }),
  );

  registerDraftTools(server, api, guarded, baseUrl);
  registerActionTools(server, api, guarded);

  server.registerResource(
    'viewer',
    VIEWER_URI,
    { title: 'fluid viewer', description: 'Renders a fluid view', mimeType: VIEWER_MIME },
    () => ({ contents: [{ uri: VIEWER_URI, mimeType: VIEWER_MIME, text: viewerHtml }] }),
  );

  return server;
}
