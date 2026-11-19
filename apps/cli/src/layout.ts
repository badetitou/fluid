import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export interface PackageLayout {
  root: string;
  staticDir: string;
  migrationsDir: string;
  manifestPath: string;
  /** The MCP App viewer: one self-contained HTML file. */
  viewerPath: string;
}

/** Paths of the installed package, derived from the entry file URL (dist/fluid.mjs) only. */
export function packageLayout(entryUrl: string): PackageLayout {
  const root = dirname(fileURLToPath(entryUrl));
  return {
    root,
    staticDir: join(root, 'web'),
    migrationsDir: join(root, 'migrations'),
    manifestPath: join(root, '..', 'package.json'),
    viewerPath: join(root, 'viewer.html'),
  };
}

export interface LayoutFs {
  exists: (path: string) => boolean;
  list: (dir: string) => string[];
}

/** Entries a healthy install must have; empty when everything is there. */
export function missingLayoutEntries(layout: PackageLayout, fs: LayoutFs): string[] {
  const missing: string[] = [];
  if (!fs.exists(join(layout.staticDir, 'index.html'))) missing.push('web/index.html');
  const hasMigration = fs
    .list(layout.migrationsDir)
    .some((name) => fs.exists(join(layout.migrationsDir, name, 'migration.sql')));
  if (!hasMigration) missing.push('migrations/*/migration.sql');
  return missing;
}
