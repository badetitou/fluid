#!/usr/bin/env node
// Architecture health metrics for fluid. Dependency-free on purpose so it runs
// anywhere (CI, the practices agent, a dev laptop) with plain `node`.
//
//   node scripts/arch-metrics.mjs          → human-readable report
//   node scripts/arch-metrics.mjs --json   → machine-readable (for the health log)
//
// Thresholds mirror the rules in CLAUDE.md; change both together.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const SOURCE_DIRS = ['apps/frontend/src', 'apps/bff/src', 'apps/cli/src', 'packages/shared/src'];

const LIMITS = {
  componentLines: 150, // a .tsx file
  moduleLines: 250, // a .ts file
  inlineStylesPerFile: 3,
};

// Only these frontend folders may talk to the BFF directly; components go through hooks.
const BFF_CLIENT_ALLOWED = ['apps/frontend/src/bff/', 'apps/frontend/src/hooks/', 'apps/frontend/src/entities/'];

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    // Prisma clients are generated: not ours to keep small.
    if (name === 'node_modules' || name === 'generated' || name.startsWith('.')) continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...walk(path));
    else if (/\.(ts|tsx)$/.test(name) && !/\.d\.ts$/.test(name)) out.push(path);
  }
  return out;
}

const count = (text, re) => (text.match(re) ?? []).length;

const files = SOURCE_DIRS.flatMap((d) => {
  try {
    return walk(join(ROOT, d));
  } catch {
    return [];
  }
}).map((abs) => {
  const path = relative(ROOT, abs).split(sep).join('/');
  const text = readFileSync(abs, 'utf8');
  const isTest = /\.test\.tsx?$/.test(path);
  return {
    path,
    isTest,
    isComponent: path.endsWith('.tsx') && !isTest,
    lines: text.split('\n').length,
    inlineStyles: count(text, /style=\{\{/g),
    anys: count(text, /:\s*any\b|as any\b|<any>/g),
    todos: count(text, /\b(TODO|FIXME|HACK)\b/g),
    // Type-only imports are fine: only runtime calls to the BFF couple a component to it.
    importsBffClient: /^import (?!type )[^;]*from ['"](\.{1,2}\/)+bff\/client['"]/m.test(text),
    imports: [...text.matchAll(/from ['"](\.{1,2}\/[^'"]+)['"]/g)].map((m) => m[1]),
  };
});

const src = files.filter((f) => !f.isTest);
const oversized = src
  .filter((f) => f.lines > (f.isComponent ? LIMITS.componentLines : LIMITS.moduleLines))
  .sort((a, b) => b.lines - a.lines);
const styleHeavy = src.filter((f) => f.inlineStyles > LIMITS.inlineStylesPerFile).sort((a, b) => b.inlineStyles - a.inlineStyles);
const bffLeaks = src.filter(
  (f) => f.importsBffClient && f.path.startsWith('apps/frontend/') && !BFF_CLIENT_ALLOWED.some((p) => f.path.startsWith(p)),
);
// Layering (CLAUDE.md rule 2): app → pages → features → entities → engine → shared,
// imports go down only. `views/` is today's engine; `components/` is the legacy UI folder.
const FRONTEND = 'apps/frontend/src/';
const FORBIDDEN_IMPORTS = {
  'views/': ['/components/', '/features/', '/pages/', '/app/', '/entities/'],
  'entities/': ['/components/', '/features/', '/pages/', '/app/'],
  'features/': ['/pages/', '/app/'],
  'pages/': ['/app/'],
  'shared/': ['/components/', '/features/', '/pages/', '/app/', '/entities/', '/views/'],
};
const layerViolations = src.filter((f) => {
  if (!f.path.startsWith(FRONTEND)) return false;
  const rel = f.path.slice(FRONTEND.length);
  const layer = Object.keys(FORBIDDEN_IMPORTS).find((l) => rel.startsWith(l));
  return layer && f.imports.some((i) => FORBIDDEN_IMPORTS[layer].some((bad) => `/${i}`.includes(bad)));
});

const frontendSrc = src.filter((f) => f.path.startsWith('apps/frontend/'));
const testedRatio =
  frontendSrc.length === 0
    ? 0
    : files.filter((f) => f.isTest && f.path.startsWith('apps/frontend/')).length / frontendSrc.length;

const report = {
  date: new Date().toISOString().slice(0, 10),
  totals: {
    sourceFiles: src.length,
    sourceLines: src.reduce((n, f) => n + f.lines, 0),
    largestFile: oversized[0] ? `${oversized[0].path} (${oversized[0].lines})` : null,
    oversizedFiles: oversized.length,
    styleHeavyFiles: styleHeavy.length,
    inlineStyles: src.reduce((n, f) => n + f.inlineStyles, 0),
    anys: src.reduce((n, f) => n + f.anys, 0),
    todos: src.reduce((n, f) => n + f.todos, 0),
    bffClientLeaks: bffLeaks.length,
    layerViolations: layerViolations.length,
    frontendTestRatio: Number(testedRatio.toFixed(2)),
  },
  oversized: oversized.map((f) => ({ path: f.path, lines: f.lines })),
  styleHeavy: styleHeavy.map((f) => ({ path: f.path, inlineStyles: f.inlineStyles })),
  bffClientLeaks: bffLeaks.map((f) => f.path),
  layerViolations: layerViolations.map((f) => f.path),
  anys: src.filter((f) => f.anys > 0).map((f) => ({ path: f.path, anys: f.anys })),
};

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(report, null, 2));
} else {
  const t = report.totals;
  console.log(`fluid architecture metrics — ${report.date}\n`);
  console.log(`  source files ............ ${t.sourceFiles} (${t.sourceLines} lines)`);
  console.log(`  oversized files ......... ${t.oversizedFiles}  (tsx > ${LIMITS.componentLines}, ts > ${LIMITS.moduleLines})`);
  console.log(`  style-heavy files ....... ${t.styleHeavyFiles}  (${t.inlineStyles} inline style objects)`);
  console.log(`  bffClient in components . ${t.bffClientLeaks}`);
  console.log(`  layer violations ........ ${t.layerViolations}`);
  console.log(`  explicit any ............ ${t.anys}`);
  console.log(`  TODO/FIXME .............. ${t.todos}`);
  console.log(`  frontend test ratio ..... ${t.frontendTestRatio}`);
  const list = (title, rows) => rows.length && console.log(`\n${title}\n${rows.map((r) => `  - ${r}`).join('\n')}`);
  list('Oversized:', report.oversized.map((f) => `${f.path} (${f.lines})`));
  list('Style-heavy:', report.styleHeavy.map((f) => `${f.path} (${f.inlineStyles})`));
  list('bffClient outside hooks/entities:', report.bffClientLeaks);
  list('Imports going up a layer:', report.layerViolations);
}
