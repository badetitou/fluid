// Builds the publishable package into apps/cli/pkg (see package.publish.json). Run via `pnpm pack:cli`.
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { checkBundleText, checkExternals, checkInputs, checkStaged, checkVersions } from './guards.mjs';

const CLI = join(dirname(fileURLToPath(import.meta.url)), '..');
const REPO = join(CLI, '..', '..');
const PKG = join(CLI, 'pkg');
const DIST = join(PKG, 'dist');
const FRONTEND_DIST = join(REPO, 'apps', 'frontend', 'dist');
const BFF = join(REPO, 'apps', 'bff');
const PRISMA_CLIENT = join(BFF, 'src', 'generated', 'prisma');
const MIGRATIONS = join(BFF, 'prisma', 'migrations');

// Gives bundled CJS code require/__filename/__dirname in the ESM output. Paths for assets are
// never derived from chunks (they live in dist/chunks): only the entry computes them.
const BANNER = `import { createRequire as __fluidCreateRequire } from 'node:module';
import { fileURLToPath as __fluidFileURLToPath } from 'node:url';
import { dirname as __fluidDirname } from 'node:path';
const require = __fluidCreateRequire(import.meta.url);
const __filename = __fluidFileURLToPath(import.meta.url);
const __dirname = __fluidDirname(__filename);`;

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)],
  );
}

/** name@version plus license/notice files of every package that ended up in the bundle. */
function thirdPartyLicenses(metafile) {
  const dirs = new Map();
  for (const input of Object.keys(metafile.inputs)) {
    const idx = input.lastIndexOf('node_modules/');
    if (idx === -1) continue;
    const rest = input.slice(idx + 'node_modules/'.length).split('/');
    const name = rest[0].startsWith('@') ? `${rest[0]}/${rest[1]}` : rest[0];
    const dir = resolve(CLI, input.slice(0, idx + 'node_modules/'.length), name);
    dirs.set(name, dir);
  }
  const sections = [];
  for (const [name, dir] of [...dirs].sort(([a], [b]) => a.localeCompare(b))) {
    if (!existsSync(join(dir, 'package.json'))) continue;
    const { version, license } = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
    const files = readdirSync(dir).filter((f) => /^(licen[sc]e|notice)/i.test(f));
    const body = files.map((f) => readFileSync(join(dir, f), 'utf8').trim()).join('\n\n');
    sections.push(`${name}@${version} (${license ?? 'see below'})\n${'-'.repeat(40)}\n${body || '(no license file shipped)'}`);
  }
  return `Third-party software bundled in @badetitou/fluid (@electric-sql/pglite is installed separately).\n\n${sections.join('\n\n\n')}\n`;
}

rmSync(PKG, { recursive: true, force: true });
if (!existsSync(join(FRONTEND_DIST, 'index.html')) || !existsSync(PRISMA_CLIENT)) {
  throw new Error('frontend build or generated Prisma client is missing: run `pnpm pack:cli`');
}

const result = await build({
  absWorkingDir: CLI,
  entryPoints: { fluid: 'src/bin.ts' },
  outdir: 'pkg/dist',
  bundle: true,
  splitting: true,
  format: 'esm',
  platform: 'node',
  target: 'node22',
  outExtension: { '.js': '.mjs' },
  chunkNames: 'chunks/[name]-[hash]',
  external: ['@electric-sql/pglite', 'pg-native', 'pg-cloudflare'],
  banner: { js: BANNER },
  minify: false,
  legalComments: 'none',
  metafile: true,
  logLevel: 'warning',
});

const outputs = walk(DIST).filter((f) => f.endsWith('.mjs'));
for (const file of outputs) execFileSync(process.execPath, ['--check', file]);

cpSync(FRONTEND_DIST, join(DIST, 'web'), { recursive: true, filter: (src) => src !== join(FRONTEND_DIST, 'config.js') });
for (const name of readdirSync(MIGRATIONS)) {
  const sql = join(MIGRATIONS, name, 'migration.sql');
  if (!existsSync(sql)) continue;
  mkdirSync(join(DIST, 'migrations', name), { recursive: true });
  cpSync(sql, join(DIST, 'migrations', name, 'migration.sql'));
}
cpSync(join(CLI, 'package.publish.json'), join(PKG, 'package.json'));
cpSync(join(CLI, 'README.md'), join(PKG, 'README.md'));
cpSync(join(REPO, 'LICENSE'), join(PKG, 'LICENSE'));
writeFileSync(join(PKG, 'THIRD_PARTY_LICENSES.txt'), thirdPartyLicenses(result.metafile));

const publishManifest = JSON.parse(readFileSync(join(CLI, 'package.publish.json'), 'utf8'));
checkExternals(result.metafile);
checkInputs(result.metafile);
checkBundleText(Object.fromEntries(outputs.map((f) => [f, readFileSync(f, 'utf8')])));
checkVersions({ bffDir: BFF, publishManifest });
checkStaged(DIST);
console.log(`built ${outputs.length} bundles into ${PKG}`);
