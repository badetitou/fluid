#!/usr/bin/env node
// Test double of badetitou/Model's `model-graphql <root> [--host H] [--port N] [--no-scip]`.
// Behaviour is chosen by the root dir's base name:
//   ok-*       serves POST /graphql at once
//   slow-*     serves after 400 ms
//   crash-*    writes to stderr (with the root path) and exits with code 3
//   never-*    stays alive without ever listening
//   stubborn-* serves, but ignores SIGTERM (only SIGKILL stops it)
// It writes its pid to `<root>/fake.pid` on start-up.
// Every answer carries `argv` so tests can check the arguments it was given.
import { createServer } from 'node:http';
import { writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';

const argv = process.argv.slice(2);
const root = argv[0] ?? '';
const option = (name) => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
};
const mode = basename(root).split('-')[0];
const host = option('--host') ?? '127.0.0.1';
const port = Number(option('--port') ?? 8080);

writeFileSync(join(root, 'fake.pid'), String(process.pid));

if (mode === 'crash') {
  process.stderr.write(
    `indexing ${root}\nerror: cannot read ${root}/Cargo.toml\nfatal: giving up\n`,
  );
  process.exit(3);
}
if (mode === 'stubborn') process.on('SIGTERM', () => {});
if (mode === 'never') setInterval(() => {}, 1000);

const serve = () =>
  createServer((req, res) => {
    if (req.method !== 'POST' || req.url !== '/graphql') {
      res.writeHead(404).end();
      return;
    }
    req.resume();
    req.on('end', () => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ data: { __typename: 'Query', argv, pid: process.pid } }));
    });
  }).listen(port, host);

if (mode === 'ok' || mode === 'stubborn') serve();
if (mode === 'slow') setTimeout(serve, 400);
