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

/**
 * The base URL of a fluid as origin + path without trailing slash, or null when it is not an http(s)
 * URL or carries credentials, a query or a hash. Callers must not echo the raw value (it may hold a secret).
 */
export function parseFluidUrl(raw: string): string | null {
  try {
    const u = new URL(raw.trim());
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    if (u.username || u.password || u.search || u.hash) return null;
    return `${u.origin}${u.pathname}`.replace(/\/+$/, '');
  } catch {
    return null;
  }
}

const INVALID_URL = 'invalid --url: expected an http(s) URL without credentials, query or hash';
const RUN_ONLY = ['port', 'host', 'data-dir', 'env-file', 'no-open', 'verbose'] as const;

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
    const runOnly = RUN_ONLY.find((o) => values[o] !== undefined);
    if (runOnly) return { kind: 'error', message: `--${runOnly} does not apply to \`fluid mcp\`` };
    if (values.url === undefined) return { kind: 'mcp' };
    const url = parseFluidUrl(values.url);
    return url ? { kind: 'mcp', url } : { kind: 'error', message: INVALID_URL };
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
