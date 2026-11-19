import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { readFileSync } from 'node:fs';
import { createFluidApi } from './fluidApi';
import { createFluidMcpServer } from './server';
import { loadViewerHtml } from './viewerHtml';

export const DEFAULT_FLUID_URL = 'http://localhost:4001';

/**
 * Serves MCP over stdio until the host closes it. stdout is the protocol channel: this module and
 * everything it calls must only log to stderr. fluid being down is not fatal here: hosts start MCP
 * servers at launch, so each tool call reports it instead.
 */
export async function runMcp(baseUrl: string, version: string, viewerPath: string): Promise<number> {
  const viewer = loadViewerHtml(viewerPath, (path) => readFileSync(path, 'utf8'));
  if (viewer.source === 'placeholder') console.error(`fluid mcp: viewer not found at ${viewerPath}, serving the placeholder (build it with \`pnpm pack:cli\`)`);
  const server = createFluidMcpServer(createFluidApi(baseUrl), baseUrl, version, viewer.html);
  const closed = new Promise<void>((resolve) => {
    server.server.onclose = resolve;
    process.stdin.once('end', resolve);
  });
  await server.connect(new StdioServerTransport());
  console.error(`fluid mcp: serving on stdio, fluid at ${baseUrl}`);
  await closed;
  return 0;
}
