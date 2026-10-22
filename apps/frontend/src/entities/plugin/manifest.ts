import { z } from 'zod';
import { externalWidgetContractSchema } from '@fluid/shared';
import { themeDefinitionSchema } from '../../shared/theme';

/**
 * The manifest of an installable plugin (`manifest.json`). Themes are plain
 * data; widgets need the plugin's `module`, an ES module that renders them.
 */
export const pluginManifestSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9][a-z0-9-]*$/, 'Plugin ids are lowercase words joined by "-"'),
    name: z.string().min(1).max(60),
    version: z.string().min(1).max(30),
    description: z.string().max(500).optional(),
    author: z.string().max(100).optional(),
    homepage: z.url().optional(),
    /** ES module rendering the widgets, relative to the manifest. */
    module: z.string().min(1).optional(),
    contributes: z.object({
      themes: z.array(themeDefinitionSchema).optional(),
      widgets: z.array(externalWidgetContractSchema).optional(),
    }),
  })
  .superRefine((m, ctx) => {
    const widgets = m.contributes.widgets ?? [];
    if (widgets.length > 0 && !m.module) {
      ctx.addIssue({
        code: 'custom',
        path: ['module'],
        message: 'A plugin contributing widgets needs a "module"',
      });
    }
    widgets.forEach((w, i) => {
      if (!w.type.startsWith(`${m.id}/`)) {
        ctx.addIssue({
          code: 'custom',
          path: ['contributes', 'widgets', i, 'type'],
          message: `Widget types of plugin "${m.id}" start with "${m.id}/"`,
        });
      }
    });
    if (!m.contributes.themes?.length && !widgets.length) {
      ctx.addIssue({
        code: 'custom',
        path: ['contributes'],
        message: 'A plugin contributes themes or widgets',
      });
    }
  });
export type PluginManifest = z.infer<typeof pluginManifestSchema>;

/** What a plugin contributes, for display. */
export function contributionKinds(manifest: PluginManifest): Array<'themes' | 'widgets'> {
  const kinds: Array<'themes' | 'widgets'> = [];
  if (manifest.contributes.themes?.length) kinds.push('themes');
  if (manifest.contributes.widgets?.length) kinds.push('widgets');
  return kinds;
}
