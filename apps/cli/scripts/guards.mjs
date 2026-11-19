// Build-time checks on the esbuild result. Every function throws on failure.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { builtinModules } from 'node:module';
import { join } from 'node:path';

const ALLOWED_EXTERNALS = new Set(['pg-native', 'pg-cloudflare', '@electric-sql/pglite']);
// The dev default of storage/client.ts; harmless in the bundle because main always passes migrationsDir.
const ALLOWED_IMPORT_META_PATHS = ['../../prisma/migrations'];

/** Present in the built viewer (its `appInfo.name`), absent from the placeholder. */
export const VIEWER_MARKER = 'fluid-mcp-app-viewer';

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));

function isAllowedExternal(path) {
  if (path.startsWith('node:') || builtinModules.includes(path)) return true;
  return [...ALLOWED_EXTERNALS].some((e) => path === e || path.startsWith(`${e}/`));
}

/** (a) the only runtime imports left outside the bundle are node:*, the optional pg drivers and pglite. */
export function checkExternals(metafile) {
  let pgliteImported = false;
  for (const [file, out] of Object.entries(metafile.outputs)) {
    for (const imp of out.imports) {
      if (!imp.external) continue;
      if (!isAllowedExternal(imp.path)) throw new Error(`guard (a): ${file} imports unexpected external "${imp.path}"`);
      if (imp.path.startsWith('@electric-sql/pglite')) pgliteImported = true;
    }
  }
  if (!pgliteImported) throw new Error('guard (a): @electric-sql/pglite is not imported by the bundle');
}

/** (b) no dotenv (a stray cwd .env must never be read) and no unresolved workspace package. */
export function checkInputs(metafile) {
  for (const input of Object.keys(metafile.inputs)) {
    if (/node_modules\/dotenv\//.test(input)) throw new Error(`guard (b): dotenv is bundled (${input})`);
    if (/node_modules\/@fluid\/shared\//.test(input)) throw new Error(`guard (b): unresolved @fluid/shared (${input})`);
  }
}

/** (c) no asset located relative to import.meta.url: it would break once chunks move to dist/chunks. */
export function checkBundleText(files) {
  const urlLiteral = /new URL\(\s*(["'`])([^"'`]+)\1\s*,\s*import\.meta\.url/g;
  const readFromMeta = /readFile(?:Sync)?\([^)]*import\.meta/g;
  for (const [file, text] of Object.entries(files)) {
    for (const m of text.matchAll(urlLiteral)) {
      if (!ALLOWED_IMPORT_META_PATHS.includes(m[2])) throw new Error(`guard (c): ${file} loads "${m[2]}" relative to import.meta.url`);
    }
    if (readFromMeta.test(text)) throw new Error(`guard (c): ${file} reads a file relative to import.meta`);
  }
}

/** (d) generated client and CLI version must match, (e) pglite pin must match what the BFF resolves. */
export function checkVersions({ bffDir, publishManifest }) {
  const pkgVersion = (name) => readJson(join(bffDir, 'node_modules', name, 'package.json')).version;
  const client = pkgVersion('@prisma/client');
  const cli = pkgVersion('prisma');
  if (client !== cli) throw new Error(`guard (d): @prisma/client ${client} != prisma ${cli}`);
  const pinned = publishManifest.dependencies['@electric-sql/pglite'];
  const resolved = pkgVersion('@electric-sql/pglite');
  if (pinned !== resolved) throw new Error(`guard (e): publish manifest pins pglite ${pinned}, apps/bff resolves ${resolved}`);
}

/** (f) the package content the CLI needs at runtime. */
export function checkStaged(distDir) {
  if (!existsSync(join(distDir, 'web', 'index.html'))) throw new Error('guard (f): dist/web/index.html is missing');
  if (existsSync(join(distDir, 'web', 'config.js'))) throw new Error('guard (f): dist/web/config.js must not ship');
  const viewer = join(distDir, 'viewer.html');
  if (!existsSync(viewer)) throw new Error('guard (f): dist/viewer.html is missing');
  if (!readFileSync(viewer, 'utf8').includes(VIEWER_MARKER)) throw new Error('guard (f): dist/viewer.html is not the fluid viewer');
  const migrations = existsSync(join(distDir, 'migrations')) ? readdirSync(join(distDir, 'migrations')) : [];
  if (!migrations.some((m) => existsSync(join(distDir, 'migrations', m, 'migration.sql')))) {
    throw new Error('guard (f): no migration was copied');
  }
}
