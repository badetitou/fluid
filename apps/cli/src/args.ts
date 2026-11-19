import { parseArgs } from 'node:util';
import { z } from 'zod';

export interface CliOptions {
  port: number;
  host: string;
  dataDir?: string;
  envFile?: string;
  open: boolean;
  verbose: boolean;
}

export type ParsedArgs =
  | { kind: 'run'; options: CliOptions }
  | { kind: 'mcp'; url?: string }
  | { kind: 'help' }
  | { kind: 'version' }
  | { kind: 'error'; message: string };

export const DEFAULT_PORT = 4001;
export const DEFAULT_HOST = '127.0.0.1';

const portSchema = z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(0).max(65535));

/** The base URL of a fluid (no trailing slash), or null when it is not an http(s) URL. */
export function parseFluidUrl(raw: string): string | null {
  try {
    const u = new URL(raw.trim());
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return raw.trim().replace(/\/+$/, '');
  } catch {
    return null;
  }
}

export function parseCliArgs(argv: string[]): ParsedArgs {
  let values;
  let positionals: string[];
  try {
    ({ values, positionals } = parseArgs({
      args: argv,
      strict: true,
      allowPositionals: true,
      options: {
        url: { type: 'string' },
        port: { type: 'string' },
        host: { type: 'string' },
        'data-dir': { type: 'string' },
        'env-file': { type: 'string' },
        'no-open': { type: 'boolean' },
        verbose: { type: 'boolean' },
        help: { type: 'boolean', short: 'h' },
        version: { type: 'boolean', short: 'v' },
      },
    }));
  } catch (err) {
    return { kind: 'error', message: err instanceof Error ? err.message : String(err) };
  }
  if (values.help) return { kind: 'help' };
  if (values.version) return { kind: 'version' };
  const [command, ...extra] = positionals;
  if (command !== undefined && (command !== 'mcp' || extra.length > 0)) {
    return { kind: 'error', message: `unknown command "${positionals.join(' ')}" (expected: mcp)` };
  }
  if (command === 'mcp') {
    if (values.url === undefined) return { kind: 'mcp' };
    const url = parseFluidUrl(values.url);
    return url ? { kind: 'mcp', url } : { kind: 'error', message: `invalid --url "${values.url}": expected an http(s) URL` };
  }
  if (values.url !== undefined) return { kind: 'error', message: '--url only applies to `fluid mcp`' };

  let port = DEFAULT_PORT;
  if (values.port !== undefined) {
    const parsed = portSchema.safeParse(values.port.trim());
    if (!parsed.success) {
      return { kind: 'error', message: `invalid --port "${values.port}": expected an integer from 0 to 65535` };
    }
    port = parsed.data;
  }
  return {
    kind: 'run',
    options: {
      port,
      host: values.host || DEFAULT_HOST,
      dataDir: values['data-dir'],
      envFile: values['env-file'],
      open: !values['no-open'],
      verbose: values.verbose === true,
    },
  };
}
