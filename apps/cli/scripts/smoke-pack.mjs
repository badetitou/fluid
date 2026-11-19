// Smoke test of the packed tarball, with no dependency: `pnpm test:pack` (after `pnpm pack:cli`).
//   node smoke-pack.mjs [--tgz path]   tarball defaults to the newest out/*.tgz
//   node smoke-pack.mjs --stdin        tarball piped on stdin (used inside docker, see README of the issue)
// Linux run: docker create the container, docker cp `scripts/` and `test/` plus the tarball, then
// `docker exec ... node scripts/smoke-pack.mjs --tgz /path/to.tgz`.
import { execFileSync, spawn } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const FAKE_CLAUDE = join(HERE, '..', 'test', 'fixtures', 'fake-claude.mjs');
const tmp = mkdtempSync(join(tmpdir(), 'fluid-smoke-'));
const log = (msg) => console.log(`smoke: ${msg}`);
const fail = (msg) => {
  throw new Error(msg);
};
const check = (cond, msg) => {
  if (!cond) fail(msg);
  log(`ok - ${msg}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const run = (cmd, args, cwd) => execFileSync(cmd, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

function findTarball() {
  const i = process.argv.indexOf('--tgz');
  if (i !== -1) return resolve(process.argv[i + 1]);
  if (process.argv.includes('--stdin')) {
    const file = join(tmp, 'stdin.tgz');
    writeFileSync(file, readFileSync(0));
    return file;
  }
  const out = join(HERE, '..', '..', '..', 'out');
  const tgz = existsSync(out) ? readdirSync(out).filter((f) => f.endsWith('.tgz')) : [];
  if (tgz.length === 0) fail('no tarball in out/: run `pnpm pack:cli` first');
  return join(out, tgz.map((f) => [f, statSync(join(out, f)).mtimeMs]).sort((a, b) => b[1] - a[1])[0][0]);
}

/** Starts fluid; resolves once it prints its URL, or reports its exit if it dies first. */
function startFluid(bin, args, { cwd, env }) {
  const child = spawn(bin, args, { cwd, env: { PATH: process.env.PATH, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '';
  const exited = new Promise((r) => child.on('exit', (code, signal) => r({ code, signal })));
  const started = new Promise((resolveStart) => {
    const onData = (chunk) => {
      output += chunk;
      const m = output.match(/fluid running at (http:\/\/\S+)/);
      if (m) resolveStart({ url: m[1] });
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', (c) => (output += c));
    exited.then((e) => resolveStart({ exit: e }));
  });
  const timeout = sleep(30_000).then(() => ({ timeout: true }));
  return Promise.race([started, timeout]).then((r) => ({ child, exited, output: () => output, ...r }));
}

async function stop(proc) {
  proc.child.kill('SIGINT');
  const exit = await Promise.race([proc.exited, sleep(10_000).then(() => null)]);
  if (exit === null) {
    proc.child.kill('SIGKILL');
    fail('fluid did not exit within 10s of SIGINT');
  }
  return exit;
}

const get = (url, path) => fetch(url + path).then(async (r) => ({ status: r.status, type: r.headers.get('content-type') ?? '', text: await r.text() }));

async function httpChecks(url) {
  const health = await get(url, '/health');
  check(health.status === 200, 'GET /health is 200');
  const root = await get(url, '/');
  check(root.type.includes('text/html'), 'GET / is HTML');
  const config = await get(url, '/config.js');
  check(/"bffUrl": ""/.test(config.text), '/config.js points at the same origin');
  const asset = root.text.match(/\/assets\/[^"']+/)?.[0];
  check(asset && (await get(url, asset)).status === 200, `asset ${asset} is served`);
  check((await get(url, '/some/spa/route')).type.includes('text/html'), 'SPA route falls back to index.html');
  const nope = await get(url, '/api/nope');
  check(nope.status === 404 && nope.type.includes('json'), '/api/nope is a JSON 404');
}

/** `fluid mcp` over stdio against a dead URL (or a live fluid): initialize, tools/list and one tool error; stdout must be protocol only. */
async function mcpChecks(bin, cwd, env, url = 'http://127.0.0.1:1') {
  const live = url !== 'http://127.0.0.1:1';
  const child = spawn(bin, ['mcp', '--url', url], { cwd, env: { PATH: process.env.PATH, ...env }, stdio: ['pipe', 'pipe', 'pipe'] });
  const lines = [];
  let buffer = '';
  child.stdout.on('data', (c) => {
    buffer += c;
    const parts = buffer.split('\n');
    buffer = parts.pop();
    lines.push(...parts.filter(Boolean));
  });
  const send = (msg) => child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', ...msg })}\n`);
  const reply = async (id) => {
    for (let i = 0; i < 300; i++) {
      const found = lines.map((l) => JSON.parse(l)).find((m) => m.id === id);
      if (found) return found;
      await sleep(100);
    }
    return fail(`no MCP answer for request ${id}`);
  };
  send({ id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'smoke', version: '0' } } });
  check((await reply(1)).result?.serverInfo?.name === 'fluid', 'fluid mcp answers initialize');
  send({ method: 'notifications/initialized' });
  send({ id: 2, method: 'tools/list' });
  const names = (await reply(2)).result.tools.map((t) => t.name).sort().join();
  check(names === 'list_sources,list_views,run_queries,show_view', `fluid mcp lists its tools (${names})`);
  if (live) {
    send({ id: 3, method: 'tools/call', params: { name: 'list_views', arguments: {} } });
    const views = (await reply(3)).result;
    check(!views.isError && views.structuredContent.items.some((v) => v.title === 'Smoke view'), 'list_views over the live fluid returns the smoke view');
  } else {
    send({ id: 3, method: 'tools/call', params: { name: 'list_sources', arguments: {} } });
    const call = (await reply(3)).result;
    check(call.isError === true && call.content[0].text.includes('is not reachable'), 'unreachable fluid is a tool error');
  }
  check(lines.every((l) => JSON.parse(l).jsonrpc === '2.0'), 'every stdout line of fluid mcp is JSON-RPC');
  child.stdin.end();
  const exit = await Promise.race([new Promise((r) => child.on('exit', (code) => r(code))), sleep(10_000).then(() => null)]);
  check(exit === 0, 'fluid mcp exits 0 when stdin closes');
}

