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
  | { kind: 'help' }
  | { kind: 'version' }
  | { kind: 'error'; message: string };

export const DEFAULT_PORT = 4001;
export const DEFAULT_HOST = '127.0.0.1';

const portSchema = z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(0).max(65535));

export function parseCliArgs(argv: string[]): ParsedArgs {
  let values;
  try {
    ({ values } = parseArgs({
      args: argv,
      strict: true,
      allowPositionals: false,
      options: {
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
