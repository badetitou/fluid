import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkWidgetsAgainstCatalog, widgetSchema } from '@fluid/shared';
import { pluginManifestSchema } from './manifest';

// Tests run from the frontend package (see vite.config.ts).
const read = (id: string) =>
  JSON.parse(readFileSync(resolve('public/plugins', id, 'manifest.json'), 'utf8'));

describe('example plugins (public/plugins)', () => {
  it.each(['tagcloud', 'nord-theme', 'local-sources'])('%s has a valid manifest', (id) => {
    const parsed = pluginManifestSchema.safeParse(read(id));
    expect(parsed.error?.issues ?? []).toEqual([]);
  });

  it('tagcloud ships a valid example, checked against its own schema', () => {
    const manifest = pluginManifestSchema.parse(read('tagcloud'));
    const contract = manifest.contributes.widgets![0];
    expect(widgetSchema.safeParse(contract.example).success).toBe(true);
    expect(checkWidgetsAgainstCatalog([contract.example], [contract])).toEqual([]);
    expect(
      checkWidgetsAgainstCatalog([{ ...contract.example, field: undefined }], [contract]),
    ).not.toEqual([]);
  });
});