const VIEW = { spec: { id: 'smoke', concept: 'Character', title: 'Smoke view', queries: {}, widgets: [] } };
const postView = (url) =>
  fetch(`${url}/api/views`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(VIEW) });
const hasView = async (url) => (await get(url, '/api/views')).text.includes('Smoke view');

async function main() {
  const tgz = findTarball();
  log(`tarball ${tgz} (${(statSync(tgz).size / 1e6).toFixed(1)} MB)`);

  const listing = run('tar', ['-tzf', tgz]).trim().split('\n');
  check(listing.includes('package/dist/fluid.mjs'), 'tarball has dist/fluid.mjs');
  check(listing.includes('package/dist/web/index.html'), 'tarball has dist/web/index.html');
  check(listing.some((f) => /^package\/dist\/migrations\/[^/]+\/migration\.sql$/.test(f)), 'tarball has migrations');
  check(!listing.some((f) => /\/src\/|\.env|node_modules|config\.js$/.test(f)), 'tarball has no src, .env, node_modules or config.js');
  check(statSync(tgz).size < 10e6, 'tarball is under 10 MB');
  log(`${listing.length} files in tarball`);

  const project = join(tmp, 'project');
  mkdirSync(project);
  run('npm', ['init', '-y'], project);
  run('npm', ['install', tgz, '--no-audit', '--no-fund', '--loglevel=error'], project);
  const nm = join(project, 'node_modules');
  const installed = readdirSync(nm)
    .filter((n) => !n.startsWith('.'))
    .flatMap((n) => (n.startsWith('@') ? readdirSync(join(nm, n)).map((m) => `${n}/${m}`) : [n]))
    .sort();
  check(installed.join() === '@badetitou/fluid,@electric-sql/pglite', `only two packages installed (${installed.join(', ')})`);
  log(`install footprint ${run('du', ['-sk', nm]).split('\t')[0]} KB`);

  writeFileSync(join(project, '.env'), 'DATABASE_URL=postgres://invalid:1/x\n');
  const bin = join(nm, '.bin', 'fluid');
  const data = join(tmp, 'data');
  const env = { HOME: join(tmp, 'home') };
  const args = ['--port', '0', '--no-open', '--data-dir', data];

  const first = await startFluid(bin, args, { cwd: project, env });
  if (!first.url) fail(`fluid did not start: ${JSON.stringify(first.exit ?? 'timeout')}\n${first.output()}`);
  check(first.output().includes('storage: PGlite'), 'poison .env ignored, PGlite storage');
  check(existsSync(join(data, 'fluid.lock')), '--data-dir honoured: lock file in the given dir');
  await httpChecks(first.url);
  check((await postView(first.url)).status < 300 && (await hasView(first.url)), 'a view round-trips');

  const second = await startFluid(bin, args, { cwd: project, env });
  check(second.exit?.code === 1 && second.output().includes('another fluid'), 'second instance on the same data dir exits 1');

  const stopped = await stop(first);
  check(stopped.code === 0 && !existsSync(join(data, 'fluid.lock')), 'SIGINT: exit 0 and lock released');

  const again = await startFluid(bin, args, { cwd: project, env });
  if (!again.url) fail(`restart failed:\n${again.output()}`);
  check(await hasView(again.url), 'the view persisted across a restart');
  await mcpChecks(bin, project, env, again.url);
  await stop(again);

  chmodSync(FAKE_CLAUDE, 0o755);
  const claudeEnv = { ...env, LLM_PROVIDER: 'claude-code', CLAUDE_CODE_BIN: FAKE_CLAUDE };
  const claude = await startFluid(bin, args, { cwd: project, env: claudeEnv });
  if (!claude.url) fail(`claude-code start failed:\n${claude.output()}`);
  const llm = JSON.parse((await get(claude.url, '/api/llm/config')).text);
  check(llm.providers['claude-code'].available === true, 'claude-code reported available');
  const body = { concept: 'Character', prompt: 'show them', config: { provider: 'claude-code' },
    schema: { name: 'Character', listQuery: 'characters', fields: [{ name: 'name', typeName: 'String', typeKind: 'SCALAR', isScalar: true }] } };
  const gen = await fetch(`${claude.url}/api/llm/generate-view`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const generated = await gen.json();
  check(gen.status === 200 && generated.spec?.title === 'Fake Claude view', 'generate-view returns the canned view');
  await stop(claude);

  await mcpChecks(bin, project, env);

  const other = join(tmp, 'other');
  mkdirSync(other);
  const version = run('npx', ['--yes', `--package=${tgz}`, 'fluid', '--version'], other).trim();
  check(/^\d+\.\d+\.\d+/.test(version), `npx --package form runs (fluid --version = ${version})`);
  log('all checks passed');
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(`smoke: FAILED: ${err.message}`);
    process.exit(1);
  },
);
