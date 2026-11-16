#!/usr/bin/env node
// Entry of the published package. Only node: imports here: the version gate must run
// before any dependency loads, and `main` is imported lazily for that reason.
const major = Number(process.versions.node.split('.')[0]);
if (major < 22) {
  console.error(`fluid needs Node.js 22 or later (found v${process.versions.node})`);
  process.exit(1);
}

const { main } = await import('./main');
process.exitCode = await main(process.argv.slice(2), process.env, import.meta.url);
