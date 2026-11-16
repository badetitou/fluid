import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { missingLayoutEntries, packageLayout, type LayoutFs } from './layout';

const layout = packageLayout('file:///pkg/dist/fluid.mjs');

function fakeFs(files: string[]): LayoutFs {
  return {
    exists: (p) => files.includes(p),
    list: (dir) => files.filter((f) => f.startsWith(dir + '/')).map((f) => f.slice(dir.length + 1).split('/')[0]),
  };
}

describe('layout', () => {
  it('derives every path from the entry url', () => {
    expect(layout).toEqual({
      root: '/pkg/dist',
      staticDir: '/pkg/dist/web',
      migrationsDir: '/pkg/dist/migrations',
      manifestPath: '/pkg/package.json',
    });
  });
  it('accepts a complete install', () => {
    const fs = fakeFs([join(layout.staticDir, 'index.html'), join(layout.migrationsDir, '1_init', 'migration.sql')]);
    expect(missingLayoutEntries(layout, fs)).toEqual([]);
  });
  it('reports what is missing', () => {
    expect(missingLayoutEntries(layout, fakeFs([]))).toEqual(['web/index.html', 'migrations/*/migration.sql']);
  });
});
