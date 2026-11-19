import { spawn } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { z } from 'zod';
import { parseCliArgs, parseFluidUrl, type CliOptions } from './args';
import { DEFAULT_FLUID_URL, runMcp } from './mcp/run';
import { browserCommand, shouldOpenBrowser } from './browser';
import { resolveRunConfig } from './config';
import { describeStartupError } from './errors';
import { USAGE } from './help';
import { missingLayoutEntries, packageLayout, type PackageLayout } from './layout';

type Env = Record<string, string | undefined>;

const manifestSchema = z.object({ version: z.string() });

function readVersion(layout: PackageLayout): string {
  try {
    return manifestSchema.parse(JSON.parse(readFileSync(layout.manifestPath, 'utf8'))).version;
  } catch {
    return 'unknown';
  }
}

function openBrowser(url: string): void {
  const { command, args } = browserCommand(process.platform, url);
  try {
    const child = spawn(command, args, { detached: true, stdio: 'ignore' });
    child.on('error', () => console.error(`could not open a browser: open ${url} yourself`));
    child.unref();
  } catch {
    console.error(`could not open a browser: open ${url} yourself`);
  }
}

async function launch(options: CliOptions, env: Env, layout: PackageLayout): Promise<number> {
  const config = resolveRunConfig(options, env);
  for (const warning of config.warnings) console.error(`warning: ${warning}`);
  // db.ts resolves the storage mode when the server module is first evaluated, so the data dir
  // must be in the environment BEFORE this import. Never import '@fluid/bff/server' statically.
  Object.assign(process.env, config.envOverrides);
  const { startServer, onShutdownSignals } = await import('@fluid/bff/server');
  try {
    const server = await startServer({
      port: config.port,
      host: config.host,
      staticDir: layout.staticDir,
      migrationsDir: layout.migrationsDir,
      logLevel: options.verbose ? 'info' : 'warn',
    });
    const url = config.displayUrl(server.port);
    console.log(`fluid running at ${url} · storage: ${server.storageLabel} · Ctrl+C to stop`);
    if (config.postgres) {
      console.log('Postgres mode: the database must already be migrated (prisma migrate deploy).');
    }
    onShutdownSignals(server.close);
    if (shouldOpenBrowser(options.open, env, process.platform)) openBrowser(url);
    return 0;
  } catch (err) {
    console.error(`fluid: ${describeStartupError(err, config.port)}`);
    if (options.verbose) console.error(err);
    return 1;
  }
}

/** CLI orchestration; the only module with side effects (process, fs, spawn). Returns the exit code. */
export async function main(argv: string[], env: Env, entryUrl: string): Promise<number> {
  const layout = packageLayout(entryUrl);
  const parsed = parseCliArgs(argv);
  if (parsed.kind === 'help') {
    console.log(USAGE);
    return 0;
  }
  if (parsed.kind === 'version') {
    console.log(readVersion(layout));
    return 0;
  }
  if (parsed.kind === 'error') {
    console.error(`fluid: ${parsed.message}\n\n${USAGE}`);
    return 2;
  }
  if (parsed.kind === 'mcp') {
    const fromEnv = env.FLUID_URL ? parseFluidUrl(env.FLUID_URL) : null;
    if (env.FLUID_URL && !fromEnv && !parsed.url) {
      console.error(`fluid: invalid FLUID_URL "${env.FLUID_URL}": expected an http(s) URL`);
      return 2;
    }
    return runMcp(parsed.url ?? fromEnv ?? DEFAULT_FLUID_URL, readVersion(layout));
  }
  const { options } = parsed;
  if (options.envFile) {
    try {
      process.loadEnvFile(options.envFile); // never overrides variables already set
    } catch (err) {
      console.error(`fluid: cannot read --env-file ${options.envFile}: ${(err as Error).message}`);
      return 1;
    }
  }
  const missing = missingLayoutEntries(layout, { exists: existsSync, list: (d) => (existsSync(d) ? readdirSync(d) : []) });
  if (missing.length > 0) {
    console.error(`fluid: corrupted install (missing ${missing.join(', ')}), reinstall`);
    return 1;
  }
  return launch(options, env, layout);
}
